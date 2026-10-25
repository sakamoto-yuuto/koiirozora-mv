param(
  [Parameter(Mandatory=$true)][string]$PromptFile,
  [Parameter(Mandatory=$true)][string]$OutFile,
  [Parameter(Mandatory=$true)][string]$LogFile,
  [Parameter(Mandatory=$true)][string]$Workdir,
  [string]$ImageListFile = ""
)
$ErrorActionPreference = 'Continue'
$prompt = Get-Content -LiteralPath $PromptFile -Raw -Encoding UTF8
$codex = (Get-Command codex).Source
$a = @('exec','--ephemeral','--skip-git-repo-check','-s','workspace-write','-m','gpt-5.6-terra','-c','model_reasoning_effort=low','-C',$Workdir)
if ($ImageListFile -and (Test-Path -LiteralPath $ImageListFile)) {
  $imgs = Get-Content -LiteralPath $ImageListFile -Encoding UTF8 | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($img in $imgs) { $a += @('-i',$img) }
}
$a += @('-o',$OutFile,$prompt)
& $codex @a *> $LogFile
exit $LASTEXITCODE
