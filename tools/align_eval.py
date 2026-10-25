"""Score a per-mora lyric alignment against the vocal stem (an objective PROXY, not ground truth).
usage: python tools/align_eval.py <alignment.json> [--vocals assets/audio/vocals.wav] [--out report.json] [--ref ref.json]
alignment.json: data/lyrics_film.json style ({"lines": [{"morae": [{"k": "た", "t": 75.627}, ...]}, ...]}) or the
  lab format {"lines": [{"line": i, "morae": [{"k", "t"}]}]}.
Measures, for every mora time t:
  - the nearest vocal ONSET (log-mel spectral flux of the Demucs vocal stem, 0-4 kHz, backtracked to the energy rise):
    |t - onset| -> median, hit rates within 50 / 100 ms, and the signed median (bias: + = the mora time is late)
  - the vocal ENERGY at t (a mora placed in a silent gap is wrong whatever the onsets say): share of morae in silence
With --ref (a hand-checked reference of the same format, some morae only), also the error against it.
Caveats printed with the report: legato vowel-to-vowel morae have weak onsets, so the onset proxy underrates any
method there; compare methods against each other and against --ref, not against 100 %.
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
import librosa

def load_alignment(p):
    d = json.loads(Path(p).read_text(encoding='utf-8'))
    out = []
    for i, ln in enumerate(d['lines']):
        idx = ln.get('line', i)
        for j, m in enumerate(ln.get('morae', [])):
            if m.get('t') is not None: out.append((idx, j, m['k'], float(m['t'])))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('alignment'); ap.add_argument('--vocals', default='assets/audio/vocals.wav')
    ap.add_argument('--out'); ap.add_argument('--ref')
    o = ap.parse_args()
    sr, hop = 22050, 128                                             # 5.8 ms frames
    y, _ = librosa.load(o.vocals, sr=sr, mono=True)
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_mels=96, fmax=4000, lag=2, max_size=3)
    on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, backtrack=True, units='time', delta=0.04, wait=6)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]
    rdb = librosa.amplitude_to_db(rms, ref=np.max)
    A = load_alignment(o.alignment)
    ts = np.array([a[3] for a in A])
    near = np.array([on[np.argmin(np.abs(on - t))] for t in ts])
    err = ts - near
    fr = np.clip((ts * sr / hop).astype(int), 0, len(rdb) - 1)
    silent = rdb[np.clip(fr + int(0.03 * sr / hop), 0, len(rdb) - 1)] < -42      # 30 ms after the mora: still no voice
    rep = {
        'file': str(o.alignment), 'morae': int(len(ts)), 'onsets': int(len(on)),
        'median_abs_ms': round(float(np.median(np.abs(err))) * 1000, 1),
        'bias_ms': round(float(np.median(err)) * 1000, 1),
        'hit50': round(float(np.mean(np.abs(err) <= 0.05)), 3), 'hit100': round(float(np.mean(np.abs(err) <= 0.10)), 3),
        'in_silence': round(float(np.mean(silent)), 3),
        'per_line': {},
    }
    for i in sorted(set(a[0] for a in A)):
        sel = np.array([a[0] == i for a in A])
        e = err[sel]
        rep['per_line'][str(i)] = {'n': int(sel.sum()), 'median_abs_ms': round(float(np.median(np.abs(e))) * 1000, 1), 'bias_ms': round(float(np.median(e)) * 1000, 1), 'in_silence': int(silent[sel].sum())}
    if o.ref:
        R = {(a[0], a[1]): a[3] for a in load_alignment(o.ref)}
        pairs = [(a[3], R[(a[0], a[1])]) for a in A if (a[0], a[1]) in R]
        if pairs:
            e = np.array([p - q for p, q in pairs])
            rep['vs_ref'] = {'n': len(pairs), 'median_abs_ms': round(float(np.median(np.abs(e))) * 1000, 1), 'bias_ms': round(float(np.median(e)) * 1000, 1),
                             'hit50': round(float(np.mean(np.abs(e) <= 0.05)), 3), 'hit100': round(float(np.mean(np.abs(e) <= 0.10)), 3)}
    txt = json.dumps(rep, ensure_ascii=False, indent=1)
    if o.out: Path(o.out).write_text(txt, encoding='utf-8')
    print({k: v for k, v in rep.items() if k != 'per_line'})

if __name__ == '__main__':
    main()
