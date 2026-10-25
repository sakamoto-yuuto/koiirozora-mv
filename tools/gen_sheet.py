"""Contact sheet of codex generations newer than a time: python tools/gen_sheet.py "2026-10-22 18:55" out.jpg [h]"""
import sys, os, glob, datetime
from PIL import Image, ImageDraw
since = datetime.datetime.fromisoformat(sys.argv[1]).timestamp(); out = sys.argv[2]; h = int(sys.argv[3]) if len(sys.argv) > 3 else 420
root = os.path.expanduser('~/.codex/generated_images')
fs = sorted((f for f in glob.glob(root + '/*/*.png') if os.path.getmtime(f) >= since), key=os.path.getmtime)
tiles = []
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB'); im = im.resize((int(im.width * h / im.height), h))
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 60, 28), fill='#000'); d.text((6, 6), f'#{i}', fill='#fff')
    tiles.append(im); print(f'#{i}', f, Image.open(f).size)
cols = 4; rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
W = max(sum(t.width for t in r) for r in rows); s = Image.new('RGB', (W, h * len(rows)), '#000')
for y, r in enumerate(rows):
    x = 0
    for t in r: s.paste(t, (x, y * h)); x += t.width
s.save(out, quality=85)
