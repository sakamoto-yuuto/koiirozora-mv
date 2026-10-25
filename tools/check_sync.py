"""Sync self-check for an exported MP4.

1. audio mux lag   : cross-correlate the MP4's audio with the source wav (should be ~0 ms)
2. video cue lag   : per-frame brightness of the MP4 vs. the cue times where the renderer
                     fires a flash (power-on, drop, enter) -> the brightness jump must sit on that frame
3. lyric vs vocal  : cross-correlate LRC line starts with a vocal-band onset envelope to
                     estimate whether the whole LRC is early/late against the singing

All times printed are SONG time (audio start = 0). The film starts before the song (config.json
safety.preroll: a silent warning page); the exporter writes the song time of the file's first frame into the
mp4 (`comment` tag: mv_start=...), and that offset is taken into account here.

Usage:  .venv\\Scripts\\python tools/check_sync.py out/sample_0-41_540p30.mp4
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
FF = "ffmpeg"
try:
    subprocess.run([FF, "-version"], capture_output=True, check=True)
except Exception:
    FF = str(ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe")


def main():
    mp4 = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "out" / "sample_0-41_540p30.mp4")
    feats = json.loads((ROOT / CFG["paths"]["features"]).read_text(encoding="utf-8"))
    lyr = json.loads((ROOT / CFG["paths"]["lyrics"]).read_text(encoding="utf-8"))
    src, sr = librosa.load(str(ROOT / CFG["paths"]["audio"]), sr=None, mono=True)

    # --- 1. audio mux lag --------------------------------------------------------
    probe = subprocess.run([FF, "-i", str(mp4)], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    m = re.search(r"mv_start=(-?[0-9.]+)", probe)
    start = float(m.group(1)) if m else 0.0                      # song time of the file's first frame
    print(f"[0] file starts at song time {start:+.3f} s" + ("" if m else "  (no mv_start tag: assumed 0)"))
    raw = subprocess.run([FF, "-v", "error", "-i", str(mp4), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    dec = np.frombuffer(raw, dtype=np.float32)
    # line the two up on song time: skip the silent lead of the file, or the part of the song before it
    dec0 = dec[int(round(max(0.0, -start) * sr)):]
    src0 = src[int(round(max(0.0, start) * sr)):]
    n = min(len(dec0), len(src0), sr * 30)
    a, b = dec0[:n], src0[:n]
    lags = np.arange(-2400, 2401)
    core = slice(2400, n - 2400)
    xc = [float(np.dot(a[core], b[2400 + l: n - 2400 + l])) for l in lags]
    lag = lags[int(np.argmax(xc))]          # >0: mp4 audio is EARLIER than source by lag samples
    print(f"[1] audio in mp4 vs source wav: lag = {-lag / sr * 1000:+.2f} ms  (decoded {len(dec) / sr:.3f} s)")

    # --- 2. video cue lag ----------------------------------------------------------
    fps = float(next(p for p in probe.split(",") if " fps" in p).split()[0])
    raw = subprocess.run([FF, "-v", "error", "-i", str(mp4), "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    luma = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 64 * 36).mean(axis=1)
    dur = len(luma) / fps
    grid = feats["grid"]
    bar = lambda k: grid["t0"] + grid["period"] * (feats["downbeatPhase"] + 4 * k)
    cues = {"power-on (first transient)": 0.209, "drop (bar 8)": bar(8), "enter (bar 9)": bar(9)}
    off = CFG["timing"]["offset"]
    print(f"[2] video: {len(luma)} frames @ {fps:g} fps ({dur:.3f} s); brightness jump vs cue time")
    for name, tc in cues.items():
        tc += off
        if tc - start > dur - 0.3 or tc - start < 0.2:
            continue
        f0 = int(np.ceil((tc - start) * fps - 1e-6))             # first frame at/after the cue
        w = np.arange(max(1, f0 - 6), f0 + 7)
        jump = w[int(np.argmax(luma[w] - luma[w - 1]))]          # frame with the largest brightness rise
        print(f"      {name:28s} cue {tc:7.3f}s (song) -> expected frame {f0}, brightest rise at frame {jump} "
              f"({(jump - f0) / fps * 1000:+.0f} ms)")

    # --- 3. LRC vs vocal onsets ------------------------------------------------------
    hop = 256
    harm = librosa.effects.harmonic(src, margin=2.0)
    S = np.abs(librosa.stft(harm, n_fft=2048, hop_length=hop))
    fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
    band = S[(fr >= 300) & (fr <= 3400)]
    env = np.maximum(0, np.diff(np.log1p(band * 50).sum(axis=0), prepend=0))    # vocal-band spectral flux
    env_t = np.arange(len(env)) * hop / sr
    starts = np.array([l["start"] for l in lyr["lines"]])
    lag_s = np.arange(-0.40, 0.401, 0.005)
    score = np.array([np.interp(starts + d, env_t, env).mean() for d in lag_s])
    sm = np.convolve(score, np.ones(5) / 5, mode="same")
    best = lag_s[int(np.argmax(sm))]
    z = (sm.max() - sm.mean()) / (sm.std() + 1e-9)
    print(f"[3] LRC vs vocal-band onsets: best lag = {best * 1000:+.0f} ms (peak z={z:.1f}); "
          f">0 means singing starts AFTER the LRC time")
    near = []                                                    # per-line nearest onset peak within +-150 ms
    for s in starts:
        m = (env_t >= s - 0.15) & (env_t <= s + 0.15)
        near.append(env_t[m][int(np.argmax(env[m]))] - s)
    near = np.array(near)
    print(f"      per-line nearest onset: median {np.median(near) * 1000:+.0f} ms, "
          f"IQR {np.percentile(near, 25) * 1000:+.0f}..{np.percentile(near, 75) * 1000:+.0f} ms")
    kw = np.array([l["start"] for l in lyr["lines"] if l["emphasis"]])
    d = (kw - grid["t0"]) / grid["period"]
    db = (d - np.round(d)) * grid["period"]
    print(f"      keyword lines vs beat grid: median {np.median(db) * 1000:+.0f} ms, "
          f"within +-60 ms: {(np.abs(db) <= 0.06).mean():.0%} of {len(kw)}")


if __name__ == "__main__":
    main()
