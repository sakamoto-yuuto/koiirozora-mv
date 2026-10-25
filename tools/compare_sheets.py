"""Compare the baseline contact sheets (out/base_*.png, v3) with a fresh render (out/cmp_*.png).

Prints, per set, every tile whose picture differs, with its song time. Two renders of the same code
differ by at most 1/255 on a few bytes (GPU passes, see README), so a tile only counts as changed when
more than PIXELS of its pixels differ by more than LEVEL.

Usage:  .venv\\Scripts\\python tools/compare_sheets.py [set ...] [--level 6] [--pixels 12]
        [--a base] [--b cmp] [--sets out/base_sets.json]
--a / --b are the file prefixes of the two renders (out/<prefix>_<set>.png); --sets names the list of tiles
(tools/base_sheets.mjs writes out/base_sets.json, tools/regress_sheets.mjs writes out/regress_sets.json).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FF = "ffmpeg"
try:
    subprocess.run([FF, "-version"], capture_output=True, check=True)
except Exception:
    FF = str(ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe")


def load(png, w, h):
    raw = subprocess.run([FF, "-v", "error", "-i", str(png), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3).astype(np.int16)


def main():
    args = sys.argv[1:]
    opt = lambda name, d: float(args[args.index(name) + 1]) if name in args else d
    sopt = lambda name, d: args[args.index(name) + 1] if name in args else d
    level, pixels = opt("--level", 6), opt("--pixels", 12)
    pa, pb, sets = sopt("--a", "base"), sopt("--b", "cmp"), sopt("--sets", "out/base_sets.json")
    names = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or not args[i - 1].startswith("--"))]
    meta = json.loads((ROOT / sets).read_text())
    tw, th, cols, pad = (meta["tile"][k] for k in ("w", "h", "cols", "pad"))
    total = 0
    for name, times in meta["sets"].items():
        if names and name not in names:
            continue
        a_p, b_p = ROOT / "out" / f"{pa}_{name}.png", ROOT / "out" / f"{pb}_{name}.png"
        if not a_p.exists() or not b_p.exists():
            print(f"[{name}] missing sheet(s)")
            continue
        rows = -(-len(times) // cols)
        W, H = cols * tw + (cols - 1) * pad, rows * th + (rows - 1) * pad
        a, b = load(a_p, W, H), load(b_p, W, H)
        changed = []
        for i, t in enumerate(times):
            x, y = (i % cols) * (tw + pad), (i // cols) * (th + pad)
            d = np.abs(a[y:y + th, x:x + tw] - b[y:y + th, x:x + tw]).max(axis=2)
            n = int((d > level).sum())
            if n > pixels:
                ys, xs = np.nonzero(d > level)
                changed.append((t, n, int(d.max()), (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))))
        total += len(changed)
        print(f"[{name}] {len(times)} tiles, {len(changed)} changed")
        for t, n, mx, box in changed:
            print(f"    t={t:8.3f}s  {n:6d} px ({100 * n / (tw * th):5.1f} %)  max diff {mx:3d}  box x {box[0]}-{box[2]} y {box[1]}-{box[3]}  (of {tw}x{th})")
    print(f"total changed tiles: {total}")


if __name__ == "__main__":
    main()
