# Install scripts

Status: Charan asked for this on 2026-11-27 and chose each option below the same day.

One script per system installs everything a learner needs, from a laptop with nothing installed: Docker, Git, kubectl, k3d, AWS CLI version 2, and eksctl. It first prints what it found about the laptop, then installs only what is missing, then runs the setup check so the learner can paste its output into **Set up your laptop**.

## Charan's decisions

| Question | Decision |
| --- | --- |
| What the scripts install | Everything: Docker, Git, kubectl, k3d, AWS CLI, and eksctl. Learners download the script with one command before they clone the project. |
| Where the scripts live | A new top-level `scripts` folder: `scripts/install-macos.sh`, `scripts/install-linux.sh`, and `scripts/install-windows.ps1`. |
| Which Linux systems | Ubuntu and Debian. Windows learners run the Linux script inside Ubuntu on WSL 2. Other distributions get a message that points to the step-by-step cards. |
| Where they appear | First in each system's install step, on the setup page and in the start guide. The step-by-step cards stay below for learners who prefer them, and for when a script stops with an error. |

## Run it

Learners download the script, can open and read it, then run it. The scripts come from `main`, as the start guide's raw link does.

| System | Commands |
| --- | --- |
| macOS, in Terminal | `curl -fsSLO https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/scripts/install-macos.sh`<br>`bash install-macos.sh` |
| Windows, in PowerShell opened as administrator | `cd $HOME`<br>`Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/scripts/install-windows.ps1 -OutFile install-windows.ps1`<br>`powershell -ExecutionPolicy Bypass -File .\install-windows.ps1` |
| Ubuntu or Debian, in Terminal | `wget -q https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/scripts/install-linux.sh`<br>`bash install-linux.sh` |

- Linux uses `wget` because Ubuntu and Debian desktops include it and may not include `curl`. The script installs `curl` itself.
- `-ExecutionPolicy Bypass` applies only to that one PowerShell process. It does not change the laptop's policy.
- Each script is safe to run again. A second run skips everything already installed and finishes what the first run could not.

## What each script does

Every script runs as the learner's own user, asks for the password only when an install step needs `sudo` or administrator rights, and stops at the first error with the step that failed.

1. **Look at the laptop.** Print the system and its version, the CPU and its architecture, the number of cores, memory, and free disk space.
   - Stop on a system or architecture the tools don't support: only 64-bit Intel or AMD (`x86_64`, `amd64`) and 64-bit Arm (`arm64`, `aarch64`) run every tool.
   - Warn, and carry on, with less than 8 GB of memory or 10 GB of free disk, the start guide's requirements.
2. **Install what is missing**, in this order, using the official commands in the sources below. Each tool already installed is skipped and its version printed.
3. **Run the setup check**, the same command as the setup page's step 4, and print its output between two marker lines, with a reminder to paste it into step 5.

### macOS

