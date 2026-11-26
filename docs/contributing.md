# Contributing

How to run Kubernetes Made Simple from source, and how to run its tests and checks. Read [AGENTS.md](../AGENTS.md) first: it holds the project rules, the Lessons Learned, and the Decision Log. Every feature starts as a spec in [specs](../specs/).

## Run from source

Install Node.js 26.13.1, Go 1.27.4, Helm, kubeconform, and Python 3. If you use nvm, run `nvm install` and `nvm use` from the project root. Download the verified chart archives and pinned schemas once.

```sh
./backend/download-charts.sh
python3 backend/download-schemas.py
./backend/build-promtool.sh "$PWD/.runtime/prometheus-tools"
export PATH="$PWD/.runtime/prometheus-tools:$PATH"
```

Start the renderer from the project root.

```sh
cd backend
go run .
```

In another terminal, start the frontend from the project root.

```sh
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) or the URL printed by Vite. The renderer listens on loopback port 8080. [Local chart rendering](local-rendering.md) has more on the renderer.

## Lessons and labs

Lessons live in `templates/kubernetes/lessons`, one JSON file per lesson, listed in `templates/kubernetes/lessons.json`. Each file holds the whole YAML after every block, the notes, Try it commands with the results to check, and Read it and Fix it practice. The [beginner learning path](../specs/beginner-learning-path.md) sets the writing rules.

Lab guides are Markdown files in `docs`, and their YAML files are in `templates/kubernetes/labs`. The guide is also the test: `tests/lab-guide.check.mjs` runs every command in its `bash` blocks in order, plus hidden `<!-- do: ... -->` and `<!-- check: ... -->` steps. A unit test checks that every YAML block in a guide matches a lab file. The dashboard's lab pages read the same guides when the dashboard is built, so a guide change appears there after a rebuild. `tests/lab-lessons.test.mjs` fails if a guide uses Markdown the lab page cannot show, or if the page would drop any of its text. Each lab's **Understand the files** steps are in `templates/kubernetes/labs/lab-1.json` and `lab-2.json`.

## Test

Run these from `frontend`:

- `npm run lint`, `npm test`, and `npm run build`.

Run these from the project root:

- `go test ./...` from `backend`, after downloading the charts.
- `node --test tests/lesson-manifests.check.mjs`, after preparing the schemas, to check every finished lesson step and every lab file with strict kubeconform.
- `tests/check-lessons-k3s.sh 1.37`, with Docker, k3d, kubectl, and curl installed, to apply every Anywhere lesson to a fresh K3s cluster. It checks each **Try it** result and each **Fix it** message, then deletes the cluster. Repeat with `1.36` and `1.35`.
- `KCB_LAB_LIMIT_SECONDS=900 node tests/lab-guide.check.mjs docs/lab-1-hello-kubernetes.md` to run Lab 1 on a fresh K3s cluster and time it. It uses its own kubeconfig in `.runtime`, so yours is untouched.

### Browser checks

Run the browser checks with the backend and Vite dev server running. From `frontend`, install Chromium with `npx playwright-core install chromium`, then run `npm run test:browser`. Set `KCB_CHROME_PATH` to use an installed Chrome binary. `node ../tests/site-shell.browser.mjs` checks Learn Kubernetes on its own, with only the Vite dev server running.

### Checks on EKS

These create resources in AWS, which charges for them. Run them only with Charan's approval of the account, Region, and budget, and delete everything afterwards.

EKS only lessons, on a dedicated cluster named `kcb-lessons-*`:

```sh
export KCB_EKS_CLUSTER=kcb-lessons-137 KCB_EKS_REGION=ap-south-1
KCB_EFS_ID=$(tests/eks-lessons-cluster.sh create 1.37 | tail -n 1)
KCB_EFS_ID=$KCB_EFS_ID tests/check-lessons-eks.sh 1.37
tests/eks-lessons-cluster.sh delete
```

Creating the cluster and EFS takes about 20 minutes. The check waits up to ten minutes for each load balancer, volume, or new machine. `delete` removes the lessons' objects first, so AWS removes their load balancers and volumes, then the EFS file system, the roles, and the cluster. It ends by listing anything left. Set `KCB_LESSON_ONLY=<id>,<id>` to rerun some lessons. The check also saves the cluster's NodePool and IngressClassParams CRDs in `.runtime/eks-crds`. Compare them with `backend/eks-crds` to see whether Auto Mode changed either kind.

Lab 2 creates and deletes its own cluster, `hello-eks`, as a learner would:

```sh
KCB_LAB_SET='{"export AWS_REGION=us-east-1":"export AWS_REGION=ap-south-1"}' KCB_LAB_RETRY_SECONDS=600 KCB_LAB_LIMIT_SECONDS=2400 \
  node tests/lab-guide.check.mjs docs/lab-2-your-app-on-eks.md
```

If a step fails, the check runs the guide's clean-up commands. Check the AWS console afterwards anyway.

### Build a config checks (phase 2)

- `./tests/check-argo-usage.sh <dedicated-test-kubeconfig>` with the pinned Argo CD chart and its ApplicationSet controller running on a fresh local K3s 1.37 test cluster.
- `./tests/check-prometheus-usage.sh <dedicated-test-kubeconfig>` with a dedicated local K3s 1.37 Prometheus test cluster.
- `bash tests/check-first-k3s-lab.sh` to download the actual files in Chromium and time the GitOps and monitoring lab on a disposable K3s cluster. Add `--applicationset` for the separate Full preset check. See the [lab guide](first-k3s-lab.md) for prerequisites.
- The [local K3s deployment instructions](local-rendering.md#local-k3s-deploy-checks) for server-side dry runs and rollout checks.

### CI

GitHub Actions verifies chart checksums, runs the frontend and Go checks, and runs Helm lint and strict kubeconform across the supported Kubernetes versions. Pushes to this repository do not start CI, so start it from the Actions tab. During phase 1, CI runs once, at the end.

## Security checks

CI fails on high or critical npm and Go findings. The only exception is an unfixed development-only npm finding recorded in the [accepted dependency risks file](../security/accepted-dependency-risks.json). It fails again after its review date, if it reaches the runtime dependencies, or once a fixed release is published. Image findings recorded in the [accepted risks file](../security/accepted-risks.json) are reported through their review date. Unaccepted or expired findings fail CI. npm audit reads the frontend lockfile. Trivy scans the Go module and the images from both verified charts across supported Kubernetes minors and builder toggles. The image scan covers Linux AMD64 and ARM64 and includes the Argo CD initialization Job.

To reproduce the image scan locally with Trivy installed, run from the project root after downloading the charts.

```sh
mkdir -p .runtime/security
(cd backend && go run . -list-images) > .runtime/security/chart-images.txt
./tests/scan-chart-images.sh .runtime/security/chart-images.txt .runtime/security/images
```

The script prints findings and writes per-image JSON reports to the directory you pass. An incomplete scan fails the check.

## Releases

Release notes are in [docs/releases](releases/). Tag a release only after Charan confirms the final review.
