$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildAssetsDir = Join-Path $projectRoot "build-assets"

function Get-LauncherRepositoryInfo {
  $owner = if ($env:LAUNCHER_ASSET_OWNER) { $env:LAUNCHER_ASSET_OWNER } elseif ($env:GITHUB_OWNER) { $env:GITHUB_OWNER } else { "Slocean" }
  $repo = if ($env:LAUNCHER_ASSET_REPO) { $env:LAUNCHER_ASSET_REPO } elseif ($env:GITHUB_REPO) { $env:GITHUB_REPO } else { "PulseCoreLite" }
  $tag = if ($env:LAUNCHER_ASSET_TAG) { $env:LAUNCHER_ASSET_TAG } else { "llm-assets-v1" }
  return @{
    Owner = $owner
    Repo = $repo
    Tag = $tag
  }
}

function Get-LauncherAssetsToFetch {
  $assets = @(
    @{
      AssetName = if ($env:LAUNCHER_CPU_ASSET) { $env:LAUNCHER_CPU_ASSET } else { "llama-b8405-bin-win-cpu-x64.zip" }
      TargetDir = "llama_CPU_X64"
    },
    @{
      AssetName = if ($env:LAUNCHER_GPU_DEFAULT_ASSET) { $env:LAUNCHER_GPU_DEFAULT_ASSET } else { "llama-b8405-bin-win-cuda-12.4-x64.zip" }
      TargetDir = "llama_GPU_CUDA12"
    }
  )

  if ($env:LAUNCHER_GPU_ALT_ASSET) {
    $assets += @{
      AssetName = $env:LAUNCHER_GPU_ALT_ASSET
      TargetDir = if ($env:LAUNCHER_GPU_ALT_TARGET_DIR) { $env:LAUNCHER_GPU_ALT_TARGET_DIR } else { "llama_GPU_CUDA13" }
    }
  }

  return $assets
}

function Get-LauncherDownloadUrl {
  param(
    [Parameter(Mandatory = $true)][string]$AssetName
  )

  $repoInfo = Get-LauncherRepositoryInfo
  return "https://github.com/$($repoInfo.Owner)/$($repoInfo.Repo)/releases/download/$($repoInfo.Tag)/$AssetName"
}

function Get-RequestHeaders {
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) {
    $headers["Authorization"] = "Bearer $($env:GITHUB_TOKEN)"
  }
  return $headers
}

function Copy-ExtractedLauncherContent {
  param(
    [Parameter(Mandatory = $true)][string]$ExtractPath,
    [Parameter(Mandatory = $true)][string]$DestinationPath
  )

  $topLevelItems = @(Get-ChildItem -LiteralPath $ExtractPath -Force)
  if ($topLevelItems.Count -eq 0) {
    throw "Archive extraction produced no files: $ExtractPath"
  }

  $sourcePath = $ExtractPath
  if ($topLevelItems.Count -eq 1 -and $topLevelItems[0].PSIsContainer) {
    $sourcePath = $topLevelItems[0].FullName
  }

  if (Test-Path -LiteralPath $DestinationPath) {
    Remove-Item -LiteralPath $DestinationPath -Recurse -Force
  }
  New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null

  Get-ChildItem -LiteralPath $sourcePath -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $DestinationPath -Recurse -Force
  }
}

function Invoke-LauncherFetch {
  param(
    [Parameter(Mandatory = $true)][string]$AssetName,
    [Parameter(Mandatory = $true)][string]$TargetDir
  )

  $downloadUrl = Get-LauncherDownloadUrl -AssetName $AssetName
  $scratchRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pulsecorelite-launchers-" + [Guid]::NewGuid().ToString("N"))
  $archivePath = Join-Path $scratchRoot $AssetName
  $extractPath = Join-Path $scratchRoot "extract"
  $destinationPath = Join-Path $buildAssetsDir $TargetDir

  New-Item -ItemType Directory -Path $scratchRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

  try {
    Write-Host "[fetch-launchers] Downloading $AssetName"
    $headers = Get-RequestHeaders
    if ($headers.Count -gt 0) {
      Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -Headers $headers
    } else {
      Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
    }

    Write-Host "[fetch-launchers] Extracting to $TargetDir"
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force
    Copy-ExtractedLauncherContent -ExtractPath $extractPath -DestinationPath $destinationPath
  }
  finally {
    if (Test-Path -LiteralPath $scratchRoot) {
      Remove-Item -LiteralPath $scratchRoot -Recurse -Force
    }
  }
}

New-Item -ItemType Directory -Path $buildAssetsDir -Force | Out-Null

$repoInfo = Get-LauncherRepositoryInfo
Write-Host "[fetch-launchers] Source release: $($repoInfo.Owner)/$($repoInfo.Repo)@$($repoInfo.Tag)"

foreach ($asset in Get-LauncherAssetsToFetch) {
  Invoke-LauncherFetch -AssetName $asset.AssetName -TargetDir $asset.TargetDir
}

Write-Host "[fetch-launchers] Launcher assets are ready in $buildAssetsDir"
