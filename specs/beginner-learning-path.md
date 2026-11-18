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

Each phase gets its own spec section approval, small commits, tests, and a Chromium check, following the existing workflow.

1. **Decisions and brand assets.** Answer the open questions below. Record answers here and in the Decision Log.
2. **Explanation rewrite.** Apply the style rules to the six existing templates and their field help. No layout change. Test that every emitted line has a note and that every note meets the word limit.
3. **Brand and front doors.** Header, theme, footer, and the two-door home screen.
4. **Block-at-a-time builder.** Build it with the existing Service template first, since it is the shortest, then the Argo CD Application.
5. **Level 0 and Level 1 Anywhere lessons (1–8)** with Lab 1, verified on fresh K3s across 1.35, 1.36, and 1.37.
6. **Level 1 EKS-only lessons (9–12)** with Lab 2, verified on a dedicated EKS Auto Mode test cluster. Create the cluster only after Charan approves the account, Region, and budget, and delete it after each run.
7. **README and docs restructure.**
8. **Later:** move Level 2 and Level 3 Argo CD and Prometheus content to EKS.

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

## Acceptance criteria

- [ ] A first-time visitor sees the two front doors and can start a lesson with one click.
- [ ] Each lesson step adds one block of at most 6 new YAML lines, highlights it, and shows its card.
- [ ] Back, Next block, Show whole file, Copy, and Download work at every step and export exactly what is shown.
- [ ] Every learner-facing note is at most 20 words and introduces at most one new term, which links to the glossary. A unit test enforces both.
- [ ] Beginner downloads contain one comment per block and no command header. Build a config downloads are unchanged.
- [ ] Every Level 1 manifest passes kubeconform for all three Kubernetes versions. EKS custom resources such as `IngressClassParams` use pinned schemas from an official AWS source.
- [ ] Every Anywhere lesson deploys on fresh K3s, and every lesson deploys on the dedicated EKS Auto Mode test cluster.
- [ ] Lab 1 runs end to end on fresh K3s in under 15 minutes, timed from cluster creation with the environment recorded.
- [ ] Lab 2 runs end to end on a fresh EKS Auto Mode cluster in under 40 minutes. Its cleanup leaves no cluster, load balancer, or EBS volume, verified with AWS CLI commands.
- [ ] Each lesson shows its Anywhere or EKS only badge, and Level 2 and 3 content shows **Tested on K3s**.
- [x] Brand header, colours, favicon, and footer appear on desktop and narrow screens, and text meets WCAG AA contrast.
- [ ] Existing usage and installation browser tests still pass, with only their start URL changed to `#build`.

## Changes to project rules

Charan approved each of these on 2026-11-18.

| Previous rule | Change | Decision |
| --- | --- | --- |
| Product Scope covers only Argo CD and Prometheus templates. Instruction 2: build only the Product Scope. | Adds Level 0 and Level 1 core Kubernetes lessons and a new lab. | Approved. |
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
