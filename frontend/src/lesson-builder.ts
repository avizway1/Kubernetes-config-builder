import readingYamlLesson from '../../templates/kubernetes/lessons/reading-yaml.json' with { type: 'json' };
import manifestPartsLesson from '../../templates/kubernetes/lessons/manifest-parts.json' with { type: 'json' };
import podLesson from '../../templates/kubernetes/lessons/pod.json' with { type: 'json' };
import replicaSetLesson from '../../templates/kubernetes/lessons/replicaset.json' with { type: 'json' };
import deploymentLesson from '../../templates/kubernetes/lessons/deployment.json' with { type: 'json' };
import resourcesLesson from '../../templates/kubernetes/lessons/resources.json' with { type: 'json' };
import namespaceLesson from '../../templates/kubernetes/lessons/namespace.json' with { type: 'json' };
import configMapLesson from '../../templates/kubernetes/lessons/configmap.json' with { type: 'json' };
import secretLesson from '../../templates/kubernetes/lessons/secret.json' with { type: 'json' };
import jobsLesson from '../../templates/kubernetes/lessons/jobs.json' with { type: 'json' };
import serviceLesson from '../../templates/kubernetes/lessons/service.json' with { type: 'json' };
import dnsLesson from '../../templates/kubernetes/lessons/dns.json' with { type: 'json' };
import nodePortLesson from '../../templates/kubernetes/lessons/node-port.json' with { type: 'json' };
import externalNameLesson from '../../templates/kubernetes/lessons/external-name.json' with { type: 'json' };
import headlessServiceLesson from '../../templates/kubernetes/lessons/headless-service.json' with { type: 'json' };
import daemonSetLesson from '../../templates/kubernetes/lessons/daemonset.json' with { type: 'json' };
import limitRangeLesson from '../../templates/kubernetes/lessons/limit-range.json' with { type: 'json' };
import resourceQuotaLesson from '../../templates/kubernetes/lessons/resource-quota.json' with { type: 'json' };
import probesLesson from '../../templates/kubernetes/lessons/probes.json' with { type: 'json' };
import timingLesson from '../../templates/kubernetes/lessons/timing.json' with { type: 'json' };
import podDisruptionBudgetLesson from '../../templates/kubernetes/lessons/pod-disruption-budget.json' with { type: 'json' };
import nodeAffinityLesson from '../../templates/kubernetes/lessons/node-affinity.json' with { type: 'json' };
import podAntiAffinityLesson from '../../templates/kubernetes/lessons/pod-anti-affinity.json' with { type: 'json' };
import taintsLesson from '../../templates/kubernetes/lessons/taints.json' with { type: 'json' };
import rollingUpdateLesson from '../../templates/kubernetes/lessons/rolling-update.json' with { type: 'json' };
import recreateLesson from '../../templates/kubernetes/lessons/recreate.json' with { type: 'json' };
import blueGreenLesson from '../../templates/kubernetes/lessons/blue-green.json' with { type: 'json' };
import canaryLesson from '../../templates/kubernetes/lessons/canary.json' with { type: 'json' };
import autoscalingLesson from '../../templates/kubernetes/lessons/autoscaling.json' with { type: 'json' };
import glossaryData from '../../templates/kubernetes/glossary.json' with { type: 'json' };

// A broken copy of a block's file, with the message a YAML reader prints for it. Line numbers count from 1.
export type LessonMistake = { yaml: string; line: number; error: string; explain: string; fix: string };

// How the cluster check confirms a Try it result. `run` replaces a command learners cannot run as written, such as
// one with a placeholder or one that keeps running. The output must contain every `expect` text and match `pattern`,
// and `lines` counts the non-empty lines it prints. `anyStatus` accepts a command that fails on purpose, such as one
// Kubernetes refuses. `then` checks the effect of the command afterwards.
// Values such as {{replicas}} are filled from the lesson's choices.
export type LessonCheck = { run?: string; expect?: string[]; pattern?: string; lines?: number | string; anyStatus?: boolean };
export type LessonTryIt = { command: string; result: string; check?: LessonCheck & { then?: LessonCheck } };

// Read it: a question about the finished file, with three answers. `line` is the line the question is about.
export type LessonQuestion = { question: string; answers: string[]; correct: number; explain: string; line: number };

