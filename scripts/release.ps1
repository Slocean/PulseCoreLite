param(
  [switch]$SkipBuild,
  [switch]$NoPush,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-ReleaseNotes {
  param(
    [Parameter(Mandatory = $true)][string]$Version
  )

  $notesPath = Join-Path $projectRoot "version.md"
  if (-not (Test-Path -LiteralPath $notesPath -PathType Leaf)) {
    return ""
  }

  $lines = Get-Content -LiteralPath $notesPath
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

  return ($notes -join "`n").Trim()
}

function Resolve-RepoInfo {
  $origin = ""
  try {
    $origin = (git remote get-url origin 2>$null).Trim()
  } catch {
    return $null
  }
  if (-not $origin) {
    return $null
  }
  if ($origin -match 'github\.com[:/](?<owner>[^/]+)/(?<repo>[^/]+?)(\.git)?$') {
    return @{
      Owner = $Matches.owner
      Repo = $Matches.repo
    }
  }
  return $null
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
$version = $packageJson.version
if (-not $version) {
  throw "Failed to read version from package.json."
}

$tag = "v$version"

$notes = Get-ReleaseNotes -Version $version
if (-not $notes) {
  throw "Missing release notes for $tag in version.md."
}

if (-not $Force) {
  $dirty = git status --porcelain
  if ($dirty) {
    throw "Working tree is dirty. Commit or pass -Force to continue."
  }
}

$existingTag = git tag -l $tag
if ($existingTag) {
  throw "Tag already exists: $tag"
}

if (-not $SkipBuild) {
  $repoInfo = Resolve-RepoInfo
  if ($repoInfo) {
    $env:GITHUB_OWNER = $repoInfo.Owner
    $env:GITHUB_REPO = $repoInfo.Repo
  }
  $env:GITHUB_TAG = $tag
  Write-Host "[release] Running custom pack command..."
  npm run pack:release
  if ($LASTEXITCODE -ne 0) {
    throw "pack:release failed with exit code $LASTEXITCODE"
  }
}

Write-Host "[release] Creating git tag $tag"
git tag $tag

if (-not $NoPush) {
  Write-Host "[release] Pushing tag $tag"
  git push origin $tag
}

Write-Host "[release] Done."
