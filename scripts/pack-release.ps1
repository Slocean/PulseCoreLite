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

function Ensure-LauncherAssets {
  param(
    [Parameter(Mandatory = $true)][string[]]$RequiredDirs
  )

  $missing = @(
    $RequiredDirs |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $projectRoot ("build-assets\" + $_)) -PathType Container)
      }
  )

  if ($missing.Count -eq 0) {
    return
  }

  $fetchScriptPath = Join-Path $projectRoot "scripts\fetch-launchers.ps1"
  if (-not (Test-Path -LiteralPath $fetchScriptPath -PathType Leaf)) {
    throw "Launcher fetch script not found: $fetchScriptPath"
  }

  Write-Host "[pack-release] Missing launcher assets: $($missing -join ', ')"
  Write-Host "[pack-release] Fetching launcher assets..."
  & $fetchScriptPath
  if ($LASTEXITCODE -ne 0) {
    throw "Launcher asset fetch failed with exit code $LASTEXITCODE"
  }

  $stillMissing = @(
    $RequiredDirs |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $projectRoot ("build-assets\" + $_)) -PathType Container)
      }
  )
  if ($stillMissing.Count -gt 0) {
    throw "Launcher assets are still missing after fetch: $($stillMissing -join ', ')"
  }
}

function Invoke-TauriBuild {
  param(
    [Parameter(Mandatory = $true)][string]$ManifestName,
    [string]$LauncherResourceDir,
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

  if ([string]::IsNullOrWhiteSpace($LauncherResourceDir)) {
    $override.bundle.Remove("resources")
  } else {
    $override.bundle.resources = @{
      ("../build-assets/" + $LauncherResourceDir) = $LauncherResourceDir
    }
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

function New-PortableAiArchive {
  param(
    [Parameter(Mandatory = $true)][string]$PortableRootDir,
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [Parameter(Mandatory = $true)][string]$ExeName,
    [Parameter(Mandatory = $true)][string]$LauncherSourceDir,
    [Parameter(Mandatory = $true)][string]$LauncherDirName,
    [Parameter(Mandatory = $true)][string]$LauncherLabel
  )

  if (Test-Path -LiteralPath $PortableRootDir) {
    Remove-Item -LiteralPath $PortableRootDir -Recurse -Force
  }
  if (Test-Path -LiteralPath $ArchivePath) {
    Remove-Item -LiteralPath $ArchivePath -Force
  }

  New-Item -ItemType Directory -Path $PortableRootDir -Force | Out-Null
  Copy-Item -LiteralPath $ExecutablePath -Destination (Join-Path $PortableRootDir $ExeName) -Force
  Copy-Item -LiteralPath $LauncherSourceDir -Destination (Join-Path $PortableRootDir $LauncherDirName) -Recurse -Force

  $readmePath = Join-Path $PortableRootDir "README.txt"
  $readmeContent = @"
PulseCoreLite Portable AI
=========================

What is included:
- $ExeName (portable app)
- $LauncherDirName\ (bundled local AI launcher: $LauncherLabel)

How to run:
1) Launch $ExeName
2) In Settings > Local AI, choose your model folder that contains .gguf files
3) Open the AI page and start the local runtime
"@
  Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding ASCII

  Compress-Archive -Path $PortableRootDir -DestinationPath $ArchivePath -Force
  Remove-Item -LiteralPath $PortableRootDir -Recurse -Force
}

