"""Cut a SET sheet (several separate objects on #00FF00, generated together so they share one camera and one light)
into one keyed RGBA picture per object.
usage: python tools/split_set.py <sheet.png> <out_dir> <name1,name2,...> [--join 18] [--margin 10]
- keyed with tools/key_art.py
- objects = connected parts of the matte after a dilation of --join px (a mug and its curl of steam stay one object)
- the parts are taken in reading order (rows of similar height, then left to right) and named from the list;
  extra parts smaller than 0.3 % of the sheet are dropped, a count mismatch is an error
"""
import sys, os, argparse, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from key_art import key  # noqa: E402

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('out'); ap.add_argument('names')
    ap.add_argument('--join', type=int, default=18); ap.add_argument('--margin', type=int, default=10)
    o = ap.parse_args()
    names = o.names.split(',')
    tmp = os.path.join(tempfile.mkdtemp(), 'k.png'); key(o.sheet, tmp)
    im = np.asarray(Image.open(tmp).convert('RGBA')); H, W = im.shape[:2]
    A = im[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(A, iterations=o.join))
    parts = []
    for i in range(1, n + 1):
        m = (lab == i) & A
        if m.sum() < 0.003 * H * W: continue
        ys, xs = np.where(m)
        parts.append((ys.min(), ys.max(), xs.min(), xs.max(), m))
    if len(parts) != len(names):
        raise SystemExit(f'{len(parts)} objects found, {len(names)} names given')
    # reading order: a new row starts when a part's top is below the current row's mean centre
    parts.sort(key=lambda p: (p[0] + p[1]) / 2)
    rows, cur = [], [parts[0]]
    for p in parts[1:]:
        if p[0] > np.mean([(q[0] + q[1]) / 2 for q in cur]): rows.append(cur); cur = [p]
        else: cur.append(p)
    rows.append(cur)
    ordered = [p for r in rows for p in sorted(r, key=lambda p: p[2])]
    os.makedirs(o.out, exist_ok=True)
    for name, (y0, y1, x0, x1, m) in zip(names, ordered):
        y0, x0 = max(0, y0 - o.margin), max(0, x0 - o.margin); y1, x1 = min(H, y1 + 1 + o.margin), min(W, x1 + 1 + o.margin)
        crop = im[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(m[y0:y1, x0:x1], crop[..., 3], 0)
        Image.fromarray(crop, 'RGBA').save(os.path.join(o.out, f'{name}.png'))
        print(f'{name}: {x1 - x0}x{y1 - y0} at ({x0}, {y0}) of the sheet')

if __name__ == '__main__':
    main()
