"""Turn a codex BACKGROUND PLATE (a whole 16:9 screenprint, no keying) into an ink-label map the engine can re-colour.
usage: python tools/plate_art.py <in.png> <name> [--out assets/plates] [--scale 2] [--extra 3] [--key] [--preview x.jpg]
  -> <out>/<name>.png   8-bit grey, pixel = 16 * ink index (lossless; 0..7 inks); 255 = transparent (--key)
     <out>/<name>.json  {"w", "h", "inks": [{"rgb": [r, g, b], "role": "<palette role>", "n": share}]}
Why: colour = state (docs/PLAN.md §2). A plate printed in its own RGB would bring warm lights into the grey intro;
as a label map every ink takes a palette ROLE, so the plate greys, cools or warms with the film's state. The roles in
the .json are only defaults; a shot can give any ink another role.
- the sheet is enlarged (Lanczos, --scale) BEFORE it is quantised: edges stay crisp at 4K
- inks = the five fixed screenprint inks of the prompts + the plate's warm accent (found: the mean of the saturated
  light pixels) + up to --extra inks for what is left (k-means on the far pixels: e.g. the green public phone)
- an RGBA source with transparency (a frame cut by tools/slice_sheet.py) keeps its alpha
- --key: an object on #00FF00 (the train car): keyed as tools/key_art.py does, the green becomes transparent
- a pixel that differs from all four neighbours takes their majority (single-pixel speckle from the resampling)
"""
import sys, os, json, argparse
import numpy as np
from PIL import Image

FIXED = [  # rgb, default role
    ((0x12, 0x19, 0x25), 'panel'),   # deep navy: the darkest (palette panel < bg)
    ((0x1B, 0x22, 0x30), 'bg'),      # near-black navy = the ground the code fills with too
    ((0x34, 0x42, 0x56), 'line'),    # slate
    ((0xAF, 0xC9, 0xD8), 'ice'),     # ice blue-grey
    ((0xF1, 0xE9, 0xDA), 'text'),    # cream
]

def nearest(px, inks):
    d = ((px[:, None, :] - inks[None, :, :]) ** 2).sum(-1)
    return d.argmin(1), d.min(1)

