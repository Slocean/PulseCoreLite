param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

function Resolve-WebViewInstallerPath {
  if ($env:WEBVIEW2_OFFLINE_INSTALLER) {
    $envPath = $env:WEBVIEW2_OFFLINE_INSTALLER
    if (Test-Path -LiteralPath $envPath -PathType Leaf) {
      return (Resolve-Path -LiteralPath $envPath).Path
    }
    throw "WEBVIEW2_OFFLINE_INSTALLER is set but file does not exist: $envPath"
  }

  $candidates = @(
    (Join-Path $projectRoot "build-assets\webview2\install_webview2.exe"),
    (Join-Path $projectRoot "build-assets\webview2\MicrosoftEdgeWebView2RuntimeInstallerX64.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw @"
WebView2 offline installer is required for portable-full output.
Put it at:
  build-assets\webview2\install_webview2.exe
or set:
  WEBVIEW2_OFFLINE_INSTALLER=<absolute-path-to-offline-installer>

Download from Microsoft (Evergreen Standalone Installer, x64):
https://developer.microsoft.com/microsoft-edge/webview2/
"@
}

Write-Host "[pack-release] Reading project version..."
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version
$date = Get-Date -Format "yyyyMMdd"
$base = "PulseCoreLite_v${version}_${date}"
$releaseDir = Join-Path $projectRoot "release"

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

if (-not $SkipBuild) {
  Write-Host "[pack-release] Building Tauri bundles..."
  & npm run tauri:build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run tauri:build failed with exit code $LASTEXITCODE"
  }
}
else {
  Write-Host "[pack-release] SkipBuild enabled; using existing artifacts."
}

Write-Host "[pack-release] Collecting build artifacts..."
$nsisDir = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis"
$msiDir = Join-Path $projectRoot "src-tauri\target\release\bundle\msi"
$nsis = Get-ChildItem -Path (Join-Path $nsisDir "*_${version}_*-setup.exe") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$msi = Get-ChildItem -Path (Join-Path $msiDir "*_${version}_*.msi") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $nsis) {
  $nsis = Get-ChildItem -Path (Join-Path $nsisDir "*-setup.exe") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $msi) {
  $msi = Get-ChildItem -Path (Join-Path $msiDir "*.msi") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
$portableExe = Join-Path $projectRoot "src-tauri\target\release\pulsecorelite.exe"

if (-not $nsis) { throw "NSIS installer not found." }
if (-not $msi) { throw "MSI installer not found." }
if (-not (Test-Path -LiteralPath $portableExe -PathType Leaf)) { throw "Portable executable not found: $portableExe" }

$setupExeOut = Join-Path $releaseDir "${base}_setup.exe"
$setupMsiOut = Join-Path $releaseDir "${base}_setup.msi"
$portableLiteOut = Join-Path $releaseDir "${base}_portable-lite.exe"

Copy-Item -LiteralPath $nsis.FullName -Destination $setupExeOut -Force
Copy-Item -LiteralPath $msi.FullName -Destination $setupMsiOut -Force
Copy-Item -LiteralPath $portableExe -Destination $portableLiteOut -Force

Write-Host "[pack-release] Preparing portable-full package..."
$webviewInstaller = Resolve-WebViewInstallerPath
$portableFullDir = Join-Path $releaseDir "${base}_portable-full"
$portableFullZip = Join-Path $releaseDir "${base}_portable-full.zip"
$portableExeName = "pulsecorelite.exe"

if (Test-Path -LiteralPath $portableFullDir) {
  Remove-Item -LiteralPath $portableFullDir -Recurse -Force
}
New-Item -ItemType Directory -Path $portableFullDir -Force | Out-Null

Copy-Item -LiteralPath $portableExe -Destination (Join-Path $portableFullDir $portableExeName) -Force
Copy-Item -LiteralPath $webviewInstaller -Destination (Join-Path $portableFullDir "install_webview2.exe") -Force

$launcherPath = Join-Path $portableFullDir "Start_PulseCoreLite.bat"
$launcherContent = @"
@echo off
setlocal
set "APP_EXE=$portableExeName"
set "WV2_SETUP=install_webview2.exe"

reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>&1
if %errorlevel% neq 0 (
  reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>&1
)

if %errorlevel% neq 0 (
  echo [PulseCoreLite] WebView2 runtime not detected.
  echo [PulseCoreLite] Installing WebView2 runtime...
  if not exist "%WV2_SETUP%" (
    echo [PulseCoreLite] Missing %WV2_SETUP%.
    echo [PulseCoreLite] Please install WebView2 manually, then run %APP_EXE%.
    pause
    exit /b 1
  )
  start /wait "" "%WV2_SETUP%" /silent /install
  if %errorlevel% neq 0 (
    echo [PulseCoreLite] WebView2 installation failed. ExitCode=%errorlevel%
    pause
    exit /b %errorlevel%
  )
)

start "" "%APP_EXE%"
endlocal
"@
Set-Content -LiteralPath $launcherPath -Value $launcherContent -Encoding ASCII

$readmePath = Join-Path $portableFullDir "README.txt"
$readmeContent = @"
PulseCoreLite Portable Full
===========================

What is included:
- pulsecorelite.exe (portable app)
- install_webview2.exe (WebView2 offline installer)
- Start_PulseCoreLite.bat (recommended launcher)

How to run:
1) Double-click Start_PulseCoreLite.bat
2) If WebView2 is missing, the script installs it silently first.
3) The app starts automatically.

Manual fallback:
- Run install_webview2.exe manually, then run pulsecorelite.exe
"@
Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding ASCII

if (Test-Path -LiteralPath $portableFullZip) {
  Remove-Item -LiteralPath $portableFullZip -Force
}
Compress-Archive -Path $portableFullDir -DestinationPath $portableFullZip -Force
Remove-Item -LiteralPath $portableFullDir -Recurse -Force

Write-Host ""
Write-Host "[pack-release] Done. Generated 4 release artifacts:"
Write-Host " - $setupExeOut"
Write-Host " - $setupMsiOut"
Write-Host " - $portableLiteOut"
Write-Host " - $portableFullZip"
