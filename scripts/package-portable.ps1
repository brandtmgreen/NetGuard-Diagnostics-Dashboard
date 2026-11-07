param(
  [string]$RuntimePath = "$env:LOCALAPPDATA\Programs\NetGuard",
  [string]$OutputDir = "release",
  [switch]$Zip
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version

if (-not (Test-Path (Join-Path $RuntimePath "NetGuard.exe"))) {
  throw "Working Electron runtime not found at $RuntimePath. Pass -RuntimePath with a folder containing NetGuard.exe and resources."
}

Write-Output "Building frontend and bundled server..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }

$staging = Join-Path $root ".package-staging"
$release = Join-Path $root $OutputDir
$app = Join-Path $release "NetGuard"
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $app -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $staging | Out-Null
New-Item -ItemType Directory -Force $app | Out-Null

Copy-Item (Join-Path $root "electron.cjs") $staging
@"
{
  "name": "netguard-security-desk",
  "productName": "NetGuard Security Desk",
  "version": "$version",
  "private": true,
  "main": "electron.cjs"
}
"@ | Set-Content (Join-Path $staging "package.json") -Encoding utf8

& (Join-Path $root "node_modules\.bin\asar.cmd") pack $staging (Join-Path $staging "app.asar")
if ($LASTEXITCODE -ne 0) { throw "asar pack failed." }

robocopy $RuntimePath $app /E /XD resources /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE." }
New-Item -ItemType Directory -Force (Join-Path $app "resources") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $app "resources\app.asar.unpacked\dist") | Out-Null
Copy-Item (Join-Path $staging "app.asar") (Join-Path $app "resources\app.asar") -Force
Copy-Item (Join-Path $root "dist\*") (Join-Path $app "resources\app.asar.unpacked\dist") -Recurse -Force
New-Item -ItemType Directory -Force (Join-Path $app "scripts") | Out-Null
Copy-Item (Join-Path $root "scripts\install-startup.ps1") (Join-Path $app "scripts\install-startup.ps1") -Force
Copy-Item (Join-Path $root "scripts\uninstall-startup.ps1") (Join-Path $app "scripts\uninstall-startup.ps1") -Force
Copy-Item (Join-Path $root "README.md") (Join-Path $app "README.md") -Force

if (Test-Path (Join-Path $app "react-example.exe")) {
  Rename-Item (Join-Path $app "react-example.exe") "NetGuard.exe" -Force
}

Write-Output "Portable build: $app"
if ($Zip) {
  $zipPath = Join-Path $release "NetGuard-$version-win-x64.zip"
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  Compress-Archive -Path (Join-Path $app "*") -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Output "Portable zip: $zipPath"
}
