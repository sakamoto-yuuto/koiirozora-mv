#!/usr/bin/env python3
"""R02 experiment C: HubertFA (HuBERT forced aligner for singing), Japanese ONNX.

HubertFA is the HuBERT-based successor of SOFA; its v0.0.7 ONNX bundle ships a
Japanese dictionary and a 396 MB self-contained model (the HuBERT front-end is
inside the graph).  It predicts phone boundaries with a frame/edge model and
adds a non-lexical (breath) head; no CTC decoding is involved here.

One command (from the project root):
  tools/align_lab/hubertfa/.venv/Scripts/python tools/align_lab/hubertfa/run.py
Add --limit 3 for a smoke test.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import warnings
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "tools/align_lab"))
import common  # noqa: E402

HFA_DIR = HERE / "HubertFA"
MODEL_DIR = ROOT / "tools/align_lab/_cache/hubertfa/model/1218_hfa_model_new_dict"
WORK = ROOT / "out/align_lab/hubertfa/_work"


def make_segments(lines, windows, limit=None):
    seg = WORK / "segments"
    if seg.exists():
        shutil.rmtree(seg)
    seg.mkdir(parents=True)
    y, sr = sf.read(str(common.VOCALS), dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    assert sr == 44100
    items = []
    for i, (ln, (left, right)) in enumerate(zip(lines, windows)):
        if limit is not None and i >= limit:
            break
        a, b = int(round(left * sr)), int(round(right * sr))
        wav = seg / f"line_{i:02d}.wav"
        # Half a second of true digital silence in front gives the initial SP
        # somewhere to live; without it the DP can start the first phone at
        # frame 0 (a systematic ~0.4 s early bias on every line's first mora).
        prepad = 0.5
        sf.write(str(wav), np.concatenate([np.zeros(int(prepad * sr), dtype=np.float32), y[a:b]]),
                 sr, subtype="PCM_16")

        # One "word" per mora, but do NOT insert SP between words: the acoustic
        # model only needs the phone sequence; word ids are used to group the
        # returned phone intervals back into morae.
        word_units = [j for j, ps in enumerate(ln["phones"]) if ps]
        word_index = {j: w for w, j in enumerate(word_units)}
        ph_seq = ["SP"]
        ph_owner = []
        for j in word_units:
            for p in ln["phones"][j]:
                ph_seq.append("ja/" + p)
                ph_owner.append(word_index[j])
        ph_seq.append("SP")
        ph_owner.append(-1)
        items.append({
            "line": i, "left": left - prepad, "wav": wav, "n_units": len(ln["units"]),
            "word_units": word_units, "ph_seq": ph_seq,
            "word_seq": [str(j) for j in word_units], "ph_owner": ph_owner,
        })
    (WORK / "items.json").write_text(json.dumps(
        [{k: (str(v) if isinstance(v, Path) else v) for k, v in it.items()} for it in items],
        ensure_ascii=False), encoding="utf-8")
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    lines = common.load_lines()
    windows = common.line_windows(lines)
    items = make_segments(lines, windows, args.limit)

    os.chdir(HFA_DIR)
    sys.path.insert(0, str(HFA_DIR))
    from onnx_infer import InferenceOnnx  # noqa: E402

    inf = InferenceOnnx(onnx_path=MODEL_DIR / "model.onnx")
    inf.load_config()
    inf.init_decoder()
    inf.load_model()
    for it in items:
        inf.dataset.append((it["wav"], it["ph_seq"], it["word_seq"], it["ph_owner"]))
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        inf.infer(non_lexical_phonemes="AP", pad_times=1, pad_length=0.0)
    (WORK / "warnings.log").write_text("\n".join(str(w.message) for w in caught), encoding="utf-8")

    by_line = {}
    for wav_path, wav_length, words in inf.predictions:
        name = Path(wav_path).stem
        i = int(name.split("_")[1])
        got = {}
        for w in words:
            t = str(w.text)
            if t.isdigit():
                got[int(t)] = float(w.start)
        by_line[i] = got

    per_line, conf = [], []
    for it in items:
        i = it["line"]
        got = by_line.get(i, {})
        times = [float("nan")] * it["n_units"]
        for j in it["word_units"]:
            if j in got:
                times[j] = got[j] + it["left"]
        for j, u in enumerate(lines[i]["units"]):
            if np.isnan(times[j]):
                if j + 1 < len(times) and not np.isnan(times[j + 1]):
                    times[j] = times[j + 1]
                elif j and not np.isnan(times[j - 1]):
                    times[j] = times[j - 1]
        times = common.fill_geminates([float(t) for t in times], lines[i]["units"])
        per_line.append(times)
        conf.append([1.0] * len(times))

    if args.limit is not None:
        (WORK / "pred.json").write_text(json.dumps({"per_line": per_line, "words": by_line},
                                                   ensure_ascii=False, indent=1), encoding="utf-8")
        for i, row in enumerate(per_line):
            print(i, " ".join(f"{t:.2f}" for t in row), flush=True)
        return
    out = common.write_alignment(
        "hubertfa_jpn", "tools/align_lab/hubertfa/.venv/Scripts/python tools/align_lab/hubertfa/run.py",
        per_line, None)
    flat = [t for row in per_line for t in row]
    common.write_clicks("hubertfa_jpn", flat)
    common.plot_lines("hubertfa_jpn", flat)
    print("wrote", out, "morae", len(flat))


if __name__ == "__main__":
    main()
