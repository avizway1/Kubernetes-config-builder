# Set up your laptop

**Status: Plan and mock-ups approved by Charan on 2026-11-26.** Built together with [lab lessons](lab-lessons.md). Charan changed it on 2026-11-27: the card moves to the top of the lesson list, and the page opens with what the laptop needs and ends with the practice cluster and kubeconfig steps. Later that day Charan kept K3s as the only practice cluster and added an optional last step that looks inside the practice cluster's node. See [Charan's changes on 2026-11-27](#charans-changes-on-2026-11-27).

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

Opened at `#learn/setup`, from a **Set up your laptop** card at the top of the lesson list, before Level 0, and from each locked lab and each **Try it** panel.

1. **What your laptop needs.** Memory, disk, system, internet, permission to install apps, and an AWS account for Lab 2 and EKS only lessons. The values match the start guide's **Check your laptop** step.
2. **Choose your system:** macOS, Windows (WSL 2), or Linux. The page picks one from the browser and the learner can change it.
3. **Install the tools.** One card per tool, with the version each lab needs, the install commands for the chosen system, and a link to the official install page they come from. Lab 2's tools are in their own group, **Only for Lab 2**.
4. **Run the check.** One short command block with **Copy**. Learners read it before running it. It never downloads or runs a script.
5. **Paste what it printed.** The page lists each tool as **Ready** or **Fix this**, with the fix, and says which labs are now unlocked.
6. **Create your practice cluster and point kubectl at it.** Create the `practice` cluster once, switch kubectl to it every time, then fixes for the real messages. Each command block says what success looks like.
7. **Look inside your practice cluster.** Optional. Open a shell on the node and look, without changing anything, at where K3s keeps the control plane's parts. See item 7 of Charan's changes.

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
lkme-check 1
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

## Charan's changes on 2026-11-27

Charan asked for these changes, which also approve the layout change.

1. **Set up your laptop comes first.** The card moves from the top of **Hands-on labs** to its own section at the top of the lesson list, before Level 0, so learners set up before the first lesson. **Hands-on labs** stays at the bottom and lists only the labs.
2. **What the laptop needs, first.** The setup page opens with the basic requirements:
   - Memory: 8 GB or more. Docker gets half of it by default, and 4 GB is enough for the dashboard and a practice cluster.
   - Disk: about 10 GB free.
   - System:
     - macOS: a version Docker Desktop supports, which is the current release and the two before it ([Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)).
     - Windows: 64-bit Windows 10 22H2 or Windows 11 23H2 or later, in the Pro, Enterprise, or Education edition, with WSL 2 ([Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)).
     - Linux: Docker Engine.
   - Internet: a steady connection, and permission to install apps.
   - An AWS account for Lab 2 and EKS only lessons. AWS charges for these.

   These are the start guide's values.
3. **kubeconfig steps.** Charan's tools passed the check, but the first **Try it** command did not reach K3s. There were two gaps:
   - The setup page stopped at the tools. Only the start guide's optional step created the practice cluster.
   - Nothing said which cluster kubectl uses.

   How kubectl finds a cluster:
   - kubectl reads clusters from its kubeconfig. That is `$HOME/.kube/config` unless `KUBECONFIG` names other files ([Organizing cluster access using kubeconfig files](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/)).
   - `k3d cluster create` adds the cluster to that file as the context `k3d-<name>` and switches to it. Both flags default to true in k3d 5.9.0 ([k3d cluster create](https://k3d.io/stable/usage/commands/k3d_cluster_create/)).
   - `k3d cluster delete` removes the context. If it was the current one, k3d switches kubectl to another cluster in the file, such as an EKS cluster. Lab 1's last step does this.
   - EKS tools add their clusters to the same file.
   - On the project Mac on 2026-11-27, the kubeconfig held only an EKS context and no current context. With no current context, kubectl falls back to `localhost:8080`, which is the dashboard's own port. With the dashboard running, kubectl answers `the server could not find the requested resource`.

   The last step, **Create your practice cluster and point kubectl at it**, is one path a beginner follows in order. See item 5.
4. **Every command can be copied and pasted.** Charan asked for this the same day.
   - Every **Try it** command gets its own block with a **Copy** button, as on the setup and lab pages. So do the context check and the command that adds worker nodes. Selecting a command no longer picks up the result line below it.
   - Every command stays plain ASCII text, with no prompt, tab, curly quote, or long dash.
   - Command fonts show `--` as two hyphens, never one long dash, so `--image` can't be misread as `—image`.
5. **One path from scratch.** Charan asked whether the dashboard had a command to point kubectl at K3s. It had one, but as the third card of step 6, under "If it shows another cluster". To follow it, a learner first had to read their current context and decide it was wrong. Entry-level learners need one path that always works, so step 6 now has three cards:

   | Card | Commands | What success looks like | Source |
   | --- | --- | --- | --- |
   | **Do this once: create the practice cluster** | `k3d cluster create practice --image rancher/k3s:v1.37.2-k3s1 --wait`, then `kubectl config use-context k3d-practice`, then `kubectl get nodes` | `Cluster 'practice' created successfully`, `Switched to context "k3d-practice".`, then `k3d-practice-server-0` with STATUS `Ready` | [k3d cluster create](https://k3d.io/stable/usage/commands/k3d_cluster_create/), [kubectl quick reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/) |
   | **Every time you practise: point kubectl at it** | `kubectl config use-context k3d-practice`, then `kubectl get nodes` | The same switch message and Ready node | [kubectl quick reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/), [Organizing cluster access](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/) |
   | **If something goes wrong** | One fix for each real message | The every-time block works again | Below |

   Learners switch every time instead of checking first, because switching is safe to repeat and needs no decision. The every-time card says to start Docker Desktop first. The cluster's containers use Docker's `unless-stopped` restart policy, so they come back when Docker starts.

   **If something goes wrong** lists each message as K3s 1.37.2 and k3d 5.9.0 print it on 2026-11-27, with its fix:

   | Message | Cause | Fix | Source |
   | --- | --- | --- | --- |
   | `error: no context exists with the name: "k3d-practice"` | kubectl doesn't know the practice cluster. | `k3d cluster list`. If it shows `practice`, `k3d kubeconfig merge practice --kubeconfig-merge-default --kubeconfig-switch-context`. If not, the **Do this once** card. | [k3d kubeconfig](https://k3d.io/stable/usage/kubeconfig/) |
   | `The connection to the server … was refused` | The cluster isn't running, or kubectl has no current context and the dashboard isn't running. | Run the every-time card. If the message stays, start Docker Desktop, then `k3d cluster start practice`. | [k3d cluster start](https://k3d.io/stable/usage/commands/k3d_cluster_start/) |
   | `the server could not find the requested resource` | kubectl has no current context, so it reached the dashboard at `localhost:8080`. | `kubectl config use-context k3d-practice` | [kubectl quick reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/) |
   | `Failed to create cluster 'practice' because a cluster with that name already exists` | The cluster was created before. | Nothing to fix. Run the every-time card. | [k3d cluster create](https://k3d.io/stable/usage/commands/k3d_cluster_create/) |

   On Windows, every command runs in Ubuntu. Every Anywhere lesson's **Try it** starts with `kubectl config use-context k3d-practice` and its **Copy** button, and links to step 6. The check command stays the same: it checks tools, and Lab 1 creates its own cluster.
6. **K3s stays the only practice cluster.** Charan asked whether learners with less memory could use kind instead. The answer was no, and Charan chose to drop kind:
   - K3s is built to be small. It ships as one binary and stores the cluster in SQLite by default ([K3s](https://docs.k3s.io/)). kind was "primarily designed for testing Kubernetes itself" ([kind](https://kind.sigs.k8s.io/)), and its docs give no memory figure for running a cluster.
   - The autoscaling lesson needs metrics-server, which K3s includes ([K3s packaged components](https://docs.k3s.io/installation/packaged-components)) and kind does not.
   - Three Level 5 lessons add two workers to the running cluster with `k3d node create`. kind's docs declare nodes only when a cluster is created ([kind configuration](https://kind.sigs.k8s.io/docs/user/configuration/)).
   - A second tool would make every beginner choose, and double the **Try it** steps, messages, and tests.

   On the project Mac (Docker Desktop with 8.7 GiB), the practice cluster's containers used about 836 MiB a minute after start. Without Traefik, ServiceLB, and the k3d load balancer, which no Anywhere lesson uses, they used about 725 MiB. kind was not measured.
7. **Look inside the practice cluster.** Charan asked for commands to get into the K3s node, as with SSH, and look at the control plane's important paths, with a warning not to edit them, so learners get a real Kubernetes feel.
   - k3d runs each node as a Docker container ([k3d](https://k3d.io/stable/)), with no SSH server. `docker exec` "runs a new command in a running container" ([docker exec](https://docs.docker.com/reference/cli/docker/container/exec/)), so `docker exec -it k3d-practice-server-0 sh` opens a shell on the node, as SSH would on a server.
   - On EKS Auto Mode, AWS manages the API server and etcd, and nodes allow no SSH or SSM access ([EKS Auto Mode](https://docs.aws.amazon.com/eks/latest/userguide/automode.html)). The practice cluster is where learners can see these parts.

   Step 7, **Look inside your practice cluster**, comes after step 6 and is optional. Its cards, with what K3s 1.37.2 showed on the project Mac on 2026-11-27:

   | Card | Command | What learners see | What it teaches | Source |
   | --- | --- | --- | --- | --- |
   | **Open a shell on the node** | `docker exec -it k3d-practice-server-0 sh` | The prompt `~ #`. The `#` means root. | The node is a Docker container. | [docker exec](https://docs.docker.com/reference/cli/docker/container/exec/), [k3d](https://k3d.io/stable/) |
   | **See the control plane run** | `ps` | `/bin/k3s server` and `containerd`, and no `kube-apiserver`, `kube-scheduler`, or `kube-controller-manager` | K3s runs the control plane inside the k3s server process. kubeadm writes a static Pod manifest for each part to `/etc/kubernetes/manifests`. | [K3s architecture](https://docs.k3s.io/architecture), [Kubernetes components](https://kubernetes.io/docs/concepts/overview/components/), [kubeadm implementation details](https://kubernetes.io/docs/reference/setup-tools/kubeadm/implementation-details/) |
   | **Where every object is stored** | `ls -l /var/lib/rancher/k3s/server/db` | `state.db` | K3s stores the cluster in SQLite by default. Most clusters use etcd. | [K3s datastore](https://docs.k3s.io/datastore), [K3s backup and restore](https://docs.k3s.io/datastore/backup-restore) |
   | **Certificates and keys** | `ls /var/lib/rancher/k3s/server/tls` | `.crt` and `.key` files, such as `client-admin.crt` and `client-scheduler.key` | The parts of the cluster prove who they are with these. kubeadm keeps them in `/etc/kubernetes/pki`. | [K3s certificates](https://docs.k3s.io/cli/certificate), [PKI certificates and requirements](https://kubernetes.io/docs/setup/best-practices/certificates/) |
   | **Files K3s applies by itself** | `ls /var/lib/rancher/k3s/server/manifests` | `coredns.yaml`, `local-storage.yaml`, `traefik.yaml`, and a `metrics-server` folder | K3s applies these like `kubectl apply` and writes its own again each time it starts. | [K3s packaged components](https://docs.k3s.io/installation/packaged-components) |
   | **The containers on this node** | `crictl ps` | One row per container, with its Pod and namespace, such as `coredns` in `kube-system` | Pods are containers that containerd runs on a node. | [crictl](https://kubernetes.io/docs/tasks/debug/debug-cluster/crictl/) |
   | **Container logs** | `ls /var/log/pods` | One folder per Pod, named namespace, Pod name, and UID, such as `kube-system_coredns-…` | `kubectl logs` reads these files through the kubelet. | [Logging architecture](https://kubernetes.io/docs/concepts/cluster-administration/logging/) |
   | **Leave the node** | `exit` | The laptop's prompt. The cluster keeps running. Docker Desktop may print a **What's next** tip about `docker debug`. | | [docker exec](https://docs.docker.com/reference/cli/docker/container/exec/) |

   A warning comes before the cards: look, don't change. The shell runs as root, so nothing stops a change. Learners must not edit, move, or delete anything on the node, because K3s uses these files while it runs. They must never print or share the token in `/var/lib/rancher/k3s/server/token` or a `.key` file. "Anyone with access to the server token essentially has full administrator access" ([K3s token](https://docs.k3s.io/cli/token)). Every command after the first only reads. If something breaks anyway, `k3d cluster delete practice` and the **Do this once** card start again ([k3d cluster delete](https://k3d.io/stable/usage/commands/k3d_cluster_delete/)). On Windows, the commands run in Ubuntu. The start guide gives the same commands after **Try your first file**.

**Tests.**

- **Unit.** The setup data opens with the requirements and ends with the practice cluster cards. Every card and fix has a source. The start guide gives the same commands and messages.
- **Browser.** The setup card is the first item in the lesson list, before Level 0. The setup page's first step is **What your laptop needs**, and its last step shows the kubeconfig commands. An Anywhere lesson's **Try it** starts with the switch command, and an EKS only lesson's does not.
- **Copy.**
  - A unit test checks that every command in the setup data, the lessons, the lab guides, the README, the contributing guide, and the start guide is plain text with no prompt.
  - A browser test clicks every **Try it** **Copy** button in every lesson and checks that the clipboard holds exactly that command.
  - Another browser test does the same for every start guide command on macOS, Windows, and Linux, and checks that ligatures are off.
- **Real cluster.** `tests/practice-cluster.check.mjs` reads the practice cluster commands from the setup data and runs them on K3s 1.37.2, under a test cluster name, with its own kubeconfig.
  - It starts from an EKS-style context and no current context, as on the project Mac.
  - It runs the **Do this once** card, then the **every time** card after switching to the other cluster.
  - It causes each message in **If something goes wrong**, checks that the message matches, runs the fix, and checks that the every-time card works again.
  - It applies the Pod lesson's download and checks that the Pod runs on the k3d node.
  - It opens a shell on the node with step 7's command, runs each card's command there, checks what it shows, and checks that the every-time card still works.
  - It deletes the cluster and checks that the context is gone and kubectl has moved to the other cluster.
- **Step 7.** A unit test checks that the first command opens the shell, every other command is one of `ps`, `ls`, `ls -l`, `crictl ps`, or `exit`, the warning is there, and every source is official. A browser test checks the step's heading and warning and copies its first command.

**Acceptance criteria**

- [x] The **Set up your laptop** card is the first item in the lesson list, before Level 0.
- [x] The setup page opens with what the laptop needs, with the same values as the start guide.
- [x] The setup page ends with the practice cluster and kubeconfig steps, each linked to its official source, with what success looks like.
- [x] Anywhere lessons' **Try it** says how to check that kubectl uses the practice cluster.
- [x] The practice cluster commands pass on K3s 1.37.2, starting from a kubeconfig that holds another cluster and no current context.
- [x] The start guide and README match the new order and commands.
- [x] Every command on the setup page, in **Try it**, in the labs, and in the start guide has a **Copy** button that copies exactly the command, in plain text.
- [x] Step 6 is one path: create once, switch every time, then fixes for the real messages. Nothing asks the learner to decide which branch applies.
- [x] Each message in **If something goes wrong** matches what K3s 1.37.2 and k3d 5.9.0 print, and its fix works on a real cluster.
- [x] Step 7 opens a shell on the practice cluster's node with one command, and every other command in it only reads.
- [x] What each step 7 card says learners see matches K3s 1.37.2 on a real cluster.
- [x] The warning says not to edit, move, or delete anything on the node, and never to print or share the token or keys, and says how to start again.
- [x] The start guide gives the same step 7 commands.

On 2026-11-27, on the project Mac (Apple silicon, Docker Desktop), with Node 26.13.1:
- `npm run lint`, `npm test` (32 passing), and `npm run build` passed.
- The browser tests (18 passing in Chrome) passed. They copied all 244 **Try it** command blocks in 35 lessons. They also copied every start guide block, with **If something goes wrong** opened: 22 on macOS, 26 on Windows, and 22 on Linux.
- `tests/practice-cluster.check.mjs` passed on K3s 1.37.2 with k3d 5.9.0 in 50 seconds. It caused all four messages in **If something goes wrong**, and each fix brought the practice cluster back. It ran step 7's commands on the node, and each showed what its card says. Its first run found that the node's prompt is `~ #`, not `/ #` as first written. A real terminal, through `script`, showed `~ #` too, and Docker Desktop's **What's next** tip after `exit`. The default `~/.kube/config` was unchanged afterwards.

The same day, with the v1.1.0 dashboard running and no current context, kubectl reached the dashboard at `localhost:8080` and answered `the server could not find the requested resource`. That matches what Charan saw.

## Acceptance criteria

- [x] The setup page shows install commands for macOS, Windows (WSL 2), and Linux, each linked to its official source, with the version each lab needs.
- [x] The check command runs unchanged in macOS zsh, Linux bash, and WSL 2 bash, and prints nothing personal.
- [x] Pasting a report shows **Ready** or **Fix this** for every tool, and unlocks Lab 1 and Lab 2 separately.
- [x] The unlock survives a reload.
- [x] The start guide's Windows practice cluster uses WSL 2, matching Lab 1.
- [x] Unit and browser tests above pass.

On 2026-11-26 the check ran unchanged in macOS zsh and bash, and in Linux bash inside `nginx:1.30.4`. The same day, CI run [45814830178](https://github.com/avizway1/learning-kubernetes-made-easy/actions/runs/45814830178) ran it in Ubuntu 26.04 on WSL 2 (kernel `6.18.58.1-microsoft-standard-WSL2`) on a `windows-2025` runner, after the Windows card installed kubectl 1.37.2, k3d 5.9.0, AWS CLI 2.42.4, and eksctl 0.232.0. It read as Windows (WSL 2). Its first run found the eksctl checksum problem in the Decision Log. Docker's WSL integration and Lab 1 on Windows still need a Windows tester, since the runner has no Docker Desktop. Microsoft's [Install WSL](https://learn.microsoft.com/windows/wsl/install) says plain `wsl --install` works only when WSL is not installed at all. Docker Desktop installs WSL first, so the Windows card and the start guide use `wsl --install -d Ubuntu`.
