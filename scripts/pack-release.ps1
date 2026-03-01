$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tauriCliPath = Join-Path $projectRoot "node_modules\.bin\tauri.cmd"
Set-Location $projectRoot

if (-not (Test-Path -LiteralPath $tauriCliPath -PathType Leaf)) {
  throw "Tauri CLI not found at $tauriCliPath. Run package install first (npm install / pnpm install)."
}

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
WebView2 offline installer is required for full installers and portable-full output.
Put it at:
  build-assets\webview2\install_webview2.exe
or set:
  WEBVIEW2_OFFLINE_INSTALLER=<absolute-path-to-offline-installer>

Download from Microsoft (Evergreen Standalone Installer, x64):
https://developer.microsoft.com/microsoft-edge/webview2/
"@
}

function Build-WithWebViewMode {
  param(
    [Parameter(Mandatory = $true)][string]$ModeType,
    [Parameter(Mandatory = $true)][bool]$Silent,
    [Parameter()][Nullable[bool]]$CreateUpdaterArtifacts
  )

  $overridePath = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetTempFileName(), ".json")
  $override = @{
    bundle = @{
      createUpdaterArtifacts = $CreateUpdaterArtifacts
      windows = @{
        webviewInstallMode = @{
          type = $ModeType
          silent = $Silent
        }
      }
    }
  }

  if ($null -eq $CreateUpdaterArtifacts) {
    $override.bundle.Remove("createUpdaterArtifacts")
  }

  try {
    $override | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $overridePath -Encoding ASCII
    & $tauriCliPath build --config $overridePath
    if ($LASTEXITCODE -ne 0) {
      throw "tauri build failed for webview mode '$ModeType' with exit code $LASTEXITCODE"
    }
  }
  finally {
    if (Test-Path -LiteralPath $overridePath) {
      Remove-Item -LiteralPath $overridePath -Force
    }
  }
}

function Get-LatestBundleArtifact {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string]$PreferredPattern,
    [Parameter(Mandatory = $true)][string]$FallbackPattern
  )

  $match = Get-ChildItem -Path (Join-Path $Directory $PreferredPattern) -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($match) {
    return $match
  }

  return Get-ChildItem -Path (Join-Path $Directory $FallbackPattern) -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

function Get-ReleaseNotes {
  param(
    [Parameter(Mandatory = $true)][string]$Version
  )

  $notesPath = Join-Path $projectRoot "version.md"
  if (-not (Test-Path -LiteralPath $notesPath -PathType Leaf)) {
    return ""
  }

  $lines = Get-Content -LiteralPath $notesPath -Encoding UTF8
  $target = "## v$Version"
  $start = [Array]::IndexOf($lines, $target)
  if ($start -lt 0) {
    return ""
  }

  $notes = New-Object System.Collections.Generic.List[string]
  for ($i = $start + 1; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line -match '^##\s+') {
      break
    }
    $notes.Add($line)
  }

  $notesText = ($notes -join "`n").Trim()
  $historyUrl = "https://github.com/Slocean/PulseCoreLite/releases"
  $historyLine = "查看历史版本: $historyUrl"
  if ($notesText -notmatch [regex]::Escape($historyUrl)) {
    if ($notesText) {
      $notesText = "$notesText`n`n$historyLine"
    } else {
      $notesText = $historyLine
    }
  }
  return $notesText
}

function New-UpdaterManifest {
  param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$SignaturePath,
    [Parameter(Mandatory = $true)][string]$DownloadUrl,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$Notes
  )

  if (-not (Test-Path -LiteralPath $SignaturePath -PathType Leaf)) {
    throw "Updater signature not found: $SignaturePath"
  }

  $signature = (Get-Content -LiteralPath $SignaturePath -Raw).Trim()
  $manifest = @{
    version = $Version
    notes = $Notes
    pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
      "windows-x86_64" = @{
        signature = $signature
        url = $DownloadUrl
      }
    }
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $manifestJson = $manifest | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($OutputPath, $manifestJson, $utf8NoBom)
}

