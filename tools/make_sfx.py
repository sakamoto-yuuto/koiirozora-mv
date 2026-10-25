#!/usr/bin/env python3
"""Deterministically synthesize the film's practical sound effects and mix them.

The source song is intentionally never gain-normalized.  Effect targets are
measured against the song around each cue, then a limiter is applied only to
the summed output if a sample would otherwise exceed the delivery ceiling.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy import signal


ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
INPUT = ROOT / "data" / "sfx.json"
TRACK = ROOT / "assets" / "audio" / "track.mp3"
STEM = ROOT / "assets" / "audio" / "sfx_stem.wav"
MIX = ROOT / "assets" / "audio" / "mix.wav"
VOCALS = ROOT / "assets" / "audio" / "vocals.wav"
SR = 44_100
RNG = np.random.default_rng(19861224)
EPS = 1e-12

# These are RMS ceilings, not peak ceilings. They leave enough headroom for
# the deliberate transient shapes below.
BED_KINDS = {"hum", "tape"}
DTMF = {
    "1": (697, 1209), "2": (697, 1336), "3": (697, 1477),
    "4": (770, 1209), "5": (770, 1336), "6": (770, 1477),
    "7": (852, 1209), "8": (852, 1336), "9": (852, 1477),
    "*": (941, 1209), "0": (941, 1336), "#": (941, 1477),
}


def dbfs(value: float) -> float:
    return 20.0 * np.log10(max(float(value), EPS))


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.asarray(x, dtype=np.float64) ** 2)))


def timebase(duration: float) -> np.ndarray:
    return np.arange(max(1, int(round(duration * SR))), dtype=np.float64) / SR


def fade(n: int, attack: float = 0.004, release: float = 0.008) -> np.ndarray:
    """Raised-cosine attack/release, including for very short click buffers."""
    env = np.ones(n, dtype=np.float64)
    na, nr = min(int(round(attack * SR)), n // 2), min(int(round(release * SR)), n // 2)
    if na:
        env[:na] = np.sin(np.linspace(0, np.pi / 2, na, endpoint=False)) ** 2
    if nr:
        env[-nr:] = np.sin(np.linspace(np.pi / 2, 0, nr, endpoint=True)) ** 2
    return env


def band(x: np.ndarray, lo: float, hi: float, order: int = 3) -> np.ndarray:
    hi = min(hi, SR * 0.49)
    sos = signal.butter(order, [lo, hi], btype="bandpass", fs=SR, output="sos")
    # sosfilt works for the tiny click buffers where filtfilt padding does not.
    return signal.sosfilt(sos, x)


def low(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype="lowpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def tone(freq: float, duration: float, phase: float = 0.0) -> np.ndarray:
    t = timebase(duration)
    return np.sin(2 * np.pi * freq * t + phase)


def handset(x: np.ndarray) -> np.ndarray:
    """The narrowed, gently overloaded band of a 1980s handset."""
    return band(np.tanh(1.15 * band(x, 300, 3400)), 300, 3400)


def click(duration: float = 0.012, bright: bool = True) -> np.ndarray:
    n = max(8, int(round(duration * SR)))
    x = RNG.standard_normal(n)
    if bright:
        x = band(x, 1700, 9000)
    return x * np.exp(-np.arange(n) / max(1, n / 5)) * fade(n, 0.0007, 0.004)


def synth_step() -> np.ndarray:
    dur = 0.090
    n = int(dur * SR)
    x = np.zeros(n, dtype=np.float64)
    # 20--40 compact grains make the snow crunch irregular rather than a hiss.
    for _ in range(int(RNG.integers(20, 41))):
        grain_n = int(RNG.uniform(0.0012, 0.0042) * SR)
        at = int(RNG.uniform(0.0, 0.070) * SR)
        if at >= n:
            continue
        grain = band(RNG.standard_normal(grain_n), 1200, 5000)
        grain *= np.hanning(grain_n) * RNG.uniform(0.25, 1.0)
        end = min(n, at + grain_n)
        x[at:end] += grain[:end - at]
    thud_n = min(n, int(0.085 * SR))
    tt = np.arange(thud_n) / SR
    x[:thud_n] += 0.65 * np.sin(2 * np.pi * 140 * tt) * np.exp(-tt / 0.027)
    return x * fade(n, 0.001, 0.012)


def synth_door() -> np.ndarray:
    dur = 0.25
    t = timebase(dur)
    creak = signal.chirp(t, f0=900, f1=600, t1=dur, method="quadratic")
    creak += 0.24 * band(RNG.standard_normal(len(t)), 550, 1600)
    creak *= (0.42 + 0.58 * np.sin(np.pi * t / dur) ** 1.4) * np.exp(-t / 0.34)
    thud = 0.75 * np.sin(2 * np.pi * 115 * t) * np.exp(-t / 0.045)
    return (creak + thud) * fade(len(t), 0.004, 0.025)


def synth_tick() -> np.ndarray:
    dur = 0.068
    t = timebase(dur)
    x = np.zeros_like(t)
    c = click(0.012)
    x[:len(c)] += c
    x += 0.22 * (np.sin(2 * np.pi * 50 * t) + 0.45 * np.sin(2 * np.pi * 100 * t)) * np.exp(-t / 0.026)
    return x * fade(len(t), 0.0008, 0.006)


def synth_hum(duration: float) -> np.ndarray:
    t = timebase(duration)
    x = (np.sin(2 * np.pi * 100 * t) + 0.22 * np.sin(2 * np.pi * 200 * t + 0.3)
         + 0.07 * np.sin(2 * np.pi * 300 * t + 0.7))
    return x * fade(len(t), 0.4, 0.4)


def synth_breath() -> np.ndarray:
    dur = 1.3
    t = timebase(dur)
    x = band(RNG.standard_normal(len(t)), 300, 2500)
    shape = np.sin(np.pi * t / dur) ** 1.35
    return x * shape * fade(len(t), 0.015, 0.08)


def synth_squeak(duration: float) -> np.ndarray:
    t = timebase(duration)
    x = np.zeros_like(t)
    count = int(RNG.integers(2, 4))
    starts = np.linspace(0.05, max(0.06, duration - 0.18), count)
    for start in starts:
        length = min(0.15, duration - start)
        idx = (t >= start) & (t < start + length)
        u = t[idx] - start
        f = RNG.uniform(1600, 2600)
        vib = 1 + 0.018 * np.sin(2 * np.pi * RNG.uniform(5, 8) * u)
        x[idx] += np.sin(2 * np.pi * f * vib * u) * np.sin(np.pi * u / length) ** 1.7
    return band(x, 1200, 3200) * fade(len(t), 0.006, 0.02)


def synth_lift() -> np.ndarray:
    t = timebase(0.115)
    x = np.zeros_like(t)
    for start, amp in ((0.0, 1.0), (0.040, 0.72)):
        c = click(0.013)
        at = int(start * SR)
        x[at:at + len(c)] += amp * c
    rattle = band(RNG.standard_normal(len(t)), 450, 2200) * np.exp(-t / 0.04)
    return (x + 0.16 * rattle) * fade(len(t), 0.001, 0.014)


def synth_card() -> np.ndarray:
    t = timebase(0.3)
    buzz = (np.sin(2 * np.pi * 180 * t) + 0.42 * np.sin(2 * np.pi * 360 * t)
            + 0.18 * np.sin(2 * np.pi * 540 * t))
    x = low(buzz, 1800) * np.sin(np.pi * t / 0.3) ** 0.7
    c = click(0.011)
    x[-len(c):] += 0.9 * c
    return x * fade(len(t), 0.005, 0.008)


def synth_dialtone(duration: float) -> np.ndarray:
    x = handset(tone(400, duration))
    return x * fade(len(x), 0.005, 0.005)


def synth_dtmf(key: str) -> np.ndarray:
    if key not in DTMF:
        raise ValueError(f"invalid DTMF key {key!r}")
    lo_freq, hi_freq = DTMF[key]
    x = handset(tone(lo_freq, 0.110) + tone(hi_freq, 0.110, 0.2))
    return x * fade(len(x), 0.004, 0.008)


def synth_key() -> np.ndarray:
    return click(0.012) * 0.8


def synth_ringback() -> np.ndarray:
    t = timebase(1.0)
    x = np.sin(2 * np.pi * 400 * t) * (1.0 + 0.30 * np.sin(2 * np.pi * 16 * t))
    x = handset(x)
    return x * fade(len(x), 0.005, 0.010)


def synth_bell() -> np.ndarray:
    t = timebase(1.0)
    selector = (np.sin(2 * np.pi * 16 * t) > 0).astype(float)
    x = selector * np.sin(2 * np.pi * 1300 * t) + (1 - selector) * np.sin(2 * np.pi * 1600 * t)
    x *= (0.75 + 0.25 * np.sin(2 * np.pi * 3.2 * t)) * fade(len(t), 0.006, 0.025)
    # A small, fixed empty-room reflection pattern; no long wash over the music.
    ir = np.zeros(int(0.075 * SR))
    for delay, gain in ((0.012, 0.26), (0.027, 0.16), (0.049, 0.09), (0.070, 0.05)):
        ir[int(delay * SR)] = gain
    ir[0] = 1.0
    return signal.fftconvolve(x, ir)[:len(x)]


def synth_relay() -> np.ndarray:
    t = timebase(0.19)
    x = np.zeros_like(t)
    for start, amp in ((0.0, 1.0), (0.045, 0.68)):
        c = click(0.016, bright=False)
        at = int(start * SR)
        x[at:at + len(c)] += amp * c
    x += 0.30 * band(RNG.standard_normal(len(t)), 100, 900) * np.exp(-t / 0.075)
    return x * fade(len(t), 0.001, 0.020)


def synth_tape(duration: float) -> np.ndarray:
    t = timebase(duration)
    hiss = band(RNG.standard_normal(len(t)), 1800, 9000)
    whine = 0.025 * np.sin(2 * np.pi * 92 * t + 0.04 * np.sin(2 * np.pi * 0.17 * t))
    return (0.32 * hiss + whine) * fade(len(t), 0.18, 0.18)


def tape_voice(src: float, duration: float) -> np.ndarray:
    """Her own voice played back from his answering-machine tape: the vocal stem (src .. src + duration s of the song)
    through the machine's small speaker, with a little tape wow."""
    x, sr = sf.read(os.path.relpath(VOCALS), start=int(round(src * SR)), stop=int(round((src + duration) * SR)))
    if sr != SR:
        raise ValueError(f"vocals.wav is {sr} Hz, expected {SR}")
    x = x.mean(axis=1) if x.ndim > 1 else x
    n = len(x)
    i = np.arange(n, dtype=np.float64)
    wow = 0.0006 * SR * (1 + np.sin(2 * np.pi * 0.7 * i / SR))      # a slowly wandering delay (~0.6 ms): the tape's wow
    x = np.interp(i - wow, i, x)
    x = band(x, 380, 3000)
    # a small machine's AGC: an envelope follower squeezes the singing (crest ~8 -> ~3.5), so it sits as a level line
    env = signal.lfilter([0.003], [1, -0.997], np.abs(x))                  # ~7 ms smoothing
    thr = 0.08 * np.max(env)
    x = x * np.where(env > thr, (env / thr) ** (1 / 6 - 1), 1.0)
    x = band(np.tanh(2.2 * x / np.max(np.abs(x))), 380, 3000)
    return x * fade(n, 0.03, 0.3)


