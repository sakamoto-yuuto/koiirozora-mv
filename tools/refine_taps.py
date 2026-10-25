"""Tidy hand taps (tools/tap.html -> out/tap/manual_taps.json) against the vocal stem, conservatively.
usage: python tools/refine_taps.py <taps.json> <out.json> [--bias auto|<ms>] [--report out.json]
1. a global offset: the median signed distance of the taps to the nearest vocal event (--bias auto), subtracted
2. each mora moves to the nearest vocal EVENT within [-100, +60] ms of its (bias-corrected) tap, else stays;
   events = spectral-flux onsets (backtracked), pitch steps >= 0.7 semitone, voicing starts
3. (--starts only) the first mora of a line may move back to the voicing start of the phrase (up to 450 ms).
   OFF by default: checked on L4 / L15 it picked up the BREATH before the phrase. Fix a late phrase start by hand
   with --fix line:mora:time instead (verified on the spectrogram, tools/align_view.py)
4. order is kept: a mora never moves past its neighbours (a move that would break the order is not made)
The human taps stay the reference: nothing moves further than the windows above.
"""
import argparse, json
from pathlib import Path
import numpy as np
import librosa

def events(y, sr, hop):
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_mels=96, fmax=4000, lag=2, max_size=3)
    on = list(librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, backtrack=True, units='time', delta=0.04, wait=4))
    f0, vf, _ = librosa.pyin(y, sr=sr, hop_length=hop, fmin=150, fmax=1100)
    midi = librosa.hz_to_midi(np.where(vf, f0, np.nan)); t = np.arange(len(midi)) * hop / sr
    steps, starts = [], []
    for i in range(4, len(midi) - 4):
        a, b = midi[i - 4], midi[i + 4]
        if np.isfinite(a) and np.isfinite(b) and abs(b - a) >= 0.7 and abs(midi[i + 1] - midi[i - 1]) >= abs(midi[i] - midi[i - 2]): steps.append(t[i])
        if vf[i] and not vf[i - 4:i].any(): starts.append(t[i])
    ev = np.array(sorted(on + steps + starts))
    keep = [ev[0]] if len(ev) else []
    for e in ev[1:]:
        if e - keep[-1] > 0.015: keep.append(e)
    return np.array(keep), np.array(starts)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('taps'); ap.add_argument('out'); ap.add_argument('--bias', default='auto'); ap.add_argument('--report')
    ap.add_argument('--vocals', default='assets/audio/vocals.wav')
    ap.add_argument('--starts', action='store_true'); ap.add_argument('--fix', action='append', default=[], help='line:mora:seconds, applied last')
    o = ap.parse_args()
    d = json.loads(Path(o.taps).read_text(encoding='utf-8'))
    sr, hop = 22050, 128
    y, _ = librosa.load(o.vocals, sr=sr, mono=True)
    ev, starts = events(y, sr, hop)
    allt = np.array([m['t'] for ln in d['lines'] for m in ln['morae']])
    near = lambda t: ev[np.argmin(np.abs(ev - t))]
    bias = float(np.median([t - near(t) for t in allt])) if o.bias == 'auto' else float(o.bias) / 1000
    moved, firsts, out = [], 0, {'method': 'manual_tap_refined', 'source': o.taps, 'bias_ms': round(bias * 1000, 1), 'lines': []}
    for ln in d['lines']:
        ts = [m['t'] - bias for m in ln['morae']]
        new = list(ts)
        for j, t in enumerate(ts):
            lo, hi = t - 0.10, t + 0.06
            cand = ev[(ev >= lo) & (ev <= hi)]
            if j == 0 and o.starts:                                     # the phrase start: back to where the voice begins
                vs = starts[(starts >= t - 0.45) & (starts <= t + 0.06)]
                if len(vs): cand = np.concatenate([cand, vs[:1]]); firsts += 1
            if not len(cand): continue
            c = float(cand[np.argmin(np.abs(cand - t))]) if j else float(cand.min())
            prev = new[j - 1] if j else -1e9
            nxt = ts[j + 1] - 0.10 if j + 1 < len(ts) else 1e9               # leave room for the next mora's own window
            if prev + 0.03 < c < nxt: new[j] = c
        for f in o.fix:
            li, mj, tv = f.split(':')
            if int(li) == ln['line']: new[int(mj)] = float(tv)
        for j, (a, b) in enumerate(zip(ts, new)):
            if abs(a - b) > 1e-4: moved.append((ln['line'], j, round((b - a) * 1000)))
        out['lines'].append({'line': ln['line'], 'morae': [{'k': m['k'], 't': round(t, 4)} for m, t in zip(ln['morae'], new)]})
    Path(o.out).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    mv = np.array([m[2] for m in moved]) if moved else np.zeros(1)
    rep = {'bias_ms': round(bias * 1000, 1), 'morae': int(len(allt)), 'moved': len(moved), 'moved_median_abs_ms': float(np.median(np.abs(mv))),
           'moved_max_abs_ms': int(np.max(np.abs(mv))), 'line_starts_checked': firsts, 'big_moves': [m for m in moved if abs(m[2]) > 100]}
    if o.report: Path(o.report).write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding='utf-8')
    print(rep)

if __name__ == '__main__':
    main()
