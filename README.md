# Kubernetes Config Builder and Learning Dashboard

[![CI](https://github.com/avizway1/Kubernetes-config-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/avizway1/Kubernetes-config-builder/actions/workflows/ci.yml)

**Kubernetes Made Simple** by Aviz Academy teaches Kubernetes one block at a time. Each lesson builds a real file, explains every line in plain English, and gives you commands to try on a free practice cluster on your laptop. Lessons are written for Amazon EKS with Auto Mode and Kubernetes 1.35, 1.36, and 1.37.

## Learn Kubernetes

Start the dashboard with Docker below and open [localhost:8080](http://localhost:8080). Begin with **Level 0 · Reading YAML**, then work through the levels in order. The [beginner learning path](specs/beginner-learning-path.md) lists every lesson.

The project is built in two phases. Phase 1, now, is Learn Kubernetes. Phase 2 brings back **Build a config**, the Argo CD and Prometheus template builder described below, which is hidden in the dashboard until then.

## Build a config (phase 2)

Build a config still works if you open [localhost:8080/#build](http://localhost:8080/#build) directly. Its content is unchanged and tested on K3s.

### Use the tool

**Use the tool** is Build a config’s default view. Choose a template, fill in its example-backed fields, then copy or download the YAML.

| Tool | Templates |
| --- | --- |
| Argo CD | Application, AppProject, ApplicationSet |
| Standalone Prometheus | Annotated metrics Service, custom scrape job, alert rule |

Learning mode explains every YAML line. Validation uses the Argo CD CRD schemas from chart 10.17.1, the Kubernetes Service schema, or `promtool` for configuration rendered by Prometheus chart 29.45.1.

#### Apply the generated files

For Argo CD, apply the generated manifest to a cluster where Argo CD is installed. For example, run `kubectl apply -f application.yaml`. To use ApplicationSet with the installation builder, choose **Full chart defaults** so the controller is running.

For standalone Prometheus, apply the annotated Service with kubectl. For a custom scrape job or alert rule, follow the pinned Helm upgrade command at the top of the values download. Merge existing alert groups into the alert values file before upgrading.

#### Run the first K3s lab

Start the dashboard with Docker below, then follow the lab guide. You’ll deploy a sample app with Argo CD and use Prometheus to collect its metrics, trigger an alert, and verify recovery. [First K3s lab](docs/first-k3s-lab.md)

## Start with Docker

With Docker Desktop or Docker Engine with Compose running, clone this repository and build the latest dashboard, including the Learn Kubernetes lessons. Give Docker at least 8 GB of memory first (Docker Desktop: Settings, then Resources). With 4 GB, the build stops with “cannot allocate memory” while compiling promtool.

```sh
git clone https://github.com/avizway1/Kubernetes-config-builder.git
cd Kubernetes-config-builder
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

Open [localhost:8080](http://localhost:8080). Docker verifies the pinned source archive, charts, and Kubernetes schemas during the build, and compiles the patched promtool, so the first build can take a while. Run `docker compose -f compose.yaml -f compose.build.yaml down` from the same folder to stop the dashboard.

### Older prebuilt release

`docker compose up -d` without the build file pulls the v0.4.0 image, `ghcr.io/cavula/kubernetes-config-builder:v0.4.0`, published from the original repository before this one. It has the Argo CD and Prometheus builder and the first K3s lab, but not Kubernetes Made Simple or the lessons.

## Run from source for development

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

Open [http://localhost:5173](http://localhost:5173) or the URL printed by Vite. The renderer listens on loopback port 8080.

## Install the tool (phase 2)

In Build a config, switch to **Install the tool** to generate Helm or Kubernetes installation files. In **Deploy**, choose **Helm chart + values** and click **Download Helm bundle**. Unzip the bundle and run the install command in its README. The ZIP includes the verified pinned chart and its dependencies, so Helm needs no chart repository. The cluster still needs access to the container images or must already have them. **Copy values** copies the commented values file.

Choose **YAML manifest** to copy or download the same explained Kubernetes YAML. The file begins with the apply command and after-install steps. Learning adds short explanations for key fields. Choose Compact for component and purpose headers with deployment instructions. Click a component name to open its preview. The Argo CD manifest includes its CRDs, namespace, and Redis initialization Job.

For Prometheus, run `kubectl apply --server-side -f prometheus-manifests.yaml`. The file creates the `monitoring` namespace. Both configuration reloader images use the ARM64-compatible tag recorded in the [Decision Log](AGENTS.md#decision-log).

## Test

- Run `npm test` and `npm run build` from `frontend`.
- Run `go test ./...` from `backend` after downloading the charts.
- Run `node --test tests/lesson-manifests.check.mjs` from the project root, after preparing the schemas, to check every finished lesson step with strict kubeconform.
- Run `./tests/check-argo-usage.sh <dedicated-test-kubeconfig>` with the pinned Argo CD chart and its ApplicationSet controller running on a fresh local K3s 1.37 test cluster.
- Run `./tests/check-prometheus-usage.sh <dedicated-test-kubeconfig>` with a dedicated local K3s 1.37 Prometheus test cluster.
- Run `bash tests/check-first-k3s-lab.sh` to download the actual files in Chromium and time the complete lab on a disposable K3s cluster. Add `--applicationset` for the separate Full preset check. See the [lab guide](docs/first-k3s-lab.md) for prerequisites.
- Follow the [local K3s deployment instructions](docs/local-rendering.md#local-k3s-deploy-checks) for server-side dry runs and rollout checks.

GitHub Actions verifies chart checksums, runs the frontend and Go checks, and runs Helm lint and strict kubeconform across the supported Kubernetes versions on every push. You can also start CI manually from the Actions tab.

The [MVP specs](specs/) and [Decision Log](AGENTS.md#decision-log) record acceptance criteria, implementation decisions, and remaining work.

Run the browser checks with the backend and Vite dev server running. From `frontend`, install Chromium with `npx playwright-core install chromium`, then run `npm run test:browser`. Set `KCB_CHROME_PATH` to use an installed Chrome binary.

### Security checks

CI fails on high or critical npm and Go findings. The only exception is an unfixed development-only npm finding recorded in the [accepted dependency risks file](security/accepted-dependency-risks.json). It fails again after its review date, if it reaches the runtime dependencies, or once a fixed release is published. Image findings recorded in the [accepted risks file](security/accepted-risks.json) are reported through their review date. Unaccepted or expired findings fail CI. npm audit reads the frontend lockfile. Trivy scans the Go module and the images from both verified charts across supported Kubernetes minors and builder toggles. The image scan covers Linux AMD64 and ARM64 and includes the Argo CD initialization Job.

To reproduce the image scan locally with Trivy installed, run from the project root after downloading the charts.

```sh
mkdir -p .runtime/security
(cd backend && go run . -list-images) > .runtime/security/chart-images.txt
./tests/scan-chart-images.sh .runtime/security/chart-images.txt .runtime/security/images
```

The script prints findings and writes per-image JSON reports to the directory you pass. An incomplete scan fails the check.

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Charan.