def synth_beep() -> np.ndarray:
    x = handset(tone(1000, 0.45))
    return x * fade(len(x), 0.006, 0.012)


def synth_busy(duration: float) -> np.ndarray:
    """Japanese busy tone: 400 Hz, 0.5 s on / 0.5 s off, through the handset (default 4 s)."""
    t = timebase(duration or 4.0)
    gate = ((t % 1.0) < 0.5).astype(float)
    gate = signal.lfilter([0.02], [1, -0.98], gate)               # 5 ms-ish soft edges, no clicks
    x = handset(np.sin(2 * np.pi * 400 * t) * gate)
    return x * fade(len(t), 0.005, 0.02)


def synth_crowd(duration: float) -> np.ndarray:
    """A festival audience heard through a TV in a shop window: murmur + scattered applause, narrow and distant."""
    t = timebase(duration or 6.0)
    murmur = band(RNG.standard_normal(len(t)), 250, 1800) * (0.6 + 0.4 * band(RNG.standard_normal(len(t)), 0.3, 2.0, order=1))
    claps = np.zeros(len(t))
    for _ in range(int(14 * (duration or 6.0))):
        at = int(RNG.uniform(0, len(t) - 400)); c = click(0.008, bright=True) * RNG.uniform(0.2, 0.6)
        claps[at:at + len(c)] += c
    x = band(0.5 * murmur + claps, 300, 3400)                      # a small TV speaker
    return x * fade(len(t), 0.4, 0.6)


