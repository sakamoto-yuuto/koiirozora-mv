# Task T03 — hairline detailing of the drawn world (owner: codex)

Project: <项目根目录>. Read docs/VISUAL.md first (§1 every frame is a print), then docs/PLAN.md §3.
Reference for the look: research/senbon_study.md §1 ("金色细描线": flat fills + ONE thin line tracing structure: building
outlines, window frames, railings, ornament corners) — our equivalent is a thin `text` or `ice` line at low alpha.

## Scope: ONLY these files
- src/components/world.js : street() (far roofs: roof edges, window frames of lit windows, eaves), booth() (frame edges, glass
  mullions, the roof slab, the sign box), boothInside() (mullion edges, a directory shelf + a hanging phone directory on a chain
  as simple shapes), room() (window frame, curtain edge folds, desk edge), machine() and homePhone() (panel seams, button rims).
- src/components/phone.js : mc3p() (body bevel line, keypad well rim, slot rims, the instruction plate's text lines).
Do NOT edit any other file. Keep every exported function signature backwards compatible (add optional params only).

## Rules
- Lines: 1.2-2 px (virtual 1920x1080 units; inside ctx.at(...{scale}) divide by the scale so they stay thin), colour role
  'text' or 'ice' (or 'line'), alpha 0.18-0.5. Only palette roles, never hex. No gradients (light = dot screens, see print.js).
- Add structure, not noise: each object gets the 3-6 lines that make it read as a real, built thing.
- Deterministic (no Math.random; use rand() from src/engine/prng.js). Performance: keep a frame under ~25 ms at 960x540.

## Verify (required)
Render before/after contact sheets and look at them:
  node export/export.mjs --sheet out/t03_before.png --times 2,10,22,30,40,45,62 --cols 4   (run BEFORE editing)
  node export/export.mjs --sheet out/t03_after.png  --times 2,10,22,30,40,45,62 --cols 4
Iterate until the after sheet is clearly richer but still calm. Do not commit. Finish with a summary of what you added per object.
