#!/usr/bin/env bash
# Learning Kubernetes made easy - Aviz Academy
# Installs everything the lessons and labs need on Ubuntu or Debian, and inside Ubuntu on WSL 2:
# Docker Engine, Git, kubectl, k3d, AWS CLI version 2, and eksctl. Then it runs the setup check.
# It skips anything already installed, so it is safe to run again. See specs/install-scripts.md.
#
# Run it as your own user, not with sudo. It asks for your password when a step needs sudo:
#   wget -q https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/scripts/install-linux.sh
#   bash install-linux.sh
set -euo pipefail

KUBECTL_VERSION=v1.37.2
SKIP_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    # Only for CI runners. Learners never need it.
    --skip-docker) SKIP_DOCKER=true ;;
    -h | --help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg. Run: bash install-linux.sh" >&2
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
trap 'printf "\nStopped: the command on line %s failed. Read the message above, fix it, then run bash install-linux.sh again.\nThe Linux cards on Set up your laptop do the same steps one at a time.\n" "$LINENO" >&2' ERR

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# 1. Look at the laptop -------------------------------------------------------------------------------------------------

step "Looking at your laptop"
[ "$(uname -s)" = Linux ] || stop "This script is for Linux. On a Mac use install-macos.sh, and on Windows use install-windows.ps1."
[ "$(id -u)" -ne 0 ] || stop "Run it as your own user, without sudo: bash install-linux.sh. It asks for your password when it needs sudo."
command -v sudo >/dev/null || stop "sudo is missing. Ask whoever set up this computer to give your user sudo rights."
[ -r /etc/os-release ] || stop "This script supports Ubuntu and Debian, and can't tell which system this is."
# shellcheck source=/dev/null
. /etc/os-release

wsl=false
grep -qi microsoft /proc/version 2>/dev/null && wsl=true
system="${PRETTY_NAME:-$ID}"
$wsl && system="$system (WSL 2)"

case "${ID:-}" in
  ubuntu | debian) ;;
  *) stop "This script supports Ubuntu and Debian, and this is $system. Install each tool with the Linux cards on Set up your laptop." ;;
esac
# The versions Docker Engine supports: https://docs.docker.com/engine/install/ubuntu/ and https://docs.docker.com/engine/install/debian/
case "$ID ${VERSION_ID:-}" in
  "ubuntu 22.04" | "ubuntu 24.04" | "ubuntu 26.04" | "ubuntu 26.10" | "debian 12" | "debian 13") ;;
  *) warn "Docker supports Ubuntu 22.04, 24.04, 26.04, and 26.10, and Debian 12 and 13. Some steps may fail on $system." ;;
esac

arch=$(dpkg --print-architecture)
case "$arch" in
  amd64) aws_arch=x86_64 ;;
  arm64) aws_arch=aarch64 ;;
  *) stop "The tools need a 64-bit Intel, AMD, or Arm processor, and this one is $arch." ;;
esac

cpu=$(sed -n 's/^model name[[:space:]]*: //p' /proc/cpuinfo | head -n 1 || true)
[ -n "$cpu" ] || cpu=$(lscpu 2>/dev/null | sed -n 's/^Model name:[[:space:]]*//p' | head -n 1 || true)
memory_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
disk_kb=$(df -Pk "$HOME" | awk 'NR == 2 {print $4}')
gb() { awk -v kb="$1" 'BEGIN {printf "%.1f", kb / 1048576}'; }

say "System:       $system"
# Some Arm machines and virtual machines report no model name, or "-".
if [ -n "$cpu" ] && [ "$cpu" != "-" ]; then say "CPU:          $cpu ($(nproc) cores)"; else say "CPU:          $(nproc) cores"; fi
say "Architecture: $(uname -m) ($arch)"
say "Memory:       $(gb "$memory_kb") GB"
say "Free disk:    $(gb "$disk_kb") GB in $HOME"
if $wsl; then
  say "WSL 2 gets part of your Windows laptop's memory. install-windows.ps1 checks the laptop's own memory."
elif [ "$memory_kb" -lt 7340032 ]; then
  warn "The lessons need a laptop with 8 GB of memory. The tools still install, but a practice cluster may be slow."
fi
[ "$disk_kb" -ge 10485760 ] || warn "The lessons need about 10 GB of free disk. Free some space before you create a practice cluster."

# 2. Install what is missing ------------------------------------------------------------------------------------------

missing_packages=""
for package in ca-certificates curl git unzip; do
  dpkg -s "$package" >/dev/null 2>&1 || missing_packages="$missing_packages $package"
done
step "curl, Git, and unzip"
if [ -n "$missing_packages" ]; then
  say "Installing$missing_packages with apt."
  sudo apt-get update -q
  # shellcheck disable=SC2086
  sudo apt-get install -y -q $missing_packages
