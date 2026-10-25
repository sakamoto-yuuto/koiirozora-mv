"""Chroma-key codex art (flat inks on pure #00FF00) into clean RGBA for the engine.
usage: python tools/key_art.py <in.png> <out.png> [--magenta]   (or: --all  keys every art_src/keep/*.png into assets/art/)
--magenta: the screen is #FF00FF (for green objects: the public phone); alpha from min(r, b) - g, spill on r and b
- alpha from 'greenness' (g - max(r, b)); body = 255, background = 0, a 1-2 px soft edge only
- green spill removed from edge pixels (g clamped to max(r, b))
- specks: connected background islands / foreground dust under 0.02% of the area are dropped
"""
import sys, glob, os
import numpy as np
from PIL import Image, ImageFilter

def key(src, dst, magenta=False):
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    green = np.minimum(r, b) - g if magenta else g - np.maximum(r, b)
    a = np.clip(1.0 - (green - 60.0) / 90.0, 0, 1)          # green >= 150 -> 0, <= 60 -> 1
    # clean: binarise the core, keep a thin soft edge
    m = Image.fromarray((a * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MedianFilter(3))
    a = np.asarray(m).astype(np.float32) / 255
    a[a > 0.92] = 1.0; a[a < 0.06] = 0.0
    if magenta:                                               # despill: an edge pixel's red and blue never exceed its green by much
        lim = g + 40
        r = np.where(a < 1.0, np.minimum(r, lim), r); b = np.where(a < 1.0, np.minimum(b, lim), b)
        out = np.dstack([r, g, b, a * 255]).clip(0, 255).astype(np.uint8)
    else:
        g2 = np.where(a < 1.0, np.minimum(g, np.maximum(r, b)), g)  # despill
        g2 = np.minimum(g2, np.maximum(r, b) + 30)               # flat inks never lean green
        out = np.dstack([r, g2, b, a * 255]).clip(0, 255).astype(np.uint8)
    # drop tiny islands
    try:
        from scipy import ndimage
        lab, n = ndimage.label(out[..., 3] > 0)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            small = np.isin(lab, np.where(sizes < out.shape[0] * out.shape[1] * 0.0002)[0] + 1)
            out[small] = 0
    except ImportError:
        pass
    Image.fromarray(out, 'RGBA').save(dst, optimize=True)
    cov = (out[..., 3] > 0).mean()
    print(f'{os.path.basename(dst)}: {out.shape[1]}x{out.shape[0]} figure {cov:.1%}')

if __name__ == '__main__':
    if sys.argv[1] == '--all':
        for f in sorted(glob.glob('art_src/keep/*.png')):
            key(f, os.path.join('assets/art', os.path.basename(f)))
    else:
        key(sys.argv[1], sys.argv[2], magenta='--magenta' in sys.argv)
