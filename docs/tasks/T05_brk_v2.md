# Task T05 — BREAK + V2: the line is cut; the shop-window TVs (173.81 – 212.21 s) (owner: codex / dsh, competing)

Project: see the prompt. READ FIRST: docs/PLAN.md (§6 rows 9-10), docs/VISUAL.md, research/senbon_study.md, research/phone1986.md,
src/scenes/01_intro.js and src/scenes/02_v1.js (finished sections: copy their idioms), kit.js, cues.js, components/*.
Files you own: NEW src/scenes/05_brk.js (`brkShots`, `brkSfx`), NEW src/scenes/06_v2.js (`v2Shots`, `v2Sfx`),
NEW src/components/tv.js. In src/scenes/index.js ONLY add the two SECTIONS entries in film order. Touch nothing else.

## BREAK 173.81 → 186.61 (deep silence in the music; state `snow`)
- 173.81: ピー — the answering machine's recording time is over (1 kHz beep, the REC lamp goes OUT). Then the line is dead:
  the busy tone ツー・ツー (400 Hz, 0.5 s on / 0.5 s off) drawn as a dot-matrix trace that pulses, in a black frame.
- Then almost nothing: the receiver hanging on its coiled cord (o_receiver art), swinging slowly to rest, in the booth's cold
  light; her y_profile_down beyond, out of focus (blur filter) — the only movement is the cord's swing decaying and snow.
- 度数 LED stays as it was (≈40): the card is still in; the call is just cut.
- Sound: beep (rel -8), busy tone kind 'busy' is NOT available → use 'ringback'? NO: list a new kind 'busy' in your summary and
  declare it anyway (the mixer skips unknown kinds with a warning).

## V2 186.61 → 212.21 (lines 11-14: 〔L12〕 / 〔L13〕 / 〔L14〕 / 〔L15〕)
The third kind of picture (only here): BROADCAST. State `tv`.
- A 1986 electronics shop window on the street at night (電器店): a wall of 9-16 CRT TVs of different sizes stacked, all showing
  the same live music-festival broadcast (明星音楽祭 生放送): her on stage (y_stage art, cream/wine/navy plates printed in the
  CRT palette with scanlines + slight RGB misregistration + curved-glass highlight), stage lights as dot cones, a crowd of
  countless small round heads as a halftone field (多くの人), captions in Noto Sans JP (role sans) as TV lower-thirds:
  「明星音楽祭」「生放送」「森川由綺」 (all characters already in the sans whitelist).
- 微笑み: the crowd heads lift/brighten in a wave left→right on the sung characters (smiles shared out).
- On 〔L14〕: pull back through the shop glass: outside the window, in the snow, SHE stands alone (y_back_full,
  small), seen from behind, looking at herself on all the screens; her reflection faint in the glass. All TVs then cut to the
  same close-up of her (y_eye or y_stage cropped) at once, on a beat.
- 〔L15〕: the street empties; the TVs keep playing; she stays.
- Price tags on the TVs (¥59,800 etc. in mono) and a shop sign (電器 in sans) add the period. Snow throughout.
- Her lyric column stays on the right (default); keep the right 380 px calm.
- Motion: always — channel flicker on cuts, scan roll, camera slow truck along the TV wall, crowd shimmer, snow. Cuts on beats.
- Sound (v2Sfx): a faint crowd/applause bed is NOT available as a kind → list 'crowd' in your summary and declare it; keep rel ≤ -20.

## Verify
`node tools/sfx.mjs` runs. Render every-beat contact sheets (tools/sheet.sh) for 173.8-212.2 and LOOK at them; iterate until
docs/VISUAL.md §6 holds. One full-size frame of the TV wall. Do not commit. Summarise per shot + new art / sfx kinds wanted.
