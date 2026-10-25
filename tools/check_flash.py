"""Photosensitivity + single-frame-glitch check for an exported MP4.

Approximates the WCAG 2.3.1 "three flashes" thresholds on a 64x36 down-scaled copy:
  general flash : a pair of opposing luminance changes of >= 10 % of full scale (darker
                  state below 0.80) on >= 25 % of the frame
  red flash     : a pair of opposing transitions to / from saturated red on >= 25 % of the frame
A film passes when no 1-second window holds more than 3 flashes of either kind.

Also lists single-frame pops: a frame that differs strongly from both neighbours while the
neighbours look alike (an unintended one-frame flash or a missing frame).

Times are printed as SONG time (audio start = 0) with the position in the FILE in brackets: the film starts
before the song (config.json safety.preroll), and the exporter records the song time of the file's first frame
in the mp4 (`comment` tag: mv_start=...).

Usage:  .venv\\Scripts\\python tools/check_flash.py out/preview_1080p.mp4
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
W, H, AREA = 64, 36, 0.25


def transitions(value, thresh, dark_limit=None):
    """Per pixel and frame: 1 where the pixel completes a rise or fall of >= thresh since its last
    extreme (directions alternate by construction, so two marks = one flash for that pixel)."""
    n = value.shape[0]
    ext = value[0].copy()                 # last extreme per pixel
    direction = np.zeros(value.shape[1], dtype=np.int8)
    marks = np.zeros(value.shape, dtype=np.int16)
    for i in range(1, n):
        v = value[i]
        rise = (v - ext >= thresh) & (direction <= 0)
        fall = (ext - v >= thresh) & (direction >= 0)
        if dark_limit is not None:        # only counts when the darker of the two states is below the limit
            rise &= ext < dark_limit
            fall &= v < dark_limit
        marks[i] = rise | fall
        direction[rise], direction[fall] = 1, -1
        ext[rise], ext[fall] = v[rise], v[fall]
        ext = np.where(direction > 0, np.maximum(ext, v), np.where(direction < 0, np.minimum(ext, v), ext))
    return marks


def flashes_per_second(marks, fps):
    """Largest F such that at least AREA of the frame flashes F times inside some 1 s window."""
    win = int(round(fps))
    cum = np.cumsum(marks, axis=0, dtype=np.int32)
    counts = cum[win:] - cum[:-win]                                   # transitions per pixel per window
    area_level = np.percentile(counts, 100 * (1 - AREA), axis=1)      # value reached by the busiest 25 % of pixels
    at = int(np.argmax(area_level))
    return float(area_level[at]) / 2, at, int((marks.mean(axis=1) >= AREA).sum())


def main():
    mp4 = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "out" / "preview_1080p.mp4")
    probe = subprocess.run([FF, "-i", str(mp4)], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    fps = float(next(p for p in probe.split(",") if " fps" in p).split()[0])
    m = re.search(r"mv_start=(-?[0-9.]+)", probe)
    start = float(m.group(1)) if m else 0.0                  # song time of the file's first frame
    at = lambda frame: f"{frame / fps + start:.2f} s song time (file {frame / fps:.2f} s)"
    raw = subprocess.run([FF, "-v", "error", "-i", str(mp4), "-vf", f"scale={W}:{H}:flags=area,format=rgb24", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    rgb = np.frombuffer(raw, dtype=np.uint8).reshape(-1, W * H, 3).astype(np.float32) / 255.0
    n = rgb.shape[0]
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    print(f"[flash] {mp4.name}: {n} frames @ {fps:g} fps ({n / fps:.1f} s), first frame at song time {start:+.3f} s"
          + ("" if m else " (no mv_start tag: assumed 0)"))

    worst, w0, cnt = flashes_per_second(transitions(lum, 0.10, dark_limit=0.80), fps)
    print(f"  general: {cnt} frames with a large-area luminance transition; worst 1 s window = {worst:.1f} flashes "
          f"(window starting {at(w0)}) -> {'PASS' if worst <= 3 else 'FAIL'} (limit 3)")

    s = rgb.sum(axis=2) + 1e-6                               # saturated red: R / (R+G+B) >= 0.8, scaled by its strength
    red = np.where(rgb[..., 0] / s >= 0.8, np.clip((rgb[..., 0] - rgb[..., 1] - rgb[..., 2]) * 320 / 255, 0, None), 0)
    worst, w0, cnt = flashes_per_second(transitions(red, 20 / 255), fps)
    print(f"  red:     {cnt} frames with a large-area saturated-red transition; worst 1 s window = {worst:.1f} flashes "
          f"(window starting {at(w0)}) -> {'PASS' if worst <= 3 else 'FAIL'} (limit 3)")

    # busiest second in terms of big whole-frame changes (cuts, heavy glitching)
    flat = rgb.reshape(n, -1)
    d1 = np.abs(flat[1:] - flat[:-1]).mean(axis=1)           # d1[i] = change from frame i to i+1
    cuts = np.where(d1 > 0.12)[0]
    if len(cuts):
        per = [int(np.searchsorted(cuts, c + fps) - j) for j, c in enumerate(cuts)]
        j = int(np.argmax(per))
        print(f"  hard frame changes (mean abs diff > 0.12): {len(cuts)}; busiest second has {per[j]} (from {at(cuts[j])})")

    # single-frame pops: frame i unlike i-1 and i+1, while i-1 and i+1 are alike
    d2 = np.abs(flat[2:] - flat[:-2]).mean(axis=1)           # d2[i] = change from frame i to i+2
    pops = [i + 1 for i in range(n - 2) if d1[i] > 0.05 and d1[i + 1] > 0.05 and d2[i] < 0.35 * min(d1[i], d1[i + 1])]
    if pops:
        print(f"  single-frame pops: {len(pops)} (song time) -> " + ", ".join(f"{p / fps + start:.3f}s" for p in pops[:40]))
    else:
        print("  single-frame pops: none")


if __name__ == "__main__":
    main()