def make_mono(event: dict) -> np.ndarray | None:
    kind = event["kind"]
    dur = float(event.get("dur", 0.0))
    if kind == "step": return synth_step()
    if kind == "door": return synth_door()
    if kind == "tick": return synth_tick()
    if kind == "hum": return synth_hum(dur)
    if kind == "breath": return synth_breath()
    if kind == "squeak": return synth_squeak(dur)
    if kind == "lift": return synth_lift()
    if kind == "card": return synth_card()
    if kind == "dialtone": return synth_dialtone(dur)
    if kind == "dtmf": return synth_dtmf(str(event.get("key", "")))
    if kind == "key": return synth_key()
    if kind == "ringback": return synth_ringback()
    if kind == "bell": return synth_bell()
    if kind == "relay": return synth_relay()
    if kind == "tape": return synth_tape(dur)
    if kind == "beep": return synth_beep()
    if kind == "voice": return tape_voice(float(event["src"]), dur)
    if kind == "busy": return synth_busy(dur)
    if kind == "crowd": return synth_crowd(dur)
    print(f"WARNING: unknown SFX kind {kind!r} at {event.get('t')}; skipped")
    return None


def pan_stereo(mono: np.ndarray, pan: float) -> np.ndarray:
    pan = float(np.clip(pan, -1.0, 1.0))
    # Constant-power panning. Measuring after panning gives the requested
    # target independently of left/right placement.
    return np.column_stack((mono * np.sqrt((1 - pan) / 2), mono * np.sqrt((1 + pan) / 2)))


