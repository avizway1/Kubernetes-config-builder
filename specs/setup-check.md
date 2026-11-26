# Set up your laptop

**Status: Plan and mock-ups approved by Charan on 2026-11-26.** Built before phase 2, together with [lab lessons](lab-lessons.md).

## Goal

Learners install the tools a lab needs and prove they work before they start it. The dashboard gives the install commands for their system, checks the result, and unlocks each lab's hands-on part only when its tools pass.

## Why

- Lab guides list the tools in **Before you start**, but nothing checks them. Learners find a missing or old tool halfway through a lab.
- On Windows, the start guide installs k3d and kubectl in PowerShell with Scoop, while Lab 1 says to run every command in WSL 2. A Windows learner who follows both ends up in WSL 2 without the tools.

## What the dashboard can and cannot see

The dashboard runs inside a locked-down container: read-only, with no extra permissions, reachable only from the laptop. It cannot see the programs installed on the laptop. So the learner runs one check command in their own terminal and pastes what it prints into the dashboard.

A terminal inside the dashboard was considered and set aside on 2026-11-26. It would need the laptop's Docker socket, which gives full control of the laptop, and any website the learner visits could try to reach it. Charan also set aside AWS CloudShell and Killercoda for now.

## Before the dashboard: Docker and Git

Learners need Docker and Git to start the dashboard, so those stay in the [start guide](../docs/getting-started.html). The dashboard's check still confirms Docker is running, because Lab 1 needs it.

## The setup page

Opened at `#learn/setup`, from a **Set up your laptop** card at the top of the catalogue's **Hands-on labs** section and from each locked lab.

1. **Choose your system:** macOS, Windows (WSL 2), or Linux. The page picks one from the browser and the learner can change it.
2. **Install the tools.** One card per tool, with the version each lab needs, the install commands for the chosen system, and a link to the official install page they come from. Lab 2's tools are in their own group, **Only for Lab 2**.
3. **Run the check.** One short command block with **Copy**. Learners read it before running it. It never downloads or runs a script.
4. **Paste what it printed.** The page lists each tool as **Ready** or **Fix this**, with the fix, and says which labs are now unlocked.

### Windows

Every lab command runs in WSL 2, as Lab 1 already says. The Windows tab installs WSL 2 with Ubuntu, turns on Docker Desktop's WSL integration for it, and installs kubectl and k3d inside Ubuntu with the Linux commands. The start guide's Windows practice-cluster section changes to the same WSL 2 steps, so the start guide, lessons, and labs agree.

### Install commands

Each command is copied from the tool's official install page when the page is built, and the link sits beside it. Downloaded installers are saved, read, then run, as the start guide does for k3d.

