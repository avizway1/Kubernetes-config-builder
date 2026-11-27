<#
Learning Kubernetes made easy - Aviz Academy
Installs everything the lessons and labs need on Windows: Git, Docker Desktop, and Ubuntu on WSL 2.
Then, inside Ubuntu, install-linux.sh installs kubectl, k3d, AWS CLI version 2, and eksctl, and runs the setup check.
It skips anything already installed, so it is safe to run again. See specs/install-scripts.md.

Run it in PowerShell opened as administrator:
  cd $HOME
  Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/scripts/install-windows.ps1 -OutFile install-windows.ps1
  powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
#>
param(
  # Only for CI runners, which can't run Docker Desktop. Learners never need it.
  [switch]$SkipDockerDesktop
)

Set-StrictMode -Version 3
$ErrorActionPreference = 'Stop'
# Without this, Windows PowerShell 5.1 downloads very slowly while it draws a progress bar.
$ProgressPreference = 'SilentlyContinue'
# wsl.exe prints UTF-16 unless WSL_UTF8 is set.
$env:WSL_UTF8 = '1'
$LinuxScriptUrl = 'https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/scripts/install-linux.sh'
$Again = 'powershell -ExecutionPolicy Bypass -File .\install-windows.ps1'

function Step([string]$Text) { Write-Host ''; Write-Host "==> $Text" }
function Say([string]$Text) { Write-Host "    $Text" }
function Warn([string]$Text) { Write-Host "    Warning: $Text" -ForegroundColor Yellow }
function Stop-Install([string]$Text) {
  Write-Host ''
  Write-Host "Stopped: $Text" -ForegroundColor Red
  exit 1
}
# Windows PowerShell 5.1 turns a program's error output into a terminating error when ErrorActionPreference is Stop.
# Programs such as wsl.exe and winget report failure with their exit code instead, which each caller checks.
function Invoke-Program([scriptblock]$Block) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Block } finally { $ErrorActionPreference = $previous }
}
function Update-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# 1. Look at the laptop -------------------------------------------------------------------------------------------------

Step 'Looking at your laptop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Stop-Install 'Open PowerShell as administrator: click Start, type PowerShell, right-click Windows PowerShell, and select Run as administrator. Then run this script again.'
}

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
switch ($architecture) {
  'AMD64' { $dockerArch = 'amd64' }
  'ARM64' { $dockerArch = 'arm64' }
  default { Stop-Install "The tools need a 64-bit Intel, AMD, or Arm processor, and this one is $architecture." }
}
$memoryGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$drive = Get-PSDrive -Name $env:SystemDrive.TrimEnd(':')
$freeGB = [math]::Round($drive.Free / 1GB, 1)

Say "System:       $($os.Caption) (build $($os.BuildNumber))"
Say "CPU:          $("$($cpu.Name)".Trim()) ($([Environment]::ProcessorCount) cores)"
Say "Architecture: $architecture"
Say "Memory:       $memoryGB GB"
Say "Free disk:    $freeGB GB on $env:SystemDrive"
# Docker Desktop's requirements: https://docs.docker.com/desktop/setup/install/windows-install/
if ([int]$os.BuildNumber -lt 19045) { Warn 'Docker Desktop needs Windows 10 22H2 (build 19045) or Windows 11 23H2 or later. Update Windows first.' }
if ($os.Caption -notmatch 'Pro|Enterprise|Education') { Warn 'Docker Desktop lists Windows Pro, Enterprise, and Education. Other editions may not run it.' }
if ($memoryGB -lt 7) { Warn 'The lessons need a laptop with 8 GB of memory. The tools still install, but a practice cluster may be slow.' }
if ($freeGB -lt 10) { Warn 'The lessons need about 10 GB of free disk. Free some space before you install Docker Desktop.' }

# 2. Install what is missing ------------------------------------------------------------------------------------------

Step 'Git'
if (Get-Command git -ErrorAction SilentlyContinue) {
  Say "Already installed: $(git --version)"
} elseif (Get-Command winget -ErrorAction SilentlyContinue) {
  # The start guide's command. winget may ask you to agree to its source terms first.
  Say 'Installing Git with winget.'
  Invoke-Program { winget install --id Git.Git -e --source winget }
  if ($LASTEXITCODE -ne 0) { Stop-Install "winget couldn't install Git. Install it from https://git-scm.com/install/windows, then run this script again." }
  Update-Path
} else {
  Stop-Install 'winget is missing. Install Git from https://git-scm.com/install/windows, then run this script again.'
}

