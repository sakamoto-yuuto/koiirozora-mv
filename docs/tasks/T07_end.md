# Task T07 — bridge, C3, 恋色の空, outro, end (273.01 – 395.41 s)

READ FIRST: docs/PLAN.md (§2 colour = state, §6 rows 13-17 — this is the end of the film, read it twice), docs/VISUAL.md,
research/senbon_study.md, research/lyrics_and_music.md §5.6-5.7 and §6.3-6.5, and the finished sections in src/scenes/.
Files you own: NEW src/scenes/09_bridge.js, 10_c3.js, 11_koi.js, 12_outro.js (+ components/sky.js if needed); Do NOT edit
src/scenes/index.js: your SECTIONS entries already exist there. Touch nothing else. Cuts on beats / bars; charTimes for words.
Bars: B(n) = 1.01 + 3.2 n (B(85)=273.01, B(92)=295.41, B(100)=321.01, B(104)=333.81, B(117)=375.41).

## Bridge 273.01 → 295.41 (instrumental, high energy, builds; state night)
She leaves the booth. No more phone: no machine will carry her words now.
- 273.01: the folding door opens (booth from outside), she steps out (y_walk_back art if registered, else y_back_full); the
  booth light behind her; the ejected card stays in the slot.
- Then ONE long continuous move, not chopped: she walks along the snowy street under the telephone wires (reuse world.js
  street()/bank()/snow with a large camX travel; wires.js from T06 if it exists); the camera tracks her, parallax 3+ layers,
  near snow streaks, street lamps passing as dot-cones one per bar (they are the beat). Her small silhouette walks with the
  bob idiom from 01_intro.js. The energy builds to 295.41: lamps pass faster (the camera speeds up), snow thickens.

## C3 295.41 → 320.44 (lines 22-24, state cold; the loudest part of the song)
No glass any more: the C1 images reprinted OUTDOORS.
- line 22 〔L8〕 / line 23 〔L9〕: the 寂 snow of C1 (see 04_c1.js) now falls ON HER
  in the open street (y_back_full / y_breath), and the glyph-snow lands on her shoulders and hair; bigger, denser than in C1.
- line 24 〔L25〕: his window seen from the street, dark (from 04_c1's window idiom but from outside);
  y_breath: she breathes out a white cloud on 冬の匂い.

## 恋色の空 320.44 → 333.81 (line 25, state koi) — THE moment of the film
- 見上げたなら (320.44 →): y_profile_up (she looks up) — camera tilts up with her gaze from the street to the sky.
- 恋色の空: the sky becomes **the only smooth gradient of the whole film**: her wine (role `me`) and his amber (role `you`)
  BLEND for the first time into one sky (vertical gradient amber at the horizon → wine → indigo at the top, using ctx.gradRect /
  radial — gradients are allowed ONLY here and after). Snow keeps falling through it. Use palette state `koi`.
- The words 恋色の空 are not in the column: hang them as paper slips (tanzaku) on a telephone wire against the sky, one slip
  per character landing on its charTimes (like the 千本桜 tanzaku in research/senbon_study.md §2), swaying.
- Keep the picture until 333.81; no new lyric after it.

## Outro 333.81 → 375.41 (instrumental; state koi → dawn)
- The sky holds, slowly brightening towards dawn (palette blend koi → dawn over the section).
- The camera follows the telephone wire from her street back across the city to HIS window (reverse of T06's move), enters
  his dark room: the answering machine, 用件 "2" blinking red (1 Hz), the tape rewound.

## End 375.41 → 395.41 (fade; state dawn → dead)
- An amber hand (h_press art, accent role `you`) enters and presses 再生 on the machine (machine press '再生'), on a beat.
- The reels start to turn. BEFORE any voice could be heard: cut to the dawn street — the same street as the opening shot, now
  in morning light, the booth unlit, one line of footprints leading AWAY from it (bookend with 01_intro).
- Credits, small, bottom left (serif): 恋色空 / 森川由綺（CV：平野綾）/ 作詞 Bee'　作曲・編曲 藤間仁 / 非公式ファンメイド — then
  fade to `dead` by 392.4; the file's tail is silence.
- Sound: relay + tape for 再生, then nothing but the music's tail.

Verify: every-beat contact sheets for each section (tools/sheet.sh), look and iterate (docs/VISUAL.md §6); one full-size frame
at 326 (the sky) and at 385. node tools/sfx.mjs runs. Do not commit. Summarise per shot; list art / sfx kinds you wanted.
