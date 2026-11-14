# First usage workflow

Approved by Charan on November 14, 2026, including the desktop layout. Improve the six existing usage templates before adding more templates. Keep **Use the tool** as the starting view and **Install the tool** available for setup. Keep the Argo CD 10.17.1 and standalone Prometheus 29.45.1 chart pins. Push each finished part in a small commit and verify its CI. Tag a release only after Charan tries the lab and confirms.

## Inputs

The selected mode, tool, template, and Kubernetes version, the current form values, generated YAML or Helm values, and the pinned chart and schemas. For the lab, use a dedicated K3s context and a fixed sample workload. Preview and export work before a cluster is set up.

## Outputs and proposed changes

1. **Show what validation checked.** Validate the fields emitted by the supported templates using the rules for the selected Kubernetes version and resource kind. Cover names and namespaces, label keys and values, Service and numeric target ports from 1 to 65535, and required fields. Check template-specific relationships that can be determined locally, such as whether an ApplicationSet placeholder matches a known list generator input. Keep the Kubernetes and Argo CD schema checks, Helm render checks, and `promtool` checks where applicable. Show actionable errors next to the inputs. Example pass text: “Local checks passed: object name, namespace, and Argo CD schema. Check on your cluster: permissions, project and Git source, sync, and workload health.” Show pending or incomplete checks distinctly, including missing validators. Copy and download remain available with diagnostics.
2. **Add Next steps to each usage template.** Show prerequisites, an exact command using the current filename and relevant values, and a check with an expected result. Build commands from validated or safely quoted arguments and show users which terminal and context to use. Add the same handoff to Learning and Compact exports. For existing Prometheus releases, let users identify the release and namespace and verify the chart version before using the pinned upgrade. Show how to find and preserve existing alert groups before upgrading. Use a dedicated kubeconfig explicitly for lab commands. Provide a short “I don’t have a cluster” path for starting a dedicated K3s cluster, with the exact lab setup, install, and cleanup steps in one place.
3. **Offer one lab shared by both tools.** Use a small `sample-app` Deployment from a pinned commit in a public lab path. Explain in the fixture and lab steps that `sample-app` uses a pinned Prometheus binary for its `/metrics` endpoint, and that the separate monitoring Prometheus is what collects the metrics and evaluates the alert. Align the AppProject, Application, annotated Service, custom job, and alert defaults around the same repo, namespace, workload, Service, and job. Make the lab the first suggested example. Keep Guestbook as an optional example in the existing Application template. ApplicationSet is an optional follow-on using Full chart defaults and isolated destinations so it does not take ownership of the main lab workload.
4. **Fix the port clash and retain drafts.** Keep the dashboard at `http://localhost:8080`, forward Argo CD on `https://localhost:8081`, and use `http://localhost:9090` for Prometheus. Derive commands and URLs from the same settings in the app, YAML downloads, Helm bundle README, and lab guide. Keep independent drafts for each usage template and each tool’s installation settings throughout the current dashboard session, including template, tool, and mode switches. Switching comment density retains field edits.
5. **Put the form and live output alongside each other.** On desktop, put the form on the left and live YAML, validation status, and export controls on the right. Put Next steps beside the generated file. Keep the three install stages in order and show their live preview in the right pane. On narrow screens, stack the panes and provide a direct jump between form and YAML. Keep Learning and Compact available.

| Template | Prerequisite and action | What success looks like |
| --- | --- | --- |
| Argo CD AppProject | Argo CD is ready. Apply the generated AppProject before the lab Application. | The project exists and the Application can use its repo and destination. |
| Argo CD Application | Argo CD is ready and the project allows the source and destination. Apply the file and select **Sync** in Argo CD with the default manual policy. | Argo CD shows **Synced** and **Healthy**, and the demo Deployment is ready. |
| Argo CD ApplicationSet | Install Argo CD with the Full preset so the controller is running. Apply the generated file. | The controller creates the two expected Applications. |
| Prometheus annotated Service | The workload serves metrics and the pinned standalone Prometheus chart is running. Apply the Service file. | The Service has a ready endpoint and the discovered target is **UP**. |
| Prometheus custom scrape job | The same Service resolves and the pinned Helm release exists. Upgrade with the downloaded values file. | The named job is **UP** on Targets and its `up` query returns `1`. Explain that automatic discovery and the custom job briefly collect the same endpoint for comparison. |
| Prometheus alert rule | The custom job is collecting; merge any existing rule groups. Upgrade with the downloaded alert values file. Change the lab job’s metrics path to a missing path, then restore it. | The rule is loaded. The configured target goes **DOWN**, the alert fires after its configured delay, and restoring the path returns the target to **UP** and the alert to inactive. Firing is visible in Prometheus. Notifications require a configured Alertmanager. |

## Acceptance criteria

- [ ] Unit and browser tests reject the reported invalid names and port, accept valid boundary values for the relevant fields, and distinguish failed, incomplete, successful, and cluster-only checks.
- [ ] Browser tests verify the right Next steps for all six templates, that commands match the actual clipboard and downloads in both comment modes, and that drafts survive template, tool, and mode round trips.
- [ ] Browser tests verify that the form and live YAML are visible together in a desktop viewport and that narrow screens offer a direct jump. Verify that copy, download, and comparison still work.
- [ ] With the Docker dashboard on port 8080, use the generated Argo CD access command and reach its UI on port 8081. Check the UI, YAML header, Helm bundle README, and lab guide for matching commands and links.
- [ ] Follow the documented path on a fresh, dedicated K3s cluster using the actual exports. Verify Argo CD sync and health, generated Service endpoints, both Prometheus targets, alert firing, and recovery. Test the optional ApplicationSet separately with the Full preset.
- [ ] Do a first-run walkthrough from the release README in a fresh browser. Record how long it takes to reach the first actionable step and the first verified result, and where the walkthrough requires outside instructions.
- [ ] On a fresh dedicated K3s cluster, time the beginner walkthrough from the setup instructions through alert recovery. Target about 20 minutes or less. Record the host architecture, cache conditions, what was included, and the measured time.

## Sample image

Use `quay.io/prometheus/prometheus:v3.16.0@sha256:9332054523223e2ddc18d8101799d54a4a8d823b030c53216f063a6c117773cd` for the demo workload. Quay’s image index was inspected and shared with Charan before use. It lists native Linux AMD64 manifest `sha256:89c1a644817e9ad70fa2af76c84898e327c1de7063735f962e8313b1e28672c3` and Linux ARM64 manifest `sha256:c523006440e714e0e53405b77e9f6ee668871d9855fc1c853fd43f5b990c34d2`.

[Prometheus v3.16.0 release](https://github.com/prometheus/prometheus/releases/tag/v3.16.0) · [Quay OCI image index](https://quay.io/v2/prometheus/prometheus/manifests/sha256:9332054523223e2ddc18d8101799d54a4a8d823b030c53216f063a6c117773cd)

## Sources

- [Kubernetes object names](https://kubernetes.io/docs/concepts/overview/working-with-objects/names/), [Services and EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/service/), [kubectl apply](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/), and [kubectl port-forward](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_port-forward/)
- [k3d cluster create](https://k3d.io/stable/usage/commands/k3d_cluster_create/)
- [Argo CD Getting Started](https://argo-cd.readthedocs.io/en/stable/getting_started/), [AppProjects](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/), and [ApplicationSet list generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-List/)
- [Prometheus installation](https://prometheus.io/docs/prometheus/latest/installation/), [alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/), [HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/), and [Helm upgrade](https://helm.sh/docs/helm/helm_upgrade/)