else
  say "Already installed: $(git --version)"
fi

relogin=false
step "Docker"
me=$(id -un)
if $SKIP_DOCKER; then
  say "Skipped, because of --skip-docker."
elif $wsl; then
  # Docker Desktop on Windows gives Ubuntu its docker command: https://docs.docker.com/desktop/features/wsl/
  if docker info >/dev/null 2>&1; then
    say "Docker Desktop's Docker works in Ubuntu: $(docker --version)"
  else
    warn "Docker doesn't answer in Ubuntu yet. Start Docker Desktop on Windows. Then, in Docker Desktop, open Settings, then Resources, then WSL integration, turn on Ubuntu, and select Apply & restart."
  fi
else
  if command -v docker >/dev/null; then
    say "Already installed: $(docker --version)"
  else
    # https://docs.docker.com/engine/install/ubuntu/ and https://docs.docker.com/engine/install/debian/
    conflicts=$(dpkg --get-selections docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc 2>/dev/null | awk '$2 == "install" {print $1}' | tr '\n' ' ' || true)
    if [ -n "$conflicts" ]; then
      say "Docker's packages replace these, so apt removes them first and asks you to confirm: $conflicts"
      # shellcheck disable=SC2086
      sudo apt-get remove $conflicts
    fi
    say "Adding Docker's apt repository and installing Docker Engine."
    suite="$VERSION_CODENAME"
    [ "$ID" = ubuntu ] && suite="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
    sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: $suite
Components: stable
Architectures: $arch
Signed-By: /etc/apt/keyrings/docker.asc
EOF
    sudo apt-get update -q
    sudo apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    say "Installed: $(docker --version)"
  fi
  # Run docker without sudo: https://docs.docker.com/engine/install/linux-postinstall/
  getent group docker >/dev/null || sudo groupadd docker
  if ! id -nG "$me" | tr ' ' '\n' | grep -qx docker; then
    sudo usermod -aG docker "$me"
    relogin=true
    say "Added $me to the docker group, so docker works without sudo after you log out and back in."
  fi
fi

step "kubectl"
if command -v kubectl >/dev/null; then
  say "Already installed: kubectl $(kubectl version --client 2>/dev/null | sed -n 's/^Client Version: //p')"
else
  # https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/
  say "Installing kubectl $KUBECTL_VERSION for $arch."
  (
    cd "$work"
    curl -fsSLO "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/$arch/kubectl"
    curl -fsSLO "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/$arch/kubectl.sha256"
    echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
  )
fi

step "k3d"
if command -v k3d >/dev/null; then
  say "Already installed: $(k3d version | head -n 1)"
else
  # https://k3d.io/stable/#installation. The installer checks the download against the release's checksums.
  say "Installing k3d with its official installer."
  curl -fsSL -o "$work/install-k3d.sh" https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh
  bash "$work/install-k3d.sh"
fi

step "AWS CLI version 2"
if command -v aws >/dev/null; then
  say "Already installed: $(aws --version 2>&1 | cut -d' ' -f1)"
else
  # https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
  say "Installing the AWS CLI for $aws_arch."
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$aws_arch.zip" -o "$work/awscliv2.zip"
  unzip -q "$work/awscliv2.zip" -d "$work"
  sudo "$work/aws/install"
fi

step "eksctl"
if command -v eksctl >/dev/null; then
  say "Already installed: eksctl $(eksctl version)"
else
  # https://docs.aws.amazon.com/eks/latest/eksctl/installation.html, checking only the file downloaded.
  platform="Linux_$arch"
  say "Installing the latest eksctl for $platform."
  (
    cd "$work"
    curl -fsSLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_$platform.tar.gz"
    curl -fsSLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_checksums.txt"
    awk -v file="eksctl_$platform.tar.gz" '$2 == file' eksctl_checksums.txt | sha256sum --check
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
if $relogin && command -v sg >/dev/null; then
  # The new docker group applies to new logins. sg, where the system has it, uses it for this one command.
  output=$(sg docker -c "bash '$work/check.sh'")
else
  output=$(bash "$work/check.sh")
fi
echo "----- Copy from the next line -----"
echo "$output"
echo "----- to the line before this one -----"
say "Paste those lines into step 5 of Set up your laptop, at http://localhost:8080."
$relogin && say "Log out and back in, so docker works without sudo. If the check says docker not-running, run the check from step 4 again after that."
echo "$output" | grep -qx "aws-signed-in no" && say "For Lab 2, sign in to AWS with aws configure, or aws sso login, then run the check again."
say "Next, step 6 of Set up your laptop creates your practice cluster."
