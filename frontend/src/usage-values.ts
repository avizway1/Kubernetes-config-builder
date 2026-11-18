import argoUsage from '../../templates/argo-cd/usage.json' with { type: 'json' };

import prometheusUsage from '../../templates/prometheus/usage.json' with { type: 'json' };
import { usageNextSteps } from './usage-next-steps.ts';

export type UsageTemplateId = keyof typeof argoUsage | keyof typeof prometheusUsage;
export type UsageValues = Record<string, string | boolean | number>;

export const guestbookExample = {
  name: 'my-app',
  project: 'default',
  repoURL: 'https://github.com/argoproj/argocd-example-apps.git',
  targetRevision: 'HEAD',
  path: 'guestbook',
  destinationNamespace: 'guestbook',
  createNamespace: true,
};

export const usageTemplateIds = {
  'argo-cd': ['application', 'app-project', 'application-set'],
  prometheus: ['service-scrape', 'scrape-job', 'alert-rule'],
} as const satisfies Record<string, readonly UsageTemplateId[]>;

export type UsageTool = keyof typeof usageTemplateIds;

type Field = {
  id: string;
  label: string;
  description: string;
  example?: string;
} & (
  { type: 'text'; default: string } |
  { type: 'number'; default: number } |
  { type: 'select'; default: string; choices: string[] } |
  { type: 'boolean'; default: boolean }
);

export const usageTemplates = { ...argoUsage, ...prometheusUsage } as Record<UsageTemplateId, {
  label: string;
  description: string;
  fields: Field[];
}>;

export function defaultUsageValues(id: UsageTemplateId): UsageValues {
  return Object.fromEntries(usageTemplates[id].fields.map(field => [field.id, field.default]));
}

export function usageFilename(id: UsageTemplateId) {
  return id === 'scrape-job' || id === 'alert-rule' ? `prometheus-${id}-values.yaml` : `${id}.yaml`;
}

const inCluster = 'https://kubernetes.default.svc';

