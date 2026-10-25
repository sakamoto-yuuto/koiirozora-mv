#!/usr/bin/env python3
"""Forced-align Japanese kana readings with a real wav2vec2 CTC model.

This script is intentionally standalone.  It prepends its private dependency
directory before importing numpy/torch because the project venv launchers are
broken on this Windows installation.  Audio is decoded once per source by
ffmpeg; song times refer to the first decoded sample and no MP3 metadata offset
is added.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PRIVATE_SITE = HERE / ".venv" / "Lib" / "site-packages"
if PRIVATE_SITE.is_dir():
    sys.path.insert(0, str(PRIVATE_SITE))

# These must be fixed before numpy/torch initialize a BLAS/OpenMP runtime.
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("MKL_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "4")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

try:
    import numpy as np
    import torch
    from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
except ImportError as exc:  # pragma: no cover - actionable bootstrap error
    raise SystemExit(
        f"Missing private dependency: {exc}. Run tools/align_lab/japanese_ctc/run.ps1 first."
    ) from exc


MODEL_ID = "jonatasgrosman/wav2vec2-large-xlsr-53-japanese"
MODEL_REVISION = "cf031e020336460d15a417eba710bbc5bb43be9a"
MODEL_LICENSE = "Apache-2.0"
SAMPLE_RATE = 16_000
SMALL = set("っゃゅょぁぃぅぇぉゎッャュョァィゥェォヮ")
SOURCE_PATHS = {
    "vocals": ROOT / "assets" / "audio" / "vocals.wav",
    "track": ROOT / "assets" / "audio" / "track.mp3",
}


@dataclass(frozen=True)
class Mora:
    line: int
    index: int
    kana: str
    chars: tuple[str, ...]


@dataclass(frozen=True)
class Window:
    lines: tuple[int, ...]
    start: float
    end: float


def mora_units(kana: str) -> list[str]:
    """Exact local copy of tools/align_lyrics.py:mora_units()."""
    result: list[str] = []
    for char in kana:
        if char in SMALL and result:
            result[-1] += char
        else:
            # Long vowel mark remains an independent mora.
            result.append(char)
    return result


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def lyric_morae(kana_data: dict) -> list[list[Mora]]:
    all_lines: list[list[Mora]] = []
    for line_index, line in enumerate(kana_data["lines"]):
        units: list[str] = []
        # Segment-local splitting is deliberate.  In particular, an initial っ
        # in a segment stays separate instead of attaching to the prior segment.
        for _display, reading in line["segments"]:
            units.extend(mora_units(reading))
        all_lines.append(
            [Mora(line_index, index, unit, tuple(unit)) for index, unit in enumerate(units)]
        )
    return all_lines


def make_windows(
    film_lines: list[dict], mode: str, padding: float, group_max_seconds: float
) -> list[Window]:
    if mode == "line":
        return [
            Window(
                (index,),
                max(0.0, float(line["start"]) - padding),
                float(line["end"]) + padding,
            )
            for index, line in enumerate(film_lines)
        ]

    groups: list[tuple[int, ...]] = []
    current: list[int] = []
    for index, line in enumerate(film_lines):
        if not current:
            current = [index]
            continue
        first = film_lines[current[0]]
        previous = film_lines[current[-1]]
        duration = float(line["end"]) - float(first["start"])
        gap = float(line["start"]) - float(previous["end"])
        if gap <= 2.0 and duration <= group_max_seconds:
            current.append(index)
        else:
            groups.append(tuple(current))
            current = [index]
    if current:
        groups.append(tuple(current))
    return [
        Window(
            group,
            max(0.0, float(film_lines[group[0]]["start"]) - padding),
            float(film_lines[group[-1]]["end"]) + padding,
        )
        for group in groups
    ]


def decode_audio(path: Path) -> np.ndarray:
    command = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-map",
        "a:0",
        "-ac",
        "1",
        "-ar",
        str(SAMPLE_RATE),
        "-f",
        "f32le",
        "pipe:1",
    ]
    completed = subprocess.run(command, check=True, stdout=subprocess.PIPE)
    audio = np.frombuffer(completed.stdout, dtype="<f4").copy()
    if audio.size == 0:
        raise RuntimeError(f"ffmpeg decoded no samples from {path}")
    return audio


def target_for_window(
    window: Window, all_morae: list[list[Mora]], vocab: dict[str, int]
) -> tuple[list[Mora], list[int], list[tuple[int, ...]]]:
    morae = [mora for line in window.lines for mora in all_morae[line]]
    token_ids: list[int] = []
    mora_token_indices: list[tuple[int, ...]] = []
    missing: set[str] = set()
    for mora in morae:
        indices: list[int] = []
        for char in mora.chars:
            if char not in vocab:
                missing.add(char)
                continue
            indices.append(len(token_ids))
            token_ids.append(int(vocab[char]))
        mora_token_indices.append(tuple(indices))
    if missing:
        raise ValueError(f"model vocabulary misses target characters: {''.join(sorted(missing))}")
    if any(not indices for indices in mora_token_indices):
        raise ValueError(f"empty tokenization in lines {window.lines}")
    return morae, token_ids, mora_token_indices


def ctc_viterbi(
    log_probs: np.ndarray, token_ids: list[int], blank_id: int
) -> tuple[list[list[int]], float]:
    """Return emission-frame indices assigned to every target token.

    The dynamic program uses the standard blank-interleaved CTC graph.  It
    permits a two-state skip only when adjacent target labels differ, so doubled
    kana such as ``いい`` must pass through a blank and cannot collapse.
    """
    frames, _vocab_size = log_probs.shape
    labels = np.asarray(token_ids, dtype=np.int64)
    states = labels.size * 2 + 1
    if frames < states:
        raise ValueError(f"not enough emission frames ({frames}) for {labels.size} tokens")
    extended = np.full(states, blank_id, dtype=np.int64)
    extended[1::2] = labels
    previous = np.full(states, -np.inf, dtype=np.float64)
    previous[0] = float(log_probs[0, blank_id])
    if labels.size:
        previous[1] = float(log_probs[0, labels[0]])
    back = np.full((frames, states), -1, dtype=np.int8)

    for frame in range(1, frames):
        current = np.full(states, -np.inf, dtype=np.float64)
        for state in range(states):
            best_state = state
            best_score = previous[state]
            if state > 0 and previous[state - 1] > best_score:
                best_state = state - 1
                best_score = previous[state - 1]
            if (
                state > 1
                and extended[state] != blank_id
                and extended[state] != extended[state - 2]
                and previous[state - 2] > best_score
            ):
                best_state = state - 2
                best_score = previous[state - 2]
            current[state] = best_score + float(log_probs[frame, extended[state]])
            back[frame, state] = np.int8(best_state - state)
        previous = current

    final_candidates = [states - 1]
    if states > 1:
        final_candidates.append(states - 2)
    state = max(final_candidates, key=lambda item: previous[item])
    score = float(previous[state])
    state_path = np.empty(frames, dtype=np.int32)
    state_path[-1] = state
    for frame in range(frames - 1, 0, -1):
        state += int(back[frame, state])
        state_path[frame - 1] = state
    if state_path[0] not in (0, 1):
        raise RuntimeError("invalid CTC backtrace start")

    token_frames: list[list[int]] = []
    for token_index in range(labels.size):
        token_state = token_index * 2 + 1
        assigned = np.flatnonzero(state_path == token_state).tolist()
        if not assigned:
            raise RuntimeError(f"CTC backtrace skipped token {token_index}")
        token_frames.append(assigned)
    return token_frames, score / max(1, frames)


def align_window(
    model: Wav2Vec2ForCTC,
    processor: Wav2Vec2Processor,
    source_audio: np.ndarray,
    window: Window,
    all_morae: list[list[Mora]],
    vocab: dict[str, int],
    blank_id: int,
) -> tuple[dict[tuple[int, int], dict], dict]:
    first_sample = max(0, round(window.start * SAMPLE_RATE))
    last_sample = min(source_audio.size, round(window.end * SAMPLE_RATE))
    clip = source_audio[first_sample:last_sample]
    actual_start = first_sample / SAMPLE_RATE
    actual_duration = clip.size / SAMPLE_RATE
    batch = processor(clip, sampling_rate=SAMPLE_RATE, return_tensors="pt")
    with torch.inference_mode():
        logits = model(
            batch.input_values,
            attention_mask=getattr(batch, "attention_mask", None),
        ).logits[0]
        log_probs_tensor = torch.log_softmax(logits, dim=-1).cpu()
    predicted_ids = torch.argmax(logits, dim=-1).cpu().tolist()
    predicted = processor.decode(predicted_ids, skip_special_tokens=True)
    log_probs = log_probs_tensor.numpy()

    morae, token_ids, mora_token_indices = target_for_window(window, all_morae, vocab)
    token_frames, path_score = ctc_viterbi(log_probs, token_ids, blank_id)
    seconds_per_frame = actual_duration / log_probs.shape[0]
    aligned: dict[tuple[int, int], dict] = {}
    for mora, token_indices in zip(morae, mora_token_indices):
        first_frame = token_frames[token_indices[0]][0]
        posteriors: list[float] = []
        for token_index in token_indices:
            token_id = token_ids[token_index]
            posteriors.extend(
                float(np.exp(log_probs[frame, token_id]))
                for frame in token_frames[token_index]
            )
        aligned[(mora.line, mora.index)] = {
            "k": mora.kana,
            "t": round(actual_start + (first_frame + 0.5) * seconds_per_frame, 6),
            "conf": round(float(np.mean(posteriors)), 6),
        }
    diagnostic = {
        "lines": list(window.lines),
        "start": round(actual_start, 6),
        "end": round(actual_start + actual_duration, 6),
        "emission_frames": int(log_probs.shape[0]),
        "target_tokens": len(token_ids),
        "ctc_path_mean_logprob": round(path_score, 6),
        "greedy_asr": predicted,
    }
    return aligned, diagnostic


def assert_mora_contract(lines: list[dict], all_morae: list[list[Mora]]) -> None:
    if len(lines) != 26:
        raise AssertionError(f"expected 26 lines, got {len(lines)}")
    for index, (line, expected) in enumerate(zip(lines, all_morae)):
        actual = line["morae"]
        if line["line"] != index:
            raise AssertionError(f"line index mismatch at {index}")
        if [item["k"] for item in actual] != [item.kana for item in expected]:
            raise AssertionError(f"mora sequence mismatch at line {index}")
        times = [float(item["t"]) for item in actual]
        if any(right < left for left, right in zip(times, times[1:])):
            raise AssertionError(f"non-monotonic mora times at line {index}")


def output_path(output_dir: Path, source: str, mode: str) -> Path:
    suffix = "" if mode == "line" else "_grouped"
    return output_dir / f"japanese_ctc_{source}{suffix}.json"


def run_alignment(
    args: argparse.Namespace,
    model: Wav2Vec2ForCTC,
    processor: Wav2Vec2Processor,
    source: str,
    mode: str,
    film_lines: list[dict],
    all_morae: list[list[Mora]],
) -> Path:
    started = time.perf_counter()
    audio = decode_audio(SOURCE_PATHS[source])
    windows = make_windows(film_lines, mode, args.padding, args.group_max_seconds)
    vocab = processor.tokenizer.get_vocab()
    blank_id = int(model.config.pad_token_id)
    aligned: dict[tuple[int, int], dict] = {}
    diagnostics: list[dict] = []
    for window_index, window in enumerate(windows, start=1):
        print(
            f"[{source}/{mode}] window {window_index}/{len(windows)} "
            f"lines={window.lines} {window.start:.2f}-{window.end:.2f}s",
            flush=True,
        )
        result, diagnostic = align_window(
            model, processor, audio, window, all_morae, vocab, blank_id
        )
        duplicate = set(aligned).intersection(result)
        if duplicate:
            raise RuntimeError(f"duplicate aligned mora keys: {sorted(duplicate)[:3]}")
        aligned.update(result)
        diagnostics.append(diagnostic)

    lines = []
    for line_index, morae in enumerate(all_morae):
        values = [aligned[(line_index, mora.index)] for mora in morae]
        lines.append({"line": line_index, "morae": values})
    assert_mora_contract(lines, all_morae)
    rerun = (
        "powershell -ExecutionPolicy Bypass -File "
        "tools/align_lab/japanese_ctc/run.ps1"
    )
    payload = {
        "method": f"japanese_ctc_{source}_{mode}",
        "command": rerun,
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
            "license": MODEL_LICENSE,
            "blank_token_id": blank_id,
            "target": "known kana grapheme tokens mapped directly to segment-local morae",
        },
        "source": str(SOURCE_PATHS[source].relative_to(ROOT)).replace("\\", "/"),
        "window_mode": mode,
        "padding_seconds": args.padding,
        "group_max_seconds": args.group_max_seconds if mode == "grouped" else None,
        "audio_timebase": "first sample of ffmpeg-decoded 16 kHz mono stream is song t=0",
        "runtime": {
            "device": "cpu",
            "threads": args.threads,
            "torch": torch.__version__,
            "transformers": __import__("transformers").__version__,
            "elapsed_seconds": round(time.perf_counter() - started, 3),
        },
        "windows": diagnostics,
        "lines": lines,
    }
    destination = output_path(args.output_dir, source, mode)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"wrote {destination}", flush=True)
    return destination


def validate_target_vocab(processor: Wav2Vec2Processor, all_morae: list[list[Mora]]) -> None:
    vocab = processor.tokenizer.get_vocab()
    required = sorted({char for line in all_morae for mora in line for char in mora.chars})
    missing = [char for char in required if char not in vocab]
    print(
        f"model_vocab={len(vocab)} required_kana_chars={len(required)} "
        f"missing={''.join(missing) or '<none>'}",
        flush=True,
    )
    if missing:
        raise ValueError(f"model does not cover target kana: {''.join(missing)}")


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", nargs="+", choices=sorted(SOURCE_PATHS), default=["vocals", "track"])
    parser.add_argument("--modes", nargs="+", choices=["line", "grouped"], default=["line", "grouped"])
    parser.add_argument("--padding", type=float, default=0.60)
    parser.add_argument("--group-max-seconds", type=float, default=24.0)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--local-files-only", action="store_true")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "out" / "align_lab")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    if not 1 <= args.threads <= 4:
        raise SystemExit("--threads must be in [1, 4]")
    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    cache_dir = ROOT / "tools" / "align_lab" / "_cache" / "japanese_ctc" / "hf"
    os.environ["HF_HOME"] = str(cache_dir)
    os.environ["HF_HUB_CACHE"] = str(cache_dir / "hub")
    os.environ["HF_XET_CACHE"] = str(cache_dir / "xet")

    kana_data = load_json(ROOT / "data" / "lyrics_kana.json")
    film_data = load_json(ROOT / "data" / "lyrics_film.json")
    all_morae = lyric_morae(kana_data)
    if len(all_morae) != len(film_data["lines"]):
        raise ValueError("lyrics_kana.json and lyrics_film.json line counts differ")

    print(f"loading {MODEL_ID}@{MODEL_REVISION} on CPU", flush=True)
    processor = Wav2Vec2Processor.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        cache_dir=cache_dir,
        local_files_only=args.local_files_only,
    )
    validate_target_vocab(processor, all_morae)
    model = Wav2Vec2ForCTC.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        cache_dir=cache_dir,
        local_files_only=args.local_files_only,
    )
    model.eval()
    model.to("cpu")
    print(
        f"model_loaded parameters={sum(p.numel() for p in model.parameters())} "
        f"torch_threads={torch.get_num_threads()}",
        flush=True,
    )
    if args.download_only:
        return 0

    for source in args.sources:
        for mode in args.modes:
            run_alignment(args, model, processor, source, mode, film_data["lines"], all_morae)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
