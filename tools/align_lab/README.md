# R02 alignment lab

Three independent experiments on `assets/audio/vocals.wav` + the 26 LRC lines
in `data/lyrics_film.json` / `data/lyrics_kana.json`.  Nothing here modifies
`data/`, `src/`, `assets/`, `config.json` or the existing `tools/*.py`.

| method | directory | backend | level |
|---|---|---|---|
| `out/align_lab/sofa_jpn.json` | `sofa/` | SOFA Japanese v0.0.2 (PyTorch, CPU) | phone -> mora |
| `out/align_lab/hubertfa_jpn.json` | `hubertfa/` | HubertFA Japanese ONNX v0.0.7 (CPU) | phone -> mora |
| `out/align_lab/stable_ts_largev3.json` | `stable_ts/` | stable-ts `align()` + Whisper large-v3 (CPU) | character -> mora |

Shared code lives in `common.py` (kana→phone table, per-line crops, clicks,
spectrogram overlays, JSON writer).  `validate.py` checks the contract
(26 lines, 349 morae, same kana/order, finite monotonic times).

## One-command reruns

From the project root:

```powershell
# SOFA
tools\align_lab\sofa\.venv\Scripts\python.exe tools\align_lab\sofa\run.py --device cpu

# HubertFA (ONNX, CPU)
tools\align_lab\hubertfa\.venv\Scripts\python.exe tools\align_lab\hubertfa\run.py

# stable-ts + large-v3
tools\align_lab\stable_ts\.venv\Scripts\python.exe tools\align_lab\stable_ts\run.py --backend vanilla --device cpu

# score / validate
.venv\Scripts\python.exe tools\align_eval.py out\align_lab\<method>.json --out out\align_lab\<method>.eval.json
.venv\Scripts\python.exe tools\align_lab\validate.py
```

Each command writes `out/align_lab/<method>.json`, `<method>_clicks.wav`
(left = original song, right = one click per mora) and
`<method>_L0.png`, `_L10.png`, `_L25.png` (vocal spectrogram + mora lines).

## Environment setup (isolated venvs)

Models and caches go under `tools/align_lab/_cache/`; set
`UV_CACHE_DIR` there if the system drive is small.

### SOFA

```powershell
git clone --depth 1 https://github.com/qiuqiao/SOFA.git tools/align_lab/sofa/SOFA
# download https://github.com/colstone/SOFA_Models/releases/tag/JPN-V0.0.2b
# extract to tools/align_lab/_cache/SOFA_model_JPN/
uv venv --python 3.10 tools/align_lab/sofa/.venv
uv pip install --python tools/align_lab/sofa/.venv/Scripts/python.exe torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
uv pip install --python tools/align_lab/sofa/.venv/Scripts/python.exe -r tools/align_lab/sofa/SOFA/requirements.txt "setuptools<81"
```

SOFA's `infer.py` cannot load its checkpoint with PyTorch >= 2.6
(`weights_only` default); `run.py` performs the same inference in-process with
`weights_only=False`.  torchaudio 2.5.1 is used so `torchaudio.load` does not
require torchcodec/FFmpeg DLLs.

### HubertFA

```powershell
git clone --depth 1 https://github.com/wolfgitpr/HubertFA.git tools/align_lab/hubertfa/HubertFA
# download https://github.com/wolfgitpr/HubertFA/releases/download/v0.0.7/1218_hfa_model_new_dict.zip
# extract to tools/align_lab/_cache/hubertfa/model/
uv venv --python 3.11 tools/align_lab/hubertfa/.venv
uv pip install --python tools/align_lab/hubertfa/.venv/Scripts/python.exe onnxruntime "numpy~=1.26.4" "librosa<0.10" matplotlib "textgrid~=1.5" pandas tqdm click PyYAML soundfile "setuptools<81"
```

The ONNX graph contains the HuBERT front-end, so only `onnxruntime` is needed.

### stable-ts

```powershell
uv venv --python 3.11 tools/align_lab/stable_ts/.venv
uv pip install --python tools\align_lab\stable_ts\.venv\Scripts\python.exe torch torchaudio --index-url https://download.pytorch.org/whl/cpu
uv pip install --python tools\align_lab\stable_ts\.venv\Scripts\python.exe stable-ts faster-whisper librosa soundfile matplotlib "setuptools<81"
# large-v3 (2.94 GB):
curl.exe -L -o tools\align_lab\_cache\models\large-v3.pt https://openaipublic.azureedge.net/main/whisper/models/e5b1a55b89c1367dacf97e3e19bfd829a01529dbfdeefa8caeb59b3f1b81dadb/large-v3.pt
```

The intended faster-whisper/kotoba route (`kotoba-whisper-v2.0-faster`,
1.41 GB) is kept in `_cache/models/kotoba-v2.0-faster/`, but
`faster-whisper 1.2.1`'s CT2 `model.align()` access-violates on this Windows
host (CTranslate2 4.5 and 4.8.3, int8 and float32).  The vanilla Whisper
cross-attention path is used instead.  `--backend faster` remains available for
a machine where CT2 alignment works.
