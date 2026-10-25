"""Audio analysis -> data/audio_features.json

Per-frame features are aligned to the video frame grid: frame i is centred at
t = i / fps seconds (hop = sr / fps samples, exact for 44100 Hz @ 60 fps).

Usage:  .venv\\Scripts\\python tools/analyze_audio.py
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
FPS = 60                 # analysis grid; the renderer interpolates for other frame rates
N_FFT = 2048
N_BANDS = 32             # down-sampled spectrum (mel bands)
BANDS_HZ = {"low": (20, 150), "mid": (150, 2500), "high": (2500, 16000)}


def norm01(x, pct=99.5):
    """Scale so the pct-th percentile maps to 1, clip to [0, 1]."""
    ref = np.percentile(x, pct) or 1.0
    return np.clip(x / ref, 0.0, 1.0)


def r3(x):
    return [round(float(v), 3) for v in x]


def main():
    wav = ROOT / CFG["paths"]["audio"]
    info = sf.info(str(wav))
    print(f"[wav] {wav.name}")
    print(f"      samplerate={info.samplerate} Hz  channels={info.channels}  "
          f"subtype={info.subtype}  duration={info.duration:.3f} s")

    y, sr = librosa.load(str(wav), sr=None, mono=True)
    hop = sr / FPS
    if hop != int(hop):
        sys.exit(f"sr {sr} is not divisible by {FPS}; resample first")
    hop = int(hop)
    n_frames = int(np.ceil(len(y) / hop))

    # --- per-frame spectrum / energy (frame i centred on i*hop) -------------
    S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=hop, center=True))[:, :n_frames]
    P = S ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
    rms = librosa.feature.rms(y=y, frame_length=N_FFT, hop_length=hop, center=True)[0][:n_frames]

    bands = {}
    for name, (lo, hi) in BANDS_HZ.items():
        sel = (freqs >= lo) & (freqs < hi)
        bands[name] = norm01(np.sqrt(P[sel].sum(axis=0)))

    mel = librosa.feature.melspectrogram(S=P, sr=sr, n_fft=N_FFT, n_mels=N_BANDS, fmin=30, fmax=16000)
    mel_db = librosa.power_to_db(mel, ref=np.max, top_db=70.0)        # [-70, 0]
    spec = np.clip((mel_db + 70.0) / 70.0 * 255.0, 0, 255).astype(np.uint8).T   # [frame][band]

    # --- beats / tempo / onsets (finer hop for timing precision) ------------
    hop_b = 256
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_b)
    tempo, beat_fr = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop_b, units="frames")
    tempo = float(np.atleast_1d(tempo)[0])
    beats = librosa.frames_to_time(beat_fr, sr=sr, hop_length=hop_b)

    tracked = beats

    # Constant-tempo grid search. The dynamic tracker drifts locally on this song, but the
    # track is sequenced at a fixed tempo, so we look for (bpm, t0) whose pulse train
    # collects the most onset energy over the whole file and use that grid as "beats".
    ibi_bpm = 60.0 / float(np.median(np.diff(tracked)))
    env_t = np.arange(len(oenv)) * hop_b / sr
    dur = len(y) / sr
    best = (-1.0, ibi_bpm, 0.0)
    for bpm in np.arange(round(ibi_bpm) - 1.0, round(ibi_bpm) + 1.0, 0.002):
        per = 60.0 / bpm
        for ph in np.arange(0.0, per, 0.004):
            sc = float(np.interp(np.arange(ph, dur, per), env_t, oenv).mean())
            if sc > best[0]:
                best = (sc, float(bpm), float(ph))
    _, g_bpm, g_t0 = best
    period = 60.0 / g_bpm
    beats = np.arange(g_t0, dur, period)
    # how many tracker beats sit on the grid (on-beat or off-beat) within 35 ms
    d = np.abs(((tracked - g_t0) / (period / 2) + 0.5) % 1.0 - 0.5) * (period / 2)
    grid = {"bpm": round(g_bpm, 3), "t0": round(g_t0, 4), "period": round(period, 6),
            "trackerAgreement": round(float((d < 0.035).mean()), 3)}

    # Downbeat guess: the beat phase (mod 4) carrying the most low-band energy.
    low_at_beat = np.interp(beats, np.arange(n_frames) / FPS, bands["low"])
    phase = int(np.argmax([low_at_beat[p::4].mean() for p in range(4)]))

    on_fr = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=hop_b, backtrack=False, units="frames")
    on_t = librosa.frames_to_time(on_fr, sr=sr, hop_length=hop_b)
    on_s = norm01(oenv[on_fr], pct=98)

    out = {
        "meta": {
            "file": wav.name, "sampleRate": sr, "channels": info.channels, "subtype": info.subtype,
            "duration": round(info.duration, 4), "fps": FPS, "frames": n_frames,
            "nFft": N_FFT, "bandsHz": BANDS_HZ, "spectrumBands": N_BANDS,
        },
        "bpm": grid["bpm"],
        "bpmTracker": round(tempo, 3),
        "grid": grid,
        "downbeatPhase": phase,          # beats[i] is a bar start when i % 4 == downbeatPhase
        "beats": r3(beats),              # constant-tempo grid
        "beatsTracked": r3(tracked),     # raw librosa tracker output, for reference
        "onsets": {"t": r3(on_t), "s": r3(on_s)},
        "rms": r3(norm01(rms)),
        "low": r3(bands["low"]),
        "mid": r3(bands["mid"]),
        "high": r3(bands["high"]),
        # flat uint8 array, row-major: spectrum[frame * spectrumBands + band]
        "spectrum": spec.flatten().tolist(),
    }
    dst = ROOT / CFG["paths"]["features"]
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")

    print(f"[bpm] tracker={tempo:.2f}  constant-grid={grid['bpm']:.3f} (t0={grid['t0']:.3f}s, "
          f"tracker agreement={grid['trackerAgreement']:.0%})")
    print(f"[beats] {len(beats)}  first={beats[0]:.3f}s  downbeatPhase={phase}")
    print(f"[onsets] {len(on_t)}")
    print(f"[frames] {n_frames} @ {FPS}fps, spectrum {N_BANDS} bands")
    print(f"[out] {dst.relative_to(ROOT)}  {dst.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
