// Validate every finished lesson step with strict kubeconform for each supported Kubernetes version.
// Needs kubeconform on PATH and the pinned schemas from `python3 backend/download-schemas.py`.
// Run from the project root: node --test tests/lesson-manifests.check.mjs
import { ok } from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { defaultLessonValues, lessonContent, lessonText, renderLesson } from '../frontend/src/lesson-builder.ts';

const schemas = fileURLToPath(new URL('../.runtime/schemas', import.meta.url));
const versions = ['1.35.0', '1.36.0', '1.37.0'];

function valueSets(lesson) {
  let sets = [defaultLessonValues(lesson)];
  for (const [name, choice] of Object.entries(lesson.choices ?? {})) {
    sets = sets.flatMap(values => choice.options.map(option => ({ ...values, [name]: option })));
  }
  return sets;
}

test('every finished lesson step passes strict kubeconform', () => {
  ok(existsSync(join(schemas, 'v1.37.0-standalone-strict', 'pod-v1.json')), `Missing schemas in ${schemas}. Run python3 backend/download-schemas.py.`);
  const folder = mkdtempSync(join(tmpdir(), 'lesson-manifests-'));
  try {
    const files = [];
    let objects = 0;
    for (const lesson of Object.values(lessonContent).filter(lesson => lesson.kind)) {
      for (const [set, values] of valueSets(lesson).entries()) {
        for (let step = lesson.finishedAt; step < lesson.blocks.length; step++) {
          const file = join(folder, `${lesson.id}-${set}-${step + 1}.yaml`);
          const text = lessonText(renderLesson(lesson, step, values, true));
          objects += text.split('\n').filter(line => line.startsWith('kind:')).length;
          writeFileSync(file, text);
          files.push(file);
        }
      }
    }
    for (const version of versions) {
      const output = execFileSync('kubeconform', [
        '-strict', '-summary', '-kubernetes-version', version,
        '-schema-location', `${schemas}/{{ .NormalizedKubernetesVersion }}-standalone{{ .StrictSuffix }}/{{ .ResourceKind }}{{ .KindSuffix }}.json`,
        ...files,
      ], { encoding: 'utf8' });
      ok(output.includes(`${objects} resources found in ${files.length} files - Valid: ${objects}, Invalid: 0, Errors: 0, Skipped: 0`), `${version}: ${output}`);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// kubeconform reads YAML before it looks for a kind, so a file without one fails only with "missing 'kind' key"
// when it parses, and with the YAML reader's own message when it does not.
function readYaml(text) {
  const folder = mkdtempSync(join(tmpdir(), 'lesson-yaml-'));
  try {
    const file = join(folder, 'file.yaml');
    writeFileSync(file, text);
    try {
      return execFileSync('kubeconform', [file], { encoding: 'utf8' });
    } catch (error) {
      return String(error.stdout);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test('every step of a YAML-only lesson parses', () => {
  for (const lesson of Object.values(lessonContent).filter(lesson => !lesson.kind)) {
    for (let step = 0; step < lesson.blocks.length; step++) {
      for (const explanations of [true, false]) {
        const output = readYaml(lessonText(renderLesson(lesson, step, defaultLessonValues(lesson), explanations)));
        ok(output.includes("missing 'kind' key") && !output.includes('yaml:'), `${lesson.id} step ${step + 1}: ${output}`);
      }
    }
  }
});

test('each mistake shows the exact message the YAML reader prints', () => {
  let checked = 0;
  for (const lesson of Object.values(lessonContent)) {
    for (const block of lesson.blocks.filter(block => block.mistake)) {
      const output = readYaml(block.mistake.yaml);
      ok(output.includes(`error converting YAML to JSON: ${block.mistake.error}\n`), `${lesson.id}: ${output}`);
      checked++;
    }
  }
  ok(checked >= 1, 'no mistakes were checked');
});
