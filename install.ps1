# mochi one-line installer for Windows (PowerShell 5.1+ compatible).
#
# Run (PowerShell):
#   irm https://raw.githubusercontent.com/xanstomper/mochi/main/install.ps1 | iex
#
# With options (download first, then run):
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Version 0.23.1 -To "C:\tools\mochi" -NoOnboard
#
# Parameters:
#   -Version    version to install (default: latest release, fallback 0.23.1)
#   -To         install directory (default: $env:LOCALAPPDATA\mochi\bin)
#   -NoOnboard  hide the `mochi onboard` next-step hint
# Env overrides: MOCHI_VERSION, MOCHI_SRC (source-fallback dir).
#
# Idempotent: safe to re-run (overwrites mochi.exe).

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Version = "",
  [Alias("InstallDir")]
  [string]$To = "",
  [switch]$NoOnboard
)

$ErrorActionPreference = "Stop"

$Repo = "xanstomper/mochi"
$FallbackVersion = "0.23.1"
$ApiUrl = "https://api.github.com/repos/xanstomper/mochi/releases/latest"

function Write-Log([string]$Message) {
  Write-Host $Message
}

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Test-Command([string]$Name) {
  return ($null -ne (Get-Command $Name -ErrorAction SilentlyContinue))
}

# ---- install dir -----------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($To)) {
  $base = $env:LOCALAPPDATA
  if ([string]::IsNullOrWhiteSpace($base)) {
    $base = Join-Path $HOME "AppData\Local"
  }
  $InstallDir = Join-Path $base "mochi\bin"
} else {
  $InstallDir = $To
}

# ---- version resolution ----------------------------------------------------
$VersionExplicit = $false
if ([string]::IsNullOrWhiteSpace($Version)) {
  if (-not [string]::IsNullOrWhiteSpace($env:MOCHI_VERSION)) {
    $Version = $env:MOCHI_VERSION
    $VersionExplicit = $true
  }
} else {
  $VersionExplicit = $true
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $resolved = ""
  try {
    $rel = Invoke-RestMethod -Uri $ApiUrl -UseBasicParsing -TimeoutSec 20
    if (($null -ne $rel) -and ($null -ne $rel.tag_name)) {
      $resolved = [string]$rel.tag_name
      if ($resolved.StartsWith("v")) {
        $resolved = $resolved.Substring(1)
      }
    }
  } catch {
    Write-Log ("warning: GitHub API unreachable; using fallback version " + $FallbackVersion)
  }
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    $resolved = $FallbackVersion
    Write-Log ("warning: could not determine latest version; using fallback " + $FallbackVersion)
  }
  $Version = $resolved
}

if ($Version -notmatch '^[0-9A-Za-z._-]+$') {
  Fail ("invalid version: " + $Version + " (expected e.g. 0.23.1)")
}

# ---- arch detection --------------------------------------------------------
$Arch = ""
$procArch = ""
if (-not [string]::IsNullOrWhiteSpace($env:PROCESSOR_ARCHITECTURE)) {
  $procArch = $env:PROCESSOR_ARCHITECTURE.ToUpperInvariant()
}
if ($procArch -eq "AMD64") {
  $Arch = "x64"
} elseif ($procArch -eq "ARM64") {
  $Arch = "arm64"
} else {
  Fail ("unsupported architecture: " + $env:PROCESSOR_ARCHITECTURE + " (only x64 and arm64 are supported)")
}

Write-Log ("mochi installer: version=" + $Version + " os=windows arch=" + $Arch + " dir=" + $InstallDir)

# ---- temp dir --------------------------------------------------------------
$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("mochi-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

$BinaryOk = $false

# ---- binary install --------------------------------------------------------
$Asset = "mochi-" + $Version + "-windows-" + $Arch + ".zip"
$Url = "https://github.com/" + $Repo + "/releases/download/v" + $Version + "/" + $Asset
$ZipPath = Join-Path $TmpDir $Asset
$ExtractDir = Join-Path $TmpDir "extract"
Write-Log ("downloading " + $Url + " ...")
try {
  Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing -TimeoutSec 120
  New-Item -ItemType Directory -Force -Path $ExtractDir | Out-Null
  Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force
  $found = Get-ChildItem -Path $ExtractDir -Filter "mochi.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $found) {
    Fail ("archive did not contain a 'mochi.exe' binary (looked in " + $Asset + ").")
  }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Copy-Item -Path $found.FullName -Destination (Join-Path $InstallDir "mochi.exe") -Force
  Write-Log ("installed " + (Join-Path $InstallDir "mochi.exe"))
  $BinaryOk = $true
} catch {
  Write-Log ("download failed: " + $_.Exception.Message)
  $BinaryOk = $false
}

