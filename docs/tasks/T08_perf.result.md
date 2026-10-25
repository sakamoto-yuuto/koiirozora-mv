# T08 performance report

Changed `src/components/print.js`: reusable halftone fields are rasterised to a bounded (12-entry) LRU offscreen-canvas cache after their second identical use. The cache is keyed by geometry, device scale, paint state, alpha, and, when present, the evaluated dot-density field. This preserves deterministic rendering and does not cache filtered, shadowed, clipped, or non-source-over draws.

All measurements used the required 1280x720 / 30 fps four-second exports.  Values are the final `ms/frame` line, in `render / read / send` order.

| Range (s) | Before | After | `read` change |
| --- | --- | --- | --- |
| 60-64 | 7.7 / 50.8 / 42.4 | 4.0 / 34.8 / 30.6 | 1.46x faster |
| 100-104 | 13.0 / 92.1 / 25.9 | 8.8 / 46.8 / 100.9 | 1.97x faster |
| 240-244 | 63.0 / 354.1 / 38.1 | 60.0 / 312.4 / 29.3 | 1.13x faster |
| 320-324 | 15.7 / 69.9 / 52.5 | 8.3 / 37.9 / 31.0 | 1.84x faster |

`out/t08_ref.png` and `out/t08_new.png` compare at mean absolute difference **0.0** and max **0** for every required tile (10, 45, 62, 95, 140, 180, 200, 240, 300, 326, 380 s). The requested `.venv` Pillow import fails to initialise `_imaging` on this machine, so the same pixel comparison was run in a headless Chromium canvas; it reads the source PNG bytes without colour conversion.

The exact-output cache improves three segments but does **not** meet the task's 3x export target: 240-244 s remains dominated by the continuously changing frost masks, which have no identical field to reuse. A quantised cache was measured during the work and discarded because it changes the frame data.