def role_for(rgb):
    r, g, b = rgb
    if g > r + 15 and g > b: return 'phone'                     # green (the public phone)
    wine = g <= b + 10                                          # wine / rose (her) leans to blue; amber (his light) to green
    if r - b >= 60 and r + g > 300: return 'meHot' if wine else 'youHot'       # saturated warm light
    if r - b >= 70 or (wine and r - b >= 40): return 'me' if wine else 'you'    # saturated warm dark: her wine hair, his amber
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if lum > 200: return 'text'
    if lum > 135: return 'sub' if r >= b else 'ice'             # light greys: warm-leaning ones (skin shade, beige) never take the cold ice
    return 'mute' if lum > 95 else 'line' if lum > 55 else 'panel'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('name')
    ap.add_argument('--out', default='assets/plates'); ap.add_argument('--scale', type=float, default=2)
    ap.add_argument('--extra', type=int, default=3)
    ap.add_argument('--key', action='store_true', help='the source is an object on #00FF00: key it')
    ap.add_argument('--magenta', action='store_true', help='with --key: the screen is #FF00FF (green objects)')
    ap.add_argument('--preview', help='also write the plate re-printed in its own inks (jpg) to check the quantising')
    o = ap.parse_args()
    os.makedirs(o.out, exist_ok=True)
    raw = Image.open(o.src); im = raw.convert('RGB'); alpha = None
    if raw.mode == 'RGBA' and raw.getchannel('A').getextrema()[0] < 128:
        alpha = raw.getchannel('A')                              # already keyed (a frame cut by slice_sheet.py)
    elif o.key:
        sys.path.insert(0, os.path.dirname(__file__)); from key_art import key
        tmp = os.path.join(o.out, f'_{o.name}_keyed.png'); key(o.src, tmp, magenta=o.magenta)
        ka = Image.open(tmp).convert('RGBA'); os.remove(tmp)
        im = ka.convert('RGB'); alpha = ka.getchannel('A')
    W, H = round(im.width * o.scale), round(im.height * o.scale)
    big = np.asarray(im.resize((W, H), Image.LANCZOS)).astype(np.float32)
    px = big.reshape(-1, 3)
    small = np.asarray(im).reshape(-1, 3).astype(np.float32)
    if alpha is not None: small = small[np.asarray(alpha).ravel() >= 128]
    small = small[::7]

    inks = [np.array(c, np.float32) for c, _ in FIXED]; roles = [r for _, r in FIXED]
    _, d = nearest(small, np.stack(inks))
    sat = small.max(1) - small.min(1)
    warm = small[(d > 45 ** 2) & (sat > 25) & (small[:, 0] - small[:, 2] > 25) & (small.sum(1) > 330)]
    if len(warm) > 200:
        acc = np.median(warm, 0); inks.append(acc); roles.append(role_for(acc))
    for _ in range(o.extra):                                    # what the inks so far do not cover
        _, d = nearest(small, np.stack(inks))
        far = small[d > 50 ** 2]
        if len(far) < len(small) * 0.004: break
        c = np.median(far, 0)
        for _ in range(8):                                      # a few k-means steps on the far pixels
            sel = far[((far - c) ** 2).sum(1) < 45 ** 2]
            if len(sel) < 50: break
            c = sel.mean(0)
        if alpha is not None and not o.magenta and role_for(c) == 'phone':           # keyed source: a green 'ink' is chroma fringe, not paint
            small = small[((small - c) ** 2).sum(1) >= 45 ** 2]; continue
        inks.append(c); roles.append(role_for(c))
    K = np.stack(inks)

    lab = np.empty(len(px), np.uint8)
    for i in range(0, len(px), 1 << 20):
        lab[i:i + (1 << 20)] = nearest(px[i:i + (1 << 20)], K)[0]
    L = lab.reshape(H, W)
    # speckle: a pixel unlike all four neighbours takes their majority
    P = np.pad(L, 1, mode='edge')
    nb = np.stack([P[:-2, 1:-1], P[2:, 1:-1], P[1:-1, :-2], P[1:-1, 2:]])
    lone = (nb != L).all(0)
    if lone.any():
        cnt = np.stack([(nb == k).sum(0) for k in range(len(K))])
        L = np.where(lone, cnt.argmax(0), L).astype(np.uint8)

    out = (L * 16).astype(np.uint8); opaque = np.ones(L.shape, bool)
    if alpha is not None:
        opaque = np.asarray(alpha.resize((W, H), Image.LANCZOS)) >= 128; out[~opaque] = 255
    share = np.bincount(L[opaque].ravel(), minlength=len(K)) / max(1, opaque.sum())
    keep = [k for k in range(len(K))]
    Image.fromarray(out, 'L').save(os.path.join(o.out, f'{o.name}.png'), optimize=True)
    meta = {'w': W, 'h': H, 'src': os.path.basename(o.src), 'keyed': alpha is not None,
            'inks': [{'rgb': [int(round(v)) for v in K[k]], 'role': roles[k], 'n': round(float(share[k]), 4)} for k in keep]}
    if o.preview:
        rgb = K.astype(np.uint8)[L]; rgb[~opaque] = (0, 255, 0)
        Image.fromarray(rgb).resize((W // 2, H // 2), Image.LANCZOS).save(o.preview, quality=90)
    json.dump(meta, open(os.path.join(o.out, f'{o.name}.json'), 'w'), indent=1)
    print(f"{o.name}: {W}x{H}, " + ', '.join(f"#{''.join(f'{int(v):02x}' for v in K[k])}->{roles[k]} {share[k]:.1%}" for k in keep))

if __name__ == '__main__':
    main()
