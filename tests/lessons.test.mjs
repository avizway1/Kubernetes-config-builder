import { deepEqual, equal, ok } from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { labs, levels, runsOnLabels } from '../frontend/src/lessons.ts';

const words = text => text.trim().split(/\s+/).length;

// Charan removed lessons 35 and 37 on 2026-11-20, so phase 1 ends at Level 8. Level 9 returns in phase 2 with lesson 36.
test('the lesson catalogue follows the approved class curriculum, Levels 0 to 8, without phase 2 tool lessons', () => {
  deepEqual(levels.map(level => level.id), [...Array(9).keys()].map(index => `level-${index}`));
  deepEqual(levels.map(level => level.lessons.map(lesson => lesson.id)), [
    ['reading-yaml', 'manifest-parts'],
    ['pod', 'replicaset', 'deployment', 'resources', 'namespace', 'configmap', 'secret', 'jobs'],
    ['service', 'dns', 'node-port', 'external-name', 'load-balancer', 'ingress'],
    ['storage', 'headless-service', 'statefulset', 'efs', 'daemonset'],
    ['limit-range', 'resource-quota', 'probes', 'timing', 'pod-disruption-budget'],
    ['node-affinity', 'pod-anti-affinity', 'taints', 'node-pool'],
    ['rolling-update', 'recreate', 'blue-green', 'canary'],
    ['autoscaling'],
    ['pod-identity'],
  ]);
  deepEqual(levels.flatMap(level => level.lessons).filter(lesson => lesson.runsOn === 'eks').map(lesson => lesson.id),
    ['load-balancer', 'ingress', 'storage', 'statefulset', 'efs', 'node-pool', 'pod-identity']);
  deepEqual(labs.map(lab => lab.runsOn), ['anywhere', 'eks']);
});

test('lesson text stays short and every badge has a label', () => {
  const ids = new Set();
  for (const item of [...levels.flatMap(level => level.lessons), ...labs]) {
    ok(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    ok(runsOnLabels[item.runsOn], `${item.id} has no badge label`);
    ok(words(item.summary) <= 20, `${item.id}: ${item.summary}`);
  }
  for (const level of levels) ok(words(level.summary) <= 20, level.id);
});

test('nothing in Learn Kubernetes opens Build a config or is tested only on K3s in phase 1', () => {
  for (const item of [...levels.flatMap(level => level.lessons), ...labs]) {
    equal('open' in item, false, `${item.id} opens Build a config`);
    ok(item.runsOn !== 'k3s', `${item.id} belongs to phase 2`);
  }
});

// Each lab guide lives in docs/ and is linked from the catalogue. Its YAML must match the files learners download.
test('lab guides exist, and their YAML and downloads match the lab files', () => {
  const repo = 'https://github.com/avizway1/Kubernetes-config-builder/blob/main/';
  const raw = 'https://raw.githubusercontent.com/avizway1/Kubernetes-config-builder/main/';
  const root = new URL('../', import.meta.url);
  const labFiles = readdirSync(new URL('templates/kubernetes/labs/', root))
    .map(name => readFileSync(new URL(`templates/kubernetes/labs/${name}`, root), 'utf8'));
  for (const lab of labs.filter(lab => lab.link)) {
    ok(lab.link.startsWith(repo), `${lab.id} links outside this repository`);
    const guide = new URL(lab.link.slice(repo.length), root);
    ok(existsSync(guide), `${lab.id}: missing ${guide.pathname}`);
    const text = readFileSync(guide, 'utf8');
    const yamlBlocks = [...text.matchAll(/^```yaml\n([\s\S]*?)^```$/gm)].map(match => match[1]);
    ok(yamlBlocks.length > 0, `${lab.id} shows no YAML`);
    for (const block of yamlBlocks) ok(labFiles.includes(block), `${lab.id}: a YAML block differs from every file in templates/kubernetes/labs`);
    for (const [url] of text.matchAll(new RegExp(`${raw.replaceAll('.', '\\.')}[^\\s)]+`, 'g'))) {
      ok(existsSync(new URL(url.slice(raw.length), root)), `${lab.id}: ${url} does not exist in this repository`);
    }
    for (const [comment] of text.matchAll(/<!--.*-->/g)) ok(/^<!-- (do|check): .+ -->$/.test(comment), `${lab.id}: unknown hidden step ${comment}`);
  }
});
