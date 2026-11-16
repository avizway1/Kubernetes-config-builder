import type { UsageTemplateId, UsageValues } from './usage-values.ts';
import { tools } from './selection.ts';

type Step = { text: string; command?: string };

const prometheusChart = tools.find(tool => tool.id === 'prometheus')!.chartVersion;

function nameArgument(value: UsageValues[string], maxLength: number, subdomain = false) {
  if (typeof value !== 'string' || value.length > maxLength) return undefined;
  const labels = value.split('.');
  if (!subdomain && labels.length !== 1) return undefined;
  return labels.every(label => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) ? value : undefined;
}

export function usageNextSteps(id: UsageTemplateId, input: UsageValues, filename: string): Step[] {
  const cluster = { text: 'Check that kubectl points to the cluster you intend to use.', command: 'kubectl config current-context' };
  if (id === 'scrape-job' || id === 'alert-rule') {
    const release = nameArgument(input.helmRelease ?? 'prometheus', 53, true);
    const namespace = nameArgument(input.helmNamespace ?? 'monitoring', 63);
    const validRelease = release && namespace;

    return [
      { text: 'Helm values to add to an existing standalone Prometheus install. Use Helm to apply this file.' },
      cluster,
      { text: `Prerequisites: Helm, a cluster you can access, and an existing release on chart ${prometheusChart}. Check its release name, namespace, and chart version.`, command: 'helm list --all-namespaces' },
      { text: 'Add the chart repository if needed.', command: 'helm repo add prometheus-community https://prometheus-community.github.io/helm-charts' },
      id === 'alert-rule'
        ? { text: 'Merge existing rule groups into this file first. Helm replaces the groups list during upgrade. Inspect the current release values:',
          command: validRelease ? `helm get values ${release} --namespace ${namespace} --output yaml` : undefined }
        : { text: 'Use a unique job name to preserve other jobs in the release.' },
      validRelease
        ? { text: 'From the download folder, upgrade the existing release using this file.',
          command: `helm upgrade ${release} prometheus-community/prometheus --namespace ${namespace} --version ${prometheusChart} --reuse-values --values ${filename}` }
        : { text: 'Enter a valid Helm release name and namespace to get the upgrade command.' },
      id === 'alert-rule'
        ? { text: 'Confirm in Prometheus → Alerts that the rule is listed. A failed scrape in a configured job can make the alert fire after its hold duration. Check notification delivery separately in Alertmanager.' }
        : { text: 'Confirm in Prometheus → Targets that the new job has a target marked UP. In the query view, use up with your job name and look for 1.' },
    ];
  }

  const namespace = nameArgument(input.namespace, 63);
  const destination = nameArgument(input.destinationNamespace, 63);
  const name = id === 'service-scrape' ? nameArgument(input.name, 63) : nameArgument(input.name, 253, true);
  const apply = { text: 'From the download folder, apply the generated file.', command: `kubectl apply -f ${filename}` };

  if (id === 'service-scrape') {
    return [
      { text: 'Prerequisites: kubectl, the standalone Prometheus chart, and a running workload that serves metrics in the Service namespace.' },
      cluster,
      apply,
      { text: 'Confirm the Service has a ready endpoint, then look for the target marked UP in Prometheus → Targets under kubernetes-service-endpoints.',
        command: namespace && name ? `kubectl --namespace ${namespace} get endpointslices --selector kubernetes.io/service-name=${name}` : undefined },
    ];
  }

  const verify = id === 'application'
    ? 'Confirm that kubectl reports Synced and Healthy. Check that the workload pods are ready in the destination namespace.'
    : id === 'app-project'
      ? 'Confirm the project exists, then use it in an Application and check that the project permits its repository and destination.'
      : 'Confirm the controller creates one Application for each environment in the list. The generated names use the ApplicationSet name plus the environment.';
  const resource = { 'application': 'applications', 'app-project': 'appprojects', 'application-set': 'applicationsets' }[id];
  const applicationSteps: Step[] = input.automated === true
    ? [{ text: 'Argo CD starts the sync automatically. Check its status with kubectl.' }]
    : [
      { text: 'For a new Application, wait until Argo CD compares Git with the cluster and reports OutOfSync. If the Application already shows Synced, skip the manual sync.',
        command: namespace && name ? `kubectl --namespace ${namespace} wait application/${name} --for=jsonpath='{.status.sync.status}'=OutOfSync --timeout=2m` : undefined },
      { text: 'When the Application shows OutOfSync, request a sync with kubectl.',
        command: namespace && name ? `kubectl --namespace ${namespace} patch application ${name} --type=merge -p '{"operation":{"sync":{"syncStrategy":{"hook":{}}}}}'` : undefined },
    ];

  return [
    { text: id === 'application-set'
      ? 'Prerequisites: kubectl and the Argo CD ApplicationSet controller. In Install the tool, choose Full chart defaults so the controller runs.'
      : 'Prerequisites: kubectl and a running Argo CD installation. Use Install the tool if you need to install Argo CD.' },
    cluster,
    ...(id === 'application' ? [{ text: 'Confirm the AppProject already exists and permits this repository and destination.' }] : []),
    ...(id === 'application' && input.createNamespace !== true ? [{
      text: 'Make sure the destination namespace exists before sync. If it is missing, create it on the target cluster or ask its administrator.',
      command: destination ? `kubectl get namespace ${destination}` : undefined,
    }] : []),
    apply,
    ...(id === 'application' ? applicationSteps : []),
    { text: verify,
      command: namespace && name ? id === 'application-set'
        ? `kubectl --namespace ${namespace} get applications.argoproj.io`
        : `kubectl --namespace ${namespace} get ${resource}.argoproj.io ${name}` : undefined },
    ...(id === 'application' ? [{ text: 'You can also open the Argo CD UI to watch sync and health.' }] : []),
  ];
}
