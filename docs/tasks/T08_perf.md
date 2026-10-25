# Task T08 — render speed: cache the dot screens (owner: codex)

Project: <项目根目录>. Export is GPU-bound at ~240 ms/frame "read" (out/exp_*.log: ms/frame render / read / send):
`readPixels` waits for the GPU to finish the frame's 2D drawing, and the frame is dominated by thousands of tiny arcs from
the halftone helpers in src/components/print.js (`dotLight`, `dotCone`, `dotFill`, `dotRing`, `nearSnow`), world.js
`snow`/`fog`, plate.js `ground` dots, and kit.js snow-break particles — each dot = one subpath, tens of thousands per frame.

## Goal
At least 3x faster export (1280x720) with **visually identical output**.

## Approach (suggested; you decide)
- Pre-render dot fields to offscreen canvases and blit them: cache key = (all parameters rounded sensibly, device scale);
  a field whose parameters change every frame (alpha ramps, moving centre) can often be cached at full strength and drawn with
  globalAlpha, or cached per small quantised step (e.g. density in 1/64 steps). LRU-limit the cache (memory!).
- Draw static dot screens as a pattern (CanvasPattern of one cell tile) where the dot size is uniform.
- Batch: one path per field is already done; avoid per-dot ctx.col() / fillStyle changes.
- Do not change any scene file's look; components may change internally. Keep determinism (no wall clock, no Math.random).

## Measure (required)
1. BEFORE any change: `node export/export.mjs --start 100 --end 104 --width 1280 --height 720 --fps 30 --out out/t08_before.mp4`
   and the same for 60-64, 240-244, 320-324; note the ms/frame lines.
2. Reference stills: `node export/export.mjs --sheet out/t08_ref.png --times 10,45,62,95,140,180,200,240,300,326,380 --cols 4 --width 1280 --height 720`
3. After: same renders → `out/t08_after.mp4` timings and `out/t08_new.png`; compare the sheets pixel-wise (python + PIL/numpy in
   .venv): report mean abs diff per tile and the max; any tile with mean diff > 1.0 (0-255) must be explained or fixed.
Report a before/after table. Do not commit.