Write-Host "[pack-release] Reading project metadata..."
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version
$exeName = "$($packageJson.name).exe"
$date = Get-Date -Format "yyyyMMdd"
$base = "PulseCoreLite_v${version}_${date}"
$releaseDir = Join-Path $projectRoot "release"
$cpuLauncherDirName = "llama_CPU_X64"
$gpuLauncherDirName = "llama_GPU_CUDA12"
$cpuLauncherSourceDir = Join-Path $projectRoot ("build-assets\" + $cpuLauncherDirName)
$gpuLauncherSourceDir = Join-Path $projectRoot ("build-assets\" + $gpuLauncherDirName)
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

Ensure-LauncherAssets -RequiredDirs @($cpuLauncherDirName, $gpuLauncherDirName)

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
  "${base}_setup-ai-cpu.exe",
  "${base}_setup-ai-cpu.exe.sig",
  "${base}_setup-ai-cpu.msi",
  "${base}_portable-ai-cpu.zip",
  "${base}_setup-ai-gpu.exe",
  "${base}_setup-ai-gpu.exe.sig",
  "${base}_setup-ai-gpu.msi",
  "${base}_portable-ai-gpu.zip",
  "latest.json",
  "latest-lite.json",
  "latest-ai.json",
  "latest-ai-cpu.json",
  "latest-ai-gpu.json"
)
foreach ($name in $staleNames) {
  $path = Join-Path $releaseDir $name
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

Write-Host "[pack-release] Building lite release artifacts..."
Invoke-TauriBuild -ManifestName "latest-lite.json" -LauncherResourceDir "" -CreateUpdaterArtifacts $createUpdaterArtifacts
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

Write-Host "[pack-release] Building AI CPU release artifacts..."
Invoke-TauriBuild -ManifestName "latest-ai-cpu.json" -LauncherResourceDir $cpuLauncherDirName -CreateUpdaterArtifacts $createUpdaterArtifacts
$aiCpuOutputs = Collect-BuildOutputs -Version $version -ExeName $exeName

$setupAiCpuExeOut = Join-Path $releaseDir "${base}_setup-ai-cpu.exe"
$setupAiCpuMsiOut = Join-Path $releaseDir "${base}_setup-ai-cpu.msi"
$portableAiCpuZip = Join-Path $releaseDir "${base}_portable-ai-cpu.zip"
$portableAiCpuDir = Join-Path $releaseDir "${base}_portable-ai-cpu"
$setupAiCpuSigOut = "${setupAiCpuExeOut}.sig"

Copy-Item -LiteralPath $aiCpuOutputs.Nsis.FullName -Destination $setupAiCpuExeOut -Force
Copy-Item -LiteralPath $aiCpuOutputs.Msi.FullName -Destination $setupAiCpuMsiOut -Force
if ($aiCpuOutputs.NsisSig) {
  Copy-Item -LiteralPath $aiCpuOutputs.NsisSig -Destination $setupAiCpuSigOut -Force
}

New-PortableAiArchive `
  -PortableRootDir $portableAiCpuDir `
  -ArchivePath $portableAiCpuZip `
  -ExecutablePath $aiCpuOutputs.PortableExe `
  -ExeName $exeName `
  -LauncherSourceDir $cpuLauncherSourceDir `
  -LauncherDirName $cpuLauncherDirName `
  -LauncherLabel "CPU"

Write-Host "[pack-release] Building AI GPU release artifacts..."
Invoke-TauriBuild -ManifestName "latest-ai-gpu.json" -LauncherResourceDir $gpuLauncherDirName -CreateUpdaterArtifacts $createUpdaterArtifacts
$aiGpuOutputs = Collect-BuildOutputs -Version $version -ExeName $exeName

$setupAiGpuExeOut = Join-Path $releaseDir "${base}_setup-ai-gpu.exe"
$setupAiGpuMsiOut = Join-Path $releaseDir "${base}_setup-ai-gpu.msi"
$portableAiGpuZip = Join-Path $releaseDir "${base}_portable-ai-gpu.zip"
$portableAiGpuDir = Join-Path $releaseDir "${base}_portable-ai-gpu"
$setupAiGpuSigOut = "${setupAiGpuExeOut}.sig"

Copy-Item -LiteralPath $aiGpuOutputs.Nsis.FullName -Destination $setupAiGpuExeOut -Force
Copy-Item -LiteralPath $aiGpuOutputs.Msi.FullName -Destination $setupAiGpuMsiOut -Force
if ($aiGpuOutputs.NsisSig) {
  Copy-Item -LiteralPath $aiGpuOutputs.NsisSig -Destination $setupAiGpuSigOut -Force
}

New-PortableAiArchive `
  -PortableRootDir $portableAiGpuDir `
  -ArchivePath $portableAiGpuZip `
  -ExecutablePath $aiGpuOutputs.PortableExe `
  -ExeName $exeName `
  -LauncherSourceDir $gpuLauncherSourceDir `
  -LauncherDirName $gpuLauncherDirName `
  -LauncherLabel "GPU CUDA 12.4"

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

  $latestAiJsonPath = Join-Path $releaseDir "latest-ai.json"
  $latestAiCpuJsonPath = Join-Path $releaseDir "latest-ai-cpu.json"
  $latestAiGpuJsonPath = Join-Path $releaseDir "latest-ai-gpu.json"

  if (Test-Path -LiteralPath $setupAiCpuSigOut -PathType Leaf) {
    $aiCpuDownloadUrl = "$downloadBase/$([System.IO.Path]::GetFileName($setupAiCpuExeOut))"
    New-UpdaterManifest -Version $version -SignaturePath $setupAiCpuSigOut -DownloadUrl $aiCpuDownloadUrl -OutputPath $latestAiCpuJsonPath -Notes $notes
    Write-Host "[pack-release] AI CPU updater manifest generated: $latestAiCpuJsonPath"
  } else {
    Write-Host "[pack-release] Skipping AI CPU updater manifest because AI CPU signature is missing."
  }

  if (Test-Path -LiteralPath $setupAiGpuSigOut -PathType Leaf) {
    $aiGpuDownloadUrl = "$downloadBase/$([System.IO.Path]::GetFileName($setupAiGpuExeOut))"
    New-UpdaterManifest -Version $version -SignaturePath $setupAiGpuSigOut -DownloadUrl $aiGpuDownloadUrl -OutputPath $latestAiGpuJsonPath -Notes $notes
    Copy-Item -LiteralPath $latestAiGpuJsonPath -Destination $latestAiJsonPath -Force
    Write-Host "[pack-release] AI GPU updater manifests generated: $latestAiGpuJsonPath, $latestAiJsonPath"
  } elseif (Test-Path -LiteralPath $latestAiCpuJsonPath -PathType Leaf) {
    Copy-Item -LiteralPath $latestAiCpuJsonPath -Destination $latestAiJsonPath -Force
    Write-Host "[pack-release] AI GPU signature is missing; latest-ai.json falls back to AI CPU."
  } else {
    Write-Host "[pack-release] Skipping AI updater manifests because AI signatures are missing."
  }
} else {
  Write-Host "[pack-release] Skipping updater manifests (set GITHUB_OWNER/GITHUB_REPO and ensure .sig is present)."
}

Write-Host ""
Write-Host "[pack-release] Done. Generated release artifacts:"
Write-Host " - $setupLiteExeOut"
Write-Host " - $setupLiteMsiOut"
Write-Host " - $portableLiteOut"
Write-Host " - $setupAiCpuExeOut"
Write-Host " - $setupAiCpuMsiOut"
Write-Host " - $portableAiCpuZip"
Write-Host " - $setupAiGpuExeOut"
Write-Host " - $setupAiGpuMsiOut"
Write-Host " - $portableAiGpuZip"
if (Test-Path -LiteralPath $setupLiteSigOut -PathType Leaf) {
  Write-Host " - $setupLiteSigOut"
}
if (Test-Path -LiteralPath $setupAiCpuSigOut -PathType Leaf) {
  Write-Host " - $setupAiCpuSigOut"
}
if (Test-Path -LiteralPath $setupAiGpuSigOut -PathType Leaf) {
  Write-Host " - $setupAiGpuSigOut"
}
foreach ($manifestName in @("latest.json", "latest-lite.json", "latest-ai.json", "latest-ai-cpu.json", "latest-ai-gpu.json")) {
  $manifestPath = Join-Path $releaseDir $manifestName
  if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    Write-Host " - $manifestPath"
  }
}