# ---- source fallback -------------------------------------------------------
if (-not $BinaryOk) {
  $haveGit = Test-Command "git"
  $haveNode = Test-Command "node"
  $haveNpm = Test-Command "npm"
  if ($haveGit -and $haveNode -and $haveNpm) {
    Write-Log "git + node detected: falling back to building from source."
    try {
      $srcDir = $env:MOCHI_SRC
      if ([string]::IsNullOrWhiteSpace($srcDir)) {
        $srcDir = Join-Path $HOME ".mochi-src"
      }
      if (Test-Path (Join-Path $srcDir ".git")) {
        Write-Log ("updating existing checkout at " + $srcDir + " ...")
        & git -C $srcDir fetch --depth 1 origin 2>$null
      } elseif (Test-Path $srcDir) {
        Fail ("source fallback: " + $srcDir + " exists but is not a git checkout (move it aside or set MOCHI_SRC).")
      } else {
        & git clone --depth 1 ("https://github.com/" + $Repo + ".git") $srcDir
      }
      if ($VersionExplicit) {
        try {
          & git -C $srcDir fetch --depth 1 origin ("tag v" + $Version) 2>$null
          & git -C $srcDir checkout ("v" + $Version) 2>$null
        } catch {
          Write-Log ("warning: tag v" + $Version + " not found; building default branch instead.")
        }
      }
      Push-Location $srcDir
      try {
        try {
          & npm ci
        } catch {
          & npm install
        }
        & npm run build
      } finally {
        Pop-Location
      }
      $cliJs = Join-Path $srcDir "dist\cli.js"
      if (-not (Test-Path $cliJs)) {
        Fail "source fallback failed: dist\cli.js not produced by npm run build."
      }
      New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
      $cmdPath = Join-Path $InstallDir "mochi.cmd"
      $cmdBody = "@echo off`r`nnode `"$cliJs`" %*`r`n"
      [System.IO.File]::WriteAllText($cmdPath, $cmdBody)
      Write-Log ("installed source wrapper at " + $cmdPath + " (src: " + $srcDir + ")")
      $BinaryOk = $true
    } catch {
      Fail ("source fallback failed: " + $_.Exception.Message)
    }
  } else {
    Fail ("could not download the mochi binary (release v" + $Version + " may not exist yet or you may be offline), and source fallback is unavailable (needs git + node + npm). Install them and re-run, or try again later.")
  }
}

# ---- add to USER PATH ------------------------------------------------------
$ExePath = Join-Path $InstallDir "mochi.exe"
$MochiCmd = $ExePath
if (-not (Test-Path $ExePath)) {
  $cmdFallback = Join-Path $InstallDir "mochi.cmd"
  if (Test-Path $cmdFallback) {
    $MochiCmd = $cmdFallback
  }
}
try {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($null -eq $userPath) {
    $userPath = ""
  }
  $parts = $userPath -split ";"
  $onPath = $false
  foreach ($p in $parts) {
    if (($null -ne $p) -and ($p.Trim().ToLowerInvariant() -eq $InstallDir.Trim().ToLowerInvariant())) {
      $onPath = $true
    }
  }
  if ($onPath) {
    Write-Log ("PATH: " + $InstallDir + " is already on your USER PATH.")
  } else {
    if ([string]::IsNullOrWhiteSpace($userPath)) {
      $newPath = $InstallDir
    } else {
      $newPath = $userPath + ";" + $InstallDir
    }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Log ("added " + $InstallDir + " to your USER PATH. Restart your terminal for it to take effect.")
  }
} catch {
  Write-Log ("warning: could not update USER PATH: " + $_.Exception.Message)
}

# ---- verify ----------------------------------------------------------------
try {
  $verOut = & $MochiCmd --version 2>$null
  Write-Log ("verified: " + $verOut)
} catch {
  Fail ("verification failed: " + $MochiCmd + " --version did not run. Re-run the installer or report an issue.")
}

# ---- success banner ----------------------------------------------------------
Write-Log ""
Write-Log "========================================"
Write-Log ("  mochi " + $Version + " installed to " + $MochiCmd)
Write-Log "========================================"
Write-Log "Next steps:"
Write-Log "  mochi --help"
if (-not $NoOnboard) {
  Write-Log "  mochi onboard"
}

# ---- cleanup temp ------------------------------------------------------------
try {
  Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
} catch {
}
