# First lab: deploy an app and monitor it

Argo CD deploys **`sample-app`** from Git. The sample uses a pinned Prometheus binary because it already serves metrics at `/metrics`. You will install a separate **monitoring Prometheus** that collects those metrics, displays the target, and evaluates an alert. Open the monitoring Prometheus UI to see the results.

You can generate files in the dashboard before you set up a cluster. Use a dashboard build with the `metrics-lab` examples. The v0.3.1 Docker image predates this lab. For a local review, open the running preview supplied with the review or use the [README’s source startup steps](../README.md#run-from-source-for-development) from a checkout of `main`.

## Before you start

Start Docker and make sure `k3d`, `kubectl`, and `helm` are available in your terminal. You’ll need internet access for Git, charts, and container images. The lab uses a separate cluster, which you can delete when you finish.

In Docker Desktop, open **Settings → Resources → Advanced** and set **Memory limit** to at least **8 GB**. Run `k3d cluster list` and stop your other local clusters with `k3d cluster stop NAME` before starting the lab. You can bring them back afterward with `k3d cluster start NAME`. Docker shares its memory limit across all running clusters. [Docker Desktop memory settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/#advanced)

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

In the dashboard, choose **Install the tool → Argo CD → Minimal**. Download the Helm bundle and unzip it into a folder named `argo-cd`. Repeat for **Prometheus → Minimal** and unzip that bundle into `prometheus`. Put both folders inside `kcb-first-lab`, your terminal’s current folder.

Run these commands to install the pinned charts. The Argo CD command hides the chart’s default access instructions so you can follow the port settings below. The monitoring Prometheus uses temporary storage for this lab and evaluates alert rules every five seconds.

```sh
helm install argo-cd ./argo-cd/argo-cd-10.17.1.tgz \
  --namespace argocd --create-namespace --values ./argo-cd/argo-cd-values.yaml \
  --hide-notes --wait --timeout 5m
helm install prometheus ./prometheus/prometheus-29.45.1.tgz \
  --namespace monitoring --create-namespace --values ./prometheus/prometheus-values.yaml \
  --set server.persistentVolume.enabled=false,server.global.evaluation_interval=5s \
  --wait --timeout 5m
```

Wait for the Argo CD server to be ready before opening a port-forward. Continue when `kubectl` says the Deployment successfully rolled out.

```sh
kubectl -n argocd rollout status deployment/argo-cd-argocd-server --timeout=2m
```

In two separate terminals with the same `KUBECONFIG`, run one port-forward in each and leave them running.

```sh
kubectl port-forward svc/argo-cd-argocd-server -n argocd 8081:443
kubectl port-forward svc/prometheus-server -n monitoring 9090:80
```

If the Argo CD port-forward exits with `lost connection to pod`, wait for the rollout again, then rerun the same Argo CD port-forward command and refresh the browser. A server restart can close the connection while the cluster and installed chart remain in place.

The dashboard listens on [localhost:8080](http://localhost:8080) in the Docker setup. Open [monitoring Prometheus](http://localhost:9090) for the scrape and alert checks. You can also open [Argo CD](https://localhost:8081) to observe the deployment. The local Argo CD installation uses a self-signed certificate. For the optional UI, retrieve the generated password and sign in as `admin`. Keep the password out of Git.

```sh
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode
```

## 3. Deploy `sample-app` with Argo CD

In **Use the tool → Argo CD**, download the **AppProject** and **Application** examples. Keep their defaults. Put `app-project.yaml` and `application.yaml` in `kcb-first-lab`, then run:

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

## 4. Watch the monitoring Prometheus collect metrics

In **Use the tool → Prometheus**, download the default **Annotated metrics Service**, **Custom scrape job**, and **Alert rule** files. Put them in `kcb-first-lab`. Apply the Service and check that it has an endpoint. The Service selects the `sample-app` Pods that Argo CD deployed.

```sh
kubectl apply -f service-scrape.yaml
kubectl -n metrics-lab get endpointslices --selector kubernetes.io/service-name=sample-app-metrics
```

In the monitoring Prometheus **Targets** view, find the `sample-app-metrics` Service target in `kubernetes-service-endpoints` and wait for **UP**. Add the custom job and the alert to the fresh Helm release with the downloaded values. Existing releases can have other rule groups that need to be merged first. This lab has a fresh release with the default empty rules file.

```sh
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade prometheus prometheus-community/prometheus --namespace monitoring --version 29.45.1 \
  --reuse-values --values prometheus-scrape-job-values.yaml
helm upgrade prometheus prometheus-community/prometheus --namespace monitoring --version 29.45.1 \
  --reuse-values --values prometheus-alert-rule-values.yaml
```

Both discovery methods intentionally collect from the same endpoint so you can compare them. In Prometheus, find `sample-app-static` on **Targets** and confirm that `up{job="sample-app-static"}` returns `1` in the query view. Open **Alerts** and look for `SampleAppDown` in the inactive state.

## 5. Trigger the alert and recover

In **Custom scrape job**, change **Metrics path** from `/metrics` to `/lab-missing`. Create a `broken` folder inside `kcb-first-lab` and save the new download there as `prometheus-scrape-job-values.yaml`. Keep the original file in `kcb-first-lab` for recovery.

```sh
helm upgrade prometheus prometheus-community/prometheus --namespace monitoring --version 29.45.1 \
  --reuse-values --values broken/prometheus-scrape-job-values.yaml
```

In the monitoring Prometheus, watch `sample-app-static` go **DOWN**. Its query returns `0` because the configured target answers on the wrong path. After the 15-second hold and the next evaluation, `SampleAppDown` becomes **Firing**. The separate auto-discovered target still uses `/metrics` and stays **UP**. This exercise checks alert evaluation. Sending notifications needs an Alertmanager configured with a receiver.

Restore the original values file. The target returns to **UP**, and the alert returns to inactive.

```sh
helm upgrade prometheus prometheus-community/prometheus --namespace monitoring --version 29.45.1 \
  --reuse-values --values prometheus-scrape-job-values.yaml
```

## Optional: create two Applications with an ApplicationSet

Use a fresh lab cluster for this follow-on. Repeat the Argo CD portion of step 2, choosing **Full chart defaults** because it runs the ApplicationSet controller. Leave the monitoring install for the main lab. Download the **ApplicationSet** example into the lab folder and apply it.

```sh
kubectl apply -f application-set.yaml
kubectl -n argocd get applications.argoproj.io
```

Look for `metrics-lab-envs-dev` and `metrics-lab-envs-staging`. The generated Applications use separate destinations and can be inspected before you sync them.

## Clean up

Stop both port-forwards with `Ctrl+C`. From the lab terminal, delete only the cluster you created for this lab, then clear its kubeconfig setting.

```sh
k3d cluster delete kcb-first-lab
unset KUBECONFIG
```

Sources: [k3d cluster setup](https://k3d.io/stable/usage/commands/k3d_cluster_create/), [Argo CD Getting Started](https://argo-cd.readthedocs.io/en/stable/getting_started/), [kubectl rollout status](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_status/), [kubectl port-forward](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_port-forward/), [Prometheus Getting Started](https://prometheus.io/docs/prometheus/latest/getting_started/), and [Helm upgrade](https://helm.sh/docs/helm/helm_upgrade/).
