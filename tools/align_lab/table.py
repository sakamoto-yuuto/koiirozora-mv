#!/usr/bin/env python3
"""Print the R02 comparison table from the *.eval.json files."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "out/align_lab"
METHODS = [
    ("baseline_current", "baseline (align_lyrics.py DP)", "baseline_current.json", None),
    ("sofa_jpn", "SOFA Japanese v0.0.2", "sofa_jpn.eval.json", "sofa_jpn.json"),
    ("sofa_jpn_cal", "SOFA +32 ms (proxy-calibrated)", "sofa_jpn_cal.eval.json", "sofa_jpn_cal.json"),
    ("hubertfa_jpn", "HubertFA Japanese ONNX v0.0.7", "hubertfa_jpn.eval.json", "hubertfa_jpn.json"),
    ("stable_ts_largev3", "stable-ts align + Whisper large-v3", "stable_ts_largev3.eval.json", "stable_ts_largev3.json"),
]


def main():
    print("| method | morae | median | bias | <=50 ms | <=100 ms | silence | L0 med | L10 med | L25 med |")
    print("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for key, label, ev, align in METHODS:
        p = OUT / ev
        if not p.exists():
            print(f"| {label} | - | - | - | - | - | - | - | - | - |")
            continue
        d = json.loads(p.read_text(encoding="utf-8"))
        pl = d.get("per_line", {})

        def med(i):
            v = pl.get(str(i))
            return "-" if not v else f"{v['median_abs_ms']:.1f}"
        print(f"| {label} | {d.get('morae', '-')} | {d.get('median_abs_ms', '-')} ms | "
              f"{d.get('bias_ms', '-')} ms | {d.get('hit50', 0) * 100:.1f}% | "
              f"{d.get('hit100', 0) * 100:.1f}% | {d.get('in_silence', 0) * 100:.1f}% | "
              f"{med(0)} | {med(10)} | {med(25)} |")


if __name__ == "__main__":
    main()