// Fix it: the finished file with one line replaced. `message` is what learners see when they find the line:
// - yaml: the YAML reader's message, checked with kubeconform in CI.
// - apply: what `kubectl apply` prints for the broken copy, checked on K3s.
// - command: the copy applies, and `command` shows the problem. `expect` is a pattern its output matches on K3s.
export type LessonFix = {
  line: number;
  text: string;
  source: 'yaml' | 'apply' | 'command';
  command?: string;
  expect?: string;
  message: string;
  explain: string;
  fix: string;
};

export type LessonPractice = { questions: LessonQuestion[]; fix: LessonFix };

export type LessonChoice = { label: string; options: string[]; default: string };

// Each block holds the whole file as it stands after that block, so authors can read every step as written.
export type LessonBlock = {
  title: string;
  what: string;
  why: string;
  ifRemoved: string;
  comment: string;
  term?: string;
  tryChange?: string;
  mistake?: LessonMistake;
  yaml: string;
};

export type LessonContent = {
  id: string;
  // The Kubernetes kind the file builds. Level 0's YAML lesson has none, so it is checked only as YAML.
  kind?: string;
  filename: string;
  // Earlier lessons whose downloads Try it also applies, such as the Deployment a Service sends traffic to.
  uses?: string[];
  // How many nodes Try it needs. Scheduling lessons need three, so learners add two worker nodes to the practice cluster.
  nodes?: number;
  finishedAt: number;
  choices?: Record<string, LessonChoice>;
  blocks: LessonBlock[];
  notes: Record<string, string>;
  tryIt: LessonTryIt[];
  practice?: LessonPractice;
  sources: { title: string; url: string }[];
};

export type LessonValues = Record<string, string>;

export type LessonLine = { text: string; block: number; path?: string; kind?: string; comment?: boolean };

export const lessonContent: Record<string, LessonContent> = {
  'reading-yaml': readingYamlLesson as LessonContent,
  'manifest-parts': manifestPartsLesson as LessonContent,
  pod: podLesson as LessonContent,
  replicaset: replicaSetLesson as LessonContent,
  deployment: deploymentLesson as LessonContent,
  resources: resourcesLesson as LessonContent,
  namespace: namespaceLesson as LessonContent,
  configmap: configMapLesson as LessonContent,
  secret: secretLesson as LessonContent,
  jobs: jobsLesson as LessonContent,
  service: serviceLesson as LessonContent,
  dns: dnsLesson as LessonContent,
  'node-port': nodePortLesson as LessonContent,
  'external-name': externalNameLesson as LessonContent,
  'headless-service': headlessServiceLesson as LessonContent,
  daemonset: daemonSetLesson as LessonContent,
  'limit-range': limitRangeLesson as LessonContent,
  'resource-quota': resourceQuotaLesson as LessonContent,
  probes: probesLesson as LessonContent,
  timing: timingLesson as LessonContent,
  'pod-disruption-budget': podDisruptionBudgetLesson as LessonContent,
  'node-affinity': nodeAffinityLesson as LessonContent,
  'pod-anti-affinity': podAntiAffinityLesson as LessonContent,
  taints: taintsLesson as LessonContent,
  'rolling-update': rollingUpdateLesson as LessonContent,
  recreate: recreateLesson as LessonContent,
  'blue-green': blueGreenLesson as LessonContent,
  canary: canaryLesson as LessonContent,
  autoscaling: autoscalingLesson as LessonContent,
};

export const glossary: Record<string, string> = glossaryData;

export function defaultLessonValues(lesson: LessonContent): LessonValues {
  return Object.fromEntries(Object.entries(lesson.choices ?? {}).map(([name, choice]) => [name, choice.default]));
}

function fill(yaml: string, values: LessonValues) {
  return yaml.replace(/\{\{(\w+)\}\}/g, (_, name: string) => values[name] ?? '');
}

export function blockLines(lesson: LessonContent, block: number, values: LessonValues) {
  return fill(lesson.blocks[block].yaml, values).replace(/\n$/, '').split('\n');
}

// For each line in `after`, the index of the same line in `before`, or -1 when the line is new.
export function matchLines(before: string[], after: string[]): number[] {
  const lengths = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i][j] = before[i] === after[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const matches = new Array<number>(after.length).fill(-1);
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) matches[j++] = i++;
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return matches;
}

