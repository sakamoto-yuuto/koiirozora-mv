#!/usr/bin/env python3
"""R02 experiment A: SOFA (Singing-Oriented Forced Aligner), Japanese model.

SOFA is a frame/edge acoustic model trained on singing; it is *not* a CTC
aligner.  We feed each LRC line as a short vocal-stem segment with its phone
sequence (Phoneme G2P), then map the phone boundaries back to morae.

One command (from the project root):
  tools/align_lab/sofa/.venv/Scripts/python tools/align_lab/sofa/run.py
Add --limit 3 for a smoke test, --device cpu to force CPU.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "tools/align_lab"))
import common  # noqa: E402

SOFA_DIR = HERE / "SOFA"
CKPT = ROOT / "tools/align_lab/_cache/SOFA_model_JPN/SOFA_model_JPN_Ver0.0.2_Beta/japanese-v2.0-45000.ckpt"
WORK = ROOT / "out/align_lab/sofa/_work"


def make_segments(lines, windows, limit=None, sp_between=False):
    seg = WORK / "segments"
    if seg.exists():
        shutil.rmtree(seg)
    seg.mkdir(parents=True)
    y, sr = sf.read(str(common.VOCALS), dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    assert sr == 44100
    meta = {}
    for i, (ln, (left, right)) in enumerate(zip(lines, windows)):
        if limit is not None and i >= limit:
            break
        a, b = int(round(left * sr)), int(round(right * sr))
        wav = seg / f"line_{i:02d}.wav"
        sf.write(str(wav), y[a:b], sr, subtype="PCM_16")
        phones = []
        for ps in ln["phones"]:
            phones.extend(ps)
        if sp_between:
            tokens = ["SP"]
            for ps in ln["phones"]:
                tokens.extend(ps)
                tokens.append("SP")
            text = " ".join(tokens)
        else:
            text = " ".join(["SP"] + phones + ["SP"])
        (seg / f"line_{i:02d}.lab").write_text(text + "\n", encoding="utf-8")
        meta[i] = {"left": left, "n_units": len(ln["units"]),
                   "phone_owner": [j for j, ps in enumerate(ln["phones"]) for _ in ps],
                   "phones": phones}
    (WORK / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return seg, meta


def run_sofa(seg: Path, device: str):
    """Run SOFA in-process.

    infer.py calls Lightning's load_from_checkpoint() without weights_only,
    which PyTorch >= 2.6 rejects for this (trusted) checkpoint.  We do the same
    steps here with weights_only=False and export TextGrids.
    """
    os.chdir(SOFA_DIR)
    sys.path.insert(0, str(SOFA_DIR))
    import lightning as pl
    import torch
    import modules.AP_detector  # noqa: F401
    import modules.g2p  # noqa: F401
    from modules.AP_detector import LoudnessSpectralcentroidAPDetector
    from modules.g2p import NoneG2P
    from modules.utils.export_tool import Exporter
    from modules.utils.post_processing import post_processing
    from train import LitForcedAlignmentTask

    torch.set_grad_enabled(False)
    g2p = NoneG2P()
    g2p.set_in_format("lab")
    dataset = g2p.get_dataset(seg.rglob("*.wav"))
    model = LitForcedAlignmentTask.load_from_checkpoint(str(CKPT), weights_only=False)
    model.set_inference_mode("force")
    trainer = pl.Trainer(logger=False, accelerator="cpu" if device == "cpu" else "auto", devices=1)
    predictions = trainer.predict(model, dataloaders=dataset, return_predictions=True)
    get_ap = LoudnessSpectralcentroidAPDetector()
    predictions = get_ap.process(predictions)
    predictions, log = post_processing(predictions)
    Exporter(predictions, log).export(["textgrid"])


def parse_textgrid(path: Path):
    import textgrid
    tg = textgrid.TextGrid.fromFile(str(path))
    tier = None
    for t in tg:
        if t.name == "phones":
            tier = t
            break
    if tier is None:
        raise RuntimeError(f"no phones tier in {path}")
    return [(float(iv.minTime), float(iv.maxTime), str(iv.mark)) for iv in tier if str(iv.mark).strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", choices=["auto", "cpu"], default="auto")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--skip-infer", action="store_true")
    ap.add_argument("--sp-between", action="store_true", help="insert an SP token between morae")
    args = ap.parse_args()

    lines = common.load_lines()
    windows = common.line_windows(lines)
    seg, meta = make_segments(lines, windows, args.limit, args.sp_between)
    if not args.skip_infer:
        run_sofa(seg, args.device)

    per_line, conf = [], []
    for i, ln in enumerate(lines):
        if args.limit is not None and i >= args.limit:
            break
        m = meta[i]
        phones = parse_textgrid(seg / "TextGrid" / f"line_{i:02d}.TextGrid")
        # Keep only lexical phones, in output order.  SOFA may add AP/SP items.
        lex = [(s, e, p) for s, e, p in phones if p not in ("SP", "AP", "", "<AP>", "<SP>")]
        expected = m["phones"]
        if [p for _, _, p in lex] != expected:
            # Be forgiving about the odd dropped phone: match by sequence.
            print(f"line {i}: phone mismatch ({len(lex)} vs {len(expected)}), matching greedily", file=sys.stderr)
        times = [0.0] * m["n_units"]
        owner = m["phone_owner"]
        # Greedy in-order match of expected phones to output phones.
        k = 0
        seen = {}
        for j, p in enumerate(expected):
            while k < len(lex) and lex[k][2] != p:
                k += 1
            if k >= len(lex):
                break
            if owner[j] not in seen:
                seen[owner[j]] = lex[k][0] + m["left"]
            k += 1
        for j in range(m["n_units"]):
            times[j] = seen.get(j, float("nan"))
        # Fill morae with no acoustic phone (standalone っ) after the others.
        for j, u in enumerate(ln["units"]):
            if np.isnan(times[j]):
                if j + 1 < len(times) and not np.isnan(times[j + 1]):
                    times[j] = times[j + 1]
                elif j and not np.isnan(times[j - 1]):
                    times[j] = times[j - 1]
        times = [float(t) for t in times]
        times = common.fill_geminates(times, ln["units"])
        per_line.append(times)
        conf.append([1.0] * len(times))

    if args.limit is not None:
        (WORK / "pred.json").write_text(json.dumps(per_line, ensure_ascii=False, indent=1), encoding="utf-8")
        for i, row in enumerate(per_line):
            print(i, " ".join(f"{t:.2f}" for t in row), flush=True)
        return
    method = "sofa_jpn_sp" if args.sp_between else "sofa_jpn"
    out = common.write_alignment(
        method, "tools/align_lab/sofa/.venv/Scripts/python tools/align_lab/sofa/run.py"
                + (" --sp-between" if args.sp_between else ""),
        per_line, None)
    flat = [t for row in per_line for t in row]
    common.write_clicks(method, flat)
    common.plot_lines(method, flat)
    print("wrote", out, "morae", len(flat))


if __name__ == "__main__":
    main()
