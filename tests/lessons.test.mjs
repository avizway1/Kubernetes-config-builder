import { deepEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import { labs, levels, runsOnLabels } from '../frontend/src/lessons.ts';
import { usageTemplateIds } from '../frontend/src/usage-values.ts';

const words = text => text.trim().split(/\s+/).length;

const tools = ['argo-application', 'argo-project', 'prometheus-service', 'argo-application-set',
  'prometheus-scrape-job', 'prometheus-alert-rule', 'install-tool'];

test('the lesson catalogue follows the approved ten-level class curriculum', () => {
  deepEqual(levels.map(level => level.id), [...Array(10).keys()].map(index => `level-${index}`));
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
    ['unknown-kinds', ...tools, 'final-challenge'],
  ]);
  deepEqual(levels.flatMap(level => level.lessons).filter(lesson => lesson.runsOn === 'eks').map(lesson => lesson.id),
    ['load-balancer', 'ingress', 'storage', 'statefulset', 'efs', 'node-pool', 'pod-identity']);
  deepEqual(labs.map(lab => lab.runsOn), ['anywhere', 'eks', 'k3s']);
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

test('existing tool content is marked as tested on K3s and opens a real template', () => {
  const all = levels.flatMap(level => level.lessons);
  for (const lesson of all) {
    if (!tools.includes(lesson.id)) {
      equal(lesson.open, undefined, `${lesson.id} opens the builder`);
      continue;
    }
    equal(lesson.runsOn, 'k3s', lesson.id);
    ok(lesson.open, `${lesson.id} has nothing to open`);
    ok(usageTemplateIds[lesson.open.tool], `${lesson.id} opens an unknown tool`);
    if (lesson.open.template) ok(usageTemplateIds[lesson.open.tool].includes(lesson.open.template), lesson.id);
    else equal(lesson.open.mode, 'install', lesson.id);
  }
});
