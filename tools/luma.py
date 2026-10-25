"""Mean brightness of every frame of an export, or of every tile of a contact sheet.

The light of the climax is a ratchet (docs/v4/PLAN.md §9): inside a shot it may only rise, it falls on cuts only, and
the last frame before 192.34 s has to be the brightest of the film. This prints the numbers that claim rests on.

  video:  .venv\\Scripts\\python tools/luma.py out/chk_climax.mp4 [--step 0.2308] [--from 162.8] [--to 193.4] [--cuts 162.81,165.11,...]
          one line per step: song time, mean luma (0..1, gamma-encoded Rec.709: what the eye reads as brightness),
          mean relative luminance (linear: what tools/check_flash.py measures). With --cuts it also lists every place
          where the brightness FALLS by more than --tol (default 0.012) between two samples that lie in the same shot.
  sheet:  .venv\\Scripts\\python tools/luma.py out/sheet.png --tiles 4 [--tile 960x540] [--pad 6]
          one line per tile (the sheets written by `node export/export.mjs --sheet`).
"""
import re
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


def measures(rgb):
    """rgb: float array (..., 3) in 0..1 -> (mean gamma luma, mean linear luminance)."""
    luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    rel = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    return float(luma.mean()), float(rel.mean())


def main():
    args = sys.argv[1:]
    opt = lambda name, d=None: args[args.index(name) + 1] if name in args else d
    src = Path(args[0])
    probe = subprocess.run([FF, "-i", str(src)], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    if opt("--tiles"):
        cols, pad = int(opt("--tiles")), int(opt("--pad", 6))
        tw, th = (int(v) for v in opt("--tile", "960x540").split("x"))
        m = re.search(r", (\d+)x(\d+)", probe)
        W, H = int(m.group(1)), int(m.group(2))
        raw = subprocess.run([FF, "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
        img = np.frombuffer(raw, dtype=np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0
        rows = (H + pad) // (th + pad)
        for i in range(rows * cols):
            x, y = (i % cols) * (tw + pad), (i // cols) * (th + pad)
            if x + tw > W or y + th > H:
                continue
            a, b = measures(img[y:y + th, x:x + tw])
            print(f"tile {i:3d}: luma {a:.3f}   luminance {b:.3f}")
        return
    fps = float(next(p for p in probe.split(",") if " fps" in p).split()[0])
    m = re.search(r"mv_start=(-?[0-9.]+)", probe)
    start = float(m.group(1)) if m else 0.0
    w, h = 96, 54
    raw = subprocess.run([FF, "-v", "error", "-i", str(src), "-vf", f"scale={w}:{h}:flags=area,format=rgb24", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    rgb = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w, 3).astype(np.float32) / 255.0
    n = rgb.shape[0]
    per = [measures(rgb[i]) for i in range(n)]
    t_of = lambda i: i / fps + start
    step, t0, t1 = float(opt("--step", 0.2308)), float(opt("--from", start)), float(opt("--to", t_of(n - 1)))
    cuts = sorted(float(c) for c in opt("--cuts", "").split(",") if c)
    tol = float(opt("--tol", 0.012))
    peak = max(range(n), key=lambda i: per[i][0])
    print(f"[luma] {src.name}: {n} frames @ {fps:g} fps, song time {start:.3f} .. {t_of(n - 1):.3f} s; brightest frame at {t_of(peak):.3f} s (luma {per[peak][0]:.3f})")
    t = t0
    while t <= t1 + 1e-6:
        i = int(round((t - start) * fps))
        if 0 <= i < n:
            mark = "  | cut" if any(abs(c - t) < step / 2 for c in cuts) else ""
            print(f"  {t:8.2f} s   luma {per[i][0]:.3f}   luminance {per[i][1]:.3f}   {'#' * int(round(per[i][0] * 60))}{mark}")
        t += step
    if cuts:
        falls = []
        for a, b in zip([t0] + cuts, cuts + [t1]):
            ia, ib = max(0, int(round((a - start) * fps)) + 1), min(n - 1, int(round((b - start) * fps)) - 1)
            hi = -1.0
            for i in range(ia, ib + 1):
                if per[i][0] < hi - tol:
                    falls.append((t_of(i), hi, per[i][0]))
                    hi = per[i][0]                  # report a fall once, then follow it down
                hi = max(hi, per[i][0])
        print(f"  falls of more than {tol} inside a shot: {len(falls)}")
        for tt, a, b in falls[:60]:
            print(f"    {tt:8.3f} s   {a:.3f} -> {b:.3f}")


if __name__ == "__main__":
    main()
