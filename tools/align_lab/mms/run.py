#!/usr/bin/env python3
"""Run torchaudio MMS_FA on the two project audio sources.

The script deliberately loads dependencies from this experiment's private
``.venv/Lib/site-packages`` directory.  The Windows base CPython is used as the
launcher because venv launchers on this machine currently fail while loading
``_ctypes``.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CACHE = ROOT / "tools" / "align_lab" / "_cache" / "mms"
PRIVATE_SITE = HERE / ".venv" / "Lib" / "site-packages"
sys.path.insert(0, str(PRIVATE_SITE))
os.environ.setdefault("TORCH_HOME", str(CACHE / "torch"))
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("MKL_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")

import numpy as np  # noqa: E402
import torch  # noqa: E402
import torchaudio  # noqa: E402


MODEL_URL = "https://dl.fbaipublicfiles.com/mms/torchaudio/ctc_alignment_mling_uroman/model.pt"
SAMPLE_RATE = 16_000
SMALL = set("っゃゅょぁぃぅぇぉゎッャュョァィゥェォヮ")

# Hepburn-like normalization constrained to MMS_FA's Latin-character alphabet.
# The current song uses only the entries listed here, but the complete common
# hiragana inventory makes input validation explicit instead of silently
# dropping an unknown kana.
ROMAJI = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "ゐ": "i", "ゑ": "e", "を": "o", "ん": "n",
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "じゃ": "ja", "じゅ": "ju", "じょ": "jo",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
}


def mora_units(kana: str) -> list[str]:
    """Exact copy of tools/align_lyrics.py semantics."""
    answer: list[str] = []
    for char in kana:
        if char in SMALL and answer:
            answer[-1] += char
        else:
            answer.append(char)
    return answer


def line_morae(spec: dict[str, Any]) -> list[str]:
    """Split each reading segment independently, then concatenate."""
    result: list[str] = []
    for _display, reading in spec["segments"]:
        result.extend(mora_units(reading))
    return result


def _leading_consonant(text: str) -> str:
    for char in text:
        if char not in "aeiou":
            return "t" if char == "c" else char
    return "q"


def romanize_morae(morae: list[str]) -> list[str]:
    """Romanize one output mora at a time while preserving its boundary."""
    result: list[str] = []
    for index, mora in enumerate(morae):
        has_sokuon = "っ" in mora or "ッ" in mora
        base = mora.replace("っ", "").replace("ッ", "")
        if base == "ー":
            if not result:
                raise ValueError("long vowel mark has no preceding mora")
            vowels = [char for char in result[-1] if char in "aeiou"]
            romanized = vowels[-1] if vowels else "u"
        elif base:
            try:
                romanized = ROMAJI[base]
            except KeyError as exc:
                raise ValueError(f"no romanization for mora {mora!r}") from exc
        else:
            romanized = ""
        if has_sokuon:
            next_base = morae[index + 1].replace("っ", "").replace("ッ", "") if index + 1 < len(morae) else ""
            next_romanized = ROMAJI.get(next_base, "")
            romanized += _leading_consonant(next_romanized)
        if not romanized:
            raise ValueError(f"empty romanization for mora {mora!r}")
        result.append(romanized)
    return result


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def download_model() -> Path:
    checkpoint = CACHE / "torch" / "hub" / "checkpoints" / "model.pt"
    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    if not checkpoint.exists():
        temporary = checkpoint.with_suffix(".download")
        print(f"Downloading {MODEL_URL} -> {checkpoint}", flush=True)
        urllib.request.urlretrieve(MODEL_URL, temporary)
        temporary.replace(checkpoint)
    return checkpoint


def prepare_pcm(source: Path) -> tuple[Path, dict[str, Any]]:
    fingerprint = sha256(source)[:16]
    raw = CACHE / "pcm" / f"{source.stem}-{fingerprint}-mono-{SAMPLE_RATE}.f32le"
    raw.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg", "-v", "error", "-y", "-i", str(source), "-vn",
        "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", str(raw),
    ]
    if not raw.exists():
        subprocess.run(command, check=True)
    if raw.stat().st_size % 4:
        raise RuntimeError(f"invalid float32 PCM size: {raw}")
    return raw, {
        "source": str(source.relative_to(ROOT)).replace("\\", "/"),
        "source_sha256": sha256(source),
        "decoded_pcm": str(raw.relative_to(ROOT)).replace("\\", "/"),
        "decode_command": subprocess.list2cmdline(command),
        "sample_rate": SAMPLE_RATE,
        "samples": raw.stat().st_size // 4,
    }


def build_jobs(lines: list[dict[str, Any]], route: str) -> list[dict[str, Any]]:
    if route == "line_window":
        return [
            {"line_indices": [index], "left": max(0.0, float(line["start"]) - 0.35),
             "right": float(line["end"]) + 0.35}
            for index, line in enumerate(lines)
        ]
    if route != "block":
        raise ValueError(route)
    groups: list[list[int]] = []
    current: list[int] = []
    for index, line in enumerate(lines):
        if current:
            previous = lines[current[-1]]
            gap = float(line["start"]) - float(previous["end"])
            projected = float(line["end"]) - float(lines[current[0]]["start"])
            if gap > 2.0 or projected > 32.0:
                groups.append(current)
                current = []
        current.append(index)
    if current:
        groups.append(current)
    return [
        {"line_indices": group,
         "left": max(0.0, float(lines[group[0]]["start"]) - 1.0),
         "right": float(lines[group[-1]]["end"]) + 1.0}
        for group in groups
    ]


def inference_job(
    model: torch.nn.Module,
    tokenizer: Any,
    aligner: Any,
    pcm: np.memmap,
    job: dict[str, Any],
    line_units: list[list[str]],
    device: torch.device,
    use_half: bool,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    left_sample = max(0, round(job["left"] * SAMPLE_RATE))
    right_sample = min(len(pcm), round(job["right"] * SAMPLE_RATE))
    waveform_np = np.array(pcm[left_sample:right_sample], dtype=np.float32, copy=True)
    waveform = torch.from_numpy(waveform_np).unsqueeze(0).to(device)
    if use_half:
        waveform = waveform.half()
    flat_units = [unit for line_index in job["line_indices"] for unit in line_units[line_index]]
    transcript = romanize_morae(flat_units)
    started = time.perf_counter()
    with torch.inference_mode():
        emission, _ = model(waveform)
        token_spans = aligner(emission[0].float(), tokenizer(transcript))
    elapsed = time.perf_counter() - started
    if len(token_spans) != len(flat_units):
        raise RuntimeError(f"span count mismatch: {len(token_spans)} != {len(flat_units)}")
    seconds_per_frame = (right_sample - left_sample) / SAMPLE_RATE / emission.shape[1]
    aligned: list[dict[str, Any]] = []
    for unit, romanized, spans in zip(flat_units, transcript, token_spans):
        if not spans:
            raise RuntimeError(f"empty token span for {unit!r}/{romanized!r}")
        start_frame = min(span.start for span in spans)
        end_frame = max(span.end for span in spans)
        weights = [max(1, span.end - span.start) for span in spans]
        confidence = sum(float(span.score) * weight for span, weight in zip(spans, weights)) / sum(weights)
        aligned.append({
            "k": unit,
            "t": round(left_sample / SAMPLE_RATE + start_frame * seconds_per_frame, 3),
            "conf": round(confidence, 4),
            "romanized": romanized,
            "token_spans": [
                {"start": span.start, "end": span.end, "score": round(float(span.score), 5)}
                for span in spans
            ],
        })
    evidence = {
        "line_indices": job["line_indices"],
        "window": [round(left_sample / SAMPLE_RATE, 6), round(right_sample / SAMPLE_RATE, 6)],
        "samples": right_sample - left_sample,
        "emission_frames": emission.shape[1],
        "seconds_per_frame": seconds_per_frame,
        "elapsed_seconds": round(elapsed, 3),
    }
    del waveform, emission
    if device.type == "cuda":
        torch.cuda.empty_cache()
    return aligned, evidence


def run_one(source: Path, route: str, device_name: str, half: bool) -> Path:
    lyric_lines = json.loads((ROOT / "data" / "lyrics_film.json").read_text(encoding="utf-8"))["lines"]
    reading_lines = json.loads((ROOT / "data" / "lyrics_kana.json").read_text(encoding="utf-8"))["lines"]
    if len(lyric_lines) != 26 or len(reading_lines) != 26:
        raise ValueError("expected exactly 26 lyric and reading lines")
    line_units = [line_morae(spec) for spec in reading_lines]
    if sum(map(len, line_units)) != 349:
        raise ValueError("expected exactly 349 morae")
    dictionary = torchaudio.pipelines.MMS_FA.get_dict()
    for transcript in map(romanize_morae, line_units):
        unknown = set("".join(transcript)) - set(dictionary)
        if unknown:
            raise ValueError(f"romanization contains unsupported MMS tokens: {sorted(unknown)}")

    checkpoint = download_model()
    pcm_path, audio_meta = prepare_pcm(source)
    pcm = np.memmap(pcm_path, dtype=np.float32, mode="r")
    device = torch.device(device_name)
    model = torchaudio.pipelines.MMS_FA.get_model(with_star=False).eval().to(device)
    use_half = bool(half and device.type == "cuda")
    if use_half:
        model.half()
    tokenizer = torchaudio.pipelines.MMS_FA.get_tokenizer()
    aligner = torchaudio.pipelines.MMS_FA.get_aligner()
    jobs = build_jobs(lyric_lines, route)
    output_lines: list[dict[str, Any]] = [{"line": index, "morae": []} for index in range(26)]
    job_evidence = []
    for job_index, job in enumerate(jobs):
        print(f"{source.name} {route} job {job_index + 1}/{len(jobs)} lines={job['line_indices']}", flush=True)
        aligned, evidence = inference_job(model, tokenizer, aligner, pcm, job, line_units, device, use_half)
        cursor = 0
        for line_index in job["line_indices"]:
            count = len(line_units[line_index])
            output_lines[line_index]["morae"] = aligned[cursor:cursor + count]
            cursor += count
        job_evidence.append(evidence)
    for index, (expected, item) in enumerate(zip(line_units, output_lines)):
        actual = [mora["k"] for mora in item["morae"]]
        if actual != expected:
            raise RuntimeError(f"line {index} mora mismatch")
        if any(b["t"] < a["t"] for a, b in zip(item["morae"], item["morae"][1:])):
            raise RuntimeError(f"line {index} times decrease")

    suffix = "vocals" if source.suffix.lower() == ".wav" else "track"
    output = ROOT / "out" / "align_lab" / f"mms_{route}_{suffix}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    rerun = (
        f'& "~\\AppData\\Local\\Programs\\Python\\Python312\\python.exe" '
        f'tools/align_lab/mms/run.py --audio {suffix} --route {route} --device {device_name}'
        + (" --half" if use_half else "")
    )
    payload = {
        "method": f"torchaudio MMS_FA ({route}, {suffix})",
        "command": rerun,
        "lines": output_lines,
        "evidence": {
            "route": route,
            "audio": audio_meta,
            "jobs": job_evidence,
            "mora_split": "tools/align_lyrics.py mora_units; applied separately per readings segment",
            "model": {
                "bundle": "torchaudio.pipelines.MMS_FA",
                "url": MODEL_URL,
                "checkpoint_sha256": sha256(checkpoint),
                "checkpoint_bytes": checkpoint.stat().st_size,
                "with_star": False,
                "sample_rate": SAMPLE_RATE,
                "license": "CC-BY-NC-4.0",
            },
            "environment": {
                "python": sys.version,
                "platform": platform.platform(),
                "torch": torch.__version__,
                "torchaudio": torchaudio.__version__,
                "device": str(device),
                "half": use_half,
                "threads": torch.get_num_threads(),
                "cuda_build": torch.version.cuda,
                "cuda_device": torch.cuda.get_device_name(device) if device.type == "cuda" else None,
            },
        },
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output, flush=True)
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", choices=("vocals", "track", "all"), default="all")
    parser.add_argument("--route", choices=("line_window", "block", "all"), default="all")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--half", action="store_true", help="Use FP16 model inference on CUDA")
    parser.add_argument("--prepare", action="store_true", help="Download/check model and decode audio, but do not infer")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    sources = {
        "vocals": ROOT / "assets" / "audio" / "vocals.wav",
        "track": ROOT / "assets" / "audio" / "track.mp3",
    }
    chosen_sources = sources.values() if args.audio == "all" else [sources[args.audio]]
    chosen_sources = list(chosen_sources)
    if args.prepare:
        checkpoint = download_model()
        print(f"model_sha256={sha256(checkpoint)} bytes={checkpoint.stat().st_size}")
        for source in chosen_sources:
            raw, metadata = prepare_pcm(source)
            print(raw, metadata["samples"])
        return
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError(f"CUDA requested but unavailable (torch={torch.__version__}, build={torch.version.cuda})")
    routes = ("line_window", "block") if args.route == "all" else (args.route,)
    for source in chosen_sources:
        for route in routes:
            run_one(source, route, args.device, args.half)


if __name__ == "__main__":
    main()
