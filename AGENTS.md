# Learning Kubernetes made easy - Aviz Academy

## Overview

A dashboard that teaches Kubernetes to freshers and entry-level engineers. Each lesson builds a real manifest one block at a time, explains every block in plain English, and gives commands to run it on a cluster.

The dashboard is called **Learning Kubernetes made easy** and carries the **Aviz Academy** brand. Its full title is **Learning Kubernetes made easy - Aviz Academy**. Its main target platform is **Amazon EKS with Auto Mode**. See the [beginner learning path](specs/beginner-learning-path.md).

## Problem

Kubernetes is hard to start with. Beginners jump between official docs, miss indentation, hit errors they cannot read, and often do not understand why a manifest is written the way it is.

## Target Users

Freshers, entry-level engineers, and Aviz Academy students who want to write, read, and fix Kubernetes manifests.

## Core Features

**Block-at-a-time lessons.** Each step adds one small block to a real manifest. A card says what the block does, why it is there, and what happens without it. New lines are highlighted, and hovering over a line shows a plain English note.

**Practice.** Every lesson ends with **Read it** questions and a **Fix it** mistake. Every error message comes from kubeconform, K3s, or EKS.

**Try it.** Commands to run each finished file on a free local K3s cluster or on EKS Auto Mode, with what success looks like.

**Labs.** Lab 1 runs an app on a laptop for free. Lab 2 runs the same app on EKS Auto Mode and deletes everything afterwards. Each lab opens with a lesson on its files.

**Set up your laptop.** The first item in the lesson list. It says what the laptop needs, installs the tools, and points kubectl at the free practice cluster. One check command unlocks each lab when its tools pass.

**Copy and download.** Every step can be copied or downloaded, with one comment per block.

## Product Scope

Local app. Amazon EKS with Auto Mode is the main target, with Kubernetes 1.37, 1.36, and 1.35. Learners practise portable lessons free on a local K3s cluster created with k3d. Build, validate, and export without a live cluster. Run server-side dry run and deployment checks against a dedicated local K3s test cluster, and EKS-only checks against a dedicated EKS Auto Mode test cluster.

Build the approved [beginner learning path](specs/beginner-learning-path.md): the block-at-a-time builder, plain-English explanation rules, the class curriculum, Levels 0 to 8, from YAML basics to autoscaling and AWS access, with Build it, Read it, and Fix it practice in every lesson (Pod, ReplicaSet, Deployment, resources, Namespace, ConfigMap, Secret, Job and CronJob, every Service type, DNS, Ingress, EBS and EFS storage, StatefulSet, DaemonSet, LimitRange, ResourceQuota, probes, timing, PodDisruptionBudget, affinity, taints, Auto Mode NodePool, rollout strategies, HorizontalPodAutoscaler, and Pod Identity), a free local lab and an EKS Auto Mode lab, a simple README, and Aviz Academy branding. Lesson downloads use one comment per block.

Also build the [setup check](specs/setup-check.md), which unlocks each lab's hands-on part once the learner's tools pass, the [lab lessons](specs/lab-lessons.md), which open each lab in the dashboard with a walk-through of its files, and the beginner [start guide](docs/getting-started.html).

