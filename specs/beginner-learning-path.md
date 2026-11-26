# Beginner learning path

**Status: Approved by Charan on 2026-11-18 in full**, including the scope change, the layout, the per-block download comments, the `/templates/kubernetes` folder, and Aviz Academy branding. AGENTS.md and its Decision Log record the change.

## Goal

Make Kubernetes easy for freshers and entry-level engineers. A learner who has never written a manifest should build one **one block at a time**, understand why each block is there, and see it run on a cluster in about 15 minutes. The main target platform is **Amazon EKS with Auto Mode**. Learners practise the portable lessons free on a local cluster, then run the EKS-specific parts on EKS. The existing builder stays for engineers who want fast templates. The dashboard carries the Aviz Academy brand.

## What makes the current app hard for a beginner

Findings from reviewing v0.4.0 (`main` at `1ecf376`).

1. **The first YAML a learner sees is an Argo CD CRD or Prometheus Helm values.** There is no Pod, Deployment, Service, ConfigMap, or Namespace. A beginner has to understand GitOps, AppProjects, Helm releases, and scrape discovery before they have seen a Deployment.
2. **The whole file appears at once.** Every template renders all of its lines immediately. Nothing tells the learner which block to read first or how the blocks relate.
3. **Learning mode puts a comment above every line.** This doubles the file length. With default values, the Service download is 40 lines for 16 lines of YAML (16 comments plus 7 instruction lines), and the Application download is 44 lines for 14 lines of YAML.
4. **The explanations use expert vocabulary.** Examples from `frontend/src/usage-values.ts`: “Include the Service’s EndpointSlice targets in the default scrape job”, “Use the Argo CD API group and version that serve this resource”, “Let the controller substitute Go template expressions in string fields”. Each sentence is accurate but assumes the reader already knows the terms.
5. **Instructions are mixed into the YAML.** Prerequisites and commands are written as `#` lines at the top of every generated file before the first real field. For the Application, the 15 instruction lines are longer than its 14 lines of YAML.
6. **The screen shows every control together.** Platform (one choice), Kubernetes version, tool, Use or Install mode, template, comment density, the validation check list, changed-line highlights, Next steps, and the lab link all compete for attention. Labels such as “Comment density”, “Usage template”, “Destination server”, and a 40-character commit SHA as the default Git revision are not beginner words.
7. **The first lab is a full GitOps and monitoring exercise.** It needs Docker with 8 GB of memory, k3d, kubectl, Helm, Argo CD, and Prometheus, then an alert that fires and recovers. It is a strong second lab but a hard first one. The guide is 244 lines long.
8. **Install the tool is expert territory.** Presets render hundreds to thousands of lines (Argo CD Minimal allows 3,600 lines in Learning mode), with CRDs, RBAC, and chart comparisons.
9. **The README leads with versions, chart pins, Docker builds, CI, and security scans.** A learner has to scroll past contributor material to find the starting point.
10. **There is no branding.** The page title is “Kubernetes Config Builder” with a plain blue-grey theme.

What already works and should stay: line-level explanations backed by official docs, changed-line highlighting in Monaco, live validation with field-level errors, copy and download, drafts that survive switching, Next steps with exact commands, and pinned, tested examples.

## Proposed changes

### 1. Two front doors

The home screen asks one question: **“What would you like to do?”**

- **Learn Kubernetes** (new, default for first-time visitors). The guided path below.
- **Build a config** (the current app, unchanged for engineers). Use the tool and Install the tool stay inside this door.

The last choice is remembered in browser storage.

### 2. Block-at-a-time builder

Each lesson builds one manifest in small steps. The learner presses **Next block** to add the next piece.

- **Left pane: the lesson card.** Block title, what it does in one or two short sentences, why it is needed, “What happens if I remove it?”, and a small “Try changing” control where it makes sense (for example, replicas 1 → 3). A progress bar shows block 3 of 6.
- **Right pane: the growing YAML.** Earlier blocks stay. The new block is highlighted with the existing Monaco change highlight. Hovering any line still shows its note.
- **Back** removes the latest block. **Show whole file** jumps to the finished manifest. **Copy** and **Download** are available at every step and export the current, valid state.
- Every step produces valid YAML for its kind, or the card says clearly that the file is not finished yet and which block completes it.

Example: the Deployment lesson.

| Block | YAML added | Plain-English card |
| --- | --- | --- |
| 1. What is this file? | `apiVersion`, `kind` | Every Kubernetes file starts by saying what kind of object you want. A Deployment keeps your app running. |
| 2. Give it a name | `metadata.name`, `metadata.labels` | The name is how you find it later with `kubectl get`. Labels are tags. |
| 3. How many copies? | `spec.replicas` | Kubernetes keeps this many copies running. If one crashes, it starts a new one. |
| 4. Which Pods belong to it? | `spec.selector.matchLabels`, `spec.template.metadata.labels` | The selector and the Pod label must match. A connector line links the two. |
| 5. What should run? | `containers[].name`, `containers[].image` | The image is your packaged app. Kubernetes downloads and starts it. |
| 6. Which port? | `containers[].ports` | The port your app listens on inside the container. |
| Level up (optional) | `resources`, `readinessProbe`, `securityContext` | Shown after the basic file works. Each has its own card. |

### 3. Explanation style rules

These apply to every learner-facing note, card, label, and error.

- One idea per sentence. At most 20 words per note and two sentences per card section.
- Introduce at most one new term per block. Link every term to a short glossary entry (Pod, label, selector, namespace, image, port, replica, controller, CRD, Helm, GitOps).
- Say what the field does first, then why it is there. Use an everyday comparison only where it helps and is accurate.
- Keep the source of every explanation in the official Kubernetes, Argo CD, or Prometheus docs (AGENTS.md instruction 5). The plain wording is ours; the facts are not invented.
- Keep the YAML clean in beginner downloads. Use one short comment per block, not per line. Line detail stays in hover and the lesson card. The current per-line Learning mode stays in **Build a config**.
- Move commands and prerequisites out of the YAML header into a **Try it** panel under the editor. Keep them in engineer downloads as today.

### 4. Beginner curriculum

Charan chose EKS as the main focus on 2026-11-18. Every lesson is written for EKS Auto Mode and shows where it runs:

- **Anywhere** — works the same on the free local practice cluster and on EKS.
- **EKS only** — uses an EKS Auto Mode feature such as AWS load balancers or EBS volumes.

**Level 0 — Reading YAML** (one short interactive lesson): `key: value`, nesting with two spaces, lists with `-`, and the most common indentation mistake shown live.

**Level 1 — Kubernetes basics** (new, in `/templates/kubernetes`):

| # | Lesson | Objects | Runs on |
| --- | --- | --- | --- |
| 1 | Run one container | Pod | Anywhere |
| 2 | Keep your app running | Deployment | Anywhere |
| 3 | Group your work | Namespace | Anywhere |
| 4 | Give your app an address | Service (ClusterIP) | Anywhere |
| 5 | Settings outside the image | ConfigMap | Anywhere |
| 6 | Passwords and keys | Secret | Anywhere |
| 7 | Run a task to the end | Job, CronJob | Anywhere |
| 8 | Scale with load | HorizontalPodAutoscaler | Anywhere, with metrics-server installed |
| 9 | Open your app to the internet | Service `type: LoadBalancer` with `loadBalancerClass: eks.amazonaws.com/nlb` | EKS only |
| 10 | Route web traffic | IngressClass with `controller: eks.amazonaws.com/alb`, Ingress | EKS only |
| 11 | Keep data after restarts | StorageClass with `provisioner: ebs.csi.eks.amazonaws.com`, PersistentVolumeClaim | EKS only |
| 12 | Let a Pod call AWS safely | ServiceAccount with an EKS Pod Identity association | EKS only |

Notes from the official EKS docs, checked on 2026-11-18:

