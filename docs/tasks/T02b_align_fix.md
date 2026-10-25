# Task T02b — fix the alignment windows (owner: codex)

Read docs/tasks/T02_align.md, your tools/align_lyrics.py and out/align/report.md first.

Problems found in review (line indices are 0-based = data/lyrics_film.json lines[i]; your report is 1-based):
1. lines[10] 〔L11〕: characters were spread over 149-184 s (す at 176.6 s) because the window ran to the next
   line start (187.85) across a 30 s instrumental. The line is sung between ~149.0 and ~155.5 s (its `end` in the json).
   RULE (my spec was wrong): window = [start - 0.4, min(next start, end + 1.5)] where `end` is lines[i].end in
   data/lyrics_film.json (already trimmed to the vocal where an instrumental follows: lines 10, 21, 25).
   Also cap every mora at 4.0 s duration; a line's last mora must end before `end + 1.5`.
2. lines[21] 〔L22〕: first mora +3.22 s after the LRC start - check the plot; if the vocal really starts there keep it,
   otherwise fix the candidate selection (a soft pickup / breath is not a sung onset).
3. Sanity check all lines automatically after the run: chars strictly non-decreasing, first char within ±0.5 s of start
   (flag otherwise), last char before end + 1.5, no gap between consecutive characters > 4 s. Print violations; fix until none
   (or explain each remaining one in the report).
Re-run, regenerate data/lyrics_film.json (chars / morae / vocalEnd), out/align/*.png, report.md, clicks.wav.
Do not touch anything else. Do not commit. Summarise what changed.
