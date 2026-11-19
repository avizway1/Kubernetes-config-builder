import { deepEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockLines, defaultLessonValues, glossary, lessonContent, lessonText, lineNote, matchLines, noteKey, renderLesson, renderMistake, yamlPaths,
} from '../frontend/src/lesson-builder.ts';
import { levels } from '../frontend/src/lessons.ts';

const words = text => text.trim().split(/\s+/).length;
const sentences = text => text.split(/(?<=[.!?])\s+(?=[A-Z])/);
const lessons = Object.values(lessonContent);

// Every combination of choice values, so notes and validation cover what a learner can produce.
function valueSets(lesson) {
  let sets = [defaultLessonValues(lesson)];
  for (const [name, choice] of Object.entries(lesson.choices ?? {})) {
    sets = sets.flatMap(values => choice.options.map(option => ({ ...values, [name]: option })));
  }
  return sets;
}

test('field paths follow indentation and list items', () => {
  deepEqual(yamlPaths([
    'apiVersion: v1', 'metadata:', '  name: web', '# note', 'spec:', '  containers:', '    - name: web',
    '      image: nginx', '      ports:', '        - containerPort: 80', '    - name: side',
  ]), [
    'apiVersion', 'metadata', 'metadata.name', undefined, 'spec', 'spec.containers', 'spec.containers[].name',
    'spec.containers[].image', 'spec.containers[].ports', 'spec.containers[].ports[].containerPort', 'spec.containers[].name',
  ]);
  deepEqual(yamlPaths(['kind: ConfigMap', 'data:', '  A: b', '---', 'kind: Pod', 'spec:']), ['kind', 'data', 'data.A', '---', 'kind', 'spec']);
});

test('line matching keeps earlier lines and reports new ones', () => {
  deepEqual(matchLines(['a', 'b', 'c'], ['a', 'x', 'b', 'c', 'y']), [0, -1, 1, 2, -1]);
});

test('every block keeps the earlier file and adds one to six YAML lines', () => {
  for (const lesson of lessons) {
    for (const values of valueSets(lesson)) {
      for (let block = 0; block < lesson.blocks.length; block++) {
        const before = block ? blockLines(lesson, block - 1, values) : [];
        const after = blockLines(lesson, block, values);
        const matches = matchLines(before, after);
        equal(matches.filter(index => index >= 0).length, before.length, `${lesson.id} block ${block + 1} drops a line`);
        const added = matches.filter(index => index < 0).length;
        ok(added >= 1 && added <= 6, `${lesson.id} block ${block + 1} adds ${added} lines`);
        ok(after.every(line => !line.includes('\t') && !line.includes('{{')), `${lesson.id} block ${block + 1}`);
      }
    }
  }
});

test('downloads have one comment per block when explanations are on, and none when off', () => {
  for (const lesson of lessons) {
    const values = defaultLessonValues(lesson);
    for (let step = 0; step < lesson.blocks.length; step++) {
      const on = renderLesson(lesson, step, values, true);
      const off = renderLesson(lesson, step, values, false);
      deepEqual(on.filter(line => line.comment).map(line => line.block).sort((a, b) => a - b), [...Array(step + 1).keys()], `${lesson.id} step ${step + 1}`);
      equal(off.filter(line => line.comment).length, 0);
      deepEqual(lessonText(off).trimEnd().split('\n'), blockLines(lesson, step, values));
      ok(!lessonText(on).startsWith('# kubectl'), 'no command header');
    }
  }
});

test('every line a learner can see has a plain-English note, and no note is unused', () => {
  for (const lesson of lessons) {
    const used = new Set();
    for (const values of valueSets(lesson)) {
      for (let step = 0; step < lesson.blocks.length; step++) {
        for (const line of renderLesson(lesson, step, values, true)) {
          const note = lineNote(lesson, line);
          ok(note, `${lesson.id} step ${step + 1}: no note for ${line.text}`);
          if (noteKey(lesson, line)) used.add(noteKey(lesson, line));
        }
      }
    }
    deepEqual([...used].sort(), Object.keys(lesson.notes).sort(), `${lesson.id} notes`);
  }
});

