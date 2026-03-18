$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tauriCliPath = Join-Path $projectRoot "node_modules\.bin\tauri.cmd"
Set-Location $projectRoot

if (-not (Test-Path -LiteralPath $tauriCliPath -PathType Leaf)) {
  throw "Tauri CLI not found at $tauriCliPath. Run package install first (npm install / pnpm install)."
}

function Get-ReleaseRepositoryInfo {
  $owner = if ($env:GITHUB_OWNER) { $env:GITHUB_OWNER } else { "Slocean" }
  $repo = if ($env:GITHUB_REPO) { $env:GITHUB_REPO } else { "PulseCoreLite" }
  return @{
    Owner = $owner
    Repo = $repo
  }
}

function Get-UpdaterEndpointUrl {
  param(
    [Parameter(Mandatory = $true)][string]$ManifestName
  )

  $repoInfo = Get-ReleaseRepositoryInfo
  return "https://github.com/$($repoInfo.Owner)/$($repoInfo.Repo)/releases/latest/download/$ManifestName"
}

function Invoke-TauriBuild {
  param(
    [Parameter(Mandatory = $true)][string]$ManifestName,
    [Parameter(Mandatory = $true)][bool]$IncludeLauncher,
    [Parameter()][Nullable[bool]]$CreateUpdaterArtifacts
  )

  $overridePath = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetTempFileName(), ".json")
  $endpointUrl = Get-UpdaterEndpointUrl -ManifestName $ManifestName
  $override = @{
    bundle = @{
      createUpdaterArtifacts = $CreateUpdaterArtifacts
      windows = @{
        webviewInstallMode = @{
          type = "downloadBootstrapper"
          silent = $true
        }
      }
    }
    plugins = @{
      updater = @{
        endpoints = @($endpointUrl)
      }
    }
  }

  if (-not $IncludeLauncher) {
    $override.bundle.Remove("resources")
  } else {
    $override.bundle.resources = @(
      (Join-Path $projectRoot "build-assets\llama_CPU_X64")
    )
  }

  if ($null -eq $CreateUpdaterArtifacts) {
    $override.bundle.Remove("createUpdaterArtifacts")
  }

  $previousManifestUrl = $env:VITE_UPDATE_MANIFEST_URL

  try {
    $env:VITE_UPDATE_MANIFEST_URL = $endpointUrl
    $override | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $overridePath -Encoding ASCII
    & $tauriCliPath build --config $overridePath
    if ($LASTEXITCODE -ne 0) {
      throw "tauri build failed for manifest '$ManifestName' with exit code $LASTEXITCODE"
    }
  }
  finally {
    if ($null -eq $previousManifestUrl) {
      Remove-Item Env:\VITE_UPDATE_MANIFEST_URL -ErrorAction SilentlyContinue
    } else {
      $env:VITE_UPDATE_MANIFEST_URL = $previousManifestUrl
    }
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

  $notesPath = Join-Path $projectRoot "docs\version.md"
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
  $historyLine = "View release history: $historyUrl"
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
$launcherSourceDir = Join-Path $projectRoot "build-assets\llama_CPU_X64"
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

if (-not (Test-Path -LiteralPath $launcherSourceDir -PathType Container)) {
  throw "Launcher assets not found: $launcherSourceDir"
}

$hasSigningKey = -not [string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)
$createUpdaterArtifacts = $hasSigningKey
if (-not $hasSigningKey) {
  Write-Host "[pack-release] TAURI_SIGNING_PRIVATE_KEY not set; disabling updater artifact signing for this build."
  Write-Host "[pack-release] Set TAURI_SIGNING_PRIVATE_KEY to re-enable signatures (.sig) and updater manifest output."
}

$staleNames = @(
  "${base}_setup-lite.exe",
  "${base}_setup-lite.exe.sig",
  "${base}_setup-lite.msi",
  "${base}_portable-lite.exe",
  "${base}_setup-ai.exe",
  "${base}_setup-ai.exe.sig",
  "${base}_setup-ai.msi",
  "${base}_portable-ai.zip",
  "latest.json",
  "latest-lite.json",
  "latest-ai.json"
)
foreach ($name in $staleNames) {
  $path = Join-Path $releaseDir $name
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

Write-Host "[pack-release] Building lite release artifacts..."
Invoke-TauriBuild -ManifestName "latest-lite.json" -IncludeLauncher $false -CreateUpdaterArtifacts $createUpdaterArtifacts
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

Write-Host "[pack-release] Building AI runtime release artifacts..."
Invoke-TauriBuild -ManifestName "latest-ai.json" -IncludeLauncher $true -CreateUpdaterArtifacts $createUpdaterArtifacts
$aiOutputs = Collect-BuildOutputs -Version $version -ExeName $exeName

$setupAiExeOut = Join-Path $releaseDir "${base}_setup-ai.exe"
$setupAiMsiOut = Join-Path $releaseDir "${base}_setup-ai.msi"
$portableAiZip = Join-Path $releaseDir "${base}_portable-ai.zip"
$portableAiDir = Join-Path $releaseDir "${base}_portable-ai"
$setupAiSigOut = "${setupAiExeOut}.sig"

Copy-Item -LiteralPath $aiOutputs.Nsis.FullName -Destination $setupAiExeOut -Force
Copy-Item -LiteralPath $aiOutputs.Msi.FullName -Destination $setupAiMsiOut -Force
if ($aiOutputs.NsisSig) {
  Copy-Item -LiteralPath $aiOutputs.NsisSig -Destination $setupAiSigOut -Force
}

if (Test-Path -LiteralPath $portableAiDir) {
  Remove-Item -LiteralPath $portableAiDir -Recurse -Force
}
if (Test-Path -LiteralPath $portableAiZip) {
  Remove-Item -LiteralPath $portableAiZip -Force
}
New-Item -ItemType Directory -Path $portableAiDir -Force | Out-Null

Copy-Item -LiteralPath $aiOutputs.PortableExe -Destination (Join-Path $portableAiDir $exeName) -Force
Copy-Item -LiteralPath $launcherSourceDir -Destination (Join-Path $portableAiDir "llama_CPU_X64") -Recurse -Force

$readmePath = Join-Path $portableAiDir "README.txt"
$readmeContent = @"
PulseCoreLite Portable AI
=========================

What is included:
- $exeName (portable app)
- llama_CPU_X64\ (bundled local AI launcher)

How to run:
1) Launch $exeName
2) In the AI panel, choose your model folder that contains .gguf files
3) The bundled launcher will be detected automatically
"@
Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding ASCII

