"""Dependency-light checks for the T12 transcript contract."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("mms_run", Path(__file__).with_name("run.py"))
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def main() -> None:
    readings = json.loads((ROOT / "data" / "lyrics_kana.json").read_text(encoding="utf-8"))["lines"]
    units = [MODULE.line_morae(line) for line in readings]
    assert len(units) == 26
    assert sum(map(len, units)) == 349
    assert list(map(len, units)) == [11, 14, 11, 9, 16, 13, 8, 12, 14, 23, 13, 11, 14, 12, 9, 15, 19, 13, 15, 13, 13, 9, 12, 14, 23, 13]
    assert MODULE.mora_units("って") == ["っ", "て"]
    assert MODULE.mora_units("まった") == ["まっ", "た"]
    assert MODULE.romanize_morae(["っ", "て"]) == ["t", "te"]
    assert MODULE.romanize_morae(["まっ", "た"]) == ["mat", "ta"]
    assert MODULE.romanize_morae(["じゅ", "ん"]) == ["ju", "n"]
    lines = json.loads((ROOT / "data" / "lyrics_film.json").read_text(encoding="utf-8"))["lines"]
    blocks = MODULE.build_jobs(lines, "block")
    assert [index for block in blocks for index in block["line_indices"]] == list(range(26))
    assert max(block["right"] - block["left"] for block in blocks) <= 34.0
    print(f"contract ok: 26 lines, 349 morae, {len(blocks)} block jobs")


if __name__ == "__main__":
    main()
