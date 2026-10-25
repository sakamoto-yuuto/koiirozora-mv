"""Artifact and protected-scope verification; run with the project's Python."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from previs_common import in_blender, launch_blender, script_args

BASE = Path(__file__).resolve().parent
PROJECT = BASE.parent
PROTECTED = ("src", "assets", "art_src", "config.json", "export", "tools")


def protected_state():
    state = {}
    for entry in PROTECTED:
        root = PROJECT / entry
        paths = [root] if root.is_file() else root.rglob("*")
        for path in paths:
            if path.is_file():
                stat = path.stat()
                state[path.relative_to(PROJECT).as_posix()] = [stat.st_size, stat.st_mtime_ns]
    return state


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot-scope", action="store_true")
    parser.add_argument("--scope-only", action="store_true")
    parser.add_argument("--strict-scope", action="store_true", help="Fail on any concurrently changed protected file")
    args = parser.parse_args(script_args())
    if not in_blender() and not (args.snapshot_scope or args.scope_only):
        raise SystemExit(launch_blender(__file__, script_args()))
    scope_file = BASE / "_tmp/scope_before.json"
    if args.snapshot_scope:
        if scope_file.exists():
            raise SystemExit("Scope snapshot already exists; retaining original baseline.")
        scope_file.parent.mkdir(parents=True, exist_ok=True)
        state = protected_state()
        scope_file.write_text(json.dumps(state, indent=2), encoding="utf-8")
        print(f"Protected scope baseline: {len(state)} files")
        return
    before = json.loads(scope_file.read_text(encoding="utf-8"))
    now = protected_state()
    changed = [key for key in sorted(before.keys() | now.keys()) if before.get(key) != now.get(key)]
    scope_report = {"baseline_files": len(before), "current_files": len(now),
                    "changed_since_baseline": changed,
                    "note": "Observation only: other workflows share the project. Does not attribute file writes."}
    (BASE / "out").mkdir(exist_ok=True)
    (BASE / "out/scope_observation.json").write_text(json.dumps(scope_report, indent=2), encoding="utf-8")
    if changed:
        print(f"SCOPE OBSERVATION: {len(changed)} protected paths changed concurrently; see out/scope_observation.json")
        if args.strict_scope:
            raise AssertionError(f"Protected files changed: {changed}")
    else:
        print(f"Protected scope unchanged: {len(now)} files")
    if args.scope_only:
        return
    from render_guides import load_pixels
    import numpy as np
    outputs = []
    for shot_file in sorted((BASE / "shots").glob("*.json")):
        shot = json.loads(shot_file.read_text(encoding="utf-8"))
        for mode in ("line", "clay", "depth"):
            path = BASE / "out" / f"{shot['name']}_{mode}.png"
            arr = load_pixels(path)
            expected = (941, 1672) if shot.get("orientation") == "portrait" else (1672, 941)
            size = (arr.shape[1], arr.shape[0])
            assert size == expected, (path.name, size, expected)
            assert arr.std() > 3, f"Blank render: {path.name}"
            if mode == "line":
                region = arr[62:-38].astype(np.int16)
                assert np.mean(np.all(region > 245, axis=2)) > 0.55, f"Not white-background line art: {path.name}"
                assert np.count_nonzero(region.max(axis=2) < 100) > 100
                if shot.get("characters"):
                    for panel in np.array_split(region, len(shot.get("frames", [{}])), axis=1):
                        blue = (panel[:,:,2] > panel[:,:,0]+40) & (panel[:,:,2] > panel[:,:,1]+20)
                        red = (panel[:,:,0] > panel[:,:,1]+40) & (panel[:,:,0] > panel[:,:,2]+30)
                        for side in shot.get("qa_visible_sides", ["L", "R"]):
                            assert (blue if side == "L" else red).sum() > 10, f"Anatomical side {side} color missing: {path.name}"
            if mode == "depth":
                assert np.array_equal(arr[:, :, 0], arr[:, :, 1])
                assert np.array_equal(arr[:, :, 1], arr[:, :, 2])
                assert int(arr.max()) > int(arr.min()) + 40
            outputs.append({"file": path.relative_to(BASE).as_posix(), "bytes": path.stat().st_size,
                            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    contact = load_pixels(BASE / "out/contact.png")
    assert contact.shape[1] > 1000 and contact.shape[0] > 1000
    assert (BASE / "previs.blend").stat().st_size > 10000
    report = {"scope_observation": scope_report, "guide_count": len(outputs), "guides": outputs}
    (BASE / "out/verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"PASS: {len(outputs)} guide PNGs (dimensions, line colors, nonblank depth), contact sheet, saved .blend")


if __name__ == "__main__":
    main()
