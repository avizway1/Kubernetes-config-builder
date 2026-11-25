# Build a config (phase 2)

Build a config generates Argo CD and Prometheus files for engineers. It is hidden in the dashboard during phase 1, while Learn Kubernetes is built, and returns in phase 2. It still opens at [localhost:8080/#build](http://localhost:8080/#build) when you type the address directly. Its content is unchanged and tested on K3s.

## Use the tool

**Use the tool** is Build a config’s default view. Choose a template, fill in its example-backed fields, then copy or download the YAML.

| Tool | Templates |
| --- | --- |
| Argo CD | Application, AppProject, ApplicationSet |
| Standalone Prometheus | Annotated metrics Service, custom scrape job, alert rule |

Learning mode explains every YAML line. Validation uses the Argo CD CRD schemas from chart 10.17.1, the Kubernetes Service schema, or `promtool` for configuration rendered by Prometheus chart 29.45.1.

### Apply the generated files

For Argo CD, apply the generated manifest to a cluster where Argo CD is installed. For example, run `kubectl apply -f application.yaml`. To use ApplicationSet with the installation builder, choose **Full chart defaults** so the controller is running.

For standalone Prometheus, apply the annotated Service with kubectl. For a custom scrape job or alert rule, follow the pinned Helm upgrade command at the top of the values download. Merge existing alert groups into the alert values file before upgrading.

### Run the GitOps and monitoring lab

Start the dashboard, then follow the lab guide. You’ll deploy a sample app with Argo CD and use Prometheus to collect its metrics, trigger an alert, and verify recovery. [GitOps and monitoring lab](first-k3s-lab.md)

## Install the tool

In Build a config, switch to **Install the tool** to generate Helm or Kubernetes installation files. In **Deploy**, choose **Helm chart + values** and click **Download Helm bundle**. Unzip the bundle and run the install command in its README. The ZIP includes the verified pinned chart and its dependencies, so Helm needs no chart repository. The cluster still needs access to the container images or must already have them. **Copy values** copies the commented values file.

Choose **YAML manifest** to copy or download the same explained Kubernetes YAML. The file begins with the apply command and after-install steps. Learning adds short explanations for key fields. Choose Compact for component and purpose headers with deployment instructions. Click a component name to open its preview. The Argo CD manifest includes its CRDs, namespace, and Redis initialization Job.

For Prometheus, run `kubectl apply --server-side -f prometheus-manifests.yaml`. The file creates the `monitoring` namespace. Both configuration reloader images use the ARM64-compatible tag recorded in the [Decision Log](../AGENTS.md#decision-log).
