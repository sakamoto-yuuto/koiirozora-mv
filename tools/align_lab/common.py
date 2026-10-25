#!/usr/bin/env python3
"""Shared helpers for the R02 alignment lab.

Everything here is read-only with respect to the project data: the song, the LRC
line times and the kana readings are inputs; each method only writes its own
files under out/align_lab/.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "out/align_lab"
VOCALS = ROOT / "assets/audio/vocals.wav"
TRACK = ROOT / "assets/audio/track.mp3"

# mora_units() merges a small kana into the previous mora.  For the singing
# aligners we need phones, so we spell each possible Japanese mora out.  The
# phone set follows the Japanese dictionaries shipped with SOFA / HubertFA
# (Hepburn-style: sh, ch, ts, j, f, ...).
VOWELS = {"あ": "a", "い": "i", "う": "u", "え": "e", "お": "o"}
BASE = {
    # unvoiced
    "か": ("k", "a"), "き": ("k", "i"), "く": ("k", "u"), "け": ("k", "e"), "こ": ("k", "o"),
    "さ": ("s", "a"), "し": ("sh", "i"), "す": ("s", "u"), "せ": ("s", "e"), "そ": ("s", "o"),
    "た": ("t", "a"), "ち": ("ch", "i"), "つ": ("ts", "u"), "て": ("t", "e"), "と": ("t", "o"),
    "な": ("n", "a"), "に": ("n", "i"), "ぬ": ("n", "u"), "ね": ("n", "e"), "の": ("n", "o"),
    "は": ("h", "a"), "ひ": ("h", "i"), "ふ": ("f", "u"), "へ": ("h", "e"), "ほ": ("h", "o"),
    "ま": ("m", "a"), "み": ("m", "i"), "む": ("m", "u"), "め": ("m", "e"), "も": ("m", "o"),
    "や": ("y", "a"), "ゆ": ("y", "u"), "よ": ("y", "o"),
    "ら": ("r", "a"), "り": ("r", "i"), "る": ("r", "u"), "れ": ("r", "e"), "ろ": ("r", "o"),
    "わ": ("w", "a"), "ゐ": ("w", "i"), "ゑ": ("w", "e"), "を": ("w", "o"),
    # voiced / semi-voiced
    "が": ("g", "a"), "ぎ": ("g", "i"), "ぐ": ("g", "u"), "げ": ("g", "e"), "ご": ("g", "o"),
    "ざ": ("z", "a"), "じ": ("j", "i"), "ず": ("z", "u"), "ぜ": ("z", "e"), "ぞ": ("z", "o"),
    "だ": ("d", "a"), "ぢ": ("j", "i"), "づ": ("z", "u"), "で": ("d", "e"), "ど": ("d", "o"),
    "ば": ("b", "a"), "び": ("b", "i"), "ぶ": ("b", "u"), "べ": ("b", "e"), "ぼ": ("b", "o"),
    "ぱ": ("p", "a"), "ぴ": ("p", "i"), "ぷ": ("p", "u"), "ぺ": ("p", "e"), "ぽ": ("p", "o"),
    "ゔ": ("v", "u"),
    # moraic
    "ん": ("N",), "っ": (),
}
YOON = {
    "きゃ": ("ky", "a"), "きゅ": ("ky", "u"), "きょ": ("ky", "o"),
    "ぎゃ": ("gy", "a"), "ぎゅ": ("gy", "u"), "ぎょ": ("gy", "o"),
    "しゃ": ("sh", "a"), "しゅ": ("sh", "u"), "しょ": ("sh", "o"),
    "じゃ": ("j", "a"), "じゅ": ("j", "u"), "じょ": ("j", "o"),
    "ちゃ": ("ch", "a"), "ちゅ": ("ch", "u"), "ちょ": ("ch", "o"),
    "ぢゃ": ("j", "a"), "ぢゅ": ("j", "u"), "ぢょ": ("j", "o"),
    "にゃ": ("ny", "a"), "にゅ": ("ny", "u"), "にょ": ("ny", "o"),
    "ひゃ": ("hy", "a"), "ひゅ": ("hy", "u"), "ひょ": ("hy", "o"),
    "びゃ": ("by", "a"), "びゅ": ("by", "u"), "びょ": ("by", "o"),
    "ぴゃ": ("py", "a"), "ぴゅ": ("py", "u"), "ぴょ": ("py", "o"),
    "みゃ": ("my", "a"), "みゅ": ("my", "u"), "みょ": ("my", "o"),
    "りゃ": ("ry", "a"), "りゅ": ("ry", "u"), "りょ": ("ry", "o"),
    "ふぁ": ("f", "a"), "ふぃ": ("f", "i"), "ふぇ": ("f", "e"), "ふぉ": ("f", "o"),
    "てぃ": ("t", "i"), "でぃ": ("d", "i"), "とぅ": ("t", "u"), "どぅ": ("d", "u"),
    "うぃ": ("w", "i"), "うぇ": ("w", "e"), "うぉ": ("w", "o"),
    "つぁ": ("ts", "a"), "つぃ": ("ts", "i"), "つぇ": ("ts", "e"), "つぉ": ("ts", "o"),
    "しぇ": ("sh", "e"), "じぇ": ("j", "e"), "ちぇ": ("ch", "e"),
    "いぇ": ("y", "e"), "くぁ": ("kw", "a"), "くぃ": ("kw", "i"), "くぇ": ("kw", "e"), "くぉ": ("kw", "o"),
    "ぐぁ": ("gw", "a"), "ぐぃ": ("gw", "i"), "ぐぇ": ("gw", "e"), "ぐぉ": ("gw", "o"),
}


def load_units() -> list[str]:
    """Return the 349 mora units in the same order as align_lyrics.mora_units()."""
    sys.path.insert(0, str(ROOT / "tools"))
    from align_lyrics import mora_units  # noqa: E402

    readings = json.loads((ROOT / "data/lyrics_kana.json").read_text(encoding="utf-8"))["lines"]
    units: list[str] = []
    for line in readings:
        for _, reading in line["segments"]:
            units.extend(mora_units(reading))
    return units


def load_lines() -> list[dict]:
    """Song lines with LRC times and one phone list per mora.

    A mora that only consists of っ has no phones at all; its time is filled in
    after the acoustic alignment (it is a geminate closure, not a new vowel).
    """
    sys.path.insert(0, str(ROOT / "tools"))
    from align_lyrics import mora_units  # noqa: E402

    film = json.loads((ROOT / "data/lyrics_film.json").read_text(encoding="utf-8"))["lines"]
    readings = json.loads((ROOT / "data/lyrics_kana.json").read_text(encoding="utf-8"))["lines"]
    assert len(film) == len(readings)
    lines = []
    for i, (fl, rd) in enumerate(zip(film, readings)):
        units = [u for _, reading in rd["segments"] for u in mora_units(reading)]
        lines.append({
            "line": i,
            "start": float(fl["start"]),
            "end": float(fl["end"]),
            "units": units,
            "phones": [unit_phones(u) for u in units],
        })
    return lines


def unit_phones(unit: str) -> list[str]:
    """Kana mora -> phone list (may be empty for a standalone っ)."""
    if unit in YOON:
        return list(YOON[unit])
    if unit.endswith("っ") and len(unit) > 1:
        return unit_phones(unit[:-1])          # きっ -> k i; the closure is the next onset
    if unit in BASE:
        return list(BASE[unit])
    if len(unit) == 2 and unit[1] in "ゃゅょ":
        return list(YOON.get(unit, ()))
    if len(unit) == 1 and unit in VOWELS:
        return [VOWELS[unit]]
    raise KeyError(f"no phone mapping for mora {unit!r}")


def line_windows(lines: list[dict], pad_left: float = 0.40, right_margin: float = 0.03) -> list[tuple[float, float]]:
    """Crop window for each line: a little lead-in, stop just before the next line.

    Only onsets matter, so clipping a sustained tail at the next line's start is
    harmless and prevents the next singer's first vowel from being swallowed by
    the previous line's last mora.
    """
    out = []
    for i, ln in enumerate(lines):
        left = max(0.0, ln["start"] - pad_left)
        if i + 1 < len(lines):
            # LRC lines are usually contiguous (end == next start), but there
            # are long instrumental gaps (L10->L11, L21->L22).  Never hand the
            # model more than ~1 s past the line's own end: otherwise it
            # stretches the last morae across the interlude.
            right = min(lines[i + 1]["start"] - right_margin, ln["end"] + 1.0)
        else:
            right = ln["end"] + 2.0
        right = max(left + 0.5, right)
        out.append((left, right))
    return out


def write_alignment(method: str, command: str, per_line: list[list[float]],
                    conf: list[list[float]] | None = None, out: Path | None = None) -> Path:
    lines = load_lines()
    assert len(per_line) == len(lines), (len(per_line), len(lines))
    payload = {"method": method, "command": command, "lines": []}
    for i, (ln, times) in enumerate(zip(lines, per_line)):
        assert len(times) == len(ln["units"]), (i, len(times), len(ln["units"]))
        morae = []
        for j, (k, t) in enumerate(zip(ln["units"], times)):
            item = {"k": k, "t": round(float(t), 3)}
            if conf is not None:
                item["conf"] = round(float(conf[i][j]), 3)
            morae.append(item)
        payload["lines"].append({"line": i, "morae": morae})
    out = out or (LAB / f"{method}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def fill_geminates(times: list[float], units: list[str]) -> list[float]:
    """Give a standalone っ a time: the following mora's onset (its closure end)."""
    out = list(times)
    for j, u in enumerate(units):
        if u == "っ":
            if j + 1 < len(out):
                out[j] = out[j + 1]
            elif j:
                out[j] = out[j - 1]
    return out


