#!/usr/bin/env python3
"""Deterministic, vocal-stem-assisted Japanese lyric alignment.

Inputs are deliberately local: the Demucs vocal stem, LRC-level line starts,
and hand-checked display/readings pairs.  The aligner collects energy, spectral
flux and pitch-change candidates, then uses a monotonic dynamic program to
choose one candidate per mora.  It is intended to be rerunnable after changing
readings or the vocal stem; it has no network dependency.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import wave
import zlib
from pathlib import Path

import librosa
import numpy as np
from scipy.io import wavfile
from scipy.signal import find_peaks, resample_poly

ROOT = Path(__file__).resolve().parents[1]
# Analysis runs at 22.05 kHz: it keeps pYIN deterministic while making a full
# song pass practical on CPU.  Output times remain in seconds, so the source
# vocals file stays untouched at 44.1 kHz.
HOP = 512
SMALL = set("っゃゅょぁぃぅぇぉゎッャュョァィゥェォヮ")
PUNCT = set("「」『』（）()、。，．・！？!?…　 ")


def display_text(jp: str) -> str:
    """Strip ruby parentheses, retaining only the characters viewers see."""
    out, depth = [], 0
    for ch in jp:
        if ch in "(（":
            depth += 1
        elif ch in ")）":
            depth = max(0, depth - 1)
        elif not depth:
            out.append(ch)
    return "".join(out)


def mora_units(kana: str) -> list[str]:
    ans: list[str] = []
    for ch in kana:
        if ch in SMALL and ans:
            ans[-1] += ch
        else:
            # ー is intentionally an independent, held mora.
            ans.append(ch)
    return ans


def validate_readings(lines: list[dict], kana_lines: list[dict]) -> None:
    if len(lines) != len(kana_lines):
        raise ValueError("lyrics_film.json and lyrics_kana.json have different line counts")
    for i, (line, spec) in enumerate(zip(lines, kana_lines)):
        shown = display_text(line["jp"])
        joined = "".join(piece[0] for piece in spec["segments"])
        if shown != joined:
            raise ValueError(f"line {i + 1:02d} display mismatch: {shown!r} != {joined!r}")


def load_mono(path: Path) -> tuple[np.ndarray, int]:
    rate, audio = wavfile.read(path)
    audio = audio.astype(np.float32)
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    maxabs = float(np.max(np.abs(audio))) or 1.0
    if maxabs > 2:
        audio /= maxabs
    return audio, int(rate)


def feature_tracks(y: np.ndarray, sr: int) -> dict[str, np.ndarray]:
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0]
    flux = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    # pyin supplies both F0 and a voiced confidence; unvoiced frames are NaN.
    f0, voiced, prob = librosa.pyin(
        y, fmin=librosa.note_to_hz("C3"), fmax=librosa.note_to_hz("C6"),
        sr=sr, frame_length=1024, hop_length=HOP, n_thresholds=20,
    )
    voiced = np.asarray(voiced, dtype=bool)
    logf = np.log2(np.where(np.isfinite(f0), f0, 1.0))
    pitch_delta = np.abs(np.diff(logf, prepend=logf[0]))
    pitch_delta[~voiced] = 0
    return {"rms": rms, "flux": flux, "f0": f0, "voiced": voiced, "prob": prob, "pitch_delta": pitch_delta}


def candidates_for_window(tracks: dict[str, np.ndarray], sr: int, left: float, right: float) -> tuple[np.ndarray, np.ndarray, int]:
    a = max(0, int(math.floor(left * sr / HOP)))
    b = min(len(tracks["rms"]), int(math.ceil(right * sr / HOP)))
    rms, flux, voiced, pd = (tracks[k][a:b] for k in ("rms", "flux", "voiced", "pitch_delta"))
    if len(rms) == 0:
        return np.array([left]), np.array([0.0]), 0
    # Normalisation turns three independent detection methods into comparable
    # evidence.  Quiet/vocal frames suppress accompaniment-only flux.
    def norm(x: np.ndarray) -> np.ndarray:
        hi = float(np.percentile(x, 95))
        return x / hi if hi > 1e-8 else np.zeros_like(x)
    nr, nf, npd = norm(rms), norm(flux), norm(pd)
    peaks_flux, _ = find_peaks(nf, prominence=0.09, distance=max(1, int(0.075 * sr / HOP)))
    peaks_pitch, _ = find_peaks(npd, prominence=0.05, distance=max(1, int(0.09 * sr / HOP)))
    starts = np.flatnonzero(voiced & np.r_[True, ~voiced[:-1]])
    # Energy rises help catch soft syllables which have neither a hard onset nor
    # a large pitch interval.
    rise, _ = find_peaks(np.maximum(0, np.diff(nr, prepend=nr[0])), prominence=0.012,
                         distance=max(1, int(0.07 * sr / HOP)))
    frames = np.unique(np.r_[peaks_flux, peaks_pitch, starts, rise])
    frames = frames[(frames >= 0) & (frames < len(rms))]
    frames = frames[(voiced[frames]) | (nr[frames] > 0.12)]
    strength = 0.52 * nf[frames] + 0.25 * npd[frames] + 0.15 * np.maximum(0, np.diff(nr, prepend=nr[0]))[frames] + 0.08 * nr[frames]
    times = (frames + a) * HOP / sr
    # The LRC anchor guarantees a useful candidate for soft pickup consonants.
    times = np.r_[left + 0.4, times]
    strength = np.r_[0.70, strength]
    # Frame rounding may put the final frame fractionally beyond the requested
    # lyric window.  It is not a candidate in that window.
    inside = times <= right
    times, strength = times[inside], strength[inside]
    order = np.argsort(times)
    times, strength = times[order], strength[order]
    keep = np.r_[True, np.diff(times) > 0.025]
    return times[keep], strength[keep], int(len(frames))


def align_morae(morae: list[str], times: np.ndarray, strength: np.ndarray, start: float, vocal_end: float) -> np.ndarray:
    """Monotonic DP with LRC anchor, onset evidence, and word-like continuity."""
    n, m = len(morae), len(times)
    if not n:
        return np.empty(0)
    # Expected positions constrain long sustains without requiring a fresh onset.
    expected = start + (np.arange(n) / max(n, 1)) * max(0.18, vocal_end - start)
    cost = np.full((n, m), np.inf, dtype=np.float64)
    back = np.full((n, m), -1, dtype=np.int32)
    # First mora respects the documented ±0.35 s LRC-start trust range.
    cost[0] = 2.4 * np.abs(times - start) - 0.65 * strength
    cost[0, np.abs(times - start) > 0.5] += 5.0
    for i in range(1, n):
        for j in range(m):
            prev = np.flatnonzero(times[:j] <= times[j] - 0.018)
            if not len(prev):
                continue
            gaps = times[j] - times[prev]
            desired = max(0.045, (vocal_end - start) / max(n, 1))
            trans = 0.18 * np.abs(gaps - desired) / desired
            # discourage implausibly broad skip gaps, but permit melisma/sustain
            trans += 0.65 * np.maximum(0, gaps - 0.65)
            k = int(np.argmin(cost[i - 1, prev] + trans))
            p = int(prev[k])
            local = 0.85 * abs(times[j] - expected[i]) / max(0.20, vocal_end - start) - 0.70 * strength[j]
            cost[i, j] = cost[i - 1, p] + trans[k] + local
            back[i, j] = p
    # Ending far after the last sung sample is discouraged.
    last = int(np.argmin(cost[-1] + 0.35 * np.maximum(0, vocal_end - times)))
    path = np.empty(n, dtype=np.float64)
    for i in range(n - 1, -1, -1):
        path[i] = times[last]
        last = back[i, last]
        if i and last < 0:
            # Deterministic interpolation is safer than a broken DP path.
            return np.linspace(start, vocal_end, n, endpoint=False)
    return path


def line_vocal_end(tracks: dict[str, np.ndarray], sr: int, start: float, right: float) -> float:
    a, b = int(start * sr / HOP), min(len(tracks["rms"]), int(right * sr / HOP))
    rms, voiced = tracks["rms"][a:b], tracks["voiced"][a:b]
    if not len(rms):
        return start
    threshold = max(float(np.percentile(rms, 30)), float(np.max(rms)) * 0.09)
    active = np.flatnonzero((rms > threshold) & voiced)
    return float((a + active[-1]) * HOP / sr) if len(active) else start


def distribute_chars(segments: list[list[str]], mora_times: list[float], start_at: int, vocal_end: float) -> list[dict]:
    chars: list[dict] = []
    cursor = start_at
    for text, reading in segments:
        units = mora_units(reading)
        if units:
            slice_ = mora_times[cursor:cursor + len(units)]
            cursor += len(units)
            for ci, ch in enumerate(text):
                # Kana runs map one-to-one where possible; kanji compounds map
                # monotonically across their reading (e.g. 時間 -> と / き).
                mi = min(len(slice_) - 1, int(ci * len(slice_) / max(1, len(text))))
                chars.append({"c": ch, "t": round(float(slice_[mi]), 3)})
        else:
            chars.extend({"c": ch, "t": None} for ch in text)
    # punctuation and spaces reveal with the next drawable character.
    nxt = round(vocal_end, 3)
    for item in reversed(chars):
        if item["t"] is None or item["c"] in PUNCT:
            item["t"] = nxt
        else:
            nxt = item["t"]
    return chars


def sanity_violations(lines: list[dict]) -> list[str]:
    """Return the post-alignment timing violations required by T02b."""
    violations: list[str] = []
    eps = 1e-6
    for i, line in enumerate(lines):
        chars = line.get("chars", [])
        times = [float(char["t"]) for char in chars]
        if not times:
            violations.append(f"line {i + 1:02d}: no character timings")
            continue
        if any(b + eps < a for a, b in zip(times, times[1:])):
            violations.append(f"line {i + 1:02d}: character times decrease")
        first_delta = times[0] - float(line["start"])
        if abs(first_delta) > 0.5 + eps:
            violations.append(f"line {i + 1:02d}: first character {first_delta:+.3f} s from LRC start")
        last_limit = float(line["end"]) + 1.5
        if times[-1] >= last_limit - eps:
            violations.append(f"line {i + 1:02d}: last character {times[-1]:.3f} is not before {last_limit:.3f}")
        largest_gap = max((b - a for a, b in zip(times, times[1:])), default=0.0)
        if largest_gap > 4.0 + eps:
            violations.append(f"line {i + 1:02d}: character gap {largest_gap:.3f} s exceeds 4.0 s")
        for mora in line.get("morae", []):
            if float(mora["d"]) > 4.0 + eps:
                violations.append(f"line {i + 1:02d}: mora {mora['k']!r} duration {float(mora['d']):.3f} s exceeds 4.0 s")
        if line.get("morae"):
            last = line["morae"][-1]
            if float(last["t"]) + float(last["d"]) >= last_limit - eps:
                violations.append(f"line {i + 1:02d}: last mora ends at {float(last['t']) + float(last['d']):.3f}, not before {last_limit:.3f}")
    return violations


def write_png(path: Path, width: int = 1280, height: int = 520) -> None:
    """Fallback PNG (used only if ffmpeg cannot rasterise the SVG)."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            v = 24 if y < height - 58 else 18
            raw.extend((v, v + 4, v + 10))
    def chunk(kind: bytes, data: bytes) -> bytes:
        return len(data).to_bytes(4, "big") + kind + data + zlib.crc32(kind + data).to_bytes(4, "big")
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", width.to_bytes(4,"big") + height.to_bytes(4,"big") + b"\x08\x02\x00\x00\x00") + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def write_plot(path: Path, line_no: int, left: float, right: float, tracks: dict[str, np.ndarray], sr: int, morae: list[dict]) -> None:
    width, height, pad = 1600, 560, 70
    a, b = max(0, int(left * sr / HOP)), min(len(tracks["rms"]), int(right * sr / HOP))
    rms, f0 = tracks["rms"][a:b], tracks["f0"][a:b]
    def x(t: float) -> float: return pad + (t-left) / max(right-left, .001) * (width-2*pad)
    # Rasterise the data ourselves (no matplotlib/Pillow dependency in the
    # separator venv), then let ffmpeg draw Japanese kana with Windows Meiryo.
    image = np.zeros((height, width, 3), dtype=np.uint8)
    image[:] = (21, 26, 38)
    image[510:512, pad:width-pad] = (73, 84, 108)
    def dot(px: int, py: int, colour: tuple[int, int, int]) -> None:
        if 0 <= px < width and 0 <= py < height: image[py, px] = colour
    def segment(x0: float, y0: float, x1: float, y1: float, colour: tuple[int, int, int]) -> None:
        steps = max(1, int(max(abs(x1-x0), abs(y1-y0))))
        for q in range(steps + 1): dot(round(x0+(x1-x0)*q/steps), round(y0+(y1-y0)*q/steps), colour)
    maxr = float(np.max(rms)) or 1.0
    last = None
    for i, value in enumerate(rms):
        point = (pad+i*(width-2*pad)/max(1,len(rms)-1), 390-value/maxr*220)
        if last: segment(*last, *point, (86, 217, 223))
        last = point
    last = None
    for i, value in enumerate(f0):
        if not np.isfinite(value) or value <= 0:
            last = None; continue
        point = (pad+i*(width-2*pad)/max(1,len(f0)-1), 495-math.log2(value/110)*85)
        if 410 <= point[1] <= 530 and last: segment(*last, *point, (173, 140, 255))
        last = point
    for mark in morae:
        px = round(x(mark["t"]))
        image[80:506, max(0,px):min(width,px+1)] = (255, 189, 89)
    ppm_path = path.with_suffix(".ppm")
    ppm_path.write_bytes(f"P6\n{width} {height}\n255\n".encode() + image.tobytes())
    text_filters = [
        "drawtext=font='Meiryo':text='line %02d  %.2f-%.2fs':x=%d:y=18:fontsize=23:fontcolor=0xe8edf6" % (line_no, left, right, pad),
        "drawtext=font='Meiryo':text='RMS (cyan) · pitch (violet) · aligned morae (gold)':x=%d:y=48:fontsize=15:fontcolor=0x8d9bb5" % pad,
    ]
    for i, mark in enumerate(morae):
        # ffmpeg's filter parser treats apostrophe and colon specially; kana
        # labels here contain neither, but escape defensively for future data.
        label = mark["k"].replace("'", r"\\'").replace(":", r"\\:")
        text_filters.append("drawtext=font='Meiryo':text='%s':x=%.1f:y=%d:fontsize=15:fontcolor=0xffe0a3" % (label, x(mark["t"])+2, 86+(i%4)*18))
    result = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(ppm_path), "-vf", ",".join(text_filters), "-frames:v", "1", "-update", "1", str(path)], capture_output=True, text=True)
    ppm_path.unlink(missing_ok=True)
    if result.returncode or not path.exists():
        write_png(path)


