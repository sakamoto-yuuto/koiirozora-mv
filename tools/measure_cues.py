"""Measure the cues of src/scenes/cues.js against the audio.

For every cue it looks for onsets of the VOICE (harmonic part of the signal, 300-3400 Hz band, spectral flux:
the same envelope tools/check_sync.py uses) or, for cues whose name starts with `drum`, of the whole band, and prints:

  name   value in cues.js   nearest onset (and how strong it is)   that onset snapped to the half-beat grid

Nothing is written: cues.js is edited by hand, one line per cue, so that a value corrected by ear is never
overwritten. A cue keeps its 'initial' value when no clear onset lies within the window.

Usage:  .venv\\Scripts\\python tools/measure_cues.py [--window 0.30] [name-prefix ...]
"""
import json
import re
import sys
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))


def envelope(y, sr, hop, lo, hi):
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
    band = S[(fr >= lo) & (fr <= hi)]
    return np.maximum(0, np.diff(np.log1p(band * 50).sum(axis=0), prepend=0))


def peaks(env, hop, sr):
    """Onset candidates: local maxima of the flux that stand out of their neighbourhood. Returns (times, strength 0..1)."""
    norm = env / (np.percentile(env, 99.5) + 1e-9)
    idx = librosa.util.peak_pick(norm, pre_max=3, post_max=3, pre_avg=12, post_avg=12, delta=0.08, wait=4)
    return idx * hop / sr, np.clip(norm[idx], 0, 1)


def main():
    args = sys.argv[1:]
    win = float(args[args.index("--window") + 1]) if "--window" in args else 0.30
    only = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] != "--window")]
    feats = json.loads((ROOT / CFG["paths"]["features"]).read_text(encoding="utf-8"))
    t0, period = feats["grid"]["t0"], feats["grid"]["period"]
    snap = lambda t: t0 + round((t - t0) / (period / 2)) * (period / 2)
    src = (ROOT / "src" / "scenes" / "cues.js").read_text(encoding="utf-8")
    cues = re.findall(r"(\w+):\s*\[\s*([0-9.]+)\s*,\s*'(\w+)'", src)

    y, sr = librosa.load(str(ROOT / CFG["paths"]["audio"]), sr=None, mono=True)
    hop = 256
    voice = envelope(librosa.effects.harmonic(y, margin=2.0), sr, hop, 300, 3400)
    drums = envelope(librosa.effects.percussive(y, margin=2.0), sr, hop, 40, 8000)
    pv, pd = peaks(voice, hop, sr), peaks(drums, hop, sr)

    print(f"{'cue':16s} {'cues.js':>8s} {'source':9s} {'nearest onset':>14s} {'delta':>7s} {'strength':>8s} {'on half-beat':>12s}   others within the window")
    for name, val, source in cues:
        if only and not any(name.startswith(p) for p in only):
            continue
        val = float(val)
        times, strength = pd if name.startswith("drum") else pv
        m = np.abs(times - val) <= win
        if not m.any():
            print(f"{name:16s} {val:8.2f} {source:9s} {'(none)':>14s}")
            continue
        tt, ss = times[m], strength[m]
        j = int(np.argmin(np.abs(tt - val)))
        rest = ", ".join(f"{a:.2f}({b:.2f})" for a, b in zip(tt, ss) if a != tt[j])
        print(f"{name:16s} {val:8.2f} {source:9s} {tt[j]:14.3f} {tt[j] - val:+7.3f} {ss[j]:8.2f} {snap(tt[j]):12.3f}   {rest}")


if __name__ == "__main__":
    main()
