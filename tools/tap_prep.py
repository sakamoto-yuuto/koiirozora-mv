"""Data for the tap annotator (tools/tap.html): every line's morae with the character each belongs to, plus the vocal
stem's energy and onset envelopes (10 ms steps) for drawing.
usage: python tools/tap_prep.py   -> data/tap_data.json
"""
import json
from pathlib import Path
import numpy as np
import librosa

ROOT = Path(__file__).resolve().parents[1]

def main():
    d = json.loads((ROOT / 'data/lyrics_film.json').read_text(encoding='utf-8'))
    lines = []
    for i, ln in enumerate(d['lines']):
        mt = [m['t'] for m in ln['morae']]
        chars = []
        for c in ln['chars']:
            mi = next((j for j, t in enumerate(mt) if abs(t - c['t']) < 1e-6), None)
            chars.append({'c': c['c'], 'mi': mi})
        morae = [{'k': m['k'], 't': m['t'], 'ci': None} for m in ln['morae']]
        for ci, c in enumerate(chars):                                 # a mora belongs to the last character starting at or before it
            if c['mi'] is None or not c['c'].strip() or c['c'] in '「」': continue
            for j in range(c['mi'], len(morae)): morae[j]['ci'] = ci
        lines.append({'i': i, 'text': ln['text'], 'start': ln['start'], 'end': ln['end'], 'chars': chars, 'morae': morae})
    sr, hop = 22050, 220                                              # 10 ms
    y, _ = librosa.load(str(ROOT / 'assets/audio/vocals.wav'), sr=sr, mono=True)
    rms = librosa.amplitude_to_db(librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0], ref=np.max)
    flux = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_mels=96, fmax=4000, lag=2, max_size=3)
    flux = flux / (np.percentile(flux, 99) + 1e-9)
    out = {'step': hop / sr, 'rms': [round(float(v), 1) for v in rms], 'flux': [round(float(min(v, 1.5)), 3) for v in flux], 'lines': lines}
    (ROOT / 'data/tap_data.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('lines', len(lines), 'morae', sum(len(l['morae']) for l in lines), 'frames', len(rms))

if __name__ == '__main__':
    main()
