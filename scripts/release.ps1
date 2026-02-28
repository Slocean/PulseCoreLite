$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

param(
  [switch]$SkipBuild,
  [switch]$NoPush,
  [switch]$Force
)

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
}

Write-Host "[release] Creating git tag $tag"
git tag $tag

if (-not $NoPush) {
  Write-Host "[release] Pushing tag $tag"
  git push origin $tag
}

Write-Host "[release] Done."