The lessons and labs shipped as [v1.0.0](https://github.com/avizway1/learning-kubernetes-made-easy/releases/tag/v1.0.0) on 2026-11-26. The same day, Charan renamed the project **Learning Kubernetes made easy - Aviz Academy** and limited this repository to the lessons, labs, setup check, and start guide. They shipped under the new name as [v1.1.0](https://github.com/avizway1/learning-kubernetes-made-easy/releases/tag/v1.1.0) on 2026-11-27.

## Roadmap

No roadmap items are approved yet. New lessons, levels, or labs start as specs that Charan approves.

## Development Approach

Spec driven development. Every feature starts as a written spec with clear inputs, outputs, and acceptance criteria before any code is written.

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React with TypeScript, built with Vite on Node.js 26.13.1 LTS | Widely supported, strong for live UIs |
| Code editor | Monaco (the VS Code editor) | Built in line highlighting and hover notes |
| Backend | Go 1.27.4 | Serves the built dashboard from a small image with no other runtime |
| Validation | kubeconform with pinned schemas, server side dry run | Catches schema and cluster errors before learners see them |
| Test cluster | K3s, run locally, plus a dedicated EKS Auto Mode cluster for EKS-only lessons | K3s is free and close to real Kubernetes. EKS checks the AWS-specific features learners depend on. Create the EKS cluster only with Charan’s approval and delete it after each run. |
| CI | GitHub Actions | Runs build, tests, and security scans on every change |

## Folder Structure

```
/frontend          React app: lesson screen, Monaco editor, labs, setup page
  /public/brand    Aviz Academy logo and brand assets
/backend           Go server for the built dashboard, and the pinned schema download
  /eks-crds        NodePool and IngressClassParams CRDs exported from EKS Auto Mode, for strict schemas
/templates         Lesson and lab data
  /kubernetes      Core Kubernetes lessons built one block at a time
    /labs          YAML files the lab guides download, and each lab’s lesson
/specs             One spec file per feature, written before code
/tests             Unit and browser tests, plus deploy tests against K3s and EKS
/docs              User and contributor guides, including the lab guides
  /releases        Release notes, one file per version
```

## Acceptance Criteria

Each spec holds its own acceptance criteria: the [beginner learning path](specs/beginner-learning-path.md#acceptance-criteria), the [setup check](specs/setup-check.md), the [lab lessons](specs/lab-lessons.md), and [prebuilt Docker releases](specs/prebuilt-docker-release.md).

**Security**

- [x] Our own dependencies have no high or critical issues, except unfixed development-only npm findings accepted with a review date.
- [x] Lesson and lab files use secure defaults, such as no privileged containers.

## Phases

**Plan.** Write specs, define scope, choose the tech stack.

**Develop.** Build features against the specs.

**Build.** Package the app and lessons, set up CI.

**Test.** Check that lessons and labs run cleanly on K3s and EKS and match the specs.

**Security review.** Threat modelling, dependency scanning, and checks that lesson files follow secure defaults.

**Deploy.** Release, gather feedback, then plan the next lessons.

## Open Questions

Hosting remains an open question. Where should a hosted dashboard run, and who should be able to access it?

## Instructions for the Coding Agent

1. Read this whole file before writing any code.
2. Build only the Product Scope. Do not start roadmap items.
3. For each feature, write a spec in /specs first, then the code, then tests.
4. Follow the Folder Structure and Tech Stack exactly. Ask before changing either.
5. Take every lesson field and explanation from the official Kubernetes or AWS docs. Never invent fields.
6. Explain why each setting is present using official sources. Use placeholders for account values and dummy values for secrets.
7. After each feature, run lint, kubeconform, and a deploy test on K3s, or on the dedicated EKS Auto Mode test cluster for EKS-only lessons, and tick the matching Acceptance Criteria.
8. Keep commits small, with clear messages, so progress can be reviewed.
9. Get Charan’s approval before changing the main layout.
10. If anything is unclear, stop and ask Charan, the product owner, rather than guess. Record each answer in the relevant spec so this document stays up to date.

## Keeping Decisions in Sync

This file and /specs are the single source of truth. Chat instructions never override them silently.

1. When Charan gives a new instruction in chat, first check it against this file and the specs.
2. If it conflicts with anything, point out the conflict and confirm which one wins before coding.
3. Once confirmed, update this file and the affected specs first, then change the code.
4. Add an entry to the Decision Log below for every change.
5. At the start of every session, read this entire file, including Lessons Learned and the Decision Log, before doing any project work.
6. Whenever Charan corrects a mistake, add an entry to Lessons Learned in the same turn. Record the date, what went wrong, why it happened, and the rule that prevents it. Update the plan, relevant specs, or Decision Log when the lesson changes them.

## Lessons Learned

Dates refer to when the correction was made. The Decision Log records the resulting product and implementation decisions.

| Date | What went wrong | Why | Rule that prevents it |
| --- | --- | --- | --- |
| 2026-11-11 | Initial checks ran on Node.js 26.12.1 even though the approved project version was 26.13.1. | The version file declared the pin while the commands used the Node executable already on PATH. | Check the executable version before running tests or builds. Keep the exact version enforced and document how to activate it locally. |
| 2026-11-11 | I connected the remote without committing or pushing, and omitted the reason. | I read the repository URL as authorization to connect it and left that interpretation implicit. | State exactly what was done and what remains local. When publishing is requested, commit, push, verify the remote state, and name any blocker and the action needed to clear it. |
| 2026-11-11 | GitHub rejected the first push because the three commits used a private email address. | The commits inherited an author email incompatible with GitHub’s privacy settings. | Check the repository-local identity before committing for publication. Use Charan’s approved GitHub noreply address for author and committer. |
| 2026-11-11 | Feature tests were omitted from the initial implementation, and I did not call out the gap. | I verified selection, type checking, and the build while the acceptance criteria required feature-level tests. | Add regression tests for feature acceptance criteria to the normal test command. State which checks are pending and leave their criteria unchecked. |
| 2026-11-11 | Tests silently skipped missing fixtures, and downloaded files were loaded without verifying their hashes. | Tests treated absent fixtures as routine and trusted a filename and version as proof of contents. | Fail by default on missing or corrupt fixtures. Offer an explicit local skip flag. Verify downloads against committed SHA-256 pins before use, and document the verified download command. |
| 2026-11-11 | A pinned image stalled on ARM64 because its tag had no ARM64 image. | Schema validation and server-side dry run could not detect an architecture mismatch in the image registry. | Inspect the official image index and verify rollout readiness on the target architecture. Get approval before changing image pins and record the evidence for any override. |
| 2026-11-11 | The schema downloader still used a mutable catalog branch, and repository documentation and acceptance records lagged behind the implementation. | Other pins were locked first while schema provenance, the README, and the checklist were treated as follow-up work. | Pin schema inputs to commits, maintain setup instructions and the Decision Log alongside the code, and tick only verified criteria. Check CI for the exact full commit SHA before reporting its result. |
| 2026-11-11 | Browser checks existed only as ad hoc commands, and hover coverage was partial. | Browser evidence was gathered manually and field explanations covered selected lines before the full manifest was tested. | Commit repeatable browser tests and run them in CI. Test every rendered field for hover coverage and verify real preview latency and interactions in Chromium. |
| 2026-11-12 | A downloaded file omitted its namespace, so a fresh cluster could not apply it directly. | Earlier deployment checks supplied the namespace separately and masked the missing resource. | Apply the exact downloaded YAML to a fresh cluster without precreating its namespace. Test that the namespace appears before dependent resources. |
| 2026-11-12 | Downloads described fields without consistently explaining why they were present. | Review emphasized valid rendering and field definitions while the learning goal was not checked against the actual downloads. | Review the files a user receives. Use one path for preview, copy, and download. Explain why meaningful values are chosen using official sources, and test the download headers and explanations. |
| 2026-11-12 | I kept implementation decisions but did not record the mistakes Charan corrected as reusable lessons. | The workflow required a Decision Log and had no place to preserve causes and prevention rules. | Record each correction in Lessons Learned in the same turn. Reread the section and Decision Log at the start of every session and update affected project guidance. |
| 2026-11-12 | I wrote one export lesson as a permanent rule for the main interface. | I turned feedback about the length and quality of one export into a default for the main interface. | Do not change the main layout without asking Charan first. |
| 2026-11-12 | Charan received YAML without its explanations. | Preview and export used separate paths, and browser checks covered only one download. | Use one path for preview, clipboard, and file download. Assert the exact clipboard and downloaded contents in browser tests. |
| 2026-11-12 | Hover notes described API object types as CPU and memory settings, and downloads repeated long schema descriptions. | Explanations matched leaf names and traversed every list entry with a schema fallback. | Match overloaded fields by kind and parent path. Test downloads for wrong wording and duplicate comments. |
| 2026-11-12 | Downloaded YAML omitted probe and mount explanations after the first container and used plural wording for a single replica. | Deduplication used the whole resource and replica text assumed a plural count. | Verify comments on each container block and test both replica counts. |
| 2026-11-13 | A release was tagged before the final review was confirmed, so later fixes missed it. | The tag was cut before the review cycle was closed. | Only tag a release after Charan confirms the final review. |
| 2026-11-13 | The first Docker build took over 47 minutes on Charan’s Mac. | First-run instructions compiled a tool locally and verification focused on CI rather than a tester’s cold start. | Test the first-run experience as a new user would. Time the documented command with a fresh cache and report the environment and time to readiness. |
| 2026-11-14 | Validation stayed green for an invalid resource name and a Service port of 99999. | Schema checks covered document structure while some API field rules and runtime requirements went unchecked. | Check Kubernetes rules beyond the schema on a real API server, and name the checks that ran and the conditions that still need a live cluster. |
| 2026-11-14 | Testers downloaded a valid file and left to find out where to run it and what success looked like. | Verification ended at the generated artifact and instructions were split between the UI and README. | Verify the first workflow from the README through an observable result. Give each lesson and lab its prerequisites, exact command, and success check. |
| 2026-11-14 | Two examples that looked related reused the same names, but one’s Service did not select the other’s workload. | The examples were tested separately using different fixtures. | Run examples that look related together on a fresh cluster. Verify that selectors, ports, paths, and names connect across the actual downloads. |
| 2026-11-14 | A port-forward command reused the dashboard’s local port 8080. | The access instructions were checked separately from the Docker startup instructions. | Test documented access commands with the dashboard still running and check every guide for the same ports and URLs. |
| 2026-11-14 | Switching views could erase work in progress. | Form state reset when a view remounted, and navigation tests checked destinations without checking the work on return. | Keep each learner’s progress while they explore and test round trips between views. |
| 2026-11-14 | The live YAML was below the form at ordinary desktop sizes. | Browser tests could scroll to the output and did not check whether the feedback was visible while editing. | Verify that users can see a control and its live effect in the same desktop viewport. Give narrow screens a direct jump between them and get Charan’s approval before changing the main layout. |
| 2026-11-15 | Test servers were left running in foreground tool sessions, including `npm run dev`. | The commands start a server and keep running indefinitely, but the test setup had no explicit lifetime. | Never run a long-lived server in the foreground. Start it in the background with a timeout, capture its logs and PID, and stop it when its test ends. |
| 2026-11-16 | The README linked a lab and then offered a quick start for a release that did not have it. | The README placed the instructions for an unreleased feature beside the released Docker path without identifying which build had the feature. | At the first mention of an unreleased feature, say which build readers need and point them to the right startup path. |
| 2026-11-19 | The dashboard footer, lab links, and README still pointed to the old repository after the project moved to avizway1. | I copied existing repository URLs into new code without checking them against the current `origin` remote. | Check repository links against `git remote get-url origin` whenever links are added or the remote changes. Keep a link to another repository only for an artifact that exists only there, and say why. |
| 2026-11-19 | After the Docker rebuild, the browser kept showing the old dashboard at localhost:8080. The first rebuild also stopped with “cannot allocate memory” while Docker had 4 GB. | The server sent no Cache-Control header, so browsers reused the cached `index.html`. Docker memory was checked only after the build failed. | Send `Cache-Control: no-cache` for the page and long-lived caching only for hashed files under `/assets/`. Check Docker memory before a source build and verify the result in a browser that already visited the old version. |
| 2026-11-19 | Charan’s colleagues could not tell where or how to start, and some had never used Docker. | The README assumed readers already had Docker, Git, and a terminal, and started at the build command. | Keep a beginner start guide that begins from a laptop with nothing installed, covers macOS, Windows, and Linux, and states what success looks like after each step. Update it whenever the start commands or requirements change. |
| 2026-11-27 | The setup check passed on Charan’s laptop, but the first Try it command did not reach K3s. | The setup page stopped at the tools. Only the start guide’s optional step created the practice cluster, and nothing said which cluster kubectl uses. Every cluster test used a fresh kubeconfig of its own, which hid a learner’s existing contexts. | Test the learner’s steps against a kubeconfig that already holds other clusters and no current context. Every page that runs kubectl names the context it expects and how to switch to it. |

## Decision Log

| Date | Decision | Replaces | Affects |
| --- | --- | --- | --- |
| 2026-11-11 | Offer the K3s stable channel’s Kubernetes minor and the two preceding minors. Initial baseline is 1.37, 1.36, 1.35. | Unspecified Kubernetes versions | Lessons, validation |
| 2026-11-11 | Ship a local app first. Build, validate, and export without a live cluster. Use a dedicated local K3s test cluster for server-side dry run and deployment checks. | Open hosting and cluster access questions | Scope, validation |
| 2026-11-11 | Keep the documented stack and use Vite with [Node.js 26.13.1 LTS](https://nodejs.org/en/blog/release/v26.13.1) and [Go 1.27.4](https://go.dev/doc/devel/release#go1.27.4). | Unspecified build tool and runtime versions | Tech stack |
| 2026-11-11 | Verified Kubernetes minors and runtime pins against official sources. [K3s stable channel](https://raw.githubusercontent.com/k3s-io/k3s/main/channel.yaml), [K3s releases](https://github.com/k3s-io/k3s/releases), [Go 1.27.4](https://go.dev/doc/devel/release#go1.27.4), [Node.js 26.13.1 LTS](https://nodejs.org/uk/blog/release/v26.13.1). | Planning verification | Toolchain |
| 2026-11-11 | Pin Node.js 26.13.1 in root and frontend version files and enforce the exact version during dependency installation. | Frontend-only version file and semver range | Local development |
| 2026-11-11 | Pin the [schema catalog](https://github.com/yannh/kubernetes-json-schema/commit/9e1cd3c3b22e6432cbc5615a5a930f8268f14bf1) to a commit. | Mutable schema catalog branch | Offline validation, CI |
| 2026-11-11 | Run deployment checks in isolated k3d clusters for K3s 1.35.10, 1.36.6, and 1.37.2 using project-local kubeconfigs. | Single-minor live checks | K3s tests |
| 2026-11-11 | Fail CI on high or critical vulnerabilities from npm audit and Trivy. Report findings before changing any pins. | Manual security review without CI gates | Security review, CI |
| 2026-11-11 | Pin transitive DOMPurify to 3.4.17 for [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7) and [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr). High and critical application dependency findings always fail CI. | DOMPurify 3.4.15 | npm, CI |
| 2026-11-11 | Run the committed browser tests in CI. | Manual browser checks | Tests, CI |
| 2026-11-12 | Package the dashboard as a local Docker Compose release with verified schemas. Reopen the hosting decision. | Developer-tool setup as the only local run path | Deploy, README, CI |
| 2026-11-12 | Scan the completed Docker image in CI. | Unscanned release image | Deploy, security review |
| 2026-11-12 | Record every mistake Charan corrects in Lessons Learned and read it at the start of every session. Update any affected plan, spec, or decision alongside the lesson. License the project under MIT with Charan as copyright holder. | Decision-only history and unspecified repository license | Project workflow, README, licensing |
| 2026-11-13 | Publish verified AMD64 and ARM64 images to GHCR for each release. Use pull-based Compose for learners and keep an explicit source-build option. | Tester-side Docker compilation | Docker distribution, release CI, README |
| 2026-11-15 | Give each fresh lab run an overall timeout, and record the failing step and diagnostic before retrying. | Unbounded foreground test servers and informal lab timing | Tests, labs |
| 2026-11-16 | Document official k3d and kubectl installation paths for macOS, Windows, and Linux, with version and Docker connection checks before creating a cluster. Use WSL 2 Bash for the Windows walkthrough. | Assuming the lab commands were already installed and usable in the reader’s shell | Labs, setup guide |
| 2026-11-18 | Charan approved the [beginner learning path](specs/beginner-learning-path.md) in full: the block-at-a-time lesson layout, plain-English explanation rules, Level 0 and Level 1 core Kubernetes lessons in `/templates/kubernetes`, the Hello Kubernetes first lab, one comment per block in downloads, and Aviz Academy branding from the shared logo. | No lessons for beginners and an unbranded dashboard | Product scope, layout, explanations, templates, labs, README, branding |
| 2026-11-18 | Link the footer to [avizacademy.com](https://avizacademy.com). Make Amazon EKS with Auto Mode the main platform for learning content. Write lessons for EKS, mark each lesson Anywhere or EKS only, keep free local practice on K3s, and add an EKS lab with cost and cleanup steps. Cover twelve Level 1 lessons, including LoadBalancer, Ingress, EBS storage, HorizontalPodAutoscaler, Jobs, and Pod Identity. EKS 1.35–1.37 are in [standard support](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html). | K3s-only scope, five core lessons, and one free lab | Product scope, curriculum, labs, testing, branding |
| 2026-11-18 | Accept [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) in picomatch 4.0.7, which Vite 8.3.5 uses, as a development-only risk until 2026-12-02. Every release through 4.0.7, the latest, is affected, and the upstream fixes ([#261](https://github.com/micromatch/picomatch/pull/261), [#262](https://github.com/micromatch/picomatch/pull/262), [#269](https://github.com/micromatch/picomatch/pull/269), [#272](https://github.com/micromatch/picomatch/pull/272)) are unmerged. picomatch matches only glob patterns written in this project and is not in the Docker image. CI checks npm advisories against `security/accepted-dependency-risks.json` and fails on any other high or critical finding, after the review date, if the package becomes a runtime dependency, or when a newer release appears. Rejected options: pinning an unmerged fix, downgrading Vite to 6.2.7, or leaving CI failing. | High and critical application dependency findings always fail CI | Security review, CI, acceptance criteria |
| 2026-11-19 | Charan approved the [class curriculum](specs/beginner-learning-path.md#3-the-class-curriculum), built from the Aviz Academy EKS class manifests, easy to hard. Every lesson has Build it, Read it, and Fix it practice. Lessons use corrected copies of the class files with placeholder account values. Leave out IRSA, Fargate, Argo Rollouts, Istio, and the VerticalPodAutoscaler. | Twelve Level 1 lessons | Product scope, curriculum, templates, tests |
| 2026-11-19 | Build the block-at-a-time builder with the Pod and Deployment lessons first. Store each lesson in `/templates/kubernetes/lessons` as the whole file after each block, at most six new lines per block, with one comment per block, hover notes for every field, and a glossary. Split the Deployment’s selector and Pod template into separate blocks. Pin the Pod schema and check every finished lesson step with strict kubeconform in CI. | The six-block Deployment example | Learn Kubernetes, templates, schemas, tests, CI |
| 2026-11-19 | The project moved to Charan’s avizway1 GitHub account. Point app links, lab links, the CI badge, and the Go module path there. Make building from source the main Docker path. Pushes here do not start CI, so start CI manually after each push. | Links to the earlier repository | App links, README, templates, Docker, CI |
| 2026-11-19 | Serve hashed frontend files under `/assets/` with a one-year immutable cache and every other web file, including `index.html`, with `Cache-Control: no-cache`. State the 8 GB Docker memory requirement next to the source build command in the README. | Default Go file server caching and an unstated memory requirement | Backend, Docker, README |
| 2026-11-19 | Build Level 0 with the lesson screen. Lesson 0.1 builds an everyday `student.yaml` in four blocks, with a **See the mistake** button showing an over-indented line and the YAML reader’s real error. Lesson 0.2 builds a corrected copy of the class `01-pod.yaml` and shows `status` and `kubectl explain` in Try it. Check every 0.1 step and the mistake message with kubeconform’s YAML reader in CI. Full Read it and Fix it practice follows Level 0 as its own step. | Level 0 marked Coming soon | Learn Kubernetes, templates, lesson card, tests, CI |
| 2026-11-19 | Add a beginner start guide as `docs/getting-started.html`, linked from the README, after Charan’s colleagues could not tell where to start. It covers installing Docker and Git, giving Docker 8 GB, building and opening the dashboard, an optional k3d practice cluster, everyday commands, and common errors, for macOS, Windows, and Linux. Install steps follow the official Docker, Git, Microsoft, Kubernetes, and k3d docs. Keep it in step with the README’s start commands. | README-only setup instructions | Docs, README |
| 2026-11-19 | Charan approved the [milestones](specs/beginner-learning-path.md#milestones-approved-by-charan-on-2026-11-19): practice and cluster checks first, then the Anywhere levels with Lab 1 after Level 2, then the EKS only lessons and Lab 2, then the docs restructure. The Practise step needs a mock-up approved before it is built. | Delivering levels in curriculum order without a milestone plan | Learn Kubernetes, tests, labs, docs |
| 2026-11-19 | Charan approved the [Practise step](specs/beginner-learning-path.md#milestone-1-the-practise-step-layout-approved-by-charan-on-2026-11-19) layout from the Deployment mock-up: Read it and Fix it tabs after the last block, questions with three answers, a broken copy whose wrong line the learner picks, and only messages checked with kubeconform or on K3s. | Read it and Fix it described without a screen design | Learn Kubernetes, lesson data, tests |
| 2026-11-20 | Build the four Level 2 Anywhere lessons: ClusterIP, DNS, NodePort, and ExternalName. A lesson can name earlier lessons it `uses`, and its Try it applies their downloads first, so Services reuse the Deployment lesson’s Pods instead of rebuilding them. Reuse `nginx:1.30.4` and `busybox:1.37.0`; leave out the class DNS file’s unpinned images. | Self-contained lesson files only | Learn Kubernetes, lesson data, cluster check |
| 2026-11-20 | Build the seven Level 3 and 4 Anywhere lessons before Lab 1, at Charan’s request: headless Service, DaemonSet, LimitRange, ResourceQuota, probes, timing, and PodDisruptionBudget. Rename lesson 16 “Reach every Pod directly”, because only StatefulSet Pods get a DNS name each. A lesson may apply a used file after its own, as the LimitRange and ResourceQuota lessons do in their new namespaces. Pin the LimitRange, ResourceQuota, and PodDisruptionBudget schemas. | Lab 1 as milestone 3, and a used file applied only before the lesson’s own | Learn Kubernetes, lesson data, schemas, cluster check, milestone order |
| 2026-11-20 | Skip CI after each push until the last milestone, then run it once as the final step. Run lint, unit, kubeconform, browser, and K3s checks locally for each milestone. The CI run for commit `e186ed7` was cancelled before it finished. | Starting CI manually after each push, and a CI run for each milestone | CI, milestones |
| 2026-11-20 | Build the eight Level 5, 6, and 7 Anywhere lessons: node affinity, Pod anti-affinity, taints, rolling update, Recreate, blue-green, canary, and HorizontalPodAutoscaler. Lessons with `nodes: 3` show the `k3d node create` command that adds two workers to the practice cluster, and the cluster check runs them after adding two agents. Setup commands that apply no file may come before the lesson’s own file. The canary Fix it uses the class file’s 0-replica stable mistake. Pin the HorizontalPodAutoscaler schema. | One-node practice cluster for every lesson, and only used-file applies before the lesson’s own file | Learn Kubernetes, lesson data, schemas, cluster check, start guide |
| 2026-11-20 | Remove lesson 35, Meet an unknown kind, and lesson 37, Final challenge. The curriculum ends at Level 8, and Level 9 leaves the catalogue. | Level 9 on unknown kinds and a final challenge | Product scope, curriculum, Learn catalogue, tests |
| 2026-11-20 | Write the seven EKS only lessons now and check them on a dedicated EKS Auto Mode cluster afterwards, with `tests/check-lessons-eks.sh`. Capture API server Fix it messages on K3s 1.37.2 and the NodePool message with the official Karpenter v1.15.2 CRD. Skip `NodePool` and `IngressClassParams` in kubeconform until the EKS run exports both CRDs from the Auto Mode cluster. EKS lessons reuse nginx and busybox, so no new image needs approval. | EKS lessons written only after an approved EKS account | Learn Kubernetes, lesson data, schemas, tests |
| 2026-11-20 | Charan approved the first EKS test run: the `default` AWS profile’s account, ap-south-1, Kubernetes 1.37, and spending only from the account’s Free plan credits ($60 remaining). Create a dedicated lessons cluster with eksctl and Auto Mode, tag everything with the project tag, and delete the cluster, EFS file system, and roles at the end of the run. On the Free plan, Auto Mode can launch only c7i-flex.large and m7i-flex.large. It excludes nano, micro, and small sizes, and the [Free plan](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html) allows only [these eligible types](https://docs.aws.amazon.com/eks/latest/userguide/automode-learn-instances.html). | EKS run pending account, Region, budget, and version | EKS lessons, tests, AWS |
| 2026-11-20 | Make lesson 28 Free plan friendly. The NodePool `flex` allows only c7i-flex.large and m7i-flex.large, On-Demand, so the lesson works on AWS Free plan and paid accounts. Notes say paid accounts can add Spot. | Graviton (arm64) and Spot NodePool `arm-spot` | Lesson 28, spec |
| 2026-11-20 | The EKS run passed all seven EKS only lessons on Auto Mode 1.37. Keep the exported NodePool and IngressClassParams CRDs in `backend/eks-crds` and build their strict schemas in `backend/download-schemas.py`, with pinned checksums. Refresh them from a new EKS run when Auto Mode changes either kind. Lesson 34 waits a minute for its association. Lesson 13’s Fix it reads the scheme from AWS. The cluster check cleans up after a failed lesson. | Skipping both kinds in kubeconform, and an `internal-` hostname check | Backend schemas, Dockerfile, lessons 13 and 34, tests |
| 2026-11-25 | Charan asked to finish the remaining milestones and gave standing approval to create and delete the AWS resources the checks need, in the approved account and Region, on the Free plan credits. Every run still deletes what it creates and lists anything left. Charan approved `nginxinc/nginx-unprivileged:1.30.4` pinned to index `sha256:a5866218f05961c7651a4a4a18d9bd0e5e5b4b26aafffb334df3423948db3560` as the lab sample image. It is published by the NGINX Docker maintainers, runs as user 101 on port 8080, and was verified for linux/amd64 and linux/arm64. | Approval per EKS run, and no approved lab image | AWS checks, labs |
| 2026-11-25 | Build Lab 1 and Lab 2 as Markdown guides in `docs`, linked from the catalogue’s **Open guide**, with their YAML in `templates/kubernetes/labs`. Lab 1 runs one file with a Namespace, ConfigMap, Secret, Deployment, and Service: the page needs a login from the Secret and names the Pod that served it. Lab 2 runs that file unchanged on EKS Auto Mode, then adds an ALB Ingress, an EBS claim, and a Pod Identity role in a second file. `tests/lab-guide.check.mjs` runs each guide’s own commands in one shell, with hidden `do` and `check` steps, and a unit test keeps each guide’s YAML equal to the lab files. | Labs marked Coming soon | Labs, docs, tests |
| 2026-11-25 | Restructure the docs. The README leads with starting the dashboard, the levels, and the labs. Running from source, tests, and security checks move to `docs/contributing.md`, and release notes to `docs/releases`. The README heading is **Start learning**, not “Start learning in 2 minutes”, because the first source build takes longer. The EKS lesson cluster setup and teardown move from `.runtime` into `tests/eks-lessons-cluster.sh`. | README with every guide in one page, and EKS setup scripts kept outside the repository | README, docs, tests |
| 2026-11-25 | Lab 1 passed on fresh K3s 1.37.2 in 49 seconds of machine time. Lab 2 passed on EKS Auto Mode 1.37 in ap-south-1 in 1,319 seconds, from cluster creation to deletion, and left nothing behind. Check clean-up by asking each AWS service directly. The Resource Groups Tagging API keeps listing deleted instances, volumes, and network interfaces for a while. The EKS only lessons passed again on a fresh cluster created by `tests/eks-lessons-cluster.sh`, and the exported CRDs match `backend/eks-crds`. | Tagging API clean-up check | Labs, EKS checks |
| 2026-11-26 | Close the remaining lesson criteria with tests. A browser test steps through every block of every lesson and checks the card and the highlighted lines. A unit test checks that each block names at most one glossary term and that each term is introduced once. The card says **New word** only at a term’s first block in catalogue order and **Word to remember** after that. | Block size, highlight, and term rules checked only in part, and every term labelled New word | Learn Kubernetes, lesson card, tests |
| 2026-11-26 | Charan approved three new folders: `backend/eks-crds` for the CRDs exported from EKS Auto Mode, `templates/kubernetes/labs` for the lab YAML files, and `docs/releases` for release notes. | Folder structure without these folders | Folder structure |
| 2026-11-26 | After the milestones, build [Set up your laptop](specs/setup-check.md) and [lab lessons](specs/lab-lessons.md). Learners paste the output of one check command, and each lab's **Do it on your laptop** part unlocks when its own tools pass. Lessons and each lab's **Understand the files** part stay open. Each lab opens in the dashboard, with one recap step per object, an exception to the six-line block rule, then the guide's steps read from the same Markdown file the lab test runs. Windows labs run in WSL 2 throughout, including the start guide's practice cluster. No terminal inside the dashboard: it would need the laptop's Docker socket. AWS CloudShell and Killercoda are set aside for now. Charan approved the mock-ups the same day, with lab lesson files stored beside the lab YAML. | Lab guides opened on GitHub, with tools checked by hand, and the start guide installing Windows tools in PowerShell | Learn Kubernetes, labs, start guide, tests |
| 2026-11-26 | Build details for the setup check and lab lessons. A lesson's **Try it** links to the setup page until its cluster's tools pass: Lab 1's for Anywhere lessons and Lab 2's for EKS only lessons. Windows installs Ubuntu with `wsl --install -d Ubuntu`, because [Install WSL](https://learn.microsoft.com/windows/wsl/install) says plain `wsl --install` works only before WSL is installed, and Docker Desktop installs it first. The Dockerfile copies the two lab guides into the frontend build stage, since the lab pages read them at build time. | Try it linked to setup only for Lab 1's tools, and plain `wsl --install` | Learn Kubernetes, start guide, Docker |
| 2026-11-26 | Check the setup page's Windows path in CI. A `windows-2025` job installs Ubuntu on WSL 2, runs the Windows card's install commands and the check command in Ubuntu, and reads the output with the dashboard's report reader. The [runner image](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md) lists WSL 2 as the default but has no Docker Desktop, so Docker's WSL integration and Lab 1 on Windows still need a Windows tester. | WSL 2 left to a Windows tester | CI, setup check |
| 2026-11-26 | Charan chose to drop the optional eksctl checksum line from the Linux and Windows (WSL 2) setup cards. Since eksctl [v0.232.0](https://github.com/eksctl-io/eksctl/releases/tag/v0.232.0), `eksctl_checksums.txt` also lists an SBOM file for each platform, so the [official](https://docs.aws.amazon.com/eks/latest/eksctl/installation.html) `grep $PLATFORM \| sha256sum --check` prints FAILED for a file nobody downloaded. The new WSL 2 CI job found it. The other lines stay as the official page gives them. | The official checksum line | Setup check |
| 2026-11-26 | Charan chose to release the lessons and labs as v1.0.0 from this repository, with the images in Charan's GitHub account, as the [v1.0.0 release spec](specs/prebuilt-docker-release.md#v100-the-first-release-of-the-lessons-and-labs) sets out. `compose.yaml` pulls v1.0.0, and the README and start guide start the dashboard with `docker compose up -d`. Building from source moves to `docs/contributing.md`. The start guide asks for an 8 GB laptop and 4 GB for Docker: the dashboard and a three-node practice cluster running Lab 1 raised Docker's used memory by about 1.1 GiB, and Docker Desktop and WSL 2 default to half the laptop's memory. | Building from source as the main start path, and a 16 GB laptop with 8 GB for Docker | Release, Docker, README, start guide, contributing |
| 2026-11-26 | Pushes to this repository start CI again. The pushes of `4b41e92` to `576b6ad`, on a branch and on `main`, started it without a manual run. | Starting CI manually after each push | CI |
| 2026-11-26 | Charan confirmed the final review. Released [v1.0.0](https://github.com/avizway1/learning-kubernetes-made-easy/releases/tag/v1.0.0) from `12fb127`. The release workflow published the image for Linux AMD64 and ARM64. The package was public from its first push, and anonymous cold starts took about 7 seconds on both. On the project Mac, the start guide's `docker compose up -d` reached the first page in 13.6 seconds with no cached image. CI on `main` passed after a rerun, because GitHub first refused the pinned Trivy download with HTTP 403. | No release from this repository | Release, GHCR, CI |
| 2026-11-26 | Charan renamed the project **Learning Kubernetes made easy - Aviz Academy** and limited this repository to the lessons, labs, setup check, and start guide. The repository is now [avizway1/learning-kubernetes-made-easy](https://github.com/avizway1/learning-kubernetes-made-easy), and release images go to `ghcr.io/avizway1/learning-kubernetes-made-easy` from [v1.1.0](specs/prebuilt-docker-release.md#v110-learning-kubernetes-made-easy). The Go server only serves the built dashboard, so the image is about 23 MB and a source build needs no extra Docker memory. Test and storage names use the `LKME_` and `learning-kubernetes:` prefixes, so learners’ saved setup checks and lab ticks reset once. | The earlier product name, repository, and image name | Product name, repository, release, Docker, CI, docs, tests |
| 2026-11-27 | Charan confirmed the final review. Released [v1.1.0](https://github.com/avizway1/learning-kubernetes-made-easy/releases/tag/v1.1.0) from `3eda286`, after CI passed on that commit on the branch and on `main`. The release workflow published `ghcr.io/avizway1/learning-kubernetes-made-easy:v1.1.0` for Linux AMD64 and ARM64. The new package was public from its first push, and anonymous cold starts took about 3 seconds on both. On the project Mac, the start guide's `docker compose up -d` reached the first page in 3.7 seconds with no cached image. | v1.0.0 as the latest release | Release, GHCR |
| 2026-11-27 | Charan moved [Set up your laptop](specs/setup-check.md#charans-changes-on-2026-11-27) to the top of the lesson list, before Level 0. The setup page now opens with what the laptop needs and ends with creating the practice cluster and pointing kubectl at it, with official k3d and Kubernetes sources. Anywhere lessons’ Try it says to check that `kubectl config current-context` prints `k3d-practice`. Every Try it command gets a Copy button, every command stays plain text, and command fonts never join `--` into one dash. The check command is unchanged. | The setup card at the top of Hands-on labs, the practice cluster only in the start guide’s optional step, and Try it commands without Copy | Learn Kubernetes, setup page, Try it, start guide, README, tests |
