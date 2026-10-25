#!/usr/bin/env python3
"""Validate every R02 alignment JSON against the contract (kana/count/order/finite)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/align_lab"))
import common  # noqa: E402

lines = common.load_lines()
expected = [[m for m in ln["units"]] for ln in lines]
methods = sys.argv[1:] or [p.stem for p in sorted((ROOT / "out/align_lab").glob("*.json"))
                           if not p.stem.endswith(".eval")]
bad = 0
for m in methods:
    p = ROOT / "out/align_lab" / f"{m}.json"
    if not p.exists():
        print(f"{m}: MISSING {p}")
        bad += 1
        continue
    d = json.loads(p.read_text(encoding="utf-8"))
    errs = []
    if len(d.get("lines", [])) != len(lines):
        errs.append(f"lines {len(d.get('lines', []))} != {len(lines)}")
    for i, ln in enumerate(d.get("lines", [])):
        want = expected[i]
        got = [x.get("k") for x in ln.get("morae", [])]
        ts = [x.get("t") for x in ln.get("morae", [])]
        if got != want:
            errs.append(f"L{i}: kana/order mismatch")
        if len(ts) != len(want):
            errs.append(f"L{i}: {len(ts)} morae != {len(want)}")
        if any(t is None or t != t for t in ts):
            errs.append(f"L{i}: missing/NaN time")
        if any(b < a - 1e-9 for a, b in zip(ts, ts[1:])):
            errs.append(f"L{i}: non-monotonic")
        if ts and (min(ts) < 0 or max(ts) > 395.5):
            errs.append(f"L{i}: time outside song")
    if errs:
        bad += 1
        print(f"{m}: FAIL")
        for e in errs[:8]:
            print("   ", e)
    else:
        print(f"{m}: OK ({sum(len(x) for x in expected)} morae, 26 lines)")
sys.exit(1 if bad else 0)
