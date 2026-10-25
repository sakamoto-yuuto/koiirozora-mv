"""Bring the APPROVED v2 art (REVIEW.md ✅) into the engine. Run from the project root:
    .venv/Scripts/python art_src/v2/ingest.py [name ...]        (no names = everything in the table)
Three ways in:
  fig    a three-ink figure on green -> keyed RGBA in assets/art (src/engine/art.js separates the plates)
  seq    a sequence sheet -> registered single frames <name>_0.. in assets/art (tools/slice_sheet.py)
  plate  a whole background -> ink-label map in assets/plates (tools/plate_art.py)
  objm   the same on a MAGENTA screen (green objects: the public phone)
  obj    an object / figure with more than three inks on green -> keyed ink-label map in assets/plates (plate_art --key)
  seqtop / seqobjtop  the same, registered on the head (walk cycles)
  set    a set sheet of separate objects (one camera, one light) -> one keyed ink-label plate per object; the
         names of the parts are the 3rd field (reading order), see tools/split_set.py
  seqobj a sequence sheet whose frames need more inks (a hairline tear on skin) -> frames as keyed ink-label maps
config.json -> art / plates is updated to list what is there.
"""
import json, os, subprocess, sys

PY = sys.executable
SRC = 'art_src/v2'
# engine name: (method, source file, frames)
TABLE = {
    # backgrounds
    'bg_street_night': ('plate', 'bg_street_night', 0),
    'bg_street_dusk': ('plate', 'bg_street_dusk2', 0),
    'bg_street_dawn': ('plate', 'bg_street_dawn2', 0),
    'bg_his_room_night': ('plate', 'bg_his_room_night2', 0),
    'bg_his_room_warm': ('plate', 'bg_his_room_warm2', 0),
    'bg_her_room_night': ('plate', 'bg_her_room_night', 0),
    'bg_platform_night': ('plate', 'bg_platform_night', 0),
    'bg_window_old': ('plate', 'bg_window_old', 0),
    'bg_his_apt_ext': ('plate', 'bg_his_apt_ext', 0),
    'bg_tv_shop': ('plate', 'bg_tv_shop2', 0),
    'bg_booth_front': ('plate', 'bg_booth_front', 0),
    'bg_window_couple': ('plate', 'bg_window_couple', 0),
    'bg_window_family': ('plate', 'bg_window_family2', 0),
    'bg_platform_across': ('plate', 'bg_platform_across', 0),
    'bg_crossroad_top': ('plate', 'bg_crossroad_top2', 0),
    # objects with more inks than the three of a figure
    'obj_train_car': ('obj', 'bg_train_car', 0),
    'h_card_insert': ('obj', 'h_card_insert', 0),
    'crowd_concert': ('obj', 'crowd_concert', 0),
    'fg_pole_near': ('obj', 'fg_pole_near', 0),
    'fg_snowbank_near': ('obj', 'fg_snowbank_near', 0),
    'passers_a': ('obj', 'passers_a', 0),
    'passers_b': ('obj', 'passers_b', 0),
    # him (official turnaround: hoodie, collar lining, shoes, backpack are inks of their own)
    'yt_back_crowd': ('obj', 'yt_back_crowd', 0),
    'yt_back_bust': ('obj', 'yt_back_bust', 0),
    'yt_look_up': ('obj', 'yt_look_up', 0),
    'obj_tanzaku': ('obj', 'obj_tanzaku', 0),
    'yt_hands_back': ('obj', 'yt_hands_back', 0),
    'his_enter_back': ('obj', 'his_enter_back', 0),
    'his_hand_press': ('obj', 'his_hand_press_nokey', 0),       # the key under the finger masked out (user: press the machine's own key)
    'yt_walk_back': ('seqobjtop', 'yt_walk_back', 4),
    'yt_scarf': ('obj', 'yt_scarf', 0),
    'yt_walk_away': ('seqobjtop', 'yt_walk_away', 4),
    'yt_walk_side': ('seqobjtop', 'yt_walk_rear34a', 4),
    'passer_turn': ('seqobj', 'passer_turn_sheet', 2),
    'yt_train_window': ('obj', 'yt_train_window', 0),
    'obj_machine': ('seqobj', 'obj_machine_sheet', 3),
    # her: three-ink figures and sequences
    'y_wait': ('seq', 'y_wait_sheet', 2),
    'y_listen': ('seq', 'y_listen_sheet', 2),
    'y_eye_tear': ('seqobj', 'y_eye_tear_sheet', 3),
    'y_wave': ('seq', 'y_wave_sheet', 3),
    'y_stage': ('seq', 'y_stage_sheet', 2),
    'y_stop_back': ('fig', 'y_stop_back', 0),
    'y_lift': ('seq', 'y_lift_sheet', 3),
    'y_smile': ('seq', 'y_smile_sheet', 2),
    'y_walk': ('seqtop', 'y_walk_sheet', 4),
    'y_walk_away': ('seqtop', 'y_walk_awaye', 4),
    'y_receiver_close': ('seq', 'y_receiver_close_sheet', 2),
    'kanji_jaku': ('fig', 'kanji_jaku', 0),
    'h_press_hand': ('fig', 'h_press_hand4b', 0),
    'y_fist_booth': ('fig', 'y_fist_booth', 0),
    'y_card_look': ('fig', 'y_card_look', 0),
    'h_card_hold': ('fig', 'h_card_hold', 0),
    'h_card_hand': ('fig', 'h_card_hand', 0),
    'h_finger_glass': ('fig', 'h_finger_glass', 0),
    'obj_phone_panel': ('objm', 'obj_phone_panel', 0),
    'footprints': ('set', 'fx_footprints', 'fx_fp_top_her_L,fx_fp_top_her_R,fx_fp_top_his_L,fx_fp_top_his_R,fx_fp_mid_her_L,fx_fp_mid_her_R,fx_fp_mid_his_L,fx_fp_mid_his_R,fx_fp_low_her_L,fx_fp_low_her_R,fx_fp_low_his_L,fx_fp_low_his_R'),
    'table_set': ('set', 'obj_table_set', 'o2_mug_cream,o2_mug_amber,o2_cassette,o2_keys,o2_magazine,o2_camellia,o2_gloves'),
}