export function renderUsage(id: UsageTemplateId, values: UsageValues, learning: boolean) {
  const lines: string[] = [];
  const notes = new Map<number, string>();
  const input = { ...defaultUsageValues(id), ...values };
  for (const step of usageNextSteps(id, input, usageFilename(id))) {
    lines.push(`# ${step.text}`);
    if (step.command) lines.push(`# ${step.command}`);
  }
  lines.push('');
  const quote = (value: UsageValues[string]) => JSON.stringify(value).replace(/[\u0085\u2028\u2029]/g,
    character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'),
  );
  const quoted = (key: string) => quote(input[key]);

  function write(indent: number, yaml: string, note: string) {
    const padding = ' '.repeat(indent);
    if (learning) lines.push(`${padding}# ${note}`);
    lines.push(padding + yaml);
    notes.set(lines.length, note);
  }

  if (id === 'service-scrape') {
    function port(key: 'servicePort' | 'targetPort') {
      const value = input[key];
      return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    }

    write(0, 'apiVersion: v1', 'Services are part of the core Kubernetes API, version v1.');
    write(0, 'kind: Service', 'A Service gives a group of Pods one stable name and address.');
    write(0, 'metadata:', 'Basic details: the name, the namespace, and notes for Prometheus.');
    write(2, `name: ${quoted('name')}`, 'Other apps use this name to reach the Pods.');
    write(2, `namespace: ${quoted('namespace')}`, 'A namespace groups related objects. A Service only finds Pods in its own namespace.');
    write(2, 'annotations:', 'Extra notes for other tools. Prometheus reads the ones below.');
    write(4, 'prometheus.io/scrape: "true"', 'Ask Prometheus to collect metrics from the Pods behind this Service.');
    write(4, `prometheus.io/scheme: ${quoted('scheme')}`, 'Use http or https to read the metrics.');
    write(4, `prometheus.io/path: ${quoted('metricsPath')}`, 'The web path where the app shows its metrics.');
    write(4, `prometheus.io/port: ${quote(String(port('targetPort')))}`, 'Prometheus reads metrics from this port on each Pod.');
    write(0, 'spec:', 'What the Service does: which Pods it finds and which port it opens.');
    write(2, 'selector:', 'Find Pods by their labels. Labels are name tags on Pods.');
    write(4, `${quoted('selectorKey')}: ${quoted('selectorValue')}`, 'Only Pods with this exact label join the Service.');
    write(2, 'ports:', 'The ports this Service opens.');
    write(4, `- port: ${quote(port('servicePort'))}`, 'Other apps connect to the Service on this port.');
    write(6, `targetPort: ${quote(port('targetPort'))}`, 'The Service forwards traffic to this port on the Pods.');
    return { text: lines.join('\n') + '\n', notes };
  }

  if (id === 'scrape-job' || id === 'alert-rule') {
    if (id === 'scrape-job') {
      write(0, 'scrapeConfigs:', 'A scrape job tells Prometheus where to collect metrics. Add yours to the chart.');
      write(2, `${quoted('jobName')}:`, 'The job name. Prometheus shows it on the Targets page.');
      write(4, 'enabled: true', 'Turn this job on so the chart adds it.');
      write(4, `scrape_interval: ${quoted('interval')}`, 'How often Prometheus collects metrics from the target.');
      write(4, `metrics_path: ${quoted('metricsPath')}`, 'The web path where the target shows its metrics.');
      write(4, `scheme: ${quoted('scheme')}`, 'Use http or https to read the metrics.');
      write(4, 'static_configs:', 'List the targets by hand instead of finding them automatically.');
      write(6, '- targets:', 'The addresses in this list.');
      write(10, `- ${quoted('target')}`, 'Prometheus connects to this host and port.');
    } else {
      write(0, 'serverFiles:', 'Add files to the Prometheus server settings through the chart.');
      write(2, 'alerting_rules.yml:', 'The chart already loads this alert rules file. Your rules go here.');
      write(4, 'groups:', 'Rules live in groups. Prometheus checks each group together.');
      write(6, `- name: ${quoted('groupName')}`, 'A name for this group of rules.');
      write(8, 'rules:', 'The alerts in this group.');
      write(10, `- alert: ${quoted('alertName')}`, 'The alert name you see when it fires.');
      write(12, `expr: ${quoted('expression')}`, 'The PromQL query Prometheus checks. Each result it returns becomes an active alert.');
      write(12, `for: ${quoted('duration')}`, 'The problem must last this long before the alert fires. Short blips are ignored.');
      write(12, 'labels:', 'Tags on the alert, used to sort and route it.');
      write(14, `severity: ${quoted('severity')}`, 'How urgent the alert is, such as warning or critical.');
      write(12, 'annotations:', 'Readable details shown with the alert.');
      write(14, `summary: ${quoted('summary')}`, 'A one-line description of the problem.');
    }
    return { text: lines.join('\n') + '\n', notes };
  }

  function applicationSpec(indent: number) {
    write(indent, `project: ${quoted('project')}`, 'The AppProject sets which Git repositories and namespaces this app may use.');
    write(indent, 'source:', 'Where Argo CD finds your app’s files in Git.');
    write(indent + 2, `repoURL: ${quoted('repoURL')}`, 'The Git repository that holds your Kubernetes files.');
    write(indent + 2, `targetRevision: ${quoted('targetRevision')}`, 'The branch, tag, or commit to deploy. A commit ID pins one exact version.');
    const guestbook = input.path === 'guestbook' &&
      (input.repoURL === 'https://github.com/argoproj/argocd-example-apps.git' ||
       input.repoURL === 'https://github.com/argoproj/argocd-example-apps');
    const lab = input.path === 'templates/lab/metrics-demo' &&
      input.repoURL === 'https://github.com/cavula/Kubernetes-config-builder.git';
    const pathNote = 'The folder in the repository that holds the files.';
    write(indent + 2, `path: ${quoted('path')}`, guestbook
      ? 'The Guestbook folder. Its AMD64-only image runs under AMD64 emulation on ARM64 hosts such as Apple Silicon Macs.'
      : lab ? 'Deploy sample-app from here. A pinned Prometheus binary serves its /metrics. A separate monitoring Prometheus collects them.'
        : pathNote);
    write(indent, 'destination:', 'Where Argo CD deploys the app.');
    write(indent + 2, `server: ${quoted('destinationServer')}`, input.destinationServer === inCluster
      ? 'The cluster to deploy to. This address means the cluster Argo CD runs in.'
      : 'The address of the cluster to deploy to.');
    write(indent + 2, `namespace: ${quoted('destinationNamespace')}`, 'The namespace for app objects that do not set their own.');
  }

  const kind = usageTemplates[id].label;
  write(0, 'apiVersion: argoproj.io/v1alpha1', 'Argo CD adds this API to Kubernetes. It is not built in.');
  write(0, `kind: ${kind}`, usageTemplates[id].description);
  write(0, 'metadata:', 'Basic details: the name and namespace of this object.');
  write(2, `name: ${quoted('name')}`, `A name for this ${kind}, unique in its namespace.`);
  write(2, `namespace: ${quoted('namespace')}`, 'Put it in the namespace Argo CD watches, usually argocd.');

  if (id === 'application' && input.cascade) {
    write(2, 'finalizers:', 'Kubernetes waits for Argo CD to clean up before deleting this Application.');
    write(4, '- resources-finalizer.argocd.argoproj.io', 'Deleting this Application also deletes the objects it deployed.');
  }

  if (id === 'application') {
    write(0, 'spec:', 'What to deploy and how to keep it in sync with Git.');
    applicationSpec(2);
    if (input.automated || input.createNamespace) {
      write(2, 'syncPolicy:', 'Rules for how Argo CD applies changes from Git.');
    }
    if (input.automated) {
      write(4, 'automated:', 'Apply Git changes automatically, without a manual sync.');
      write(6, `prune: ${input.prune === true}`, input.prune ? 'Delete objects that were removed from Git.' : 'Keep objects even after they are removed from Git.');
      write(6, `selfHeal: ${input.selfHeal === true}`, input.selfHeal ? 'Undo manual changes so the cluster matches Git again.' : 'Leave manual changes in place until the next sync.');
    }
    if (input.createNamespace) {
      write(4, 'syncOptions:', 'Extra options for each sync.');
      write(6, '- CreateNamespace=true', 'Create the namespace if missing. If the AppProject blocks Namespace objects, create it yourself instead.');
    }
  } else if (id === 'app-project') {
    write(0, 'spec:', 'The limits for every Application in this project.');
    write(2, 'sourceRepos:', 'Git repositories that Applications in this project may use.');
    write(4, `- ${quoted('repoURL')}`, 'Allow this repository.');
    write(2, 'destinations:', 'Clusters and namespaces where these Applications may deploy.');
    write(4, `- server: ${quoted('destinationServer')}`, 'Allow this cluster.');
    write(6, `namespace: ${quoted('destinationNamespace')}`, 'Allow only this namespace on that cluster.');
  } else {
    write(0, 'spec:', 'How to create several Applications from one template.');
    write(2, 'goTemplate: true', 'Fill in placeholders such as {{ .environment }} in the template below.');
    write(2, 'goTemplateOptions:', 'Settings for how placeholders are filled in.');
    write(4, '- missingkey=error', 'Stop with an error if a placeholder has no value.');
    write(2, 'generators:', 'Where the placeholder values come from.');
    write(4, '- list:', 'Create one Application for each item in this list.');
    write(8, 'elements:', 'The items. Each one sets an environment value.');
    write(10, `- environment: ${quoted('firstEnvironment')}`, 'First item: one Application for this environment.');
    write(10, `- environment: ${quoted('secondEnvironment')}`, 'Second item: one Application for this environment.');
    write(2, 'template:', 'The Application that each item fills in.');
    write(4, 'metadata:', 'Details for each created Application.');
    write(6, `name: ${quote(`${input.name}-{{ .environment }}`)}`, 'Add the environment to the name so each Application is unique.');
    write(4, 'spec:', 'What each created Application deploys.');
    applicationSpec(6);
  }

  return { text: lines.join('\n') + '\n', notes };
}
