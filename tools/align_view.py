"""Look at one lyric line: the vocal stem as a mel spectrogram (0-4 kHz), its pitch (pYIN) and energy, with the mora times
of one or more alignments drawn over it, so they can be judged by eye.
usage: python tools/align_view.py <line> <out.png> <alignment.json>[:label] ... [--pad 0.4] [--vocals assets/audio/vocals.wav]
       [--grid 0.05] (thin time grid every 50 ms)
"""
import argparse, json
from pathlib import Path
import numpy as np
import librosa
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def morae(p, line):
    d = json.loads(Path(p).read_text(encoding='utf-8'))
    for i, ln in enumerate(d['lines']):
        if ln.get('line', i) == line: return [(m['k'], m['t']) for m in ln.get('morae', []) if m.get('t') is not None]
    return []

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('line', type=int); ap.add_argument('out'); ap.add_argument('alignments', nargs='+')
    ap.add_argument('--pad', type=float, default=0.4); ap.add_argument('--vocals', default='assets/audio/vocals.wav')
    ap.add_argument('--grid', type=float, default=0.05)
    o = ap.parse_args()
    sets = []
    for a in o.alignments:
        p, _, lab = a.partition(':')
        sets.append((lab or Path(p).stem, morae(p, o.line)))
    ts = [t for _, m in sets for _, t in m]
    t0, t1 = min(ts) - o.pad, max(ts) + o.pad + 0.6
    sr, hop = 22050, 128
    y, _ = librosa.load(o.vocals, sr=sr, mono=True, offset=t0, duration=t1 - t0)
    S = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop, n_mels=128, fmax=4000), ref=np.max)
    f0, vflag, _ = librosa.pyin(y, sr=sr, hop_length=hop, fmin=150, fmax=1100)
    rms = librosa.amplitude_to_db(librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0], ref=np.max)
    flux = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_mels=96, fmax=4000, lag=2, max_size=3)
    tt = t0 + np.arange(S.shape[1]) * hop / sr
    W = max(14, (t1 - t0) * 3.2)
    fig, ax = plt.subplots(3, 1, figsize=(W, 9), sharex=True, gridspec_kw={'height_ratios': [3, 1.2, 1]})
    ax[0].imshow(S, origin='lower', aspect='auto', extent=[t0, t1, 0, 128], cmap='magma', vmin=-70, vmax=0)
    ax[0].set_ylabel('mel 0-4k')
    ax[1].plot(tt[:len(f0)], librosa.hz_to_midi(np.where(vflag, f0, np.nan)), color='k', lw=1.5); ax[1].set_ylabel('pitch (midi)')
    ax[2].plot(tt[:len(rms)], rms, color='tab:blue', lw=1); ax[2].set_ylabel('dB / flux')
    ax2 = ax[2].twinx(); ax2.plot(tt[:len(flux)], flux, color='tab:orange', lw=1)
    cols = ['#00e5ff', '#76ff03', '#ff4081', '#ffea00', '#ffffff', '#b388ff']
    for si, (lab, m) in enumerate(sets):
        c = cols[si % len(cols)]
        for k, t in m:
            for a in ax: a.axvline(t, color=c, lw=1.2, alpha=0.9, ymin=0 if a is not ax[0] else si / len(sets), ymax=1 if a is not ax[0] else (si + 1) / len(sets))
            ax[0].text(t + 0.005, 128 * (si + 0.75) / len(sets), k, color=c, fontsize=13, fontname='MS Gothic')
        ax[0].text(t0 + 0.02, 128 * (si + 0.15) / len(sets), lab, color=c, fontsize=10)
    if o.grid:
        for g in np.arange(np.ceil(t0 / o.grid) * o.grid, t1, o.grid): ax[2].axvline(g, color='#ccc', lw=0.4, zorder=0)
    ax[2].set_xlim(t0, t1); ax[2].set_xlabel('song time (s)')
    plt.tight_layout(); plt.savefig(o.out, dpi=70)
    print(o.out)

if __name__ == '__main__':
    main()
