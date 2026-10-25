#!/bin/bash
# run_edit.sh <name> <image to edit>   (an EDIT job: the first ref is the picture to keep; then style refs)
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT/art_src/v2"; n=$1; src=$2; K=$ROOT/art_src/keep
$ROOT/tools/codex_gen.sh $ROOT/art_src/v2/$n.png $n.txt $src $K/y_walk_full.png < /dev/null >> done.txt
