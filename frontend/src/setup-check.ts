import setupData from '../../templates/kubernetes/setup.json' with { type: 'json' };

// Set up your laptop: the dashboard runs in a container and cannot see the laptop's programs, so learners run one
// check command and paste what it prints. See specs/setup-check.md.

export type SystemId = 'macos' | 'windows' | 'linux';
export type ToolId = 'docker' | 'kubectl' | 'k3d' | 'aws' | 'aws-signed-in' | 'eksctl';
export type LabId = 'lab-1' | 'lab-2';

type Source = { title: string; url: string };
export type SetupTool = {
  id: Exclude<ToolId, 'aws-signed-in'>;
  name: string;
  what: string;
  install: Record<SystemId, { text: string; commands?: string }>;
  after?: string;
  sources: Source[];
};
export type SetupData = {
  check: string;
  systems: { id: SystemId; label: string }[];
  requirements: {
    intro: string;
    items: { label: string; text: string; systems?: Record<SystemId, string> }[];
    sources: Source[];
  };
  windowsFirst: { title: string; steps: { text: string; commands?: string }[]; sources: Source[] };
  tools: SetupTool[];
  practiceCluster: {
    intro: string;
    steps: { title: string; text: string; commands: string; expect: string; sources: Source[] }[];
    problems: { message: string; text: string; commands?: string; sources: Source[] }[];
  };
};

export const setup = setupData as SetupData;

// What each lab needs. Lab 2 does not use Docker or k3d.
export const labTools: Record<LabId, ToolId[]> = {
  'lab-1': ['docker', 'kubectl', 'k3d'],
  'lab-2': ['aws', 'aws-signed-in', 'eksctl', 'kubectl'],
};

// Version rules, with their reasons in specs/setup-check.md:
// - kubectl is supported within one minor version of the cluster, and both labs run Kubernetes 1.37.
// - Lab 1 was tested with k3d 5.9.0, and Lab 2 with an eksctl 0.231.0 build.
const kubectlMinors = [36, 38];
const k3dMinimum = [5, 9, 0];
const eksctlMinimum = [0, 231, 0];

export const toolNeeds: Record<Exclude<ToolId, 'aws-signed-in'>, string> = {
  docker: 'Running',
  kubectl: `1.${kubectlMinors[0]} to 1.${kubectlMinors[1]}`,
  k3d: `${k3dMinimum.join('.')} or newer`,
  aws: 'Version 2, signed in',
  eksctl: `${eksctlMinimum.join('.')} or newer`,
};

export const toolLabels: Record<ToolId, string> = {
  docker: 'Docker',
  kubectl: 'kubectl',
  k3d: 'k3d',
  aws: 'AWS CLI',
  'aws-signed-in': 'AWS sign-in',
  eksctl: 'eksctl',
};

export type ToolResult = { id: ToolId; ready: boolean; message: string; fix?: string };
export type SetupReport = { valid: boolean; system?: string; tools: Partial<Record<ToolId, ToolResult>> };

// 1.36.1 from v1.36.1, 0.231.0-dev+abc from 0.231.0. Anything else is unreadable.
function version(text: string) {
  const match = text.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).map(Number) : undefined;
}

function atLeast(found: number[], minimum: number[]) {
  for (let index = 0; index < minimum.length; index++) {
    if (found[index] !== minimum[index]) return found[index] > minimum[index];
  }
  return true;
}

const installAgain = 'Install it with the card above, then run the check again.';

function judge(id: ToolId, value: string): ToolResult {
  const label = toolLabels[id];
  if (value === 'missing') return { id, ready: false, message: `${label} is missing`, fix: installAgain };
  switch (id) {
    case 'docker': {
      if (value === 'not-running') {
        return { id, ready: false, message: 'Docker is not running', fix: 'Start Docker Desktop, or Docker on Linux, then run the check again.' };
      }
      return { id, ready: true, message: `Docker ${value.split(' ')[0]} is running` };
    }
    case 'kubectl': {
      const found = version(value);
      if (!found) return { id, ready: false, message: `kubectl printed a version we can't read: ${value}`, fix: installAgain };
      const ready = found[0] === 1 && found[1] >= kubectlMinors[0] && found[1] <= kubectlMinors[1];
      return ready
        ? { id, ready, message: `kubectl ${value}` }
        : { id, ready, message: `kubectl ${value} is too ${found[1] < kubectlMinors[0] ? 'old' : 'new'} for Kubernetes 1.37`, fix: `Install kubectl ${toolNeeds.kubectl} with the card above.` };
    }
    case 'k3d':
    case 'eksctl': {
      const found = version(value);
      const minimum = id === 'k3d' ? k3dMinimum : eksctlMinimum;
      if (found && atLeast(found, minimum)) return { id, ready: true, message: `${label} ${value}` };
      return { id, ready: false, message: `${label} ${value} is older than ${minimum.join('.')}`, fix: 'Install the latest version with the card above.' };
    }
    case 'aws': {
      const found = value.match(/^aws-cli\/(\d+)\./);
      if (found?.[1] === '2') return { id, ready: true, message: `AWS CLI ${value.slice('aws-cli/'.length)}` };
      return { id, ready: false, message: `AWS CLI ${value.replace('aws-cli/', '')} is not version 2`, fix: 'Install AWS CLI version 2 with the card above.' };
    }
    case 'aws-signed-in':
      return value === 'yes'
        ? { id, ready: true, message: 'Signed in to AWS' }
        : { id, ready: false, message: 'Not signed in to AWS', fix: 'Run aws configure, or aws sso login, then run the check again.' };
  }
}

// Read the check's output. Unknown lines are ignored, and a tool with no line is left unchecked.
export function readReport(text: string): SetupReport {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const report: SetupReport = { valid: lines.includes('lkme-check 1'), tools: {} };
  for (const line of lines) {
    const space = line.indexOf(' ');
    if (space < 0) continue;
    const name = line.slice(0, space);
    const value = line.slice(space + 1).trim();
    if (name === 'system') report.system = value;
    else if (name in toolLabels) report.tools[name as ToolId] = judge(name as ToolId, value);
  }
  return report;
}

export function labReady(report: SetupReport | undefined, lab: LabId) {
  return Boolean(report?.valid && labTools[lab].every(id => report.tools[id]?.ready));
}

// The tools a lab still needs: failed, or missing from the report.
export function labMissing(report: SetupReport | undefined, lab: LabId): ToolResult[] {
  return labTools[lab]
    .map(id => report?.tools[id] ?? { id, ready: false, message: `${toolLabels[id]} not checked yet` })
    .filter(result => !result.ready);
}

export function systemLabel(system: string | undefined) {
  if (!system) return undefined;
  if (system.endsWith(' WSL')) return 'Windows (WSL 2)';
  if (system.startsWith('Darwin')) return 'macOS';
  if (system.startsWith('Linux')) return 'Linux';
  return system;
}

// The last check is kept in this browser. Storage can be blocked, so callers keep their own copy for the visit.
export type SavedCheck = { report: string; checkedAt: string };
const storageKey = 'learning-kubernetes:setup-check';

export function loadCheck(): SavedCheck | undefined {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    return typeof saved?.report === 'string' && typeof saved?.checkedAt === 'string' ? saved : undefined;
  } catch {
    return undefined;
  }
}

export function saveCheck(check: SavedCheck) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(check));
  } catch {
    // The unlock then lasts for this visit only.
  }
}

// The browser's best guess at the learner's system. Learners can change it.
export function guessSystem(userAgent: string): SystemId {
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macos';
  return 'linux';
}
