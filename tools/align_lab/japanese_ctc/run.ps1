$ErrorActionPreference = 'Stop'

$TaskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $TaskRoot '..\..\..')).Path
$PrivateSite = Join-Path $TaskRoot '.venv\Lib\site-packages'
$UvCache = Join-Path $RepoRoot 'tools\align_lab\_cache\japanese_ctc\uv'
$HfHome = Join-Path $RepoRoot 'tools\align_lab\_cache\japanese_ctc\hf'
$BasePython = '~\AppData\Local\Programs\Python\Python312\python.exe'

New-Item -ItemType Directory -Force -Path $PrivateSite, $UvCache, $HfHome | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $PrivateSite 'torch'))) {
    uv pip install --python $BasePython --target $PrivateSite --cache-dir $UvCache `
        --index-url 'https://download.pytorch.org/whl/cpu' 'torch==2.9.1'
}
if (-not (Test-Path -LiteralPath (Join-Path $PrivateSite 'transformers'))) {
    uv pip install --python $BasePython --target $PrivateSite --cache-dir $UvCache `
        'transformers==4.57.3'
}

$env:OMP_NUM_THREADS = '4'
$env:MKL_NUM_THREADS = '4'
$env:OPENBLAS_NUM_THREADS = '4'
$env:NUMEXPR_NUM_THREADS = '4'
$env:TOKENIZERS_PARALLELISM = 'false'
$env:HF_HOME = $HfHome
$env:HF_HUB_CACHE = Join-Path $HfHome 'hub'
$env:HF_XET_CACHE = Join-Path $HfHome 'xet'
$env:HF_HUB_DISABLE_TELEMETRY = '1'
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = '1'

& $BasePython (Join-Path $TaskRoot 'run.py') @args
exit $LASTEXITCODE
