#!/bin/bash
# Generate one image with codex image_gen (run many of these in parallel: one codex process each).
# usage: tools/codex_gen.sh <out.png (unix path)> <prompt-file> [ref images (unix paths)...]
# In the prompt file __OUT__ is replaced by the Windows path of <out.png>. Writes <out>.log and <out>.msg.
OUT="$1"; PF="$2"; shift 2
mkdir -p "$(dirname "$OUT")"
WOUT=$(cygpath -w "$OUT")
args=()
for r in "$@"; do args+=(-i "$(cygpath -w "$r")"); done
PROMPT=$(cat "$PF"); PROMPT="${PROMPT//__OUT__/$WOUT}"
codex exec --ephemeral --skip-git-repo-check -s workspace-write -m gpt-5.6-terra -c model_reasoning_effort=low \
  -C "$(cygpath -w "$(dirname "$OUT")")" "${args[@]}" -o "$OUT.msg" "$PROMPT" > "$OUT.log" 2>&1
code=$?
# the copy step inside codex sometimes fails silently: take the picture from THIS job's own session folder instead
# (one folder per codex session, so it can never be another parallel job's image); the newest one if it retried
if [ ! -s "$OUT" ]; then
  sid=$(grep -o "session id: [0-9a-f-]*" "$OUT.log" | head -1 | cut -d' ' -f3)
  src=$(ls -t "$HOME/.codex/generated_images/$sid/"*.png 2>/dev/null | head -1)
  [ -n "$sid" ] && [ -n "$src" ] && rm -f "$OUT" && cp "$src" "$OUT" && echo "RECOVERED $OUT <- $sid" >> "$OUT.log"
fi
[ -s "$OUT" ] && echo "OK $OUT" || echo "FAIL($code) $OUT"
