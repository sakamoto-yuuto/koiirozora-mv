param(
    [ValidateSet('all','build','render','contact','verify','test')][string]$Action = 'all',
    [string]$Shot = '',
    [string]$Passes = 'line,clay,depth'
)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$blenderExe = 'D:\Blender\blender-5.2.2-windows-x64\blender.exe'
$tempPath = Join-Path $PSScriptRoot '_tmp'
New-Item -ItemType Directory -Force -Path $tempPath | Out-Null
$prior = @{}
foreach ($name in @('BLENDER_USER_CONFIG','BLENDER_USER_SCRIPTS','TEMP','TMP','PYTHONDONTWRITEBYTECODE')) {
    $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    $env:BLENDER_USER_CONFIG = Join-Path $tempPath 'config'
    $env:BLENDER_USER_SCRIPTS = Join-Path $tempPath 'scripts'
    $env:TEMP = $tempPath
    $env:TMP = $tempPath
    $env:PYTHONDONTWRITEBYTECODE = '1'
    New-Item -ItemType Directory -Force -Path $env:BLENDER_USER_CONFIG,$env:BLENDER_USER_SCRIPTS | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $tempPath 'scope_before.json'))) {
        & $blenderExe -b --factory-startup --threads 4 --python-exit-code 1 --python (Join-Path $PSScriptRoot 'verify_previs.py') -- --snapshot-scope
        if ($LASTEXITCODE -ne 0) { throw "Scope snapshot failed: $LASTEXITCODE" }
    }
    if ($Action -in @('all','build')) {
        & $blenderExe -b --factory-startup --threads 8 --python-exit-code 1 --python (Join-Path $PSScriptRoot 'build_previs.py')
        if ($LASTEXITCODE -ne 0) { throw "Build failed: $LASTEXITCODE" }
    }
    if ($Action -in @('all','render','contact')) {
        $renderArgs = @('--all')
        if ($Shot) { $renderArgs = @((Join-Path $PSScriptRoot "shots\$Shot.json")) }
        if ($Action -eq 'contact') { $renderArgs = @('--contact-only') }
        & $blenderExe -b --factory-startup --threads 8 --python-exit-code 1 --python (Join-Path $PSScriptRoot 'render_guides.py') -- @renderArgs --passes $Passes
        if ($LASTEXITCODE -ne 0) { throw "Render failed: $LASTEXITCODE" }
    }
    if ($Action -in @('all','verify')) {
        & $blenderExe -b --factory-startup --threads 4 --python-exit-code 1 --python (Join-Path $PSScriptRoot 'verify_previs.py')
        if ($LASTEXITCODE -ne 0) { throw "Verification failed: $LASTEXITCODE" }
    }
    if ($Action -in @('all','test')) {
        & $blenderExe -b --factory-startup --threads 4 --python-exit-code 1 --python (Join-Path $PSScriptRoot 'test_previs.py')
        if ($LASTEXITCODE -ne 0) { throw "Regression tests failed: $LASTEXITCODE" }
    }
} finally {
    foreach ($name in $prior.Keys) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
}
