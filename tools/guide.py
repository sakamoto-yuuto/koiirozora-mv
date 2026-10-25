"""Layout / pose GUIDES for codex image_gen: a plain sketch the generator must follow for positions, sizes and poses.
usage: python tools/guide.py <spec.json> <out.png>
The guide is passed as the FIRST reference image with the sentence GUIDE_RULE (below) in the prompt; it fixes what
words cannot: where things are, how big, which hand does what, the leg phase of each frame of a walk cycle.

spec.json:
{ "size": [1672, 941], "frames": 1,                       # frames > 1: the canvas is split into equal cells, left to right
  "items": [                                               # drawn in every frame unless "frame": k is given
    {"box": [x, y, w, h], "label": "phone panel"},         # a labelled rectangle (an object's extent)
    {"poly": [[x, y], ...], "label": "card", "fill": true},
    {"pose": {"head": [x, y], "neck": [..], "hip": [..], "lhand": [..], "rhand": [..], "lelbow": [..], "relbow": [..],
              "lknee": [..], "rknee": [..], "lfoot": [..], "rfoot": [..], "lshoulder": [..], "rshoulder": [..]},
     "head_r": 40, "label": "her", "frame": 0},           # a stick figure; LEFT limbs blue, RIGHT limbs red
    {"arrow": [[x0, y0], [x1, y1]], "label": "moves"},
    {"text": [x, y], "label": "..."},
    {"path": [[x, y], ...], "label": "index", "color": "red", "width": 10, "joints": true}   # a bone chain (fingers)
  ]}
Coordinates are in frame px (each cell has the full "size"). Colours carry meaning only for the reader.
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

GUIDE_RULE = ("The FIRST attached image is a LAYOUT / POSE GUIDE only (thin lines on white): follow its positions, sizes, "
              "framing and poses exactly (blue = the figure's LEFT limbs, red = RIGHT limbs), but do NOT copy its lines, "
              "labels or colours - the picture itself is drawn in the style described below.")

def font(n):
    for f in ('C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/arial.ttf'):
        try: return ImageFont.truetype(f, n)
        except OSError: pass
    return ImageFont.load_default()

def main():
    spec = json.load(open(sys.argv[1], encoding='utf8'))
    W, H = spec.get('size', [1672, 941]); n = spec.get('frames', 1)
    im = Image.new('RGB', (W * n, H), 'white'); d = ImageDraw.Draw(im); F = font(max(14, H // 40))
    for k in range(n):
        ox = k * W
        if n > 1:
            d.rectangle([ox, 0, ox + W - 1, H - 1], outline=(200, 200, 200), width=2)
            d.text((ox + 10, 8), f'frame {k + 1}', fill=(120, 120, 120), font=F)
        for it in spec['items']:
            if it.get('frame', k) != k: continue
            if n > 1 and 'frame' not in it and 'text' in it and len(it) <= 2 and k > 0: continue   # a sheet-wide note: printed once
            P = lambda p: (ox + p[0], p[1])
            lab = it.get('label')
            if 'box' in it:
                x, y, w, h = it['box']; d.rectangle([P((x, y)), P((x + w, y + h))], outline=(40, 40, 40), width=3)
                if lab: d.text(P((x + 6, y + 4)), lab, fill=(40, 40, 40), font=F)
            if 'poly' in it:
                pts = [P(p) for p in it['poly']]
                if it.get('fill'): d.polygon(pts, fill=(225, 225, 225), outline=(40, 40, 40))
                else: d.line(pts + [pts[0]], fill=(40, 40, 40), width=3)
                if lab: d.text(pts[0], lab, fill=(40, 40, 40), font=F)
            if 'arrow' in it:
                a, b = P(it['arrow'][0]), P(it['arrow'][1]); d.line([a, b], fill=(0, 150, 0), width=4)
                import math
                ang = math.atan2(b[1] - a[1], b[0] - a[0])
                for s in (2.6, -2.6): d.line([b, (b[0] + 22 * math.cos(ang + s), b[1] + 22 * math.sin(ang + s))], fill=(0, 150, 0), width=4)
                if lab: d.text(((a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 + 6), lab, fill=(0, 120, 0), font=F)
            if 'path' in it:
                cols = {'red': (220, 50, 50), 'blue': (40, 90, 230), 'black': (30, 30, 30), 'green': (0, 150, 0), 'orange': (230, 140, 20), 'purple': (140, 60, 200)}
                col = cols.get(it.get('color', 'black'), (30, 30, 30)); w = it.get('width', 8); pts = [P(p) for p in it['path']]
                d.line(pts, fill=col, width=w, joint='curve')
                if it.get('joints', True):
                    for x, y in pts: d.ellipse([x - w * 0.9, y - w * 0.9, x + w * 0.9, y + w * 0.9], fill=col)
                if lab: d.text((pts[-1][0] + 10, pts[-1][1] - 10), lab, fill=col, font=F)
            if 'text' in it:
                d.text(P(it['text']), lab, fill=(40, 40, 40), font=F)
            if 'pose' in it:
                q = it['pose']; r = it.get('head_r', 40); w = it.get('width', 7)
                g = lambda j: P(q[j]) if j in q else None
                def bone(a, b, col):
                    if g(a) and g(b): d.line([g(a), g(b)], fill=col, width=w)
                K, L, R = (30, 30, 30), (40, 90, 230), (220, 50, 50)
                bone('neck', 'hip', K)
                for side, col in (('l', L), ('r', R)):
                    bone('neck', side + 'shoulder', col); bone(side + 'shoulder', side + 'elbow', col); bone(side + 'elbow', side + 'hand', col)
                    bone('hip', side + 'knee', col); bone(side + 'knee', side + 'foot', col)
                    for j in (side + 'hand', side + 'foot'):
                        if g(j): x, y = g(j); d.ellipse([x - w * 1.6, y - w * 1.6, x + w * 1.6, y + w * 1.6], fill=col)
                if g('head'): x, y = g('head'); d.ellipse([x - r, y - r, x + r, y + r], outline=K, width=w)
                if 'face' in it:                                 # a short tick: the direction the face looks
                    fx, fy = it['face']; x, y = g('head'); d.line([(x, y), (x + fx * r * 1.4, y + fy * r * 1.4)], fill=K, width=w)
                if lab and g('head'): x, y = g('head'); d.text((x + r + 6, y - r), lab, fill=K, font=F)
    im.save(sys.argv[2])
    print(sys.argv[2], im.size)

if __name__ == '__main__':
    main()
