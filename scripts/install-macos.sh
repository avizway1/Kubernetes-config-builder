#!/usr/bin/env bash
# Learning Kubernetes made easy - Aviz Academy
# Installs everything the lessons and labs need on a Mac with Apple silicon or an Intel chip:
# Git, Docker Desktop, kubectl, k3d, AWS CLI version 2, and eksctl. Then it runs the setup check.
# It skips anything already installed, so it is safe to run again. See specs/install-scripts.md.
#
# Run it in Terminal as yourself, not with sudo. It asks for your password when a step needs sudo:
#   curl -fsSLO https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/scripts/install-macos.sh
#   bash install-macos.sh
set -euo pipefail

KUBECTL_VERSION=v1.37.2
SKIP_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    # Only for CI runners, which can't run Docker Desktop. Learners never need it.
    --skip-docker) SKIP_DOCKER=true ;;
    -h | --help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg. Run: bash install-macos.sh" >&2
      exit 2
      ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }
say() { printf '    %s\n' "$*"; }
warn() { printf '    Warning: %s\n' "$*"; }
stop() {
  printf '\nStopped: %s\n' "$*" >&2
  exit 1
}
trap 'printf "\nStopped: the command on line %s failed. Read the message above, fix it, then run bash install-macos.sh again.\nThe macOS cards on Set up your laptop do the same steps one at a time.\n" "$LINENO" >&2' ERR

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Docker Desktop puts its commands here. https://docs.docker.com/desktop/setup/install/mac-permission-requirements/
PATH="$PATH:/usr/local/bin:$HOME/.docker/bin"

# 1. Look at the laptop -------------------------------------------------------------------------------------------------

step "Looking at your laptop"
[ "$(uname -s)" = Darwin ] || stop "This script is for macOS. On Linux use install-linux.sh, and on Windows use install-windows.ps1."
[ "$(id -u)" -ne 0 ] || stop "Run it as yourself, without sudo: bash install-macos.sh. It asks for your password when it needs sudo."

machine=$(uname -m)
# Under Rosetta, a Terminal on Apple silicon reports x86_64. The tools should match the chip.
[ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ] && machine=arm64
case "$machine" in
  arm64) arch=arm64 chip="Apple silicon" ;;
  x86_64) arch=amd64 chip="Intel" ;;
  *) stop "The tools need Apple silicon or a 64-bit Intel chip, and this Mac reports $machine." ;;
esac

memory_bytes=$(sysctl -n hw.memsize)
disk_kb=$(df -Pk "$HOME" | awk 'NR == 2 {print $4}')
gb() { awk -v bytes="$1" 'BEGIN {printf "%.1f", bytes / 1073741824}'; }

say "System:       $(sw_vers -productName) $(sw_vers -productVersion)"
say "CPU:          $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) cores)"
say "Architecture: $machine ($chip)"
say "Memory:       $(gb "$memory_bytes") GB"
say "Free disk:    $(gb $((disk_kb * 1024))) GB in $HOME"
say "Docker Desktop supports the current macOS and the two releases before it."
[ "$memory_bytes" -ge 7516192768 ] || warn "The lessons need a Mac with 8 GB of memory. The tools still install, but a practice cluster may be slow."
[ "$disk_kb" -ge 10485760 ] || warn "The lessons need about 10 GB of free disk. Free some space before you install Docker Desktop."

# /usr/local/bin is on every Mac's PATH, but a new Mac may not have the folder yet.
ensure_bin() { [ -d /usr/local/bin ] || sudo mkdir -p /usr/local/bin; }

# 2. Install what is missing ------------------------------------------------------------------------------------------

step "Git"
# /usr/bin/git only works once Apple's Command Line Tools are installed. Another Git, such as Homebrew's, works too.
if xcode-select -p >/dev/null 2>&1 || [ "$(command -v git)" != /usr/bin/git ]; then
  say "Already installed: $(git --version)"
else
  say "Installing Apple's Command Line Tools, which include Git."
  say "A window opens. Select Install, and wait until it says the software was installed."
  xcode-select --install >/dev/null 2>&1 || true
  waited=0
  until xcode-select -p >/dev/null 2>&1; do
    [ "$waited" -lt 3600 ] || stop "The Command Line Tools didn't finish within an hour. Install them with xcode-select --install, then run this script again."
    sleep 10
    waited=$((waited + 10))
  done
  say "Installed: $(git --version)"
fi

step "Docker Desktop"
docker_ready() { docker info >/dev/null 2>&1; }
start_docker() {
  say "Starting Docker Desktop. If it shows Docker's agreement, read it and select Accept."
  open -a Docker
  waited=0
  until docker_ready; do
    if [ "$waited" -ge 300 ]; then
      warn "Docker Desktop hasn't started yet. Finish its first start, then run this script again. The other tools install now."
      return 0
    fi
    sleep 5
    waited=$((waited + 5))
  done
  say "Docker is running: $(docker --version)"
}
if $SKIP_DOCKER; then
  say "Skipped, because of --skip-docker."
