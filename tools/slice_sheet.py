"""Cut a codex ANIMATION SEQUENCE SHEET (N frames side by side on #00FF00) into registered single frames.
usage: python tools/slice_sheet.py <sheet.png> <base> <n> [--out assets/art] [--even]
  -> <out>/<base>_0.png ... <base>_<n-1>.png, all the same size, keyed (RGBA), the figure registered on frame 0.
- keying = tools/key_art.py (same alpha / despill rules)
- the frames are found as the n widest runs of columns that carry figure pixels (separated by green gaps); --even
  (or too few runs) splits the sheet into n equal cells instead
- registration: every frame is shifted so that its alpha matte (--anchor top: its top 30 %, the head) best overlaps frame 0's (FFT cross-correlation on a
  downscaled matte), then all frames share one canvas = the union of the shifted boxes plus a margin
"""
import sys, os, argparse
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from key_art import key  # noqa: E402

def runs(colmask, min_gap):
    """[start, end) runs of True in colmask, merging gaps shorter than min_gap."""
    out, s = [], None
    for i, v in enumerate(colmask):
        if v and s is None: s = i
        if not v and s is not None: out.append([s, i]); s = None
    if s is not None: out.append([s, len(colmask)])
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] < min_gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return merged

def shift_to(ref, a, scale=4):
    """Integer (dy, dx) to add to `a`'s coordinates so it best overlaps `ref` (both float alpha, same shape)."""
    r = ref[::scale, ::scale]; b = a[::scale, ::scale]
    F = np.fft.rfft2(r) * np.conj(np.fft.rfft2(b))
    c = np.fft.irfft2(F, s=r.shape)
    dy, dx = np.unravel_index(np.argmax(c), c.shape)
    if dy > r.shape[0] // 2: dy -= r.shape[0]
    if dx > r.shape[1] // 2: dx -= r.shape[1]
    dy, dx = int(dy * scale), int(dx * scale)
    # refine at full resolution: the coarse peak is only good to +-scale px
    best, bd = -1, (dy, dx)
    for ey in range(-scale + 1, scale):
        for ex in range(-scale + 1, scale):
            v = (ref * np.roll(np.roll(a, dy + ey, 0), dx + ex, 1)).sum()
            if v > best: best, bd = v, (dy + ey, dx + ex)
    return bd

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('base'); ap.add_argument('n', type=int)
    ap.add_argument('--out', default='assets/art'); ap.add_argument('--even', action='store_true')
    ap.add_argument('--margin', type=int, default=12)
    ap.add_argument('--anchor', default='all', help="'all' = whole matte; 'top' = only the top 30%% of the figure (walk cycles: register on the head, not the legs)")
    o = ap.parse_args()
    tmp = os.path.join(o.out, f'_{o.base}_keyed.png')
    key(o.sheet, tmp)
    im = np.asarray(Image.open(tmp).convert('RGBA')); os.remove(tmp)
    H, W = im.shape[:2]; A = im[..., 3] > 0
    cols = A.sum(0) > max(2, H * 0.004)
    rr = sorted(runs(cols, min_gap=W // 120), key=lambda r: r[1] - r[0], reverse=True)[:o.n]
    if o.even or len(rr) < o.n or min(r[1] - r[0] for r in rr) < W / o.n * 0.25:
        how = 'even'; cells = [[round(i * W / o.n), round((i + 1) * W / o.n)] for i in range(o.n)]
    else:
        how = 'gaps'; cells = sorted(rr)
    # each frame in a common-width canvas, centred on its cell
    cw = max(b - a for a, b in cells) + 2 * o.margin
    frames = []
    for a, b in cells:
        f = np.zeros((H, cw, 4), np.uint8); x0 = (cw - (b - a)) // 2
        f[:, x0:x0 + (b - a)] = im[:, a:b]
        frames.append(f)
    def matte(f):
        m = f[..., 3].astype(np.float32) / 255
        if o.anchor == 'top':                                   # keep the head and shoulders only
            ys = np.where(m.max(1) > 0.5)[0]
            if len(ys): m[ys[0] + int(0.3 * (ys[-1] - ys[0])):] = 0
        return m
    ref = matte(frames[0])
    shifts = [(0, 0)] + [shift_to(ref, matte(f)) for f in frames[1:]]
    pad = max(1, max(max(abs(dy), abs(dx)) for dy, dx in shifts)) + o.margin
    big = []
    for f, (dy, dx) in zip(frames, shifts):
        c = np.zeros((H + 2 * pad, cw + 2 * pad, 4), np.uint8)
        c[pad + dy:pad + dy + H, pad + dx:pad + dx + cw] = f
        big.append(c)
    U = np.zeros(big[0].shape[:2], bool)
    for c in big: U |= c[..., 3] > 0
    ys, xs = np.where(U)
    y0, y1 = max(0, ys.min() - o.margin), min(U.shape[0], ys.max() + 1 + o.margin)
    x0, x1 = max(0, xs.min() - o.margin), min(U.shape[1], xs.max() + 1 + o.margin)
    for i, c in enumerate(big):
        Image.fromarray(c[y0:y1, x0:x1], 'RGBA').save(os.path.join(o.out, f'{o.base}_{i}.png'), optimize=True)
    print(f'{o.base}: {o.n} frames by {how}, {x1 - x0}x{y1 - y0}, shifts {shifts}')

if __name__ == '__main__':
    main()
