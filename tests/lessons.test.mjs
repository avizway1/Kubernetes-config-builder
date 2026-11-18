import { deepEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import { labs, levels, runsOnLabels } from '../frontend/src/lessons.ts';
import { usageTemplateIds } from '../frontend/src/usage-values.ts';

const words = text => text.trim().split(/\s+/).length;

test('the lesson catalogue follows the approved beginner learning path', () => {
  deepEqual(levels.map(level => level.id), ['level-0', 'level-1', 'level-2', 'level-3']);
  deepEqual(levels[1].lessons.map(lesson => lesson.id), [
    'pod', 'deployment', 'namespace', 'service', 'configmap', 'secret', 'jobs', 'autoscaling',
    'load-balancer', 'ingress', 'storage', 'pod-identity',
  ]);
  deepEqual(levels[1].lessons.filter(lesson => lesson.runsOn === 'eks').map(lesson => lesson.id),
    ['load-balancer', 'ingress', 'storage', 'pod-identity']);
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
  for (const level of levels.slice(2)) {
    for (const lesson of level.lessons) {
      equal(lesson.runsOn, 'k3s', lesson.id);
      ok(lesson.open, `${lesson.id} has nothing to open`);
      ok(usageTemplateIds[lesson.open.tool], `${lesson.id} opens an unknown tool`);
      if (lesson.open.template) ok(usageTemplateIds[lesson.open.tool].includes(lesson.open.template), lesson.id);
      else equal(lesson.open.mode, 'install', lesson.id);
    }
  }
  for (const lesson of levels.slice(0, 2).flatMap(level => level.lessons)) {
    equal(lesson.open, undefined, `${lesson.id} is not built yet`);
  }
});