elif docker_ready; then
  say "Already installed and running: $(docker --version)"
elif [ -d /Applications/Docker.app ]; then
  say "Already installed."
  start_docker
elif command -v docker >/dev/null; then
  warn "A docker command is installed, but Docker isn't running. Start the app that provides it, such as Docker Desktop."
else
  # https://docs.docker.com/desktop/setup/install/mac-install/, installing from the command line.
  # --user sets up the privileged parts now, so the first start doesn't ask for your password again.
  # There is no --accept-license: Docker Desktop shows its agreement to you when it first starts.
  say "Downloading Docker Desktop for $chip. It is about 600 MB."
  curl -fL --progress-bar -o "$work/Docker.dmg" "https://desktop.docker.com/mac/main/$arch/Docker.dmg"
  say "Installing Docker Desktop."
  sudo hdiutil attach "$work/Docker.dmg" -nobrowse -quiet
  sudo /Volumes/Docker/Docker.app/Contents/MacOS/install --user="$(id -un)"
  sudo hdiutil detach /Volumes/Docker -quiet
  start_docker
fi

step "kubectl"
if command -v kubectl >/dev/null; then
  say "Already installed: kubectl $(kubectl version --client 2>/dev/null | sed -n 's/^Client Version: //p')"
else
  # https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/
  say "Installing kubectl $KUBECTL_VERSION for $chip."
  ensure_bin
  (
    cd "$work"
    curl -fsSLO "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/darwin/$arch/kubectl"
    curl -fsSLO "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/darwin/$arch/kubectl.sha256"
    echo "$(cat kubectl.sha256)  kubectl" | shasum -a 256 --check
    chmod +x ./kubectl
    sudo mv ./kubectl /usr/local/bin/kubectl
    sudo chown root: /usr/local/bin/kubectl
  )
fi

step "k3d"
if command -v k3d >/dev/null; then
  say "Already installed: $(k3d version | head -n 1)"
else
  # https://k3d.io/stable/#installation. The installer checks the download against the release's checksums.
  say "Installing k3d with its official installer."
  ensure_bin
  curl -fsSL -o "$work/install-k3d.sh" https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh
  bash "$work/install-k3d.sh"
fi

step "AWS CLI version 2"
if command -v aws >/dev/null; then
  say "Already installed: $(aws --version 2>&1 | cut -d' ' -f1)"
else
  # https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
  say "Installing the AWS CLI with its official installer."
  curl -fsSL "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "$work/AWSCLIV2.pkg"
  sudo installer -pkg "$work/AWSCLIV2.pkg" -target /
fi

step "eksctl"
if command -v eksctl >/dev/null; then
  say "Already installed: eksctl $(eksctl version)"
else
  # https://docs.aws.amazon.com/eks/latest/eksctl/installation.html, checking only the file downloaded.
  platform="Darwin_$arch"
  say "Installing the latest eksctl for $platform."
  ensure_bin
  (
    cd "$work"
    curl -fsSLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_$platform.tar.gz"
    curl -fsSLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_checksums.txt"
    awk -v file="eksctl_$platform.tar.gz" '$2 == file' eksctl_checksums.txt | shasum -a 256 --check
    tar -xzf "eksctl_$platform.tar.gz"
    sudo install -m 0755 eksctl /usr/local/bin/eksctl
  )
fi

# 3. Run the setup check ----------------------------------------------------------------------------------------------

# The check exactly as step 4 of Set up your laptop shows it. tests/install-scripts.test.mjs keeps them the same.
write_check() {
  cat >"$1" <<'LKME_CHECK'
echo "lkme-check 1"
echo "system $(uname -sm)$(grep -qi microsoft /proc/version 2>/dev/null && echo ' WSL')"
docker info --format 'docker {{.ServerVersion}} memory {{.MemTotal}}' 2>/dev/null | grep '^docker [0-9]' || echo "docker not-running"
command -v kubectl >/dev/null && kubectl version --client 2>/dev/null | sed -n 's/^Client Version: /kubectl /p' || echo "kubectl missing"
command -v k3d >/dev/null && k3d version 2>/dev/null | sed -n 's/^k3d version /k3d /p' || echo "k3d missing"
command -v aws >/dev/null && echo "aws $(aws --version 2>&1 | cut -d' ' -f1)" || echo "aws missing"
aws sts get-caller-identity >/dev/null 2>&1 && echo "aws-signed-in yes" || echo "aws-signed-in no"
command -v eksctl >/dev/null && echo "eksctl $(eksctl version 2>/dev/null)" || echo "eksctl missing"
LKME_CHECK
}

step "Running the setup check"
write_check "$work/check.sh"
output=$(bash "$work/check.sh")
echo "----- Copy from the next line -----"
echo "$output"
echo "----- to the line before this one -----"
say "Paste those lines into step 5 of Set up your laptop, at http://localhost:8080."
echo "$output" | grep -qx "aws-signed-in no" && say "For Lab 2, sign in to AWS with aws configure, or aws sso login, then run the check again."
say "Next, step 6 of Set up your laptop creates your practice cluster."