def write_clicks(method: str, all_times: list[float], sr: int = 44100) -> Path:
    """Left: original song; right: one short click at every aligned mora."""
    import librosa
    import numpy as np
    import soundfile as sf

    y, _ = librosa.load(str(TRACK), sr=sr, mono=False)
    if y.ndim == 1:
        y = np.stack([y, y])
    left = y[0].astype(np.float32)
    right = np.zeros_like(left)
    n = int(sr * 0.022)
    wave = (np.sin(2 * np.pi * 1800 * np.arange(n) / sr) * np.hanning(n) * 0.8).astype(np.float32)
    for t in sorted(set(round(float(t), 3) for t in all_times)):
        i = int(t * sr)
        m = min(n, len(right) - i)
        if m > 0:
            right[i:i + m] += wave[:m]
    peak = max(float(np.max(np.abs(left))), 1e-6)
    out = np.stack([np.clip(left / peak, -1, 1), np.clip(right, -1, 1)], axis=1)
    path = LAB / f"{method}_clicks.wav"
    sf.write(str(path), out, sr, subtype="PCM_16")
    return path


def plot_lines(method: str, all_times: list[float], line_ids=(0, 10, 25)) -> list[Path]:
    """Spectrogram of the vocal stem with the aligned morae for selected lines."""
    import os
    os.environ.setdefault("MPLCONFIGDIR", str(LAB / "_mplconfig"))
    import librosa
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    import numpy as np

    # matplotlib's default DejaVu has no kana; use a Windows Japanese font.
    for fp in ("C:/Windows/Fonts/meiryo.ttc", "C:/Windows/Fonts/YuGothM.ttc",
               "C:/Windows/Fonts/msgothic.ttc"):
        if Path(fp).exists():
            font_manager.fontManager.addfont(fp)
            matplotlib.rcParams["font.family"] = font_manager.FontProperties(fname=fp).get_name()
            break

    y, sr = librosa.load(str(VOCALS), sr=22050, mono=True)
    lines = load_lines()
    # all_times is flat; split it back per line
    splits, pos = [], 0
    for ln in lines:
        splits.append(all_times[pos:pos + len(ln["units"])])
        pos += len(ln["units"])
    paths = []
    for li in line_ids:
        ln = lines[li]
        left = max(0.0, ln["start"] - 0.5)
        right = min(len(y) / sr, ln["end"] + 1.0)
        a, b = int(left * sr), int(right * sr)
        fig, ax = plt.subplots(figsize=(16, 4.2), dpi=120)
        n_fft, hop = 2048, 256
        stft = np.abs(librosa.stft(y[a:b], n_fft=n_fft, hop_length=hop))
        S = 20 * np.log10(stft + 1e-6)
        S -= S.max()
        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
        keep = (freqs >= 50) & (freqs <= 8000)
        tt = np.arange(S.shape[1]) * hop / sr
        mesh = ax.pcolormesh(tt, freqs[keep], S[keep], shading="auto", cmap="magma", vmin=-70, vmax=0)
        ax.set_yscale("log")
        ax.set_ylim(60, 8000)
        ax.set_xlim(0, (b - a) / sr)
        for k, t in zip(ln["units"], splits[li]):
            x = t - left
            if 0 <= x <= (b - a) / sr:
                ax.axvline(x, color="#4de2ff", lw=1.0, alpha=0.9)
                ax.text(x, 0.985, k, transform=ax.get_xaxis_transform(), ha="center", va="top",
                        fontsize=8, color="#bff6ff", clip_on=False,
                        bbox=dict(boxstyle="round,pad=0.08", fc="#10141d", ec="none", alpha=0.65))
        ax.set_title(f"{method} - line {li:02d}  {ln['start']:.2f}-{ln['end']:.2f}s  "
                     f"({len(ln['units'])} morae)", fontsize=11, color="#e8edf6", pad=8)
        fig.patch.set_facecolor("#151a26")
        ax.set_facecolor("#10141d")
        ax.tick_params(colors="#8d9bb5")
        for sp in ax.spines.values():
            sp.set_color("#3a445c")
        fig.colorbar(mesh, ax=ax, format="%+2.0f dB").ax.tick_params(colors="#8d9bb5")
        fig.tight_layout()
        p = LAB / f"{method}_L{li}.png"
        fig.savefig(p, facecolor=fig.get_facecolor())
        plt.close(fig)
        paths.append(p)
    return paths