function Collect-BuildOutputs {
  param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$ExeName
  )

  $nsisDir = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis"
  $msiDir = Join-Path $projectRoot "src-tauri\target\release\bundle\msi"
  $portableExe = Join-Path $projectRoot ("src-tauri\target\release\" + $ExeName)

  $nsis = Get-LatestBundleArtifact -Directory $nsisDir -PreferredPattern "*_${Version}_*-setup.exe" -FallbackPattern "*-setup.exe"
  $msi = Get-LatestBundleArtifact -Directory $msiDir -PreferredPattern "*_${Version}_*.msi" -FallbackPattern "*.msi"

  if (-not $nsis) { throw "NSIS installer not found after build." }
  if (-not $msi) { throw "MSI installer not found after build." }
  if (-not (Test-Path -LiteralPath $portableExe -PathType Leaf)) {
    throw "Portable executable not found: $portableExe"
  }

  $nsisSig = "$($nsis.FullName).sig"
  if (-not (Test-Path -LiteralPath $nsisSig -PathType Leaf)) {
    $nsisSig = $null
  }

  return @{
    Nsis = $nsis
    Msi = $msi
    PortableExe = $portableExe
    NsisSig = $nsisSig
  }
}

Write-Host "[pack-release] Reading project metadata..."
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version
$exeName = "$($packageJson.name).exe"
$date = Get-Date -Format "yyyyMMdd"
$base = "PulseCoreLite_v${version}_${date}"
$releaseDir = Join-Path $projectRoot "release"
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
$webviewInstaller = Resolve-WebViewInstallerPath
$hasSigningKey = -not [string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)
$createUpdaterArtifacts = $hasSigningKey
if (-not $hasSigningKey) {
  Write-Host "[pack-release] TAURI_SIGNING_PRIVATE_KEY not set; disabling updater artifact signing for this build."
  Write-Host "[pack-release] Set TAURI_SIGNING_PRIVATE_KEY to re-enable signatures (.sig) and updater manifest output."
}

# Clean stale outputs for this version/date naming set so release folder stays unambiguous.
$staleNames = @(
  "${base}_setup-lite.exe",
  "${base}_setup-lite.exe.sig",
  "${base}_setup-lite.msi",
  "${base}_portable-lite.exe",
  "${base}_setup-full.exe",
  "${base}_setup-full.msi",
  "${base}_portable-full.zip",
  "${base}_setup.exe",
  "${base}_setup.msi",
  "${base}_portable.exe",
  "latest.json"
)
foreach ($name in $staleNames) {
  $path = Join-Path $releaseDir $name
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

Write-Host "[pack-release] Building standard (no bundled WebView2) installers..."
Build-WithWebViewMode -ModeType "downloadBootstrapper" -Silent $true -CreateUpdaterArtifacts $createUpdaterArtifacts
$liteOutputs = Collect-BuildOutputs -Version $version -ExeName $exeName

$setupLiteExeOut = Join-Path $releaseDir "${base}_setup-lite.exe"
$setupLiteMsiOut = Join-Path $releaseDir "${base}_setup-lite.msi"
$portableLiteOut = Join-Path $releaseDir "${base}_portable-lite.exe"
$setupLiteSigOut = "${setupLiteExeOut}.sig"

Copy-Item -LiteralPath $liteOutputs.Nsis.FullName -Destination $setupLiteExeOut -Force
Copy-Item -LiteralPath $liteOutputs.Msi.FullName -Destination $setupLiteMsiOut -Force
Copy-Item -LiteralPath $liteOutputs.PortableExe -Destination $portableLiteOut -Force
if ($liteOutputs.NsisSig) {
  Copy-Item -LiteralPath $liteOutputs.NsisSig -Destination $setupLiteSigOut -Force
}

Write-Host "[pack-release] Building full (bundled offline WebView2) installers..."
Build-WithWebViewMode -ModeType "offlineInstaller" -Silent $true -CreateUpdaterArtifacts $createUpdaterArtifacts
$fullOutputs = Collect-BuildOutputs -Version $version -ExeName $exeName

$setupFullExeOut = Join-Path $releaseDir "${base}_setup-full.exe"
$setupFullMsiOut = Join-Path $releaseDir "${base}_setup-full.msi"
$portableFullZip = Join-Path $releaseDir "${base}_portable-full.zip"
$portableFullDir = Join-Path $releaseDir "${base}_portable-full"

Copy-Item -LiteralPath $fullOutputs.Nsis.FullName -Destination $setupFullExeOut -Force
Copy-Item -LiteralPath $fullOutputs.Msi.FullName -Destination $setupFullMsiOut -Force

if (Test-Path -LiteralPath $portableFullDir) {
  Remove-Item -LiteralPath $portableFullDir -Recurse -Force
}
if (Test-Path -LiteralPath $portableFullZip) {
  Remove-Item -LiteralPath $portableFullZip -Force
}
New-Item -ItemType Directory -Path $portableFullDir -Force | Out-Null

Copy-Item -LiteralPath $fullOutputs.PortableExe -Destination (Join-Path $portableFullDir $exeName) -Force
Copy-Item -LiteralPath $webviewInstaller -Destination (Join-Path $portableFullDir "install_webview2.exe") -Force

$launcherPath = Join-Path $portableFullDir "Start_PulseCoreLite.bat"
$launcherContent = @"
@echo off
setlocal
set "APP_EXE=$exeName"
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
- $exeName (portable app)
- install_webview2.exe (WebView2 offline installer)
- Start_PulseCoreLite.bat (recommended launcher)

How to run:
1) Double-click Start_PulseCoreLite.bat
2) If WebView2 is missing, the script installs it silently first.
3) The app starts automatically.

