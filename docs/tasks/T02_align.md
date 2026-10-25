# Task T02 — per-character lyric timing (owner: codex)

Project: <项目根目录>. Song: assets/audio/track.mp3 (44.1 kHz stereo, 395.41 s), a slow ballad, 75 BPM, solo female voice.
Lyrics: `data/lyrics_film.json` → `lines[i]` = { start, end, jp, zh, ... } (26 lines; start = LRC line start, reliable to ~0.2 s;
`jp` may contain ruby as `時間(とき)` = base 時間 read とき).

Goal: the film reveals her Japanese line **one character at a time, each character exactly when it is sung** (like the
千本桜 MV). We need, for every displayed character, the song time at which its first mora is sung.

## Steps
1. Vocal stem: separate with demucs htdemucs on CPU, in the venv `.venv-sep` (torch + demucs installed there; the htdemucs
   weights are cached in ~/.cache/torch/hub/checkpoints/955717e8-8726e21a.th). Save `assets/audio/vocals.wav` (44.1 kHz).
2. Readings: write `data/lyrics_kana.json`: for each line, the display text split into segments with their kana reading,
   e.g. `[["黄昏","たそがれ"],["に","に"],["染","そ"],["ま","ま"],["る","る"],["街","まち"],["を","を"]]`.
   Standard readings (黄昏=たそがれ, 恋色=こいいろ, 時間=とき, 傍=そば, 超す=こす, 温もり=ぬくもり, 温めて=あたためて, 一人=ひとり …).
   Punctuation, spaces and 「」 get an empty reading. Morae: small ゃゅょ join the previous kana; っ is its own mora (held, no new onset); ん is a mora.
3. Alignment (`tools/align_lyrics.py`, run with `.venv-sep/Scripts/python`): for each line, in the window
   [start - 0.4, next line start (or end + 2 s)], find sung syllable onsets on the vocal stem (combine: energy onsets, pitch
   (pyin) note changes, spectral flux; voiced segments). Assign the line's morae in order to time points with a monotonic DP that
   prefers detected onsets, keeps morae of one word close, and allows sustained notes (a mora may last several beats; melismas).
   The first mora should land near the LRC start (within ±0.35 s) unless the vocal clearly starts elsewhere.
4. Output: add to every line of `data/lyrics_film.json` (keep all existing fields untouched):
   - `chars`: `[{ "c": "黄", "t": 75.91 }, ...]` — one entry per DISPLAY character of `jp` with the ruby part removed
     (so `時間(とき)` contributes 時 and 間, with 間 at the same t as 時 or at its own mora); spaces/punctuation get the time of the next char;
   - `morae`: `[{ "k": "た", "t": 75.91, "d": 0.31 }, ...]`;
   - `vocalEnd`: when the singing of the line actually stops.
5. Verification artifacts:
   - `out/align/line_XX.png` for each line: vocal RMS envelope + pitch track over the window, vertical marks at every mora with its kana label.
   - `out/align/report.md`: per line, number of morae, number of detected onsets, max deviation of the first mora from the LRC start,
     and any line you are unsure about (say why).
   - `out/align/clicks.wav`: vocals (left) + a short click at every character time (right), for listening.

Rules: do not touch src/ or config.json or anything else in data/. Do not commit. Deterministic output. Finish with a summary + the report.