test('lesson text follows the style rules', () => {
  for (const lesson of lessons) {
    for (const note of Object.values(lesson.notes)) ok(words(note) <= 20, `${lesson.id}: ${note}`);
    for (const [index, block] of lesson.blocks.entries()) {
      const label = `${lesson.id} block ${index + 1}`;
      ok(words(block.comment) <= 20 && words(block.title) <= 6, label);
      for (const section of [block.what, block.why, block.ifRemoved]) {
        ok(sentences(section).length <= 2, `${label}: ${section}`);
        for (const sentence of sentences(section)) ok(words(sentence) <= 20, `${label}: ${sentence}`);
      }
      if (block.term) ok(glossary[block.term], `${label}: ${block.term} is not in the glossary`);
      if (block.tryChange) ok(lesson.choices?.[block.tryChange], label);
      if (block.mistake) {
        for (const section of [block.mistake.explain, block.mistake.fix]) {
          ok(sentences(section).length <= 2, `${label}: ${section}`);
          for (const sentence of sentences(section)) ok(words(sentence) <= 20, `${label}: ${sentence}`);
        }
      }
    }
    ok(lesson.finishedAt >= 0 && lesson.finishedAt < lesson.blocks.length, lesson.id);
    // A file with a kind is applied to a cluster. Level 0's YAML-only file has nothing to run.
    if (lesson.kind) equal(lesson.tryIt[0].command, `kubectl apply -f ${lesson.filename}`);
    else equal(lesson.tryIt.length, 0, lesson.id);
    for (const item of lesson.tryIt) ok(!/\b8080\b/.test(item.command), 'port 8080 is the dashboard port');
    const official = lesson.kind ? ['https://kubernetes.io/docs/'] : ['https://kubernetes.io/docs/', 'https://yaml.org/spec/'];
    for (const source of lesson.sources) ok(official.some(prefix => source.url.startsWith(prefix)), source.url);
  }
  for (const definition of Object.values(glossary)) ok(words(definition) <= 20, definition);
});

test('a choice changes only the line it controls', () => {
  const lesson = lessonContent.deployment;
  const last = lesson.blocks.length - 1;
  const two = lessonText(renderLesson(lesson, last, { replicas: '2' }, true)).split('\n');
  const three = lessonText(renderLesson(lesson, last, { replicas: '3' }, true)).split('\n');
  deepEqual(two.filter((line, index) => line !== three[index]), ['  replicas: 2']);
});

test('built lessons appear in the catalogue and run anywhere', () => {
  const catalogue = new Map(levels.flatMap(level => level.lessons).map(lesson => [lesson.id, lesson]));
  for (const lesson of lessons) {
    ok(catalogue.has(lesson.id), lesson.id);
    equal(catalogue.get(lesson.id).runsOn, 'anywhere', lesson.id);
    const lines = blockLines(lesson, lesson.blocks.length - 1, defaultLessonValues(lesson));
    if (lesson.kind) ok(lines.includes(`kind: ${lesson.kind}`), `${lesson.id} builds a ${lesson.kind}`);
    else ok(!lines.some(line => line.startsWith('kind:')), `${lesson.id} has no kind`);
  }
  for (const id of ['reading-yaml', 'manifest-parts']) ok(lessonContent[id], `Level 0 lesson ${id} is built`);
});

test('a mistake changes only the line it names, and every line it shows has a note', () => {
  const mistakes = lessons.flatMap(lesson => lesson.blocks.flatMap((block, index) => (block.mistake ? [{ lesson, block, index }] : [])));
  ok(mistakes.length >= 1, 'Level 0 shows the indentation mistake');
  for (const { lesson, block, index } of mistakes) {
    const label = `${lesson.id} block ${index + 1}`;
    const fixed = blockLines(lesson, index, defaultLessonValues(lesson));
    const shown = renderMistake(lesson, block.mistake);
    const broken = shown.text.trimEnd().split('\n');
    equal(broken.length, fixed.length, label);
    deepEqual(broken.flatMap((line, at) => (line === fixed[at] ? [] : [at + 1])), [block.mistake.line], label);
    equal(broken[block.mistake.line - 1].trim(), fixed[block.mistake.line - 1].trim(), `${label}: only the spaces change`);
    ok(shown.notes.every(Boolean), `${label}: every line has a note`);
    equal(shown.notes[block.mistake.line - 1], block.mistake.explain, label);
    ok(block.mistake.error.startsWith(`yaml: line ${block.mistake.line}: `), `${label}: the error names the line`);
  }
});
