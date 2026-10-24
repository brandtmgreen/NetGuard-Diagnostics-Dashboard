$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
  throw "Inno Setup 6 (iscc.exe) is required. Install it, then run this script again. The portable build can still be created with scripts\package-portable.ps1."
}

if (-not (Test-Path (Join-Path $root "release\NetGuard\NetGuard.exe"))) {
  throw "Build the portable package first: .\scripts\package-portable.ps1"
}

& $iscc.Source (Join-Path $root "installer\NetGuard.iss")
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed with exit code $LASTEXITCODE." }
Write-Output "Installer written to release\NetGuard-Setup-1.0.4.exe"