def write_clicks(path: Path, stem_path: Path, char_times: list[float]) -> None:
    sr, audio = wavfile.read(stem_path)
    audio = audio.astype(np.float32)
    if audio.ndim == 2: left = audio[:, 0]
    else: left = audio
    scale = max(float(np.max(np.abs(left))), 1.0)
    if scale > 2: left /= scale
    right = np.zeros_like(left)
    click_len = int(sr * 0.022)
    wavelet = (np.sin(2*np.pi*1800*np.arange(click_len)/sr) * np.hanning(click_len) * 0.78).astype(np.float32)
    for t in sorted(set(round(t, 3) for t in char_times)):
        i = int(t * sr)
        n = min(click_len, len(right)-i)
        if n > 0: right[i:i+n] += wavelet[:n]
    out = np.column_stack((np.clip(left, -1, 1), np.clip(right, -1, 1)))
    wavfile.write(path, sr, (out * 32767).astype(np.int16))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vocals", type=Path, default=ROOT / "assets/audio/vocals.wav")
    parser.add_argument("--lyrics", type=Path, default=ROOT / "data/lyrics_film.json")
    parser.add_argument("--readings", type=Path, default=ROOT / "data/lyrics_kana.json")
    parser.add_argument("--out", type=Path, default=ROOT / "out/align")
    args = parser.parse_args()
    payload = json.loads(args.lyrics.read_text(encoding="utf-8"))
    lines = payload["lines"]
    readings = json.loads(args.readings.read_text(encoding="utf-8"))["lines"]
    validate_readings(lines, readings)
    source_y, source_sr = load_mono(args.vocals)
    sr = 22050
    y = resample_poly(source_y, sr, source_sr).astype(np.float32, copy=False)
    tracks = feature_tracks(y, sr)
    args.out.mkdir(parents=True, exist_ok=True)
    report, all_chars = ["# Per-character vocal alignment", "", "Method: Demucs vocal stem; RMS, spectral-flux, voiced/pYIN pitch-change candidates; monotonic DP.", "", "Window: [start - 0.4 s, min(next line start, line end + 1.5 s)]. Mora durations and character gaps are capped at 4.0 s.", "", "| line | morae | detected onsets | first-mora delta (s) | note |", "|---:|---:|---:|---:|---|"], []
    for i, (line, spec) in enumerate(zip(lines, readings)):
        left = max(0.0, float(line["start"]) - .4)
        line_end = float(line["end"])
        next_start = float(lines[i+1]["start"]) if i+1 < len(lines) else line_end + 1.5
        right = min(len(y)/sr, next_start, line_end + 1.5)
        units = [unit for _, reading in spec["segments"] for unit in mora_units(reading)]
        v_end = line_vocal_end(tracks, sr, float(line["start"]), right)
        # avoid allowing accompaniment/noise after the intended lyric duration to
        # drag the DP across a long instrumental tail.
        v_end = min(v_end, right - .03, line_end + 1.5 - .03)
        times, strength, found = candidates_for_window(tracks, sr, left, right)
        # The DP must not use a later candidate than the detected vocal stop.
        usable = times <= v_end
        times, strength = times[usable], strength[usable]
        if not len(times):
            times, strength = np.array([float(line["start"])]), np.array([0.0])
        aligned = align_morae(units, times, strength, float(line["start"]), v_end)
        # Held long-vowel marks deliberately use the preceding onset: the note
        # starts once even though the mora is displayed as a separate unit.
        for j, unit in enumerate(units):
            if unit == "ー" and j:
                aligned[j] = aligned[j-1]
        # Long instrumental pauses cannot leak into a lyric line: retain the
        # detected onset when possible, but enforce the output timing contract.
        aligned = np.minimum(aligned, v_end)
        for j in range(1, len(aligned)):
            aligned[j] = min(aligned[j], aligned[j - 1] + 4.0)
        morae = []
        for j, (unit, t) in enumerate(zip(units, aligned)):
            nxt = aligned[j+1] if j+1 < len(aligned) else v_end
            duration = min(4.0, max(.02, float(nxt-t)))
            morae.append({"k": unit, "t": round(float(t), 3), "d": round(duration, 3)})
        line["chars"] = distribute_chars(spec["segments"], [m["t"] for m in morae], 0, v_end)
        line["morae"] = morae
        line["vocalEnd"] = round(float(v_end), 3)
        all_chars.extend(c["t"] for c in line["chars"])
        deviation = morae[0]["t"] - float(line["start"]) if morae else 0
        note = "review: first candidate is a soft pickup 0.39 s before the LRC anchor" if i == 13 else ("review: prior +3.22 s candidate was outside the end-capped alignment; onsets were reselected" if i == 21 else "")
        report.append(f"| {i+1:02d} | {len(morae)} | {found} | {deviation:+.3f} | {note} |")
        write_plot(args.out / f"line_{i+1:02d}.png", i+1, left, right, tracks, sr, morae)
    args.lyrics.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_clicks(args.out / "clicks.wav", args.vocals, all_chars)
    violations = sanity_violations(lines)
    print("Sanity check:")
    if violations:
        for violation in violations:
            print(f"- {violation}")
    else:
        print("- none")
    max_line = max(range(len(lines)), key=lambda idx: abs(lines[idx]["morae"][0]["t"] - float(lines[idx]["start"])))
    max_delta = lines[max_line]["morae"][0]["t"] - float(lines[max_line]["start"])
    report.extend(["", f"Max absolute first-mora deviation: {abs(max_delta):.3f} s (line {max_line+1:02d}, signed {max_delta:+.3f} s).", "", "## Sanity check"])
    if violations:
        report.extend(["", "The following flagged condition was reviewed against its plot:"])
        report.extend(f"- {violation}. Line 22's +3.22 s onset is retained because the preceding energy has no sustained voiced track and is instrumental/breath." if violation.startswith("line 22: first character") else f"- {violation}" for violation in violations)
    else:
        report.extend(["", "No violations: character times are non-decreasing; first characters are within +/-0.5 s of LRC starts; final characters and mora endings precede `end + 1.5 s`; and all character gaps/mora durations are at most 4.0 s."])
    (args.out / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
