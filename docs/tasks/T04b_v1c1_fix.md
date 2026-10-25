# Task T04b — second pass on V1 / B1 / C1 (owner: dsh)

Project: <项目根目录> (the MAIN project now — your T04 work was accepted and merged here).
Files you own: src/scenes/02_v1.js, 03_b1.js, 04_c1.js, src/components/memory.js. Touch nothing else.
Re-read docs/VISUAL.md §4 (motion) and research/senbon_study.md §3-4 (rhythm, motion).
Real per-character timings now exist (data/lyrics_film.json → chars, read through charTimes()). Object art o_* is registered.
Palettes changed (her wine is darker) — use roles only.

Review notes (from the director). Fix all; keep what works (street signs, hanko, counter, 寂 snow, cups/hands reprints).
1. MOTION. Every shot must visibly change across its length; right now the window shot (136.5-149) and the post-chorus are
   static for 8-12 s and the frost shot is static. Each needs one directed move + secondary motion:
   - frost: slow push-in on her; the frost front visibly advances on every beat; breath fog pulses.
   - window: slow push + snow outside + once per bar a car's headlight sweeps across the room as a moving dot-screen band
     (the only light); her hair plate drifts slightly.
   - post-chorus (≈156 → 173.81): a real accelerating montage on beats: cut every 2 beats, then every beat from B(51),
     each cut a different reprint (street, hands, cups, table, counter, platform) out of register, alternating with the 度数 LED
     falling one unit per cut (keep it ≥ 40: the card only runs out in C2) and the tape counter racing; from B(53)=170.61 the
     reels slow and we hold on the REC lamp until 173.81.
2. platform: the train must PULL AWAY during the line (horizontal motion with ctx.trail motion blur, accelerating), the さよなら
   window carried away with it; then the amber dot (him) recedes into the dark. Brighten the platform: one platform lamp as a
   dotCone, the edge line, a pillar with a station-name board (竖排 or 横排, any made-up name like 「白鳥」).
3. voice (149.1-157): no handset across her face. Redesign: side close-up — y_profile_down (or y_phone_eyesclosed cropped to
   head + hand) with the receiver against her ear; 声 formed by the earpiece holes as a dot glyph (big, beside the ear);
   すこし = three LED drops; 「…」 three dots one per beat after the line. Her line drawn vertically left of her.
4. table: objects leave on each character — make sure they exit with motion blur, in different directions, and the cups get a
   tiny warm steam animation at the end.
5. Make sure no shot is a pure static image for more than 2 beats (check with contact sheets every beat).

Verify: render every-beat sheets for 74.6-174 (tools/sheet.sh, 5-6 cols) and look at each; iterate. node tools/sfx.mjs must
run. Do not commit. Finish with a summary per note.