Manual fallback:
- Run install_webview2.exe manually, then run $exeName
"@
Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding ASCII

Compress-Archive -Path $portableFullDir -DestinationPath $portableFullZip -Force
Remove-Item -LiteralPath $portableFullDir -Recurse -Force

$githubOwner = $env:GITHUB_OWNER
$githubRepo = $env:GITHUB_REPO
$githubTag = $env:GITHUB_TAG

if ($githubOwner -and $githubRepo -and (Test-Path -LiteralPath $setupLiteSigOut -PathType Leaf)) {
  $downloadBase = if ($githubTag) {
    "https://github.com/$githubOwner/$githubRepo/releases/download/$githubTag"
  } else {
    "https://github.com/$githubOwner/$githubRepo/releases/latest/download"
  }
  $downloadUrl = "$downloadBase/$([System.IO.Path]::GetFileName($setupLiteExeOut))"
  $notes = Get-ReleaseNotes -Version $version
  $latestJsonPath = Join-Path $releaseDir "latest.json"
  New-UpdaterManifest -Version $version -SignaturePath $setupLiteSigOut -DownloadUrl $downloadUrl -OutputPath $latestJsonPath -Notes $notes
  Write-Host "[pack-release] Updater manifest generated: $latestJsonPath"
} else {
  Write-Host "[pack-release] Skipping updater manifest (set GITHUB_OWNER/GITHUB_REPO and ensure .sig is present)."
}

Write-Host ""
Write-Host "[pack-release] Done. Generated release artifacts:"
Write-Host " - $setupLiteExeOut"
Write-Host " - $setupLiteMsiOut"
Write-Host " - $portableLiteOut"
Write-Host " - $setupFullExeOut"
Write-Host " - $setupFullMsiOut"
Write-Host " - $portableFullZip"
if (Test-Path -LiteralPath $setupLiteSigOut -PathType Leaf) {
  Write-Host " - $setupLiteSigOut"
}
if (Test-Path -LiteralPath (Join-Path $releaseDir "latest.json") -PathType Leaf) {
  Write-Host " - $(Join-Path $releaseDir "latest.json")"
}