def run(*a):
    r = subprocess.run([PY, *a], capture_output=True, text=True)
    print((r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else '')
    if r.returncode: raise SystemExit(f'failed: {a}')

def main():
    names = sys.argv[1:] or list(TABLE)
    cfg = json.load(open('config.json', encoding='utf8'))
    art, plates = set(cfg.get('art', [])), set(cfg.get('plates', []))
    import tempfile
    for n in names:
        how, src, k = TABLE[n]
        f = f'{SRC}/{src}.png'
        if how == 'plate': run('tools/plate_art.py', f, n); plates.add(n)
        elif how == 'obj': run('tools/plate_art.py', f, n, '--key'); plates.add(n)
        elif how == 'objm': run('tools/plate_art.py', f, n, '--key', '--magenta'); plates.add(n)
        elif how == 'fig': run('tools/key_art.py', f, f'assets/art/{n}.png'); art.add(n)
        elif how in ('seq', 'seqtop'):
            run('tools/slice_sheet.py', f, n, str(k), *(['--anchor', 'top'] if how == 'seqtop' else []))
            art.discard(n); art.update(f'{n}_{i}' for i in range(k))
        elif how == 'set':
            tmp = tempfile.mkdtemp()
            run('tools/split_set.py', f, tmp, k)
            for part in k.split(','):
                run('tools/plate_art.py', f'{tmp}/{part}.png', part); plates.add(part)
        elif how in ('seqobj', 'seqobjtop'):
            tmp = tempfile.mkdtemp()
            run('tools/slice_sheet.py', f, n, str(k), '--out', tmp, *(['--anchor', 'top'] if how == 'seqobjtop' else []))
            for i in range(k):
                run('tools/plate_art.py', f'{tmp}/{n}_{i}.png', f'{n}_{i}'); plates.add(f'{n}_{i}')
                art.discard(f'{n}_{i}')
                if os.path.exists(f'assets/art/{n}_{i}.png'): os.remove(f'assets/art/{n}_{i}.png')
    cfg['art'] = sorted(art); cfg['plates'] = sorted(plates)
    cfg['paths']['plates'] = 'assets/plates'
    json.dump(cfg, open('config.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    print(f'config.json: {len(art)} art, {len(plates)} plates')

if __name__ == '__main__':
    main()