Compress-Archive -Path $portableAiDir -DestinationPath $portableAiZip -Force
Remove-Item -LiteralPath $portableAiDir -Recurse -Force

$githubOwner = $env:GITHUB_OWNER
$githubRepo = $env:GITHUB_REPO
$githubTag = $env:GITHUB_TAG

if ($githubOwner -and $githubRepo -and (Test-Path -LiteralPath $setupLiteSigOut -PathType Leaf)) {
  $downloadBase = if ($githubTag) {
    "https://github.com/$githubOwner/$githubRepo/releases/download/$githubTag"
  } else {
    "https://github.com/$githubOwner/$githubRepo/releases/latest/download"
  }
  $notes = Get-ReleaseNotes -Version $version

  $liteDownloadUrl = "$downloadBase/$([System.IO.Path]::GetFileName($setupLiteExeOut))"
  $latestJsonPath = Join-Path $releaseDir "latest.json"
  $latestLiteJsonPath = Join-Path $releaseDir "latest-lite.json"
  New-UpdaterManifest -Version $version -SignaturePath $setupLiteSigOut -DownloadUrl $liteDownloadUrl -OutputPath $latestJsonPath -Notes $notes
  Copy-Item -LiteralPath $latestJsonPath -Destination $latestLiteJsonPath -Force
  Write-Host "[pack-release] Lite updater manifests generated: $latestJsonPath, $latestLiteJsonPath"

  if (Test-Path -LiteralPath $setupAiSigOut -PathType Leaf) {
    $aiDownloadUrl = "$downloadBase/$([System.IO.Path]::GetFileName($setupAiExeOut))"
    $latestAiJsonPath = Join-Path $releaseDir "latest-ai.json"
    New-UpdaterManifest -Version $version -SignaturePath $setupAiSigOut -DownloadUrl $aiDownloadUrl -OutputPath $latestAiJsonPath -Notes $notes
    Write-Host "[pack-release] AI updater manifest generated: $latestAiJsonPath"
  } else {
    Write-Host "[pack-release] Skipping AI updater manifest because AI signature is missing."
  }
} else {
  Write-Host "[pack-release] Skipping updater manifests (set GITHUB_OWNER/GITHUB_REPO and ensure .sig is present)."
}

Write-Host ""
Write-Host "[pack-release] Done. Generated release artifacts:"
Write-Host " - $setupLiteExeOut"
Write-Host " - $setupLiteMsiOut"
Write-Host " - $portableLiteOut"
Write-Host " - $setupAiExeOut"
Write-Host " - $setupAiMsiOut"
Write-Host " - $portableAiZip"
if (Test-Path -LiteralPath $setupLiteSigOut -PathType Leaf) {
  Write-Host " - $setupLiteSigOut"
}
if (Test-Path -LiteralPath $setupAiSigOut -PathType Leaf) {
  Write-Host " - $setupAiSigOut"
}
foreach ($manifestName in @("latest.json", "latest-lite.json", "latest-ai.json")) {
  $manifestPath = Join-Path $releaseDir $manifestName
  if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    Write-Host " - $manifestPath"
  }
}
