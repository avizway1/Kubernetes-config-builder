# First lab: deploy an app and monitor it

Argo CD deploys **`sample-app`** from Git. The sample uses a pinned Prometheus binary because it already serves metrics at `/metrics`. You will install a separate **monitoring Prometheus** that collects those metrics, displays the target, and evaluates an alert. Open the monitoring Prometheus UI to see the results.

Start the dashboard with release `v0.4.0` or later. You can generate the files before setting up a cluster. [Start with Docker](../README.md#start-with-docker)

## Before you start

Start Docker. Plan on internet access to download tools and container images and to let Argo CD read the lab’s Git repository. The dashboard bundles the chart files and their dependencies, so Helm installs and upgrades in this lab work without a chart repository connection. You’ll use `k3d` to create a disposable Kubernetes cluster in Docker, `kubectl` to work with that cluster, and `helm` to install the packaged charts.

### macOS

Open Terminal. If you don’t have `brew`, follow the [Homebrew setup instructions](https://brew.sh/) first. Then use the Homebrew commands listed in the [k3d docs](https://k3d.io/stable/#installation), [kubectl macOS docs](https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/#install-with-homebrew-on-macos), and [Helm docs](https://helm.sh/docs/intro/install/#from-homebrew-macos):

```sh
brew install k3d
brew install kubectl
brew install helm
```

### Windows

Use **WSL 2** for the lab so you can copy the Bash commands as written.

1. If WSL isn’t installed, run `wsl --install` in PowerShell as administrator, restart Windows, and open Ubuntu. If you already use WSL, run `wsl -l -v` in PowerShell and check that your distro shows version `2`. See [Microsoft’s WSL setup instructions](https://learn.microsoft.com/en-us/windows/wsl/install).
2. In Docker Desktop, enable **Settings → General → Use the WSL 2 based engine**, then enable your distro under **Settings → Resources → WSL Integration**. If that page is missing, [switch Docker Desktop to Linux containers](https://docs.docker.com/desktop/features/wsl/#enable-docker-in-a-wsl-2-distribution).
3. In your WSL terminal, follow the Linux instructions below to install and check all three tools. Use the same distro for the rest of the lab, including the terminals you open for port forwarding. When you need to move browser downloads into the lab folder, run [`explorer.exe .`](https://learn.microsoft.com/en-us/windows/wsl/filesystems#view-your-current-directory-in-windows-file-explorer) from that folder to open it in Windows File Explorer.

If you already use Scoop and also want the tools in PowerShell, install them there with the commands listed in the [k3d docs](https://k3d.io/stable/#other-installers), [kubectl Windows docs](https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/#install-on-windows-using-chocolatey-scoop-or-winget), and [Helm docs](https://helm.sh/docs/intro/install/#from-scoop-windows). These install Windows executables separately from the Linux tools used in WSL.

```powershell
scoop install k3d
scoop install kubectl
scoop install helm
```

### Linux (including Windows WSL 2)

**k3d:** Download the [official k3d installer](https://k3d.io/stable/#install-script):

```sh
curl -fsSL -o install-k3d.sh https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh
```

After reviewing the downloaded file, run `bash install-k3d.sh`.

**kubectl:** Use the [official Linux binary instructions](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/#install-kubectl-binary-with-curl-on-linux) to install a client compatible with this lab. The example installs [kubectl 1.37.1](https://kubernetes.io/releases/download/) and checks its SHA-256 before installing. Run `uname -m` to check your CPU: use `amd64` for `x86_64`, or change the first line to `arch=arm64` for `aarch64`.

```sh
arch=amd64
kubectl_url="https://dl.k8s.io/release/v1.37.1/bin/linux/$arch/kubectl"
curl -fsSLO "$kubectl_url" &&
  curl -fsSLO "$kubectl_url.sha256" &&
  echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check &&
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

**Helm:** Download the [official Helm 4 installer](https://helm.sh/docs/intro/install/#from-script):

```sh
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4
```

After reviewing the downloaded file, run `chmod 700 get_helm.sh && ./get_helm.sh`.

### Check the tools before creating a cluster

Run these checks in the terminal you’ll use for the lab:

```sh
k3d version
k3d cluster list
kubectl version --client
helm version
```

The three version commands should print a version. `k3d cluster list` should show your clusters or an empty list; either means k3d can reach Docker. If it reports a connection error, check that Docker is running and, on Windows, that WSL integration is enabled for your distro. For the lab’s Kubernetes 1.37 cluster, use kubectl 1.36, 1.37, or 1.38 ([kubectl version compatibility](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/#before-you-begin)).

Make at least **8 GB** available to Docker. On macOS, Linux Docker Desktop, or Windows with Hyper-V, check **Settings → Resources → Advanced → Memory limit**. With the Windows WSL 2 backend, check the [WSL 2 VM memory limit](https://learn.microsoft.com/en-us/windows/wsl/wsl-config#example-wslconfig-file) instead. With Docker Engine on Linux, check the host’s available memory. [Docker Desktop memory settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/#advanced)

If `k3d cluster list` showed any other local clusters running, stop them with `k3d cluster stop NAME` before starting the lab. Bring them back afterward with `k3d cluster start NAME`. Docker shares its available memory across the clusters.

On an Apple Silicon Mac with the other clusters paused, the automated lab took **6 minutes 20 seconds** from cluster creation through alert recovery. The lab containers peaked at **1.77 GiB** of sampled memory, and the Docker VM peaked at **3.06 GiB** in use. The dashboard and prerequisites were already available. The fresh cluster still pulled its workload images.

## 1. Create a fresh K3s cluster

Open a terminal and run the following. Keep this terminal open for lab commands. The independent kubeconfig points `kubectl` and `helm` at this cluster.

```sh
mkdir -p kcb-first-lab
cd kcb-first-lab
k3d cluster create kcb-first-lab --image rancher/k3s:v1.37.2-k3s1 \
  --api-port 127.0.0.1:6445 --kubeconfig-update-default=false --kubeconfig-switch-context=false \
  --k3s-arg '--disable=traefik@server:0' --k3s-arg '--disable=metrics-server@server:0' \
  --wait --timeout 4m
k3d kubeconfig get kcb-first-lab > lab-kubeconfig.yaml
export KUBECONFIG="$PWD/lab-kubeconfig.yaml"
kubectl config current-context
kubectl get nodes
```

Look for `k3d-kcb-first-lab` and a node that is `Ready`. The lab uses port forwarding for access and collects metrics through Prometheus, so it skips the bundled Traefik and Metrics Server add-ons. The dashboard uses Kubernetes `1.37` by default for the lab. If you open a new terminal for a port-forward, set `KUBECONFIG` there to the same file using its absolute path.

## 2. Install Argo CD and the monitoring Prometheus

In the dashboard, open **Install the tool**. For each tool below, select the **Minimal** preset. Under **3. Deploy**, set **Template** to **Helm chart + values** and click **Download Helm bundle**. Unzip each bundle into its own folder inside `kcb-first-lab`, your terminal’s current folder.

| Tool | Downloaded file | Extract into |
| --- | --- | --- |
| **Argo CD** | `argo-cd-helm-bundle.zip` | `kcb-first-lab/argo-cd/` |
| **Prometheus** | `prometheus-helm-bundle.zip` | `kcb-first-lab/prometheus/` |

Run these commands to install the pinned charts. The monitoring Prometheus uses temporary storage for this lab and evaluates alert rules every five seconds. `--hide-notes` suppresses the charts’ default access instructions. Use the port-forward below, which matches the lab’s monitoring URL. [Helm install](https://helm.sh/docs/helm/helm_install/)

```sh
helm install argo-cd ./argo-cd/argo-cd-10.17.1.tgz \
  --namespace argocd --create-namespace --values ./argo-cd/argo-cd-values.yaml \
  --hide-notes --wait --timeout 5m
helm install prometheus ./prometheus/prometheus-29.45.1.tgz \
  --namespace monitoring --create-namespace --values ./prometheus/prometheus-values.yaml \
  --set server.persistentVolume.enabled=false,server.global.evaluation_interval=5s \
  --hide-notes --wait --timeout 5m
```

In a separate terminal with the same `KUBECONFIG`, start the monitoring Prometheus port-forward and leave it running for the scrape and alert checks.

```sh
kubectl port-forward svc/prometheus-server -n monitoring 9090:80
```

Open the monitoring Prometheus UI on port 9090. [Monitoring Prometheus](http://localhost:9090)

## 3. Deploy `sample-app` with Argo CD

Open **Use the tool** and choose **Argo CD** under **Tool**. Select each **Usage template** below and click **Download**. Keep the default settings and click **Load lab example** on **Application** if you previously edited it or opened the Guestbook example. Put both files in `kcb-first-lab`.

| Usage template | Downloaded file |
| --- | --- |
| **AppProject** | `app-project.yaml` |
| **Application** | `application.yaml` |

```sh
kubectl apply -f app-project.yaml
kubectl create namespace metrics-lab
kubectl apply -f application.yaml
```

The AppProject allows this Git repository and destination. You create the namespace yourself because the project only allows the Application to deploy resources inside it. Request a manual sync with `kubectl`, then wait for **Synced** and **Healthy**. The sample Deployment should report a successful rollout. [Sync with kubectl](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-kubectl/) · [Argo CD namespace sync option](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/#create-namespace)

```sh
kubectl -n argocd wait application/metrics-lab --for=jsonpath='{.status.sync.status}'=OutOfSync --timeout=2m
kubectl -n argocd patch application metrics-lab --type=merge \
  -p '{"operation":{"sync":{"syncStrategy":{"hook":{}}}}}'
kubectl -n argocd wait application/metrics-lab --for=jsonpath='{.status.sync.status}'=Synced --timeout=3m
kubectl -n argocd wait application/metrics-lab --for=jsonpath='{.status.health.status}'=Healthy --timeout=3m
kubectl -n metrics-lab rollout status deployment/sample-app --timeout=2m
```

### View the deployment in Argo CD (optional)

You can watch the Application in the Argo CD UI. In another terminal with the lab’s `KUBECONFIG`, wait for the server rollout, then start the port-forward and leave it running.

```sh
kubectl -n argocd rollout status deployment/argo-cd-argocd-server --timeout=2m
kubectl port-forward svc/argo-cd-argocd-server -n argocd 8081:443
```

If the port-forward exits with `lost connection to pod`, check the rollout again, rerun the port-forward, and refresh the browser.

In the lab terminal, retrieve the generated password and keep it out of Git. Sign in as `admin` on port 8081 and view the `metrics-lab` Application. This local server uses a self-signed certificate. [Argo CD](https://localhost:8081)

```sh
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode
```

## 4. Watch the monitoring Prometheus collect metrics

Open **Use the tool** and choose **Prometheus** under **Tool**. Select each **Usage template** below, keep its defaults, and click **Download**. Put all three files in `kcb-first-lab`.

| Usage template | Downloaded file |
| --- | --- |
| **Annotated metrics Service** | `service-scrape.yaml` |
| **Custom scrape job** | `prometheus-scrape-job-values.yaml` |
| **Alert rule** | `prometheus-alert-rule-values.yaml` |

Apply the Service and check that it has an endpoint. The Service selects the `sample-app` Pods that Argo CD deployed.

```sh
kubectl apply -f service-scrape.yaml
kubectl -n metrics-lab get endpointslices --selector kubernetes.io/service-name=sample-app-metrics
```

In the monitoring Prometheus **Targets** view, find the `sample-app-metrics` Service target in `kubernetes-service-endpoints` and wait for **UP**. Add the custom job and the alert to the fresh Helm release with the downloaded values. The commands below reuse the local chart archive from step 2. Use these lab commands when the dashboard’s general **Next steps** show a chart repository. Existing releases can have other rule groups to merge first. This lab has a fresh release with the default empty rules file.

```sh
helm upgrade prometheus ./prometheus/prometheus-29.45.1.tgz --namespace monitoring \
  --hide-notes --reuse-values --values prometheus-scrape-job-values.yaml
helm upgrade prometheus ./prometheus/prometheus-29.45.1.tgz --namespace monitoring \
  --hide-notes --reuse-values --values prometheus-alert-rule-values.yaml
```

Both discovery methods intentionally collect from the same endpoint so you can compare them. In Prometheus, find `sample-app-static` on **Targets** and confirm that `up{job="sample-app-static"}` returns `1` in the query view. Open **Alerts** and look for `SampleAppDown` in the inactive state.

## 5. Trigger the alert and recover

Open **Use the tool**, choose **Prometheus** under **Tool**, and select **Custom scrape job** under **Usage template**. Change **Metrics path** from `/metrics` to `/lab-missing`. Click **Download** to save a new `prometheus-scrape-job-values.yaml`. Create the `kcb-first-lab/broken/` folder and move the new file there. If your browser added a suffix, rename the new file to `prometheus-scrape-job-values.yaml` in that folder. Keep the original file in `kcb-first-lab` for recovery.

```sh
helm upgrade prometheus ./prometheus/prometheus-29.45.1.tgz --namespace monitoring \
  --hide-notes --reuse-values --values broken/prometheus-scrape-job-values.yaml
```

In the monitoring Prometheus, watch `sample-app-static` go **DOWN**. Its query returns `0` because the configured target answers on the wrong path. After the 15-second hold and the next evaluation, `SampleAppDown` becomes **Firing**. The separate auto-discovered target still uses `/metrics` and stays **UP**. This exercise checks alert evaluation. Sending notifications needs an Alertmanager configured with a receiver.

Restore the original `prometheus-scrape-job-values.yaml` from step 4. The target returns to **UP**, and the alert returns to inactive.

```sh
helm upgrade prometheus ./prometheus/prometheus-29.45.1.tgz --namespace monitoring \
  --hide-notes --reuse-values --values prometheus-scrape-job-values.yaml
```

## Optional: create two Applications with an ApplicationSet

Use a fresh lab cluster for this follow-on. Open **Install the tool**, choose **Argo CD** under **Tool**, and select **Full chart defaults** to run the ApplicationSet controller. Under **3. Deploy**, choose **Helm chart + values** under **Template** and click **Download Helm bundle** to save `argo-cd-helm-bundle.zip`. Extract it into `kcb-first-lab/argo-cd/` and run the Argo CD install command from step 2.

Then open **Use the tool**, select **Argo CD** under **Tool** and **ApplicationSet** under **Usage template**, and click **Download**. Put `application-set.yaml` in `kcb-first-lab` and apply it.

```sh
kubectl apply -f application-set.yaml
kubectl -n argocd get applications.argoproj.io
```

Look for `metrics-lab-envs-dev` and `metrics-lab-envs-staging`. The generated Applications use separate destinations and can be inspected before you sync them.

## Clean up

Stop the monitoring Prometheus port-forward with `Ctrl+C`. If you opened the optional Argo CD port-forward, stop it too. From the lab terminal, delete only the cluster you created for this lab, then clear its kubeconfig setting.

```sh
k3d cluster delete kcb-first-lab
unset KUBECONFIG
```

Sources: [k3d cluster setup](https://k3d.io/stable/usage/commands/k3d_cluster_create/), [Argo CD Getting Started](https://argo-cd.readthedocs.io/en/stable/getting_started/), [kubectl rollout status](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_status/), [kubectl port-forward](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_port-forward/), [Prometheus Getting Started](https://prometheus.io/docs/prometheus/latest/getting_started/), and [Helm upgrade](https://helm.sh/docs/helm/helm_upgrade/).
