"""T12: independent reference evidence, validation, snap ablation and QA artifacts.

Dependencies live only beside this script. A base CPython may execute it when
Windows' venv redirector fails to initialize DLLs; no project venv is modified.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CACHE = ROOT / "tools/align_lab/_cache/analysis"
OUT = ROOT / "out/align_lab"
sys.path.insert(0, str(HERE / ".venv/Lib/site-packages"))
sys.path.insert(0, str(ROOT / "tools"))
for key in ("NUMBA_CACHE_DIR", "MPLCONFIGDIR"):
    os.environ[key] = str(CACHE / key.lower())
for key in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[key] = "4"

import librosa
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator
import numpy as np
from scipy.signal import find_peaks
import soundfile as sf
from align_lyrics import mora_units

SR, HOP = 22050, 110
REFERENCE_LINES = (0, 5, 10, 25)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def specs():
    lyrics = read_json(ROOT / "data/lyrics_film.json")["lines"]
    kana = read_json(ROOT / "data/lyrics_kana.json")["lines"]
    return [{"line": i, "start": l["start"], "end": l["end"], "text": l["jp"],
             "morae": [m for _, k in kline["segments"] for m in mora_units(k)]}
            for i, (l, kline) in enumerate(zip(lyrics, kana))]


def validate(data, partial=False):
    expected = specs()
    ids = [l["line"] for l in data["lines"]]
    wanted = list(REFERENCE_LINES) if partial else list(range(len(expected)))
    if ids != wanted:
        raise ValueError(f"Line IDs/order: {ids} != {wanted}")
    total = 0
    previous = -1.0
    for line in data["lines"]:
        i, marks = line["line"], line["morae"]
        if [m["k"] for m in marks] != expected[i]["morae"]:
            raise ValueError(f"L{i}: mora count/order mismatch")
        times = [m["t"] for m in marks]
        if not all(isinstance(t, (int, float)) and not isinstance(t, bool) and np.isfinite(t) and 0 <= t <= 395.5 for t in times):
            raise ValueError(f"L{i}: invalid song time")
        if any(a >= b for a, b in zip(times, times[1:])) or times[0] <= previous:
            raise ValueError(f"L{i}: timestamps are not strictly increasing")
        previous = times[-1]
        for mark in marks:
            if "conf" in mark and not 0 <= mark["conf"] <= 1:
                raise ValueError(f"L{i}: confidence out of range")
            if partial and (not mark.get("reason") or mark.get("conf") is None):
                raise ValueError(f"L{i}: every reference mark requires confidence and evidence")
        total += len(marks)
    return {"lines": len(ids), "morae": total, "strict_order": True}


def load_audio(source="vocals", sr=SR):
    path = ROOT / ("assets/audio/vocals.wav" if source == "vocals" else "assets/audio/track.mp3")
    y, _ = librosa.load(path, sr=sr, mono=True)
    return y


def features(line_no, force=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"features_v2_L{line_no:02d}.npz"
    if path.exists() and not force:
        return dict(np.load(path))
    spec = specs()[line_no]
    # Inspect the full pickup around phrase boundaries; do not assume LRC
    # start/end are phonetic boundaries when constructing the reference.
    left = max(0, spec["start"] - (4.0 if line_no in (10, 25) else .8))
    right = spec["end"] + (6.0 if line_no == 10 else 1.8)
    y, _ = librosa.load(ROOT / "assets/audio/vocals.wav", sr=SR, mono=True,
                        offset=left, duration=right-left)
    stft = np.abs(librosa.stft(y, n_fft=1024, hop_length=HOP))
    freq = librosa.fft_frequencies(sr=SR, n_fft=1024)
    db = librosa.amplitude_to_db(stft, ref=np.max)
    rms = librosa.feature.rms(y=y, frame_length=512, hop_length=HOP)[0]
    flux = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP, n_fft=1024,
                                        n_mels=96, fmax=4000, lag=2, max_size=3)
    f0, voiced, probability = librosa.pyin(y, fmin=130, fmax=1100, sr=SR,
                                          frame_length=1024, hop_length=HOP*2,
                                          n_thresholds=20)
    result = {"left": left, "right": right, "t": left+np.arange(len(rms))*HOP/SR,
              "pt": left+np.arange(len(f0))*HOP*2/SR, "f0": f0, "voiced": voiced,
              "probability": probability, "freq": freq[freq <= 4000],
              "db": db[freq <= 4000], "rms": rms, "flux": flux}
    np.savez_compressed(path, **result)
    print(f"features L{line_no}: {left:.3f}-{right:.3f}", flush=True)
    return result


def setup_font():
    font = Path("C:/Windows/Fonts/meiryo.ttc")
    if font.exists():
        from matplotlib import font_manager
        font_manager.fontManager.addfont(str(font))
        plt.rcParams["font.family"] = font_manager.FontProperties(fname=str(font)).get_name()
    plt.rcParams["axes.unicode_minus"] = False


def plot_line(line_no, destination, marks=None, ref=None, left=None, right=None):
    setup_font()
    f = features(line_no)
    left = float(f["left"]) if left is None else left
    right = float(f["right"]) if right is None else right
    fig, ax = plt.subplots(4, 1, figsize=(22, 9), sharex=True,
                           gridspec_kw={"height_ratios": [3, 1.2, 1, 1]})
    ax[0].imshow(f["db"], origin="lower", aspect="auto", cmap="magma", vmin=-65, vmax=0,
                 extent=[f["left"]-HOP/SR/2, f["left"]+(f["db"].shape[1]-.5)*HOP/SR, 0, 4000])
    ax[0].set_ylabel("Spectrum / Hz")
    ax[0].set_title(f"L{line_no} {specs()[line_no]['text']} | vocals, 5 ms hop | {Path(destination).stem}")
    ax[1].plot(f["pt"], f["f0"], ".-", ms=1, lw=.7, color="#762cba")
    ax[1].set_ylabel("pYIN F0 / Hz")
    ax[1].set_ylim(130, 1100)
    ax[2].plot(f["t"], f["rms"], lw=.8, color="#147e7e")
    ax[2].set_ylabel("RMS (23 ms)")
    ax[3].plot(f["t"][:len(f["flux"])], f["flux"], lw=.8, color="#cc6910")
    ax[3].set_ylabel("Spectral flux")
    ax[3].set_xlabel("Song time / seconds (decoded sample zero)")
    for axes in ax:
        axes.set_xlim(left, right)
        axes.xaxis.set_major_locator(MultipleLocator(.2 if right-left <= 5.5 else .5))
        axes.xaxis.set_minor_locator(MultipleLocator(.05 if right-left <= 5.5 else .1))
        axes.grid(axis="x", which="major", alpha=.3)
        axes.grid(axis="x", which="minor", alpha=.12)
    for collection, color, style, labels in ((ref, "#25e3cb", "--", False), (marks, "#2174ff", "-", True)):
        if collection:
            for j, m in enumerate(collection):
                if left <= m["t"] <= right:
                    for axes in ax:
                        axes.axvline(m["t"], color=color, lw=.8, ls=style)
                    if labels:
                        ax[0].text(m["t"]+.015, 3900-(j%3)*260, f"{j}:{m['k']}", fontsize=10,
                                   color="white", bbox={"facecolor":"#164d8e", "alpha":.8, "pad":1, "edgecolor":"none"})
    fig.tight_layout()
    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(destination, dpi=150)
    plt.close(fig)


def evidence():
    for i in REFERENCE_LINES:
        f = features(i)
        dest = OUT / "reference_evidence"
        plot_line(i, dest / f"L{i:02d}_overview.png")
        left, right = float(f["left"]), float(f["right"])
        part = 0
        while left < right:
            plot_line(i, dest / f"L{i:02d}_detail_{part}.png", left=left, right=min(right, left+4.5))
            left += 4.0
            part += 1
    print("Unlabelled reference evidence rendered. Inspect before writing manual times.", flush=True)


def snap_marks(times, candidates, radius=.080):
    """Nearest independent acoustic event within radius; never create crossings.

    Fixed settings; neither reference times nor evaluation onsets are inputs.
    If two marks would collapse/cross, keep the original mark instead.
    """
    times = np.asarray(times, dtype=float)
    candidates = np.asarray(candidates, dtype=float)
    result = times.copy()
    for i, t in enumerate(times):
        eligible = candidates[np.abs(candidates-t) <= radius+1e-12]
        if not len(eligible):
            continue
        proposed = float(eligible[np.argmin(np.abs(eligible-t))])
        lower = result[i-1] if i else -np.inf
        upper = times[i+1] if i+1 < len(times) else np.inf
        if lower < proposed < upper:
            result[i] = proposed
    return result


def snap_data(data):
    result = copy.deepcopy(data)
    result["method"] = data["method"] + "_snap80"
    result["postprocess"] = {"source": "vocals.wav", "radius_seconds": .080,
                              "features": "spectral-flux peak or voiced pitch jump >= 0.8 semitone / 10 ms",
                              "reference_used": False, "monotonic_guard": True}
    moved = 0
    for line in result["lines"]:
        f = features(line["line"])
        flux = f["flux"]
        scale = max(float(np.percentile(flux, 95)), 1e-9)
        peaks, _ = find_peaks(flux/scale, prominence=.15, distance=8)
        flux_times = f["t"][peaks]
        with np.errstate(invalid="ignore", divide="ignore"):
            pd = np.abs(np.diff(12*np.log2(f["f0"])))
        pitch_times = f["pt"][1:][np.isfinite(pd) & (pd >= .8)]
        # Do not absorb sparse/noisy events in silence.
        events = np.sort(np.r_[flux_times, pitch_times])
        energy = np.interp(events, f["t"], f["rms"])
        events = events[energy > max(float(np.max(f["rms"]))*.04, 1e-6)]
        original = [m["t"] for m in line["morae"]]
        snapped = snap_marks(original, events)
        for mark, old, new in zip(line["morae"], original, snapped):
            mark["t"] = round(float(new), 6)
            mark["snap_delta_ms"] = round((new-old)*1000, 3)
            moved += abs(new-old) > 1e-9
    result["postprocess"]["moved_morae"] = moved
    validate(result)
    return result


def reference_metrics(data, ref, high_conf=False, line_no=None):
    lookup = {(l["line"], j): m for l in ref["lines"] for j, m in enumerate(l["morae"])
              if (not high_conf or m.get("conf", 0) > .3) and (line_no is None or l["line"] == line_no)}
    errors = [m["t"]-lookup[(l["line"],j)]["t"] for l in data["lines"] for j,m in enumerate(l["morae"])
              if (l["line"],j) in lookup]
    if not errors:
        return {"n": 0}
    e = np.asarray(errors)
    return {"n": len(e), "median_abs_ms": round(float(np.median(np.abs(e)))*1000, 1),
            "bias_ms": round(float(np.median(e))*1000, 1), "hit50": round(float(np.mean(np.abs(e) <= .05)), 3),
            "hit100": round(float(np.mean(np.abs(e) <= .1)), 3)}


def clicks(data, dest):
    rate = 22050
    song = load_audio("mix", rate)
    right = np.zeros_like(song)
    pulse_t = np.arange(round(.012*rate))/rate
    pulse = (.75*np.sin(2*np.pi*1900*pulse_t)*np.exp(-pulse_t*400)).astype(np.float32)
    for line in data["lines"]:
        for mark in line["morae"]:
            start = round(mark["t"]*rate)
            stop = min(start+len(pulse), len(right))
            if stop > start:
                right[start:stop] += pulse[:stop-start]
    sf.write(dest, np.stack([song, np.clip(right, -1, 1)], axis=1), rate, subtype="PCM_16")


def qa(path):
    path = Path(path)
    data, ref = read_json(path), read_json(OUT / "reference.json")
    check = validate(data, partial=data.get("method") == "manual_reference_v1")
    validate(ref, partial=True)
    # Run the unmodified official evaluator with exactly its existing dependencies.
    bootstrap = "import sys,runpy; sys.path.insert(0,'.venv/Lib/site-packages'); sys.argv=['tools/align_eval.py']+sys.argv[1:]; runpy.run_path('tools/align_eval.py',run_name='__main__')"
    eval_path = path.with_suffix(".eval.json")
    subprocess.run([sys._base_executable, "-c", bootstrap, str(path), "--out", str(eval_path),
                    "--ref", str(OUT / "reference.json")], cwd=ROOT, check=True)
    report = read_json(eval_path)
    report["contract_validation"] = check
    report["vs_ref_high_conf"] = reference_metrics(data, ref, True)
    report["vs_ref_per_line"] = {str(i): reference_metrics(data, ref, line_no=i) for i in REFERENCE_LINES}
    report["reference_note"] = "Visual acoustic reference, not an independent human/listening gold standard; conf=0.3 marks retained in standard evaluator."
    save_json(eval_path, report)
    clicks(data, path.with_name(path.stem + "_clicks.wav"))
    ref_lines = {l["line"]: l["morae"] for l in ref["lines"]}
    line_map = {l["line"]: l["morae"] for l in data["lines"]}
    for i in (0, 10, 25):
        plot_line(i, path.with_name(path.stem + f"_L{i:02d}.png"), marks=line_map[i], ref=ref_lines.get(i))
    print(f"QA complete: {path.name}, {check}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="action", required=True)
    sub.add_parser("evidence")
    for action in ("validate", "qa", "snap"):
        child = sub.add_parser(action)
        child.add_argument("files", nargs="+")
    sub.add_parser("test")
    args = ap.parse_args()
    if args.action == "evidence":
        evidence()
    elif args.action == "test":
        import pytest
        raise SystemExit(pytest.main([str(HERE / "test_analysis.py"), "-q", "-p", "no:cacheprovider"]))
    else:
        for path in args.files:
            if args.action == "validate":
                data = read_json(path)
                print(path, validate(data, data.get("method") == "manual_reference_v1"))
            elif args.action == "snap":
                result = snap_data(read_json(path))
                result["command"] = f'python tools/align_lab/analysis/run.py snap "{Path(path).as_posix()}"'
                save_json(Path(path).with_name(Path(path).stem + "_snap80.json"), result)
            else:
                qa(path)


if __name__ == "__main__":
    main()
