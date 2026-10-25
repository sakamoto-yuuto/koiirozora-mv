# torchaudio MMS_FA alignment experiment

This experiment compares line-level LRC windows with multi-line CTC blocks on
both `assets/audio/vocals.wav` and `assets/audio/track.mp3`.  The output unit is
always the exact `mora_units()` sequence from `tools/align_lyrics.py`, applied
to each `data/lyrics_kana.json` segment separately before concatenation.

The machine's virtual-environment launchers currently fail in `_ctypes`.  The
reproducible workaround is base CPython plus packages installed into this
experiment's private `.venv/Lib/site-packages`; `run.py` prepends that path
before importing NumPy or PyTorch.

Prepare model/audio caches without inference:

```powershell
& '~\AppData\Local\Programs\Python\Python312\python.exe' tools/align_lab/mms/run.py --prepare
```

Run all four CPU experiments (maximum four PyTorch threads):

```powershell
& '~\AppData\Local\Programs\Python\Python312\python.exe' tools/align_lab/mms/run.py --audio all --route all --device cpu
```

For the 4 GB RTX 3050, use the CUDA environment and short block jobs with
FP16 only after coordinating exclusive GPU access:

```powershell
& '~\AppData\Local\Programs\Python\Python312\python.exe' tools/align_lab/mms/run.py --audio all --route all --device cuda --half
```

TorchAudio source code is BSD-2-Clause.  The MMS_FA model checkpoint is
CC-BY-NC-4.0, so its weights and generated alignments need license review for
commercial use.  TorchAudio 2.8 deprecated the forced-alignment APIs, but they
remain present in the pinned 2.11 experiment package; pinning plus checkpoint
SHA-256 prevents a moving environment from silently changing the experiment.