- EKS Auto Mode creates Application Load Balancers for Ingress and Network Load Balancers for `LoadBalancer` Services. It does not create a StorageClass or IngressClass, so lessons 10 and 11 teach learners to create them. [ALB with Auto Mode](https://docs.aws.amazon.com/eks/latest/userguide/auto-configure-alb.html) · [Storage class](https://docs.aws.amazon.com/eks/latest/userguide/create-storage-class.html) · [Auto Mode resource names](https://docs.aws.amazon.com/eks/latest/userguide/migrate-auto.html)
- Auto Mode comes with Pod Identity preconfigured. The association between a ServiceAccount and an IAM role is created with the AWS CLI or console, not YAML, so lesson 12 shows that command next to the YAML. [EKS Auto Mode best practices](https://docs.aws.amazon.com/eks/latest/best-practices/automode.html)
- The HorizontalPodAutoscaler needs metrics-server, which is installed separately. Lesson 8 shows how to check and install it.
- Kubernetes 1.37, 1.36, and 1.35 are all in EKS standard support until at least March 27, 2027. [EKS release calendar](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html)

**Level 2 — Tools, tested on K3s** (existing templates, rewritten to the style rules): Argo CD Application and AppProject; Prometheus annotated Service. Marked **Tested on K3s** until a later phase moves them to EKS.

**Level 3 — Going further** (existing, unchanged behaviour, tested on K3s): ApplicationSet, custom scrape job, alert rule, and Install the tool.

### 4a. The full class curriculum

On 2026-11-19 Charan shared the manifests used in the Aviz Academy EKS class (`awar10-dailynotes/EKS/manifests`, 51 YAML files and 4 diagrams) and asked for the app to cover them all, from easy to hard. The goal: a learner who finishes can **write** a manifest, **understand** one, and **read any** Kubernetes manifest, including tools they have never seen.

Charan approved this curriculum on 2026-11-19. On 2026-11-20 Charan removed lessons 35 and 37, so phase 1 ends at Level 8 and Level 9 holds only lesson 36, built in phase 2. Learners still practise reading manifests through Read it and Fix it in every lesson. It replaces the 12-lesson Level 1 above with ten levels, and all 12 approved lessons keep their place inside them. Charan chose to leave out IRSA, Fargate, Argo Rollouts, Istio, and the VerticalPodAutoscaler, so `20-irsa.yaml`, `22-vpa.yaml`, `24-peerauth.yaml`, `25-fargate.yaml`, and `argo-rollout/*` are not covered. Explain my code stays on the roadmap.

**Three skills in every lesson**

- **Build it.** Add one block at a time, as in section 2.
- **Read it.** Show a finished file from the class material and ask two or three questions: what does this field do, and what happens if it changes.
- **Fix it.** Show a broken copy of the file and ask the learner to find the mistake. Mistakes come from real class issues (listed below) and common errors: wrong indentation, a selector that matches nothing, a missing image.

**Levels.** Class files are relative to the class folder. New lessons are marked ✚.

| Level | # | Lesson | Objects and fields | Class file | Runs on |
| --- | --- | --- | --- | --- | --- |
| 0 Read YAML | 0.1 | YAML basics | keys, nesting, lists | — | Anywhere |
| | 0.2 ✚ | Parts of every manifest | `apiVersion`, `kind`, `metadata`, `spec`, `status`, `kubectl explain` | `01-pod.yaml` | Anywhere |
| 1 Run an app | 1 | Run one container | Pod | `01-pod.yaml` | Anywhere |
| | 2 ✚ | Keep copies running | ReplicaSet, and why Deployments manage it for you | `02-replicaset.yaml` | Anywhere |
| | 3 | Keep your app running | Deployment | `03-deployment.yaml` | Anywhere |
| | 4 ✚ | CPU and memory | container `resources.requests` and `limits` | `04-limit-lab.yaml` | Anywhere |
| | 5 | Group your work | Namespace | `09-namespace.yaml`, `10-namespace-2.yaml` | Anywhere |
| | 6 | Settings outside the image | ConfigMap as env and as files | `18-configmap.yaml` | Anywhere |
| | 7 | Passwords and keys | Secret as env and as files | `19-secrets.yaml` | Anywhere |
| | 8 | Run a task to the end | Job, CronJob | none in class | Anywhere |
| 2 Connect apps | 9 | An address inside the cluster | Service `ClusterIP` | `05-ClusterIP.yaml` | Anywhere |
| | 10 ✚ | Find a Service by name | cluster DNS names | `23-dns.yaml` | Anywhere |
| | 11 ✚ | A port on every node | Service `NodePort` | `06-NodePort.yaml` | Anywhere |
| | 12 ✚ | Point to an outside name | Service `ExternalName` | `08-ExternalName.yaml` | Anywhere |
| | 13 | Open your app to the internet | Service `LoadBalancer` with the Auto Mode NLB class | `07-LoadBalancer.yaml` | EKS only |
| | 14 | Route web traffic | IngressClass, Ingress with an ALB, paths and hosts | `Ingress/*` | EKS only |
| 3 Data and special workloads | 15 | Keep data after restarts | StorageClass, PersistentVolumeClaim on EBS | `14-storageclass.yaml` | EKS only |
| | 16 ✚ | Reach every Pod directly | headless Service | `15-headless.yaml` | Anywhere |
| | 17 ✚ | Databases with their own disks | StatefulSet, `volumeClaimTemplates` | `16-stateful-with-headless.yaml` | EKS only |
| | 18 ✚ | Share files between Pods | EFS StorageClass, `ReadWriteMany` claim | `efs/*` | EKS only, needs the EFS CSI add-on |
| | 19 ✚ | One Pod on every node | DaemonSet | `13-daemonsets.yaml` | Anywhere |
| 4 Run safely | 20 ✚ | Default sizes for a namespace | LimitRange | `11-limitrange.yaml`, `11.1`, `11.2` | Anywhere |
| | 21 ✚ | A budget for a namespace | ResourceQuota | `12-ResourceQuota.yaml` | Anywhere |
| | 22 ✚ | Is the app healthy? | liveness, readiness, and startup probes | `Deployment-controls/06-probes.yml` | Anywhere |
| | 23 ✚ | Start and stop timing | `minReadySeconds`, `progressDeadlineSeconds`, `terminationGracePeriodSeconds` | `Deployment-controls/timings.yml` | Anywhere |
| | 24 ✚ | Survive node maintenance | PodDisruptionBudget | `Deployment-controls/05-pdb.yml` | Anywhere |
| 5 Choose where Pods run | 25 ✚ | Pick nodes by label | node affinity | `Deployment-controls/01-node-affinity.yml` | Anywhere |
| | 26 ✚ | Spread copies apart | Pod anti-affinity | `Deployment-controls/02-anti-affinity.yml` | Anywhere |
| | 27 ✚ | Keep Pods off some nodes | taints and tolerations | `Deployment-controls/03`, `04` | Anywhere |
| | 28 ✚ | Choose your machines | Auto Mode NodePool, `nodeSelector` | `auto/NodePool.yaml`, `26-automode.yaml` | EKS only |
| 6 Release new versions | 29 ✚ | Rolling update | `maxSurge`, `maxUnavailable` | `deployments/01-rolling-update.yaml` | Anywhere |
| | 30 ✚ | Stop, then start | `Recreate` | `deployments/02-recreate.yaml` | Anywhere |
| | 31 ✚ | Blue-green | two Deployments, switch the Service selector | `deployments/03-blue-green.yaml` | Anywhere |
| | 32 ✚ | Canary | replica ratio behind one Service | `deployments/04-canary.yaml` | Anywhere |
| 7 Scale | 33 | Scale with load | HorizontalPodAutoscaler, written as YAML | `21-hpa.yaml` | Anywhere, needs metrics-server |
| 8 AWS access | 34 | Let a Pod call AWS safely | ServiceAccount with Pod Identity | none in class | EKS only |
| 9 Read any manifest | ~~35 ✚~~ | ~~Meet an unknown kind~~ (removed 2026-11-20) | API group → CustomResourceDefinition → official docs, `kubectl get crd`, `kubectl explain`, using `NodePool` and `IngressClassParams` from earlier lessons | — | Anywhere |
| | 36 | GitOps and monitoring (phase 2) | Argo CD and Prometheus custom resources (existing Levels 2 and 3) | — | Tested on K3s |
| | ~~37 ✚~~ | ~~Final challenge~~ (removed 2026-11-20) | read a mixed file of many kinds and explain each part | all levels | — |

**Notes from official docs, checked on 2026-11-19**

- EKS Auto Mode includes block storage (EBS) but not EFS. Lesson 18 shows how to install the `aws-efs-csi-driver` add-on and create an EFS file system. [EKS add-ons](https://docs.aws.amazon.com/eks/latest/userguide/workloads-add-ons-available-eks.html) · [Auto Mode considerations](https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html)
- `NodePool` from `karpenter.sh/v1` is how Auto Mode chooses machines. The built-in `system` and `general-purpose` pools can only be turned on or off. [Create a node pool](https://docs.aws.amazon.com/eks/latest/userguide/create-node-pool.html)
- Pod-level `spec.resources` is still Beta in Kubernetes 1.37. Lessons teach container-level resources. [Pod-level resources](https://kubernetes.io/blog/2025/09/22/kubernetes-v1-34-pod-level-resources/)
- All 11 container images in the class files exist on Docker Hub (checked on 2026-11-19). Lab images still follow the pinning and approval rule in section 5.

**What the app changes from the class files.** Lessons use corrected copies. Where an issue teaches something, it becomes a **Fix it** exercise. On 2026-11-19 Charan asked for the same fixes in the class folder itself, with dummy values in place of real account details. Two class files differ from the app on purpose: `14-storageclass.yaml` keeps `ebs.csi.aws.com` with a comment, because the class also uses clusters with the EBS CSI add-on, and the Ingress files keep the AWS Load Balancer Controller’s `alb` IngressClass, because the class installs that controller.

| Class file | Issue | In the app |
| --- | --- | --- |
| `11.1`, `11.2` | Pods have no namespace, while the LimitRange and ResourceQuota are in `myapp`. The LimitRange has no `max`, so `11.2` fails only because of the quota. | Put the Pods in `myapp`. Add `max` to show the LimitRange rejecting a Pod, and keep the quota case separate. |
| `19-secrets.yaml` | `secret-test-pod3` runs `busybox` with no command, so the container exits at once and restarts. (Corrected on 2026-11-19: an earlier review said the image was missing.) | Add a command that keeps it running. Fix it exercise. |
| `16`, `Deployment-controls/03` | `MYSQL_ROOT_PASSWORD` is written in plain text. | Read it from a Secret with `secretKeyRef`. |
| `14-storageclass.yaml` | Uses `ebs.csi.aws.com`, the self-managed driver. | Use `ebs.csi.eks.amazonaws.com` for Auto Mode. |
| `26-automode.yaml` | `resources` sits at Pod level, the Beta field. | Put `resources` on each container. |
| `efs/17-efs-storageclass.yaml`, `Ingress/ingress-*.yaml` | Real EFS file system ID, ACM certificate ARN with an AWS account ID, and real domain names. | Use placeholders such as `fs-0123456789abcdef0`, `111122223333`, and `example.com`, and explain where to find the real values. |
| `Ingress/ingress-*.yaml` | Uses the old `kubernetes.io/ingress.class` annotation. | Use `spec.ingressClassName`. Fix it exercise. |
| `deployments/04-canary.yaml` | Comments say 9 stable to 1 canary, but stable has 0 replicas and canary 10. | Use 9 and 1. Fix it exercise. |
| `Deployment-controls/05-pdb.yml` | Comments describe 5 replicas, the file has 7. | Match the comments to the file. |
| `13-daemonsets.yaml` | Reuses the `app: myapp` label from other lessons, so Services can select its Pods by accident. | Give it its own label. Read it exercise on selectors. |
| `21-hpa.yaml` | The HorizontalPodAutoscaler is created with `kubectl autoscale`; the YAML is commented out. | Teach the YAML and show the command as a shortcut. |

**Dependencies.** Lesson 18 needs the EFS CSI add-on and an EFS file system. Lesson 33 needs metrics-server. Each pins an official version and shows the install and cleanup commands.

**Delivery.** Build Phase 4 (block-at-a-time builder) first. Then deliver one level at a time, each with its own approval, tests, and kubeconform checks. Anywhere lessons are verified on fresh K3s. EKS only lessons wait for an approved EKS test account.

### 5. Labs

**Lab 1 — Hello Kubernetes (free, on your laptop).** Prerequisites: Docker, k3d, and kubectl. No AWS account, Helm, Argo CD, or Prometheus.

1. Create a local practice cluster with one k3d command.
2. Apply the Namespace, Deployment, ConfigMap, Secret, and Service from Level 1.
3. Watch the Pods start with `kubectl get pods`.
4. Open the app with `kubectl port-forward` and see it in the browser.
5. Change replicas to 3, apply again, and watch Kubernetes add Pods.
6. Delete one Pod and watch it come back.
7. Delete the cluster.

Target: under 15 minutes on a warm machine.

**Lab 2 — Your app on EKS (uses your AWS account, which charges for the time the cluster runs).** Prerequisites: an AWS account, the AWS CLI, eksctl, and kubectl.

1. Show the cost first: EKS control plane, EC2 instances, the Auto Mode management fee, the load balancer, and the EBS volume, with a link to the official pricing pages.
2. Create an EKS Auto Mode cluster with an `eksctl` config file that sets `autoModeConfig.enabled: true`.
3. Deploy the same app from Lab 1 without changes. This shows the portable lessons are real.
4. Add the EKS-only pieces: an Ingress with an ALB, a PersistentVolumeClaim on EBS, and a ServiceAccount with Pod Identity.
5. Open the app through the load balancer address.
6. Clean up: delete the Ingress and PersistentVolumeClaim first so AWS removes the load balancer and volume, then delete the cluster. Finish with commands that confirm nothing is left running.

Target: under 40 minutes including cluster creation, timed and recorded with the AWS Region.

**Lab 3 — GitOps and monitoring (existing first K3s lab).** Unchanged, and tested on K3s.

Every lab sample image must be pinned by digest, support AMD64 and ARM64, run as non-root, and be shared with Charan for approval before use, as with `sample-app`.

### 6. Simpler screen in Learn Kubernetes

- Hide the Platform select and show “Amazon EKS 1.37 · practise free on your laptop” as text. Show an **Anywhere** or **EKS only** badge on each lesson. Move the version choice under **Advanced**.
- Replace “Comment density” with a **Show explanations** switch.
- Replace “Usage template” with **What do you want to create?**
- Show validation as **Looks good** or **Fix this: <field>** with a link to the field. Keep the named checks in a collapsed **What we checked** section.
- Narrow screens stack the lesson card above the YAML with a jump link, as the current builder does.

### 7. Aviz Academy branding

Charan confirmed the spelling **Aviz Academy** and shared the logo on 2026-11-18. The original is stored at `frontend/public/brand/aviz-academy-logo.webp` (2000 × 658 pixels, transparent background): a navy cloud with blue and orange rising arrows, and the AVIZ wordmark over ACADEMY in orange.

Colours sampled from the logo:

| Token | Hex | Use | Contrast on white |
| --- | --- | --- | --- |
| `--brand-navy` | `#233483` | Headings, primary buttons, links | 11.1:1 |
| `--brand-navy-dark` | `#1F2865` | Header bar, body text accents | 13.6:1 |
| `--brand-orange` | `#F69327` | Highlights, progress bar, the new-block marker, buttons with navy text | 2.3:1 (not for text on white) |
| `--brand-blue` | `#408CCB` | Secondary accents and icons | 3.6:1 (large text or icons only) |

Orange and navy together reach 5.9:1, so orange buttons use navy text, and orange text appears only on the navy header.

- Header with the full logo on the left and the product name **Kubernetes Made Simple** beside it. Use the same name for the page title.
- Theme colours as CSS custom properties so the existing styles switch over in one place. Check text contrast against WCAG AA.
- The navy wordmark disappears on dark backgrounds. No SVG or white version exists, so place the logo on a white header, or derive a light raster version from the shared WebP and get Charan’s approval.
- The full logo is too wide for a favicon. Crop the cloud and arrows as a square favicon and a small mark for narrow screens, and get Charan’s approval for the crop.
- Footer: “Built by Aviz Academy” with a link to [avizacademy.com](https://avizacademy.com), the MIT licence, and the source repository.
- The same brand in the README header, the downloaded file header line, and the Docker image labels.

### 8. Simpler README and docs

- README starts with **Start learning in 2 minutes** (Docker command, then open the browser), then the two front doors, then the labs.
- Move “Run from source”, Test, and Security checks into `docs/contributing.md`. Move release notes into `docs/releases/`.

## Delivery phases

**Two product phases (Charan, 2026-11-19).** Phase 1 is **Learn Kubernetes** end to end: Levels 0 to 8, Lab 1, and Lab 2. Lessons 35 and 37 were removed on 2026-11-20. Phase 2 is **Build a config**, with lesson 36 and Lab 3 (GitOps and monitoring). In phase 1:

- The dashboard opens straight into Learn Kubernetes. The home page’s two doors and the header’s Build a config link are hidden behind one switch, `showBuildAConfig` in `frontend/src/Site.tsx`, which phase 2 turns back on.
- `#build` still opens Build a config when typed directly, so its existing browser tests keep running in CI. Nothing in Learn Kubernetes links to it.
- The seven Level 9 items that opened Build a config (`argo-application`, `argo-project`, `prometheus-service`, `argo-application-set`, `prometheus-scrape-job`, `prometheus-alert-rule`, `install-tool`) and Lab 3 are removed from `templates/kubernetes/lessons.json`. Commit `42796a0` has them for phase 2.
- Build a config code changes only to keep its tests passing.

The numbered steps below are the original plan. Steps 5 to 7 are phase 1; step 8 and lesson 36 are phase 2.

Each phase gets its own spec section approval, small commits, tests, and a Chromium check, following the existing workflow.

1. **Decisions and brand assets.** Answer the open questions below. Record answers here and in the Decision Log.
2. **Explanation rewrite.** Apply the style rules to the six existing templates and their field help. No layout change. Test that every emitted line has a note and that every note meets the word limit.
3. **Brand and front doors.** Header, theme, footer, and the two-door home screen.
4. **Block-at-a-time builder.** Build it with the existing Service template first, since it is the shortest, then the Argo CD Application.
5. **Anywhere lessons, one level at a time** (section 4a, Levels 0 to 7 and 9), with Lab 1, verified on fresh K3s across 1.35, 1.36, and 1.37.
6. **EKS only lessons** (13, 14, 15, 17, 18, 28, and 34) with Lab 2, verified on a dedicated EKS Auto Mode test cluster. Create the cluster only after Charan approves the account, Region, and budget, and delete it after each run.
7. **README and docs restructure.**
8. **Later:** move Level 2 and Level 3 Argo CD and Prometheus content to EKS.

### Phase 1 milestones (approved by Charan on 2026-11-19)

Phase 1 still needs 28 lessons (21 Anywhere, 7 EKS only), Read it and Fix it practice, Lab 1, Lab 2, and the docs restructure. Each milestone gets its own spec section and commit. On 2026-11-20 Charan moved CI to a single run at the end of phase 1. Until then, each milestone is checked locally, including the K3s cluster check.

1. **Practice and cluster checks.** Add a **Practise** step with Read it and Fix it to the lesson screen, after Charan approves a mock-up, and add it to the ten existing lessons. Add a deploy check that applies every Anywhere lesson to fresh K3s 1.35, 1.36, and 1.37 and checks its **Try it** results. Run it on Levels 0 and 1, which have not yet been applied to a cluster.
2. **Level 2 Anywhere lessons:** 9 ClusterIP, 10 DNS, 11 NodePort, 12 ExternalName.
3. **Lab 1.** It needs the Level 2 ClusterIP Service. On 2026-11-20 Charan asked to build milestones 4 and 5 first, so Lab 1 follows Level 4. Timed from cluster creation, target under 15 minutes. Its sample image follows the lab image rule in section 5 and needs Charan’s approval.
4. **Level 3 Anywhere lessons:** 16 headless Service, 19 DaemonSet.
5. **Level 4:** lessons 20 to 24, with the class-file fixes for `11.1`, `11.2`, and `05-pdb.yml`.
6. **Level 5 Anywhere lessons:** 25 to 27. They need a cluster with several nodes, so the practice cluster gains agent nodes for this level.
7. **Level 6:** lessons 29 to 32, including the canary 9-to-1 fix.
8. **Level 7:** lesson 33. Check whether the pinned K3s release ships metrics-server before writing its prerequisites.
9. **Level 9:** removed by Charan on 2026-11-20. Lessons 35 and 37 are not built, and Level 9 leaves the catalogue until phase 2 adds lesson 36.
10. **EKS only lessons and Lab 2:** 13, 14, 15, 17, 18, 28, and 34. Written and checked with pinned schemas without a cluster. Deploying them waits for Charan’s approval of the AWS account, Region, and budget (open question 4).
11. **Docs:** the README and `docs/contributing.md` restructure from section 8, and acceptance criteria updated to match phase 1.

#### Milestone 1: the Practise step (layout approved by Charan on 2026-11-19)

- **Where it appears.** After the last block, the lesson card offers **Practise**. Practise is optional: the next-lesson link stays on the last block. The card shows two tabs, **Read it** and **Fix it**, and the YAML pane shows the file each tab is about. Narrow screens stack the card above the file, as lessons do now.
- **Read it.** The YAML pane shows the finished file without block comments, using the corrected class file where the lesson has one. The card asks two or three questions, each with three answers and one right answer. Choosing an answer shows **Correct** or **Not quite**, a short explanation, and highlights the line it is about. Questions ask what a field does or what happens when it changes.
- **Fix it.** The YAML pane shows a copy with one mistake. The learner clicks the line or picks its number, then **Check my answer**. A right answer shows the exact message Kubernetes or the YAML reader prints, why it happens, and how to fix it. A wrong answer says **Not that line** and offers **Show the answer**. **Show the fixed file** returns to the working file. Copy and Download export what the pane shows, as **See the mistake** does.
- **Every message is real.** A YAML or schema mistake uses kubeconform’s message, checked in CI. A mistake only the API server catches, such as a selector that does not match the Pod labels, uses the message from a server-side dry run on K3s, checked by the cluster check. A mistake Kubernetes accepts, such as a Service selector that matches no Pods, shows what a `kubectl` command reveals instead, also checked on K3s.
- **Data.** Each lesson file gains `practice.read` (questions, answers, the right answer, explanation, line) and `practice.fix` (broken copy, line, message, where the message comes from, why, how to fix). The existing note rules apply: at most 20 words a sentence and two sentences an explanation.
- **Progress.** Answers are kept per lesson, like block progress, and survive moving between views.
- Mock-ups on the Deployment lesson: Read it with the first question answered, and Fix it with a label that does not match the selector. The selector message was taken from a server-side dry run on K3s 1.37.2.

#### Milestone 2: Level 2 Anywhere lessons (2026-11-20)

Charan asked to start milestone 2 on 2026-11-20. Four lessons, each with Read it and Fix it, built from corrected copies of the class files and checked on K3s 1.35, 1.36, and 1.37. They reuse `nginx:1.30.4` and `busybox:1.37.0` from Level 1, so no new images need approval. The class DNS file’s unpinned `hashicorp/http-echo` and `curlimages/curl` images are not used.

- **Lessons can build on earlier downloads.** A Service needs Pods to send traffic to. Rather than rebuild a Deployment, a lesson lists the earlier lessons it `uses`, and its **Try it** starts by applying their downloaded files. The cluster check writes those files too.
- **9 Give your app an address** (`service.yaml`, class `05-ClusterIP.yaml`). A ClusterIP Service called `web` that selects the Deployment lesson’s `app: web` Pods: name, selector, ports, then `type: ClusterIP`. Try it applies `deployment.yaml`, shows the EndpointSlice with both Pod addresses, and fetches the page from a short-lived busybox Pod inside the cluster. Fix it: a selector of `app: Web`, because labels are case-sensitive.
- **10 Find a Service by name** (`dns.yaml`, class `23-dns.yaml`). A busybox Pod with two environment variables holding the short name `http://web` and the full name `http://web.default.svc.cluster.local`. Try it shows the search list in `/etc/resolv.conf`, looks the name up, and fetches the page by each name. Fix it: the full name with the wrong namespace.
- **11 A port on every node** (`node-port.yaml`, class `06-NodePort.yaml`). A NodePort Service `web-nodeport` with `nodePort: 30080`. Try it reads the node’s address and fetches the page through the node port from inside the cluster, which works on any cluster. Fix it: `nodePort: 80`, outside the allowed range.
- **12 Point to an outside name** (`external-name.yaml`, class `08-ExternalName.yaml`). An ExternalName Service `academy-site` for `avizacademy.com`. Try it shows the CNAME answer from cluster DNS. The lesson notes that HTTP and HTTPS often fail through an ExternalName, as the Kubernetes docs warn. Fix it: an address written as a URL with `https://`.

#### Milestones 4 and 5: Level 3 and 4 Anywhere lessons (2026-11-20)

Charan asked to complete the Anywhere lessons of Levels 3 and 4 on 2026-11-20, ahead of Lab 1. Seven lessons, each with Read it and Fix it, built from corrected copies of the class files. They reuse `nginx:1.30.4` and `busybox:1.37.0`, so no new images need approval. Every Try it result and Fix it message was first observed on a scratch K3s 1.37.2 cluster.

- **16 Reach every Pod directly** (`headless.yaml`, class `15-headless.yaml`). Renamed from “A name for every Pod”: a headless Service makes a lookup return each Pod’s address, but only StatefulSet Pods get a name each, which lesson 17 teaches. `web-headless` with `clusterIP: None` selects the Deployment lesson’s Pods. Try it compares the two addresses from `nslookup` with the Pods’ IP column. Fix it: `clusterIP: none`, which Kubernetes reads as an invalid address.
- **19 One Pod on every node** (`daemonset.yaml`, class `13-daemonsets.yaml`). `log-collector` keeps its own label, as the class fix asks. Its busybox container prints its node’s name, taken from `spec.nodeName` through `fieldRef`. Fix it: `spec.nodename`, because field names are case-sensitive. A selector typo was already the Deployment lesson’s mistake.
- **20 Default sizes for a namespace** (`limit-range.yaml`, class `11-limitrange.yaml`, `11.1`, `11.2`). One file creates the `limits-demo` namespace and the `container-sizes` LimitRange with `max`, `default`, and `defaultRequest`. Try it shows a Pod with no sizes receiving the defaults, then applies the CPU and memory lesson’s file in `limits-demo`, where its 500m limit breaks the 400m max. This replaces the class `11.1` and `11.2` Pods and tests the LimitRange alone, as the class-file fix asks. Fix it: a default above the max.
- **21 A budget for a namespace** (`resource-quota.yaml`, class `12-ResourceQuota.yaml`). The `quota-demo` namespace and the `team-budget` ResourceQuota. Try it shows a Pod without sizes refused, then the CPU and memory lesson’s Pod accepted and counted. Fix it: a CPU request budget of 200m, which the same Pod’s 250m request exceeds.
- **22 Is the app healthy?** (`probes.yaml`, class `Deployment-controls/06-probes.yml`). A single Pod instead of the class Deployment and Service, so learners can watch one container. Startup, readiness, and liveness probes ask nginx for `/`. Try it deletes the home page: READY drops to 0/1 after about 15 seconds, then the liveness probe restarts the container, which comes back with its page. Fix it: the readiness probe on port 8080, shown by `kubectl describe pod`.
- **23 Start and stop timing** (`timing.yaml`, class `Deployment-controls/timings.yml`). `minReadySeconds: 10`, `progressDeadlineSeconds: 60`, and `terminationGracePeriodSeconds: 5`, shorter than the class values so the effects are quick to watch. busybox `sleep` ignores the stop signal, so deleting a Pod takes the full grace period. Fix it: a progress deadline below `minReadySeconds`.
- **24 Survive node maintenance** (`pdb.yaml`, class `Deployment-controls/05-pdb.yml`). `web-pdb` with `maxUnavailable: 1` protects the Deployment lesson’s two Pods. Try it drains only the web Pods with `--pod-selector`: one is evicted and the next refused, then `kubectl uncordon` brings the node back. On a one-node cluster the replacement cannot start, so the drain stops at its timeout. Fix it: a selector typo, shown by `kubectl describe pdb` as “No matching pods found”.
- **Lessons can use earlier files after their own.** The LimitRange and ResourceQuota lessons apply the CPU and memory lesson’s file with `-n` after creating their namespace. The rule is now: files Try it needs first come before the lesson’s own file, and every used file is applied somewhere.
- The LimitRange, ResourceQuota, and PodDisruptionBudget schemas are now pinned, with checksums.

#### Milestones 6, 7, and 8: Level 5, 6, and 7 Anywhere lessons (2026-11-20)

Charan asked to complete Levels 5, 6, and 7 on 2026-11-20. Eight Anywhere lessons, each with Read it and Fix it, built from corrected copies of the class files. Lesson 28, the Auto Mode NodePool, is EKS only and waits for milestone 10. The lessons reuse `nginx:1.30.4` and `busybox:1.37.0`, so the class images `avizway/app`, `httpd`, `mysql`, and `hpa-example` are not used and no new images need approval. Every Try it result and Fix it message was first observed on a scratch K3s 1.37.2 cluster with one server and two agents.

- **Three nodes for Level 5.** Scheduling rules only show their effect with several nodes. A lesson can set `nodes: 3`, and its Try it panel then gives the command that adds two worker nodes to the practice cluster from the start guide: `k3d node create worker --cluster practice --role agent --replicas 2 --image rancher/k3s:v1.37.2-k3s1 --wait`. Commands that need a node name show `<node>`, taken from `kubectl get nodes`. The cluster check runs the one-node lessons first, adds two agents with the same command, then runs the three-node lessons. Each phase checks the node count.
- **Setup can come before the lesson’s own file.** The taints lesson labels and taints a node before applying its Pod, and removes both at the end. The rule is now: any `kubectl apply` before the lesson’s own file must apply a used file. Other commands may come first.
- **25 Pick nodes by label** (`node-affinity.yaml`, class `Deployment-controls/01-node-affinity.yml`). `ssd-web`, two nginx replicas, with a required rule for `disktype In [ssd]`. Try it shows both Pods Pending and their FailedScheduling events, “didn’t match Pod’s node affinity/selector”, labels one node, sees both Pods land there, then removes the label and sees them keep running, which is what IgnoredDuringExecution means. Fix it: `operator: in`, because operators are case-sensitive.
- **26 Spread copies apart** (`pod-anti-affinity.yaml`, class `Deployment-controls/02-anti-affinity.yml`). `spread-web`, three replicas, a required anti-affinity rule on its own label with `topologyKey: kubernetes.io/hostname`. Try it shows three Pods on three different nodes. The class file uses a preferred rule, which a Read it question explains. Fix it: four replicas, shown by `kubectl get events --field-selector reason=FailedScheduling` as “didn’t match pod anti-affinity rules”. Both lessons read scheduling events this way, because `kubectl describe` leaves out events when it describes several objects.
- **27 Keep Pods off some nodes** (`taints.yaml`, class `Deployment-controls/03` and `04`). A busybox Pod `db-pod` stands in for the class MySQL Pod. It has `nodeSelector: role: db` and a toleration for `role=db:NoSchedule`. Try it labels and taints one node, sees `db-pod` run there and four ordinary nginx Pods avoid it, then cleans up. The lesson says a toleration only allows a node, while the label draws the Pod there. Fix it: `effect: NoSchedul`.
- **29 Rolling update** (`rolling-update.yaml`, class `deployments/01-rolling-update.yaml`). `rolling-web`, four busybox replicas serving “version 1” from a `VERSION` variable, a readiness probe, and `maxSurge: 1`, `maxUnavailable: 0`. Try it changes the version with `kubectl set env`, watches `rollout status`, reads the events showing one Pod up and one down at a time, and runs `rollout undo`. The lesson says that in real work you edit the file and apply it. Fix it: `maxSurge: 0` with `maxUnavailable: 0`.
- **30 Stop, then start** (`recreate.yaml`, class `deployments/02-recreate.yaml`). The same app with `type: Recreate`. The events show the old set scaled from 4 to 0 before the new set from 0 to 4. busybox’s web server ignores the stop signal, so the gap lasts the 30-second grace period, which the timing lesson taught. Fix it: `type: recreate`.
- **31 Blue-green** (`blue-green.yaml`, class `deployments/03-blue-green.yaml`). `shop-blue`, the `shop` Service selecting `version: blue`, then `shop-green`. Try it fetches “blue”, patches the Service selector, and fetches “green”. Fix it: the green Deployment left named `shop-blue`, a copy-paste slip that Kubernetes refuses because a selector cannot change.
- **32 Canary** (`canary.yaml`, class `deployments/04-canary.yaml`). `store-stable` with 9 replicas, the `store` Service selecting only `app: store`, then `store-canary` with 1. Try it counts 100 answers inside the cluster, about 10 of them canary, then scales the canary to 3. Fix it: the class file’s own mistake, stable at 0 replicas, so every request reaches the canary.
- **33 Scale with load** (`autoscaling.yaml`, class `21-hpa.yaml`). The HorizontalPodAutoscaler is taught as YAML, with `kubectl autoscale` named as the shortcut. `busy-app` requests 50m CPU, has no `replicas` line as the Kubernetes docs advise, and uses all its CPU once `/tmp/busy` exists. The `autoscaling/v2` autoscaler aims for 50% between 1 and 3 Pods. Try it shows a low CPU reading, creates `/tmp/busy`, and sees 3 replicas and the “New size: 3” event about a minute later. K3s ships metrics-server, so learners need nothing extra. On EKS, metrics-server is an add-on to install, as the [AWS guide](https://docs.aws.amazon.com/eks/latest/userguide/horizontal-pod-autoscaler.html) says. Fix it: `scaleTargetRef` naming `busy-ap`, shown by `kubectl describe hpa`.
- Blue-green and canary build a second Deployment over several blocks, so their files become valid only at the last block.
- The HorizontalPodAutoscaler `autoscaling/v2` schema is now pinned, with checksums.

#### Milestone 10: EKS only lessons (2026-11-20)

On 2026-11-20 Charan asked to write the EKS only lessons first, then test them on an EKS Auto Mode cluster. Seven lessons, each with Read it and Fix it, built from corrected copies of the class files. They reuse `nginx:1.30.4` and `busybox:1.37.0`, so the class `mysql` image and an AWS CLI image are not needed. Lab 2 follows as its own step.

- **Written now, run on EKS later.** The lessons are written from the AWS and Kubernetes docs and checked with strict kubeconform. Their Try it results and the one EKS-only Fix it message are checked later by `tests/check-lessons-eks.sh`, which runs against an existing dedicated EKS Auto Mode cluster. Creating that cluster waits for Charan’s approval of the AWS account, Region, and budget, and it is deleted after the run.
- **Messages captured before the EKS run.** Fix it messages that come from the Kubernetes API server were captured on K3s 1.37.2, which runs the same API server: an unknown Ingress field, a StorageClass parameter written as a number, a missing StorageClass, a StatefulSet mount name that matches no volume, and a missing ServiceAccount. The NodePool message was captured with the official Karpenter v1.15.2 NodePool CRD, whose consolidation policies match the Auto Mode docs. The load balancer mistake can only be seen on EKS.
- **Try it on EKS.** For EKS only lessons, the Try it panel says to run the commands against your EKS Auto Mode cluster, that AWS charges for load balancers, volumes, and nodes while they exist, and to finish with the delete steps. A lesson can name what it `needs` before Try it, with a link to the AWS guide, as the EFS lesson does for its add-on and file system. Commands with account or cluster values use placeholders such as `<cluster>` and `<account-id>`.
- **13 Open your app to the internet** (`load-balancer.yaml`, class `07-LoadBalancer.yaml`). A Service `web-public` of `type: LoadBalancer` with `loadBalancerClass: eks.amazonaws.com/nlb` and the `aws-load-balancer-scheme: internet-facing` annotation, selecting the Deployment lesson’s Pods. Auto Mode creates an internal Network Load Balancer unless the scheme says otherwise. Try it waits for the hostname and fetches the nginx page from your laptop. Fix it: the annotation misspelled `aws-load-balancer-schema`, which Kubernetes accepts and Auto Mode ignores, so the load balancer is internal.
- **14 Route web traffic** (`ingress.yaml`, class `Ingress/ingress-single.yaml`). An `IngressClassParams` `public-alb` with `scheme: internet-facing`, an IngressClass `public-alb` with controller `eks.amazonaws.com/alb`, and an Ingress `web` sending `shop.example.com/` to the ClusterIP Service lesson’s `web` Service. Try it fetches the page through the ALB with a `Host: shop.example.com` header, so no domain is needed, and shows that other hosts get 404. Fix it: the old `kubernetes.io/ingress.class` annotation written in place of `ingressClassName`, which the API server rejects as an unknown field.
- **15 Keep data after restarts** (`storage.yaml`, class `14-storageclass.yaml`). A StorageClass `auto-ebs` with provisioner `ebs.csi.eks.amazonaws.com`, `WaitForFirstConsumer`, and encrypted gp3, a 1Gi PersistentVolumeClaim `notes-disk`, and a busybox Pod `notes` that adds the start time to `/data/starts`. Try it deletes and recreates the Pod and sees both start times. Auto Mode creates no StorageClass, as the AWS docs say. Fix it: `storageClassName: gp3`, copied from guides that assume one exists, shown by `kubectl describe pvc` as `storageclass.storage.k8s.io "gp3" not found`.
- **17 Databases with their own disks** (`statefulset.yaml`, class `16-stateful-with-headless.yaml`). The headless Service `db` and a two-replica StatefulSet `db` with a `data` claim template on `auto-ebs`. busybox stands in for MySQL, so the class file’s password Secret is not needed. Try it shows `db-0` and `db-1` with their own claims, deletes `db-0` and sees it return with the same name and disk, and looks up `db-0.db.default.svc.cluster.local`. busybox’s `nslookup` ignores the search list, so the lesson uses the full name. The claims stay after the StatefulSet is deleted, so Try it deletes them by their `app=db` label. Fix it: the volume mount named `disk`, which matches no claim template.
- **18 Share files between Pods** (`efs.yaml`, class `efs/*`). A StorageClass `efs` with `provisioningMode: efs-ap` and a placeholder `fileSystemId`, a `ReadWriteMany` claim `shared`, and a two-replica Deployment `writers` that each add their name to `/shared/visitors`. Try it reads one file holding both Pods’ names. It needs the EFS CSI add-on with its Pod Identity role and an EFS file system with mount targets, following the AWS EFS guide. Fix it: `directoryPerms: 700` without quotes, which the API server refuses because StorageClass parameters are text.
- **28 Choose your machines** (`node-pool.yaml`, class `auto/NodePool.yaml` and `26-automode.yaml`). A NodePool `flex` limited to `c7i-flex.large` and `m7i-flex.large`, On-Demand, with `consolidationPolicy: WhenEmpty` and a CPU limit of 8. It also has a two-replica Deployment `flex-web` with `nodeSelector: karpenter.sh/nodepool: flex` and per-container requests. Try it shows the pool, the new node’s pool, instance type, and capacity type, and the node going away after deletion. Fix it uses the v1beta1 `WhenUnderutilized` value. On 2026-11-20 Charan chose this Free plan friendly version over the Graviton and Spot pool. On the AWS Free plan, these two types are the only ones Auto Mode can launch.
- **34 Let a Pod call AWS safely** (`pod-identity.yaml`). A ServiceAccount and a busybox Pod `aws-caller`. Try it creates an IAM role that trusts `pods.eks.amazonaws.com` and has no permissions, associates it with the ServiceAccount, applies the file, shows the `AWS_CONTAINER_*` variables EKS adds, and reads only the expiry time of the temporary credentials. Then it deletes the association and the role. Auto Mode includes the Pod Identity Agent, per the AWS docs. Fix it: `serviceAccountName` misspelled, which the API server refuses.
- **Schemas.** Ingress, IngressClass, and StorageClass are pinned from the schema catalog. AWS publishes no CRD for `IngressClassParams`, and Auto Mode’s `NodePool` CRD can differ from open-source Karpenter’s, so kubeconform skips these two kinds until the EKS run exports both CRDs from the cluster as JSON. Until then, the NodePool passed a server-side dry run on K3s against the official Karpenter v1.15.2 CRD (commit `3a0361d`).
- **Progress, 2026-11-20.** All seven lessons are written and appear in the catalogue. Unit tests, the type check, the build, strict kubeconform for Kubernetes 1.35 to 1.37 (skipping `NodePool` and `IngressClassParams`), and the site browser tests pass. The EFS lesson lists its add-on and file system under **Before you start**. `tests/check-lessons-eks.sh` checks the lesson results on an existing dedicated cluster named `kcb-lessons-*`. It saves both CRDs to `.runtime/eks-crds` so their schemas can be pinned. The script creates nothing in AWS beyond the lessons’ own Try it steps. Still to do: the EKS run, after Charan approves the account, Region, budget, and Kubernetes version. Until that run, the load balancer Fix it and every Try it result are unverified.
- **EKS run approved, 2026-11-20.** Account: the `default` profile, on the AWS Free plan with $60 of credits. Region ap-south-1, Kubernetes 1.37, cluster `kcb-lessons-137`. Spend comes only from the credits. On the Free plan, Auto Mode can launch only c7i-flex.large and m7i-flex.large, both amd64, so the Graviton NodePool in lesson 28 cannot launch there.
- **EKS run results, 2026-11-20.** All seven lessons pass every Try it step and Fix it message on EKS Auto Mode 1.37 (`v1.37.1-eks-577a51e`) in ap-south-1, on a Free plan account. Auto Mode’s built-in pools launched `c7i-flex.large` on their own. Four changes came from the run:
  - Lesson 34 now waits a minute after creating the association, because AWS says [associations take several seconds to work](https://docs.aws.amazon.com/cli/latest/reference/eks/create-pod-identity-association.html), and EKS adds credentials only as a Pod starts. Listing an association by ServiceAccount also needs `--namespace`.
  - Lesson 13’s Fix it asks AWS for the load balancer’s scheme. An internal Network Load Balancer’s hostname does not start with `internal-`.
  - The cluster check runs a lesson’s own delete steps when the lesson fails partway, and `KCB_LESSON_ONLY` reruns chosen lessons.
  - The exported NodePool and IngressClassParams CRDs are kept in `backend/eks-crds`. `backend/download-schemas.py` builds strict schemas from them, and kubeconform now checks every lesson without skipping a kind.

#### Milestone 3: Lab 1 · Hello Kubernetes (2026-11-25)

On 2026-11-25 Charan asked to finish phase 1 and approved `nginxinc/nginx-unprivileged:1.30.4`, pinned by digest, as the lab image. It is the lessons’ nginx release, published by the NGINX Docker maintainers, running as user 101 on port 8080.

- **Guide and file.** `docs/lab-1-hello-kubernetes.md`, opened from the catalogue’s **Open guide**. The app is one file, `templates/kubernetes/labs/hello.yaml`, with a Namespace, a ConfigMap, a Secret, a Deployment, and a Service. The ConfigMap holds the page message as an environment variable and the web server settings as a file. The Secret holds the login file, so the browser asks for a username and password. The page names the Pod that served it, so scaling and replacement are visible.
- **Steps.** Create a k3d cluster, download or copy the file, apply it, open it with `kubectl port-forward` on port 8090 (the dashboard uses 8080), scale to three by editing the file, delete a Pod and watch it return, change the message and see it apply only after `kubectl rollout restart`, then delete the cluster.
- **Found while building.** nginx runs `return` before it checks the login, so the page now comes from a named location reached with `try_files`. `kubectl apply` always reports a Secret written with `stringData` as `configured`, so the guide says only that the Deployment changes.
- **The guide is the test.** `tests/lab-guide.check.mjs` runs every command in a guide’s `bash` blocks in one shell, in order, plus hidden `<!-- do: -->` steps for edits a learner makes in an editor and `<!-- check: -->` steps for what a learner sees. `kubectl port-forward` runs in the background and restarts before each check, `--watch` commands are skipped, downloads from this repository copy the local file, and the check uses its own kubeconfig. A unit test keeps every YAML block in a guide equal to a lab file and every download pointing at a file that exists. Strict kubeconform checks the lab files.
- **Verified 2026-11-25:** the Lab 1 check passed on fresh K3s 1.37.2 in 49 seconds from cluster creation to deletion, on Darwin arm64 with Docker 29.8.2, k3d 5.9.0, and kubectl 1.36.1. The 15-minute target allows for reading and typing.

#### Lab 2 · Your app on EKS (2026-11-25)

- **Guide and files.** `docs/lab-2-your-app-on-eks.md` starts with what costs money and links each AWS pricing page. eksctl creates `hello-eks` from `templates/kubernetes/labs/hello-eks-cluster.yaml`, after one `sed` command puts the learner’s Region into it. Lab 1’s `hello.yaml` runs unchanged. A second file, `hello-eks.yaml`, adds an internet-facing ALB Ingress with its health check on `/healthz`, an encrypted gp3 claim, and a one-Pod `notes` Deployment with `Recreate`, `fsGroup: 101`, and a Pod Identity ServiceAccount.
- **Pod Identity shows a real AWS answer.** The image has `curl`, so a short script in a ConfigMap reads the Pod’s temporary keys and calls STS `GetCallerIdentity` with `curl --aws-sigv4`. It prints `assumed-role/hello-notes/...`. The role has no permissions, and `GetCallerIdentity` needs none.
- **Clean-up checks ask each service directly.** The first run used the Resource Groups Tagging API to look for anything tagged with the cluster. After deletion it still listed the terminated instance, the deleted volumes, and the deleted network interface, so it cannot prove that nothing is left. The guide now checks the cluster, load balancers named `k8s-hello-`, the claim’s volume, running Auto Mode instances (which need `--include-managed-resources`), the eksctl VPC, and the IAM role. The same checks run while the lab is up, to prove each filter finds what it looks for.
- **Verified 2026-11-25** in ap-south-1 on the approved Free plan account. The final guide passed all 17 checks in 1,319 seconds from cluster creation to deletion. The cluster was ready after 12 minutes. Auto Mode launched its own nodes. eksctl created one NAT gateway with an Elastic IP, as the cost table says. Afterwards the account had no cluster, load balancer, EBS volume, NAT gateway, Elastic IP, or lab role, and only its default VPC. The first run passed every step in 25 minutes before its tagging check was replaced.
- **EKS lessons rechecked.** The same day, `tests/eks-lessons-cluster.sh` created `kcb-lessons-137` with EFS in 19 minutes, all seven EKS only lessons passed again (15 tests in 955 seconds), and its delete step left nothing. The exported NodePool and IngressClassParams CRDs match `backend/eks-crds`.

#### Milestone 11: README and docs (2026-11-25)

- The README leads with **Start learning**, then the levels and the labs, then Build a config as phase 2. The heading leaves out “in 2 minutes”, because the first source build takes longer than that.
- Running from source, tests, cluster checks, and security checks moved to `docs/contributing.md`. Build a config’s usage and installation notes moved to `docs/build-a-config.md`. Release notes moved to `docs/releases`, with an index that also describes the older prebuilt v0.4.0 image.
- The EKS lesson cluster setup and teardown moved from the ignored `.runtime` folder to `tests/eks-lessons-cluster.sh`, with the cluster name and Region as inputs.
- The start guide points to Lab 1 after Level 1, and no longer mentions lessons marked Coming soon.

#### Closing the block and term criteria (2026-11-26)

- A browser test opens every lesson and steps through all 248 blocks. At each step, the card shows that block, and the editor highlights exactly the YAML lines and comment the block adds. Long lines wrap, so the test counts YAML lines by their line numbers, not screen lines.
- Many blocks name a term an earlier lesson already introduced, such as Deployment or replica. The card called every one a **New word**. Now only a term’s first block in catalogue order says **New word**; later blocks say **Word to remember**.
- A unit test checks that each block names at most one term, that every term is in the glossary, and that every glossary term is introduced by exactly one block. The existing tests already keep notes, card sentences, and practice text to 20 words a sentence.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (42 passing), `npm run build`, and `tests/site-shell.browser.mjs` (12 passing in Chrome).
- The final phase 1 CI run on commit `817f712` passed every test, including the existing usage and installation browser tests at `#build`. Its image scan found a new Dex advisory, which Charan accepted through 2026-12-11.

Every milestone pins the schemas its kinds need.

## Progress

**Phase 2, explanation rewrite (2026-11-18).** Rewrote every Learning note in `frontend/src/usage-values.ts` and every template and field description in `templates/*/usage.json` to the style rules. Labels are unchanged until the UI phase because browser tests and the lab guide refer to them. The in-cluster destination note now appears only for `https://kubernetes.default.svc`. The lab and Guestbook notes keep their required facts. `tests/usage-values.test.mjs` now fails if any note, template description, or field description exceeds 20 words. Verified with `npm test` (27 passing) and `npm run build` on Node 26.13.1. The browser tests were not run.

**Phase 3, brand and starting options (2026-11-18).**

- The page is titled **Kubernetes Made Simple**. A white header shows the Aviz Academy logo, the product name, and links to **Learn Kubernetes** and **Build a config**, with an orange bottom border. A navy footer links to avizacademy.com, the MIT License, and the source code.
- Brand colours are CSS custom properties in `frontend/src/style.css`, and the existing hard-coded colours now use them. Every new text and background pair meets WCAG AA, the lowest at 5.88:1.
- The favicon and touch icon are the cloud and arrows cropped from the shared logo, in `frontend/public/brand/`. **The crop needs Charan’s approval.**
- First-time visitors see the two starting options. The choice is remembered in browser storage, and the URL hash (`#home`, `#learn`, `#build`) selects a view directly. Drafts survive moving between views.
- **Learn Kubernetes** shows the lesson catalogue from `templates/kubernetes/lessons.json`: Levels 0 and 1 and Labs 1 and 2 are marked **Coming soon**. Levels 2 and 3 and Lab 3 are marked **Tested on K3s** and open the existing templates, Install the tool, or the lab guide. **Build a config** keeps the existing builder, also marked **Tested on K3s**.
- Existing browser tests now open `#build`, because the home page is the new default.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (30 passing, including `tests/lessons.test.mjs`), `npm run build`, and `tests/site-shell.browser.mjs` (2 passing in Chrome against the dev server). At 1366 × 900, the builder’s live YAML starts at 637 pixels, inside the layout test’s limit. Checked by eye at 800 × 600, 1366 × 900, and 375 × 812. The existing live-builder, workflow layout, and lab browser tests were not run because Docker and Go were unavailable to start the backend.

**Phase 4, block-at-a-time builder (2026-11-19).**

- Charan asked to start building after approving the class curriculum. The builder starts with the Pod and Deployment lessons, not the Prometheus Service, because they are now the first lessons and the spec already uses the Deployment as its worked example.
- Each lesson is a data file in `templates/kubernetes/lessons/`. Every block holds the whole file as it stands after that block, so authors can read each step as written. `frontend/src/lesson-builder.ts` works out which block added each line, places one comment above each block, and maps every line to its field path for hover notes. The glossary is `templates/kubernetes/glossary.json`.
- The Deployment has seven blocks, not the six in the example above: the selector and the Pod template are separate blocks, because together they add seven lines.
- `#learn/<lesson>` opens a lesson. The card shows the block, what it does, why it is there, what happens if it is removed, the one new word with its glossary definition, and a **Try changing** control (Deployment replicas). Before the file is ready, the card names the block that finishes it. **Back**, **Next block**, **Show whole file**, **Copy**, and **Download** work at every step and export exactly what is shown. **Show explanations** turns the one-comment-per-block lines on or off. Highlights show what the last action added or changed. The **Try it** panel appears once the file is ready to apply. Progress for each lesson survives moving between views.
- The catalogue in `templates/kubernetes/lessons.json` now follows the ten levels in section 4a. Pod and Deployment show **Start**. Argo CD and Prometheus sit in Level 9, still marked **Tested on K3s**.
- `backend/download-schemas.py` now pins the Pod schema, with checksums in `backend/schema-checksums.txt`.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (38 passing, including `tests/lesson-builder.test.mjs`), `npm run build`, `tests/site-shell.browser.mjs` (4 passing in Chrome, including the lesson walk-through and the phone layout), and `tests/lesson-manifests.check.mjs`, which runs strict kubeconform on every finished step and replica choice for 1.35, 1.36, and 1.37. CI runs the kubeconform check after preparing schemas. At 1366 × 900, the lesson buttons and the YAML are both visible on the longest block.
- **Not verified:** neither lesson has been applied to a cluster, because Docker was not running. The “not finished yet” claims for early blocks rely on API server rules that kubeconform does not check. The existing live-builder, workflow layout, and lab browser tests were not run, because Go and Docker were unavailable to start the backend.

**Level 1 lessons (2026-11-19).**

- All eight Level 1 lessons are built: Pod, ReplicaSet, Deployment, CPU and memory, Namespace, ConfigMap, Secret, and Job and CronJob. Each runs **Anywhere**.
- Lesson files can now hold several objects separated by `---`. Notes can be keyed by `Kind:path` when the same field means different things in different objects, for example `metadata.name` in a ConfigMap and in a Pod.
- Choices learners can try: replica count (ReplicaSet, Deployment) and CPU request (CPU and memory).
- The ReplicaSet uses the label `app: web-copies`, so it never manages the Deployment lesson’s `app: web` Pods. Each lesson uses its own object names, so learners can apply them side by side.
- The Secret lesson uses dummy values and explains that base64 is encoding, not encryption.
- The ReplicaSet and CronJob schemas are now pinned, with checksums.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (38 passing), `npm run build`, `tests/site-shell.browser.mjs` (5 passing in Chrome, including a two-object lesson), and `tests/lesson-manifests.check.mjs` (strict kubeconform for every finished step and choice on 1.35, 1.36, and 1.37). At 1366 × 900, the lesson buttons stay on screen on every block of every lesson.
- **Not verified:** no lesson has been applied to a cluster, because Docker was not running. The **Try it** results, such as the log output, come from the official docs and have not been observed.

**Jump link fix (2026-11-19).** The first CI run of the lesson work failed in `tests/workflow-layout.browser.mjs`. Since Phase 3, any address the router did not know, such as the narrow-screen jump link `#usage-preview`, sent the visitor to the home page. The lesson jump links had the same bug. In-page anchors now keep the current view, and `tests/site-shell.browser.mjs` clicks both lesson jump links on a phone-sized screen. The new test failed without the fix and passes with it.

**Level 0 plan (approved by Charan on 2026-11-19).**

- Both Level 0 lessons use the block-at-a-time lesson screen. No layout change.
- **0.1 Read a YAML file** builds `student.yaml`, an everyday file with no Kubernetes words, in four blocks: keys and values, nesting with two spaces, a list with dashes, and a list of nested items, the pattern of every `containers:` list. Every step is valid YAML, so there is no “not finished” state and no **Try it** commands. CI checks every step parses, using kubeconform’s YAML reader: a file without `kind` must fail only with `missing 'kind' key`.
- **See the mistake** is a new button on the nesting block. It shows a copy with `country` indented one space too far, highlights that line, and shows the message the YAML reader prints: `yaml: line 6: mapping values are not allowed in this context`. The copy has no block comments, so the line number matches. CI checks that kubeconform prints this exact message for the copy. **Show the fixed file** returns to the lesson. This is the first small piece of **Fix it**; the full Read it and Fix it practice is a separate step after Level 0.
- **0.2 Parts of every manifest** builds a corrected copy of the class file `01-pod.yaml` in four blocks: `apiVersion` and `kind`, `metadata`, `spec`, and `ports`. The last card explains that Kubernetes adds `status` itself after you apply. **Try it** shows the `status` Kubernetes adds, then `kubectl explain pod` and `kubectl explain pod.spec.containers`. The copy pins `nginx:1.30.4`, as the Pod lesson does, and indents list items by two spaces, as every lesson does.
- Sources: the [YAML 1.2.2 specification](https://yaml.org/spec/1.2.2/), [Objects in Kubernetes](https://kubernetes.io/docs/concepts/overview/working-with-objects/), and [kubectl explain](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_explain/).

**Level 0 lessons (2026-11-19).**

- Both Level 0 lessons are built and show **Start**. The glossary adds key, indentation, list, manifest, metadata, spec, and status.
- Lessons without a `kind` are checked as YAML only and have no **Try it** commands; the panel says nothing needs to run. Blocks can carry a `mistake`: the broken copy, the line, the YAML reader’s message, why it happens, and how to fix it. Copy and Download export the broken copy while it is shown.
- Claims checked with kubeconform 0.8.0’s YAML reader before writing them: one extra space before `country` gives the message above; moving `tool` left under the dash gives an error; list lines without dashes become one text value (`Linux Docker`), shown by a ConfigMap that accepts them as a string.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (39 passing, including a test that a mistake changes only the spaces on its named line), `npm run build`, `tests/lesson-manifests.check.mjs` (3 passing: strict kubeconform for 0.2 and Level 1, every 0.1 step parses, the exact mistake message), and `tests/site-shell.browser.mjs` (6 passing in Chrome, including the mistake view, its hover note, both downloads, and the reset on moving blocks). The two new kubeconform checks failed when the message’s line number and a list dash were changed on purpose.
- **Not verified:** CI installs kubeconform 0.7.0, and the exact message was checked only with 0.8.0 locally. Lesson 0.2 has not been applied to a cluster, so its **Try it** results come from the official docs.

**Phase 1 focus (2026-11-19).** Charan chose to build Learn Kubernetes end to end before returning to Build a config. The dashboard now opens into Learn Kubernetes, `#home` and the logo lead there, and the header has only the Learn Kubernetes link. The Level 9 tool items and Lab 3 are gone from the catalogue, along with the Learn page’s **Open** buttons and the `open` field. The README leads with Learn Kubernetes and marks Build a config and Install the tool as phase 2. Verified on Node 26.13.1: `npm run lint`, `npm test` (39 passing, including a check that no lesson or lab opens Build a config or is marked Tested on K3s), `npm run build`, `tests/lesson-manifests.check.mjs` (3 passing), and `tests/site-shell.browser.mjs` (6 passing, including that no link points to `#build` and that `#build` still opens when typed). The Build a config browser tests need the Go backend and run only in CI; they open `#build` directly and do not use the hidden links.

**Milestone 1, Practise and cluster checks (2026-11-19).**

- After the last block, **Practise: Read it and Fix it** opens the approved Practise step. All ten built lessons have three Read it questions and one Fix it mistake, stored as `practice` in each lesson file. Read it and Fix it show the finished file with default choices and no block comments. Copy and Download export what the pane shows. Learners can pick the wrong line by clicking it or from the **Wrong line** list.
- Fix it mistakes change only the words on one line, never its indentation. Sources: the YAML reader for 0.1 (missing colon), `kubectl apply` for 0.2, ReplicaSet, Deployment, CPU and memory, Namespace, and Jobs, and a follow-up command for Pod (`nginx:1.30.44` does not exist), ConfigMap, and Secret, where Kubernetes accepts the file and the container cannot start.
- The YAML reader reports a missing colon on the next line (line 13 for a mistake on line 12). Fix it explains this instead of hiding it.
- Every **Try it** step now has a `check` the cluster test can confirm. `tests/check-lessons-k3s.sh <version>` creates a fresh k3d cluster, applies the exact download of every Anywhere lesson, runs every Try it step, applies every Fix it copy, and deletes the cluster.
- K3s 1.37.2 runs `metrics-server` in `kube-system` by default, which Level 7 can rely on for local practice.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (40 passing, including the practice style rules), `npm run build`, `tests/lesson-manifests.check.mjs` (4 passing, including the YAML Fix it message), `tests/site-shell.browser.mjs` (7 passing in Chrome, including the full Practise flow and the phone layout), and `tests/check-lessons-k3s.sh` on fresh K3s 1.37.2, 1.36.6, and 1.35.10 (19 passing on each, on ARM64, in 225, 180, and 179 seconds). Levels 0 and 1 have now been applied to a cluster, and every **Try it** result was observed.
- **Not verified:** the cluster check does not run in CI, because CI has no K3s cluster. Client-side messages, such as the missing `apiVersion`, come from kubectl 1.36.1.

**Milestone 2, Level 2 lessons (2026-11-20).** The four Level 2 lessons are built, with Read it and Fix it. Verified on Node 26.13.1: `npm run lint`, `npm test`, `npm run build`, `tests/lesson-manifests.check.mjs`, `tests/site-shell.browser.mjs` (8 passing in Chrome), and `tests/check-lessons-k3s.sh` on fresh K3s 1.37.2, 1.36.6, and 1.35.10 (27 passing on each, on ARM64, in 370, 280, and 378 seconds).

**Milestones 4 and 5, Level 3 and 4 Anywhere lessons (2026-11-20).**

- All seven lessons are built, with Read it and Fix it, and show **Start**. The glossary adds headless Service, DaemonSet, Downward API, LimitRange, ResourceQuota, probe, rollout, PodDisruptionBudget, and drain.
- Claims checked on a scratch K3s 1.37.2 cluster before writing them: without `default`, a LimitRange gives containers its `max` as their limits. A PodDisruptionBudget without `maxUnavailable` or `minAvailable` allows 0 disruptions. A headless Service without ports still answers lookups with each Pod’s address.
- Try it items can repeat a command, such as checking the probe Pod before and after its probe fails.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (40 passing), `npm run build`, `tests/lesson-manifests.check.mjs` (4 passing, strict kubeconform with no skipped objects), `tests/site-shell.browser.mjs` (9 passing in Chrome, including the Level 3 and 4 Start links and a command-source Fix it), and `tests/check-lessons-k3s.sh` on fresh K3s 1.37.2, 1.36.6, and 1.35.10 (41 passing on each, on ARM64, in 490, 479, and 491 seconds). All 66 pinned schemas match their checksums.
- **Not verified:** the drain step was checked on a one-node cluster only, where the second eviction is always refused. On a cluster with several nodes, the drain can finish once the replacement Pod is ready elsewhere. The lesson text says so, but it waits for Level 5’s multi-node practice cluster to be observed.

**Milestones 6, 7, and 8, Level 5, 6, and 7 Anywhere lessons (2026-11-20).**

- All eight lessons are built, with Read it and Fix it, and show **Start**. The glossary adds node affinity, Pod anti-affinity, topology key, taint, toleration, rolling update, Recreate, blue-green, canary, HorizontalPodAutoscaler, and metrics-server.
- The first three-node run found that `kubectl describe` leaves out events when it describes several objects, as its `--show-events` help says. Node affinity and anti-affinity now read scheduling messages with `kubectl get events --field-selector reason=FailedScheduling`.
- Verified on Node 26.13.1: `npm run lint`, `npm test` (40 passing), `npm run build`, `tests/lesson-manifests.check.mjs` (4 passing), `tests/site-shell.browser.mjs` (10 passing in Chrome), and `tests/check-lessons-k3s.sh` on fresh K3s 1.37.2, 1.36.6, and 1.35.10 (51 one-node and 7 three-node checks passing on each, on ARM64, in 561, 736, and 701 seconds). All 69 pinned schemas match their checksums.

## Acceptance criteria

- [x] A first-time visitor lands on Learn Kubernetes and can start a lesson with one click. The two front doors return with Build a config in phase 2.
- [x] Each lesson step adds one block of at most 6 new YAML lines, highlights it, and shows its card.
- [x] Back, Next block, Show whole file, Copy, and Download work at every step and export exactly what is shown.
- [x] Every learner-facing note is at most 20 words and introduces at most one new term, which links to the glossary. A unit test enforces both.
- [x] Beginner downloads contain one comment per block and no command header. Build a config downloads are unchanged.
- [x] Every Level 1 manifest passes kubeconform for all three Kubernetes versions. EKS custom resources such as `IngressClassParams` use pinned schemas from an official AWS source.
- [x] Every Anywhere lesson deploys on fresh K3s, and every EKS only lesson deploys on the dedicated EKS Auto Mode test cluster.
- [x] Lab 1 runs end to end on fresh K3s in under 15 minutes, timed from cluster creation with the environment recorded.
- [x] Lab 2 runs end to end on a fresh EKS Auto Mode cluster in under 40 minutes. Its cleanup leaves no cluster, load balancer, or EBS volume, verified with AWS CLI commands.
- [x] Each lesson and lab shows its Anywhere or EKS only badge. **Tested on K3s** content returns with Build a config in phase 2.
- [x] Brand header, colours, favicon, and footer appear on desktop and narrow screens, and text meets WCAG AA contrast.
- [x] Existing usage and installation browser tests still pass, with only their start URL changed to `#build`.

## Changes to project rules

Charan approved each of these on 2026-11-18.

| Previous rule | Change | Decision |
| --- | --- | --- |
| Product Scope covers only Argo CD and Prometheus templates. Instruction 2: build only the Product Scope. | Adds Level 0 and Level 1 core Kubernetes lessons and a new lab. On 2026-11-19, widened to the ten-level class curriculum in section 4a. | Approved. |
| Instruction 9: main layout changes need Charan’s approval. | Adds a home screen with two doors and a lesson layout. | Approved. |
| Learning mode explains every usage YAML line inside the file (Decision Log, 2026-11-13). | Beginner downloads use one comment per block; line notes move to hover and cards. Build a config keeps per-line comments. | Approved. |
| Folder Structure lists `/templates/<tool>`. | Core lessons need a home, for example `/templates/kubernetes/`. | Approved: `/templates/kubernetes`. |
| No branding in AGENTS.md. | Adds Aviz Academy branding. | Approved and added to AGENTS.md. |

## Open questions

1. Is there a tagline to show?
2. Is there a brand font? Without one, keep the system font and use the logo for brand recognition.
3. Should the MIT licence copyright stay with Charan, or move to Aviz Academy?
4. Which AWS account, Region, and monthly budget should the dedicated EKS Auto Mode test cluster use? Nothing is created in AWS until Charan approves this.

## Answers

| Date | Question | Answer |
| --- | --- | --- |
| 2026-11-18 | Brand spelling | **Aviz Academy**. |
| 2026-11-18 | Logo | Shared as a transparent WebP and saved at `frontend/public/brand/aviz-academy-logo.webp`. Colours sampled from it above. |
| 2026-11-18 | Plan approval | Full plan approved, including core Kubernetes lessons. |
| 2026-11-18 | Product name | **Kubernetes Made Simple**. |
| 2026-11-18 | Footer link | [avizacademy.com](https://avizacademy.com). |
| 2026-11-18 | Logo formats | No SVG or white version. Work from the shared WebP. |
| 2026-11-18 | Platform focus | **Amazon EKS is the main focus**, targeting EKS Auto Mode. Lessons are written for EKS. Learners practise the portable lessons free on a local cluster, and an EKS lab covers the AWS-specific parts. |
| 2026-11-18 | Lesson components | Pod, Deployment, Service, Namespace, ConfigMap, Secret, LoadBalancer Service, Ingress, PersistentVolumeClaim on EBS, HorizontalPodAutoscaler, Job, CronJob, and ServiceAccount with Pod Identity. |
| 2026-11-18 | Existing K3s content | Keep Argo CD, Prometheus, Install the tool, and the first lab working as Level 2 and 3, labelled **Tested on K3s**, and move them to EKS later. |
| 2026-11-19 | Class curriculum | Approved the ten levels in section 4a, covering the class manifests from easy to hard, in place of the 12-lesson Level 1. |
| 2026-11-19 | Reading any manifest | Read it and Fix it practice in every lesson, plus Level 9 on unknown kinds. Explain my code stays on the roadmap. |
| 2026-11-19 | Argo Rollouts, Istio, VPA | Leave out. |
| 2026-11-20 | Lessons 35 and 37 | Remove Meet an unknown kind and the Final challenge. Phase 1 ends at Level 8. |
| 2026-11-19 | IRSA and Fargate | Leave out. Teach Pod Identity and Auto Mode only. |
| 2026-11-19 | Class folder | Fix the class manifests in place and replace real account details with dummy values. |
| 2026-11-19 | Next step | Start building. Phase 4 starts with the Pod and Deployment lessons. |
