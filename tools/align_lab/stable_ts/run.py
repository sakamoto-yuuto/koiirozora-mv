#!/usr/bin/env python3
"""R02 experiment B: stable-ts ``align()`` with a Japanese Whisper model.

stable-ts aligns *given text* to audio through Whisper's cross-attention /
CT2 alignment, not through a CTC phone model.  We use kotoba-whisper v2.0
(faster-whisper / CTranslate2, Japanese-specialised) on each LRC line, then map
the word/character timestamps to morae.

One command (from the project root):
  tools/align_lab/stable_ts/.venv/Scripts/python tools/align_lab/stable_ts/run.py
Options: --limit 3, --model <dir>, --device cuda|cpu, --compute-type int8_float16
"""
from __future__ import annotations

import argparse
import difflib
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "tools/align_lab"))
import common  # noqa: E402

DEFAULT_MODEL = ROOT / "tools/align_lab/_cache/models/kotoba-v2.0-faster"


def char_times(result):
    """Flatten a stable-ts result into (characters, start time of each char)."""
    chars, times = [], []
    for w in result.all_words():
        text = w.word
        for c in text:
            if c.isspace():
                continue
            chars.append(c)
            times.append(float(w.start))
    return "".join(chars), np.array(times, dtype=float)


def map_to_expected(aligned: str, a_times: np.ndarray, expected: str) -> np.ndarray:
    """Monotonic character mapping with linear interpolation across edits."""
    out = np.full(len(expected), np.nan)
    sm = difflib.SequenceMatcher(None, aligned, expected, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            out[j1:j2] = a_times[i1:i2]
        elif tag in ("replace", "insert"):
            # Use the neighbouring aligned times as the interpolation anchors.
            left = a_times[i1 - 1] if i1 > 0 else (a_times[i2] if i2 < len(a_times) else 0.0)
            right = a_times[i2] if i2 < len(a_times) else (a_times[i1] if i1 < len(a_times) else left)
            if tag == "replace" and i2 > i1:
                # spread the replaced aligned span over the expected span
                span_a = a_times[i1:i2]
                if len(span_a) == len(expected[j1:j2]):
                    out[j1:j2] = span_a
                    continue
                left, right = span_a[0], span_a[-1]
            out[j1:j2] = np.linspace(left, right, max(1, j2 - j1), endpoint=False)
    # fill unmapped characters by interpolation / nearest value
    idx = np.arange(len(expected), dtype=float)
    good = ~np.isnan(out)
    if good.any():
        out[~good] = np.interp(idx[~good], idx[good], out[good])
    else:
        out[:] = 0.0
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=str(ROOT / "tools/align_lab/_cache/models/large-v3.pt"))
    ap.add_argument("--backend", choices=["vanilla", "faster"], default="vanilla")
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--compute-type", default="int8")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--method", default="stable_ts_largev3")
    args = ap.parse_args()

    import librosa
    import stable_whisper

    print("loading", args.model, flush=True)
    if args.backend == "faster":
        model = stable_whisper.load_faster_whisper(args.model, device=args.device,
                                                   compute_type=args.compute_type)
    else:
        model = stable_whisper.load_model(args.model, device=args.device)
    lines = common.load_lines()
    windows = common.line_windows(lines)
    y, sr = librosa.load(str(common.VOCALS), sr=16000, mono=True)

    per_line, conf = [], []
    records = []
    partial_path = HERE / "partial.json"
    partial = {"times": {}, "records": []}
    if partial_path.exists():
        try:
            partial = json.loads(partial_path.read_text(encoding="utf-8"))
        except Exception:
            partial = {"times": {}, "records": []}
    for i, (ln, (left, right)) in enumerate(zip(lines, windows)):
        if args.limit is not None and i >= args.limit:
            break
        if i < args.start or str(i) in partial.get("times", {}):
            continue
        a, b = int(left * sr), int(right * sr)
        # Feed each line separately: the LRC line times are reliable anchors and
        # this keeps a hallucinated line from dragging its neighbours.
        text = " ".join(ln["units"])
        result = model.align(
            y[a:b], text, language="ja",
            original_split=False, nonspeech_skip=None,
            suppress_silence=True, max_word_dur=3.0, token_step=100,
            verbose=None,
        )
        aligned, at = char_times(result)
        exp = "".join(ln["units"])
        ct = map_to_expected(aligned, at, exp)
        # mora time = start of its first character (small kana stay in the mora)
        times, pos = [], 0
        for u in ln["units"]:
            times.append(float(ct[pos]) + left if pos < len(ct) else np.nan)
            pos += len(u)
        times = common.fill_geminates(times, ln["units"])
        for j in range(1, len(times)):
            if times[j] < times[j - 1]:
                times[j] = times[j - 1]
        partial.setdefault("times", {})[str(i)] = times
        partial.setdefault("records", []).append(
            {"line": i, "expected": exp, "aligned": aligned,
             "words": [(w.word, round(float(w.start), 3), round(float(w.end), 3))
                       for w in result.all_words()]})
        partial_path.write_text(json.dumps(partial, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"line {i:02d}: {len(result.all_words())} words, {len(aligned)} chars, "
              f"{len(exp)} expected", flush=True)

    records = partial.get("records", [])
    (HERE / "debug.json").write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    done = {int(k): v for k, v in partial.get("times", {}).items()}
    per_line = [done[i] for i in range(len(lines)) if i in done]
    if args.limit is not None:
        for i, row in enumerate(per_line):
            print(i, " ".join(f"{t:.2f}" for t in row), flush=True)
        return
    if len(per_line) != len(lines):
        raise SystemExit(f"only {len(per_line)}/{len(lines)} lines; rerun with --start {len(per_line)}")
    out = common.write_alignment(
        args.method, "tools/align_lab/stable_ts/.venv/Scripts/python tools/align_lab/stable_ts/run.py",
        per_line, None)
    flat = [t for row in per_line for t in row]
    common.write_clicks(args.method, flat)
    common.plot_lines(args.method, flat)
    print("wrote", out, "morae", len(flat))


if __name__ == "__main__":
    main()