| Tool | Official page |
| --- | --- |
| kubectl | [Install Tools](https://kubernetes.io/docs/tasks/tools/) |
| k3d | [k3d installation](https://k3d.io/stable/#installation) |
| AWS CLI version 2 | [Installing the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| eksctl | [eksctl installation](https://docs.aws.amazon.com/eks/latest/eksctl/installation.html) |
| WSL 2 | [Install WSL](https://learn.microsoft.com/windows/wsl/install) |
| Docker Desktop with WSL 2 | [Docker Desktop WSL 2 backend](https://docs.docker.com/desktop/features/wsl/) |

## The check

The command works unchanged in macOS zsh, Linux bash, and WSL 2 bash. It prints one line per tool and nothing personal: no account number, user name, or file path. A missing tool prints `missing` instead of failing. The exact command is settled while building and tested on each system. Its output looks like this:

```text
kms-check 1
system Darwin arm64
docker 29.8.2 memory 9328558080
kubectl v1.36.1
k3d v5.9.0
aws aws-cli/2.36.37
aws-signed-in yes
eksctl 0.231.0
```

`aws-signed-in` runs `aws sts get-caller-identity` and prints only `yes` or `no`. Docker's memory is shown, not checked. The start guide already asks for 8 GB to build the dashboard.

## What each lab needs

| Lab | Needs | Why this version |
| --- | --- | --- |
| Lab 1 | Docker running | k3d runs the cluster inside Docker. |
| Lab 1 and Lab 2 | kubectl 1.36 to 1.38 | Both labs run Kubernetes 1.37, and kubectl is supported within one minor version of the cluster ([version skew policy](https://kubernetes.io/releases/version-skew-policy/#kubectl)). |
| Lab 1 | k3d 5.9.0 or newer | Lab 1 was tested with 5.9.0, the [latest k3d release](https://github.com/k3d-io/k3d/releases/tag/v5.9.0). |
| Lab 2 | AWS CLI version 2, signed in | Lab 2's guide requires version 2 and a signed-in user or role. |
| Lab 2 | eksctl 0.231.0 or newer | Lab 2 passed with a 0.231.0 build. eksctl's release notes do not say which release added Kubernetes 1.37. |

## Locks

- Lab 1's and Lab 2's **Do it on your laptop** parts unlock separately, each when its own tools pass.
- Lessons and each lab's **Understand the files** part stay open, since reading and building YAML needs no tools. A lesson's **Try it** links to the setup page until the tools for its cluster pass: Lab 1's for Anywhere lessons, and Lab 2's for EKS only lessons.
- There is no skip. The lab guides stay public on GitHub, so the lock guides learners and is not a security control.
- The result is kept in the browser with the date it was checked, and **Check again** replaces it. If the browser blocks storage, the unlock lasts for the visit.

## Tests

- **Unit:** the report reader with real output from macOS, Linux, and WSL 2, and with each failure: Docker stopped, each tool missing, kubectl 1.35 and 1.39, k3d 5.8.3, AWS CLI version 1, signed out, and eksctl 0.230.0. Unknown lines are ignored.
- **Browser:** labs locked, a passing report pasted, labs unlocked, still unlocked after reload. A report with k3d missing unlocks only Lab 2.
- **Real systems:** run the check command on macOS and Linux.
- **WSL 2 in CI:** `tests/setup-check-wsl.check.mjs` runs on a GitHub-hosted `windows-2025` runner, whose image lists WSL 2 as the default. It installs Ubuntu with `wsl --install -d Ubuntu`, then runs the Windows card's commands for kubectl, k3d, AWS CLI, and eksctl in Ubuntu as a normal user, then the check command in bash. The dashboard's report reader must read the output as Windows (WSL 2) with all four tools ready. The runner has no Docker Desktop and no AWS sign-in, so Docker must read as not running and AWS as signed out. Docker's WSL integration, the restart after `wsl --install`, and Lab 1 on Windows still need a Windows tester.

## Acceptance criteria

- [x] The setup page shows install commands for macOS, Windows (WSL 2), and Linux, each linked to its official source, with the version each lab needs.
- [x] The check command runs unchanged in macOS zsh, Linux bash, and WSL 2 bash, and prints nothing personal.
- [x] Pasting a report shows **Ready** or **Fix this** for every tool, and unlocks Lab 1 and Lab 2 separately.
- [x] The unlock survives a reload.
- [x] The start guide's Windows practice cluster uses WSL 2, matching Lab 1.
- [x] Unit and browser tests above pass.

On 2026-11-26 the check ran unchanged in macOS zsh and bash, and in Linux bash inside `nginx:1.30.4`. The same day, CI run [45814830178](https://github.com/avizway1/Kubernetes-config-builder/actions/runs/45814830178) ran it in Ubuntu 26.04 on WSL 2 (kernel `6.18.58.1-microsoft-standard-WSL2`) on a `windows-2025` runner, after the Windows card installed kubectl 1.37.2, k3d 5.9.0, AWS CLI 2.42.4, and eksctl 0.232.0. It read as Windows (WSL 2). Its first run found the eksctl checksum problem in the Decision Log. Docker's WSL integration and Lab 1 on Windows still need a Windows tester, since the runner has no Docker Desktop. Microsoft's [Install WSL](https://learn.microsoft.com/windows/wsl/install) says plain `wsl --install` works only when WSL is not installed at all. Docker Desktop installs WSL first, so the Windows card and the start guide use `wsl --install -d Ubuntu`.