// Dotted field path for each YAML line, with [] for list items: spec.containers[].image.
// A --- line starts a new object and gets the path ---.
export function yamlPaths(lines: string[]): (string | undefined)[] {
  const stack: { indent: number; path: string }[] = [];
  return lines.map(line => {
    const trimmed = line.trim();
    if (trimmed === '---') {
      stack.length = 0;
      return '---';
    }
    if (!trimmed || trimmed.startsWith('#')) return undefined;
    let indent = line.length - line.trimStart().length;
    let content = trimmed;
    if (content.startsWith('- ')) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const item = `${stack[stack.length - 1]?.path ?? ''}[]`;
      stack.push({ indent, path: item });
      indent += 2;
      content = content.slice(2).trimStart();
    }
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]?.path;
    const colon = content.indexOf(':');
    if (colon < 0) return parent;
    const path = parent ? `${parent}.${content.slice(0, colon)}` : content.slice(0, colon);
    stack.push({ indent, path });
    return path;
  });
}

// The file after `step` blocks, with one comment above the first line each block added.
export function renderLesson(lesson: LessonContent, step: number, values: LessonValues, explanations: boolean): LessonLine[] {
  let lines = blockLines(lesson, 0, values);
  let owners = lines.map(() => 0);
  for (let block = 1; block <= step; block++) {
    const next = blockLines(lesson, block, values);
    const matches = matchLines(lines, next);
    owners = matches.map(index => (index < 0 ? block : owners[index]));
    lines = next;
  }
  const paths = yamlPaths(lines);
  const kinds = documentKinds(lines);
  const commented = new Set<number>();
  const output: LessonLine[] = [];
  lines.forEach((text, index) => {
    const block = owners[index];
    if (explanations && !commented.has(block)) {
      commented.add(block);
      const indent = text.slice(0, text.length - text.trimStart().length);
      output.push({ text: `${indent}# ${lesson.blocks[block].comment}`, block, comment: true });
    }
    output.push({ text, block, path: paths[index], kind: kinds[index] });
  });
  return output;
}

export function lessonText(lines: LessonLine[]) {
  return `${lines.map(line => line.text).join('\n')}\n`;
}

// The kind of the object each line belongs to, so files with several objects can explain the same field differently.
function documentKinds(lines: string[]) {
  const kinds: (string | undefined)[] = [];
  let start = 0;
  for (let end = 0; end <= lines.length; end++) {
    if (end < lines.length && lines[end].trim() !== '---') continue;
    const kind = lines.slice(start, end).find(line => line.startsWith('kind:'))?.slice(5).trim();
    for (let index = start; index < end; index++) kinds[index] = kind;
    if (end < lines.length) kinds[end] = undefined;
    start = end + 1;
  }
  return kinds;
}

// Notes are keyed by field path, or by Kind:path when a file explains a field differently for each object.
export function noteKey(lesson: LessonContent, line: LessonLine) {
  if (line.comment || !line.path) return undefined;
  const specific = `${line.kind}:${line.path}`;
  return line.kind && specific in lesson.notes ? specific : line.path;
}

export function lineNote(lesson: LessonContent, line: LessonLine) {
  if (line.comment) return lesson.blocks[line.block].what;
  const key = noteKey(lesson, line);
  return key && lesson.notes[key];
}

// The broken copy as shown: no block comments, so the line numbers match the error message.
export function renderMistake(lesson: LessonContent, mistake: LessonMistake): { text: string; notes: (string | undefined)[] } {
  const lines = mistake.yaml.replace(/\n$/, '').split('\n');
  const paths = yamlPaths(lines);
  return {
    text: `${lines.join('\n')}\n`,
    notes: lines.map((_, index) => (index + 1 === mistake.line ? mistake.explain : lesson.notes[paths[index] ?? ''])),
  };
}

// The finished file as Read it and Fix it show it: default choices and no block comments, so line numbers are plain.
export function practiceLines(lesson: LessonContent): LessonLine[] {
  return renderLesson(lesson, lesson.blocks.length - 1, defaultLessonValues(lesson), false);
}

export function practiceFile(lesson: LessonContent) {
  const lines = practiceLines(lesson);
  return { text: lessonText(lines), notes: lines.map(line => lineNote(lesson, line)) };
}

// The broken copy for Fix it: the practice file with one line replaced.
export function brokenFile(lesson: LessonContent, fix: LessonFix) {
  const lines = practiceLines(lesson);
  const texts = lines.map((line, index) => (index + 1 === fix.line ? fix.text : line.text));
  return { text: `${texts.join('\n')}\n`, notes: lines.map(line => lineNote(lesson, line)) };
}