def local_rms(music: np.ndarray, t: float) -> float:
    start = max(0, int(round((t - 1.5) * SR)))
    end = min(len(music), int(round((t + 1.5) * SR)))
    return rms(music[start:end])


def soft_limit(x: np.ndarray, threshold: float = 0.980, ceiling: float = 0.999) -> np.ndarray:
    """Leave ordinary samples bit-identical and map peaks strictly below 1.0."""
    ax = np.abs(x)
    excess = np.maximum(ax - threshold, 0.0)
    limited = threshold + (ceiling - threshold) * np.tanh(excess / (ceiling - threshold))
    return np.sign(x) * np.where(ax <= threshold, ax, limited)


def main() -> None:
    events = json.loads(INPUT.read_text(encoding="utf-8"))["events"]
    music, sr = librosa.load(TRACK, sr=None, mono=False, dtype=np.float64)
    if sr != SR:
        raise RuntimeError(f"Expected {SR} Hz source, received {sr} Hz")
    if music.ndim == 1:
        music = np.column_stack((music, music))
    else:
        music = music.T
    stem = np.zeros_like(music, dtype=np.float64)
    report: list[tuple[dict, float, float, float, float, bool]] = []

    for event in events:
        try:
            mono = make_mono(event)
        except ValueError as exc:
            print(f"WARNING: {exc}; skipped")
            continue
        if mono is None:
            continue
        stereo = pan_stereo(mono, event.get("pan", 0.0))
        t = float(event["t"])
        at = int(round(t * SR))
        if at >= len(stem):
            print(f"WARNING: SFX at {t:.3f}s is beyond song end; skipped")
            continue
        end = min(len(stem), at + len(stereo))
        stereo = stereo[:end - at]
        music_level = local_rms(music, t)
        cap_db = -24.0 if event["kind"] in BED_KINDS else -16.0
        target_db = min(dbfs(music_level) + float(event["rel"]), cap_db)
        current = rms(stereo)
        stereo *= (10 ** (target_db / 20)) / max(current, EPS)
        effect_level = rms(stereo)
        stem[at:end] += stereo
        limit_db = dbfs(music_level) + float(event["rel"]) + 1.0
        report.append((event, dbfs(music_level), dbfs(effect_level), target_db, limit_db, dbfs(effect_level) <= limit_db + 1e-7))

    for f in (STEM, MIX):                                   # files made inside a codex sandbox cannot be overwritten, only replaced
        if f.exists(): f.unlink()
    sf.write(os.path.relpath(STEM), stem, SR, subtype="FLOAT")   # libsndfile on Windows cannot open non-ASCII absolute paths
    mixed = soft_limit(music + stem)
    sf.write(os.path.relpath(MIX), mixed, SR, subtype="PCM_16")

    print("SFX report (levels are RMS dBFS; target includes the per-kind ceiling)")
    print("| time | kind | music | effect | target | check (effect <= music + rel + 1) |")
    print("|---:|:---|---:|---:|---:|:---|")
    for event, music_db, effect_db, target_db, limit_db, passed in report:
        label = event["kind"] + (f"({event['key']})" if "key" in event else "")
        print(f"| {event['t']:6.2f} | {label:9s} | {music_db:6.2f} | {effect_db:6.2f} | {target_db:6.2f} | {'PASS' if passed else f'FAIL <= {limit_db:.2f}'} |")
    failures = [row for row in report if not row[-1]]
    print(f"Wrote {STEM.name} and {MIX.name}: {len(report)} events, {len(failures)} level-check failures.")
    print(f"Stem peak: {np.max(np.abs(stem)):.6f}; mix pre-limit peak: {np.max(np.abs(music + stem)):.6f}; mix peak: {np.max(np.abs(mixed)):.6f}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