Step 'Docker Desktop'
$dockerApps = @(
  (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe')
)
$dockerInstalled = $false
if ($SkipDockerDesktop) {
  Say 'Skipped, because of -SkipDockerDesktop.'
} elseif ($dockerApps | Where-Object { Test-Path $_ }) {
  Say 'Already installed.'
} else {
  # https://docs.docker.com/desktop/setup/install/windows-install/, installing from the command line.
  # There is no --accept-license: Docker Desktop shows its agreement to you when it first starts.
  Say "Downloading Docker Desktop for $architecture. It is about 600 MB."
  $installer = Join-Path $env:TEMP 'Docker Desktop Installer.exe'
  Invoke-WebRequest -UseBasicParsing "https://desktop.docker.com/win/main/$dockerArch/Docker%20Desktop%20Installer.exe" -OutFile $installer
  $signature = Get-AuthenticodeSignature $installer
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') {
    Remove-Item $installer
    Stop-Install "The Docker Desktop download isn't signed by Docker ($($signature.Status)). Download it from https://docs.docker.com/desktop/setup/install/windows-install/ instead."
  }
  Say 'Installing Docker Desktop. This takes a few minutes.'
  $process = Start-Process $installer -Wait -PassThru -ArgumentList 'install', '--backend=wsl-2'
  Remove-Item $installer
  if ($process.ExitCode -ne 0) { Stop-Install "Docker Desktop's installer stopped with code $($process.ExitCode). Restart Windows, then run this script again." }
  $dockerInstalled = $true
  Say 'Installed.'
}

Step 'Ubuntu on WSL 2'
function Get-Distros { @(Invoke-Program { wsl.exe --list --quiet 2>$null }) | ForEach-Object { "$_".Trim() } | Where-Object { $_ } }
$next = @(
  'Next:',
  '  1. If Windows asked you to restart, restart now.',
  '  2. Open Ubuntu from the Start menu. When it asks, choose a user name and a password for Ubuntu.',
  "  3. Open PowerShell as administrator again, then run: cd `$HOME; $Again"
)
if ((Get-Distros) -notcontains 'Ubuntu') {
  # The setup page's command: https://learn.microsoft.com/windows/wsl/install
  Say 'Installing Ubuntu. If Ubuntu asks for a user name and password, choose them. Then type exit to come back here.'
  Invoke-Program { wsl.exe --install -d Ubuntu }
  if ($LASTEXITCODE -ne 0) { Stop-Install 'wsl --install -d Ubuntu failed. Restart Windows, then run this script again.' }
}
# -e runs each command in Ubuntu directly, without its shell reading the line first.
$uid = "$(Invoke-Program { wsl.exe -d Ubuntu -e id -u 2>$null })".Trim()
if ($LASTEXITCODE -ne 0 -or -not $uid) {
  Say 'Ubuntu is installed, and starts after the next steps.'
  $next | ForEach-Object { Write-Host $_ }
  exit 0
}
if ($uid -eq '0') {
  Say 'Ubuntu has no user of its own yet.'
  $next | ForEach-Object { Write-Host $_ }
  exit 0
}
Say "Ready: $(Invoke-Program { wsl.exe -d Ubuntu -e bash -c '. /etc/os-release && echo $PRETTY_NAME' })"

Step 'The tools inside Ubuntu'
# install-linux.sh from this script's folder when it is there, as in a clone of the project, or else from GitHub.
$local = Join-Path $PSScriptRoot 'install-linux.sh'
if (Test-Path $local) {
  $linuxPath = "$(Invoke-Program { wsl.exe -d Ubuntu -e wslpath -a ($local -replace '\\', '/') })".Trim()
  Say "Running $local in Ubuntu."
  Invoke-Program { wsl.exe -d Ubuntu --cd '~' -e bash $linuxPath }
} else {
  Say 'Downloading install-linux.sh in Ubuntu and running it.'
  Invoke-Program { wsl.exe -d Ubuntu --cd '~' -e bash -c "curl -fsSL -o install-linux.sh $LinuxScriptUrl && bash install-linux.sh" }
}
if ($LASTEXITCODE -ne 0) { Stop-Install 'The Ubuntu part stopped. Read its message above, then run this script again.' }

if ($dockerInstalled) {
  Write-Host ''
  Say 'Docker Desktop is installed. Start it from the Start menu and accept its agreement.'
  Say 'Then, in Docker Desktop, open Settings, then Resources, then WSL integration, turn on Ubuntu, and select Apply & restart.'
}
Say 'From now on, run every lesson and lab command in Ubuntu.'
