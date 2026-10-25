#!/bin/bash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT/art_src/v2"; n=$1; R=$ROOT/assets/ref_official; K=$ROOT/art_src/keep
case $n in
  y_fist_booth) refs="$R/anime2009/c20081112_wa_02_cs1w1_700x495.jpg $ROOT/art_src/v2/y_wait_sheet.png";;
  y_walk_sheet) refs="$R/anime2009/c20081112_wa_02_cs1w1_700x495.jpg $R/anime2009/c20081112_wa_05_cs1w1_700x558.jpg $K/y_walk_full.png";;
  bg_booth_front) refs="$ROOT/art_src/v2/bg_street_night.png $K/y_walk_full.png";;
  bg_*) refs="$K/y_walk_full.png $K/h_joined.png $K/y_profile_up.png";;
  yt_look_up) refs="$ROOT/art_src/v2/yt_back_bust.png $R/touya/c20081208_whitealbum_1_10_cs1w1_700x495.jpg $R/touya/c20081208_whitealbum_1_09_cs1w1_700x495.jpg";;
  obj_tanzaku) refs="$K/y_walk_full.png";;
  yt_walk_back|yt_hands_back|yt_scarf) refs="$R/touya/c20081208_whitealbum_1_10_cs1w1_700x495.jpg $R/touya/c20081208_whitealbum_1_09_cs1w1_700x495.jpg $R/anime2009/c20081112_wa_05_cs1w1_700x558.jpg $K/y_walk_full.png";;
  yt_*|his_*) refs="$R/touya/c20081208_whitealbum_1_10_cs1w1_700x495.jpg $R/touya/c20081208_whitealbum_1_09_cs1w1_700x495.jpg $K/y_walk_full.png";;
  passer_turn*) refs="$R/touya/c20081208_whitealbum_1_10_cs1w1_700x495.jpg $K/y_walk_full.png";;
  bg_platform_across) refs="$ROOT/art_src/v2/guides/bg_platform_across.png $ROOT/art_src/v2/bg_platform_night.png";;
  y_card_look) refs="$R/anime2009/c20081112_wa_02_cs1w1_700x495.jpg $ROOT/art_src/v2/y_wait_sheet.png";;
  yt_walk_rear34|yt_walk_rear34a|yt_walk_rear34b) refs="$ROOT/art_src/v2/guides/$n.png $R/touya/c20081208_whitealbum_1_10_cs1w1_700x495.jpg $R/touya/c20081208_whitealbum_1_09_cs1w1_700x495.jpg $K/y_walk_full.png";;
  y_walk_awaye|y_walk_awayf) refs="$ROOT/art_src/v2/guides/y_walk_away2.png $ROOT/art_src/v2/y_stop_back.png $ROOT/art_src/v2/y_walk_awayd.png $ROOT/art_src/v2/y_walk_sheet.png";;
  y_walk_awayc|y_walk_awayd) refs="$ROOT/art_src/v2/guides/y_walk_away2.png $R/anime2009/c20081112_wa_02_cs1w1_700x495.jpg $ROOT/art_src/v2/y_walk_sheet.png";;
  y_walk_awaya|y_walk_awayb) refs="$ROOT/art_src/v2/guides/yt_walk_away.png $R/anime2009/c20081112_wa_02_cs1w1_700x495.jpg $ROOT/art_src/v2/y_walk_sheet.png";;
  fx_footprints) refs="$ROOT/art_src/v2/guides/fx_footprints.png $ROOT/art_src/v2/y_walk_sheet.png $ROOT/art_src/v2/yt_walk_rear34a.png $ROOT/art_src/v2/bg_crossroad_top2.png";;
  yt_walk_away) refs="$ROOT/art_src/v2/guides/yt_walk_away.png $R/touya/c20081208_whitealbum_1_10_cs1w1_700x495.jpg $R/touya/c20081208_whitealbum_1_09_cs1w1_700x495.jpg $K/y_walk_full.png";;
  bg_crossroad_top) refs="$ROOT/art_src/v2/bg_street_night.png";;
  obj_table_set) refs="$ROOT/art_src/v2/guides/obj_table_set.png $ROOT/art_src/v2/bg_his_room_warm2.png";;
  h_press_hand2|h_press_hand3|h_press_hand4|h_press_hand4a|h_press_hand4b|h_card_hold) refs="$ROOT/art_src/v2/guides/$n.png $ROOT/art_src/v2/h_finger_glass.png";;
  obj_phone_panel|h_card_hand|h_press_hand) refs="$ROOT/art_src/v2/guides/$n.png $K/h_joined.png";;
  h_finger_glass) refs="$K/y_walk_full.png $K/h_glass.png";;
  h_dial_b) refs="$ROOT/art_src/v2/h_card_insert.png $K/y_walk_full.png";;
  passer*|crowd*|kanji*|h_*) refs="$K/y_walk_full.png";;
  *) refs="$R/anime2009/c20081112_wa_02_cs1w1_700x495.jpg $R/anime2009/c20081112_wa_05_cs1w1_700x558.jpg $K/y_profile_up.png";;
esac
$ROOT/tools/codex_gen.sh $ROOT/art_src/v2/$n.png $n.txt $refs < /dev/null >> done.txt