| Tool | How | Source |
| --- | --- | --- |
| Git | If Apple's Command Line Tools are missing and no other Git is on the PATH, run `xcode-select --install` and wait while the learner selects **Install** in the window that appears. | Start guide step 3 |
| Docker Desktop | If `/Applications/Docker.app` is missing, download `Docker.dmg` for the Mac's chip and run Docker's command-line install with `--user`, so Docker Desktop doesn't ask for the password again on first start. Then open Docker Desktop and wait up to five minutes for it to start. The learner accepts Docker's agreement in its window: the script never passes `--accept-license`. | [Install Docker Desktop on Mac](https://docs.docker.com/desktop/setup/install/mac-install/) |
| kubectl 1.37.2 | Download the macOS binary for the chip, check it against its `.sha256` file, and install it in `/usr/local/bin`. | [Install kubectl on macOS](https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/) |
| k3d | The official installer, which checks the download's checksum. | [k3d installation](https://k3d.io/stable/#installation) |
| AWS CLI version 2 | The official `AWSCLIV2.pkg` with `sudo installer`. | [Install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| eksctl | The Unix commands with `PLATFORM=Darwin_<arch>`, and the download checked against the release's checksum for that one file. | [eksctl installation](https://docs.aws.amazon.com/eks/latest/eksctl/installation.html) |

The script does not use Homebrew, because installing Homebrew is a step of its own. The step-by-step cards still use Homebrew.

### Ubuntu and Debian

| Tool | How | Source |
| --- | --- | --- |
| curl, Git, unzip | `apt-get install`. | Start guide step 3 |
| Docker Engine | Skipped in WSL 2, where Docker Desktop provides Docker. Otherwise, if `docker` is missing, remove the conflicting packages Docker lists (apt asks first), add Docker's apt repository with its key, install Docker Engine and the Compose plugin, and add the learner to the `docker` group. The learner then logs out and back in, so `docker` works without `sudo`. | [Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Debian](https://docs.docker.com/engine/install/debian/), [post-install steps](https://docs.docker.com/engine/install/linux-postinstall/) |
| kubectl 1.37.2 | The setup page's Linux card, with the architecture filled in. | [Install kubectl on Linux](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/) |
| k3d | The setup page's Linux card. | [k3d installation](https://k3d.io/stable/#installation) |
| AWS CLI version 2 | The setup page's Linux card, with `x86_64` or `aarch64` filled in. | [Install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| eksctl | The setup page's Linux card, with the architecture filled in, and the download checked against the release's checksum for that one file. | [eksctl installation](https://docs.aws.amazon.com/eks/latest/eksctl/installation.html) |

- Ubuntu 22.04, 24.04, 26.04, and 26.10, and Debian 12 and 13, are the versions Docker supports. The script reads `/etc/os-release`. It stops on any other distribution, including derivatives such as Linux Mint, which Docker does not support.
- In WSL 2, if `docker info` fails, the script says to turn on Docker Desktop's WSL integration for Ubuntu and carries on with the other tools.
- The eksctl checksum line on eksctl's page checks every file whose name contains the platform, including an SBOM file nobody downloaded, so it prints FAILED. The script checks the one file it downloaded, matched by its exact name. The setup page's cards still leave that line out, as Charan chose on 2026-11-26.

### Windows

The Windows script runs in Windows PowerShell 5.1 as administrator, and stops with a message if it isn't.

| Step | How | Source |
| --- | --- | --- |
| Look at the laptop | Also print the Windows edition and build. Warn if the build is older than Windows 10 22H2 (19045), or the edition is not Pro, Enterprise, or Education. Docker lists these requirements, and the setup page repeats them. | [Install Docker Desktop on Windows](https://docs.docker.com/desktop/setup/install/windows-install/) |
| Git | If `git` is missing, the start guide's `winget install --id Git.Git -e --source winget`. If `winget` itself is missing, point to the Git for Windows installer and stop. | Start guide step 3 |
| Docker Desktop | If Docker Desktop is missing, download its installer for the laptop's architecture, check that Docker Inc signed it, and run `install` with the WSL 2 backend. The learner accepts Docker's agreement when Docker Desktop first starts. | [Install Docker Desktop on Windows](https://docs.docker.com/desktop/setup/install/windows-install/) |
| Ubuntu on WSL 2 | If Ubuntu is missing, the setup page's `wsl --install -d Ubuntu`. Then the script stops and says what comes next: restart if Windows asks, open Ubuntu once from the Start menu to choose a user name and password, then run the script again. | [Install WSL](https://learn.microsoft.com/windows/wsl/install) |
| Everything inside Ubuntu | Once Ubuntu has its own user, run `install-linux.sh` in Ubuntu as that user. The script takes `install-linux.sh` from its own folder when it is there, as in a clone, or downloads it from `main`. | This spec |
| Docker's WSL integration | Print the setup page's step: in Docker Desktop, **Settings**, **Resources**, **WSL integration**, turn on Ubuntu, **Apply & restart**. | [Docker Desktop WSL 2 backend](https://docs.docker.com/desktop/features/wsl/) |

## What the scripts never do

- Accept a licence or agreement for the learner: not Docker's, not winget's, not Apple's.
- Change Docker's settings, the learner's shell profile, or any security setting.
- Sign in to AWS or Docker, or create a cluster. Signing in to AWS and creating the practice cluster stay steps 3 and 6 of the setup page.
- Remove a package without apt asking the learner first.
- Print a secret or an account number.

## Setup page and start guide

- **Set up your laptop, step 3.** For the selected system, a first card, **Install everything with one script**, gives that system's commands with **Copy**, what the script prints when it finishes, and a link to the script on GitHub. On Windows it comes before the WSL 2 card. The heading **Or install each tool yourself** introduces the existing cards.
- **Start guide.** A new section before step 1, **The quick way: one script**, gives the same commands for the selected system, then says to continue at step 4. Steps 1 to 3 stay as the step-by-step way.
- The commands live once in `templates/kubernetes/setup.json`, and a unit test keeps the start guide in step with them.

## Tests

- **Unit** (`tests/install-scripts.test.mjs`): each script's check command equals the setup page's, byte for byte. Each script's kubectl version equals the setup page's. The setup page's and the start guide's script commands download from this repository's `main`. ShellCheck passes on both shell scripts when it is installed.
- **Linux** (`tests/install-linux.check.mjs`): run `install-linux.sh` in fresh `ubuntu:26.04` and `debian:13` containers as a normal user with `sudo`, read the check's output with the dashboard's report reader, and expect kubectl, k3d, AWS CLI, and eksctl ready. Docker Engine must be installed (`docker --version`) but reads as not running, because a container has no service manager. Then run the script again, and expect every tool skipped.
- **macOS** (`tests/install-macos.check.mjs`): run `install-macos.sh --skip-docker` on a GitHub-hosted macOS runner, which can't run Docker Desktop, and expect kubectl, k3d, AWS CLI, and eksctl ready. On the project Mac, where everything is installed, a run without `--skip-docker` must skip every tool without asking for a password.
- **Windows** (CI job `install-windows`): on a `windows-2025` runner, install Ubuntu with `--no-launch`, give it a default user, then run `install-windows.ps1 -SkipDockerDesktop`. Its output is read with the report reader: Windows (WSL 2), with kubectl, k3d, AWS CLI, and eksctl ready.
- `--skip-docker` and `-SkipDockerDesktop` exist only for CI runners. The setup page never shows them.

## Acceptance criteria

- [ ] Each script prints the system, CPU, architecture, cores, memory, and free disk before installing anything, and stops on an unsupported system or architecture.
- [x] On fresh Ubuntu and Debian, the Linux script installs everything, and the check reads kubectl, k3d, AWS CLI, and eksctl as ready.
- [ ] On macOS and Windows (WSL 2) CI runners, the scripts install kubectl, k3d, AWS CLI, and eksctl, and the check reads them as ready.
- [ ] A second run skips everything already installed.
- [x] Each script's check command and kubectl version match the setup page.
- [x] The setup page and the start guide show each system's script first, with Copy, and keep the step-by-step cards.
- [x] The scripts never accept an agreement, change settings, or sign in for the learner.

## Results

On 2026-11-27, on the project Mac (macOS 27.0.1, Apple M5 Pro, Docker Desktop), with Node 26.13.1:

- `npm test` passed 37 unit tests, including ShellCheck on both shell scripts, and the 18 browser tests passed. They copy each system's script commands from step 3 and every start guide command, 23, 27, and 23 for macOS, Windows, and Linux.
- `tests/install-linux.check.mjs` passed in `ubuntu:26.04` (Ubuntu 26.04.1 LTS) and `debian:13` containers on ARM64 in 100 seconds for both. Each first run installed Docker Engine with Compose, kubectl v1.37.2, k3d v5.9.0, AWS CLI 2.42.4, and eksctl 0.232.0, and the check read all four tools as ready. Each second run skipped everything. The first run found that Ubuntu 26.04 has no `sg` command, so the script now runs the check without it there, and that ARM64 containers report their CPU model as `-`, so the script then prints only the cores.
- `tests/install-macos.check.mjs` passed on the project Mac in 2.6 seconds. Every tool was already installed, so both runs skipped everything and asked for no password.
- Each shell script stops on the wrong system with a message that names the right script.

Still to run: the macOS and Windows CI jobs, which install the tools on fresh runners and run the Windows script for the first time.

## Known limits

- CI runners can't run Docker Desktop, so installing Docker Desktop with the macOS and Windows scripts needs a tester on a real Mac and Windows laptop. The project Mac already has Docker Desktop.
- In containers, the Linux script installs Docker Engine but can't start it. A real Ubuntu or Debian laptop, with systemd, starts it.
