import { deepEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockLines, defaultLessonValues, glossary, brokenFile, lessonContent, lessonText, lineNote, matchLines, noteKey, practiceLines, renderLesson, renderMistake, yamlPaths,
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
    // Try it applies the downloads of any earlier lessons this one uses. Files it needs first, such as the Deployment
    // a Service selects, come before the lesson's own file. Others, such as a Pod tried in a new namespace, may follow.
    const uses = (lesson.uses ?? []).map(id => lessonContent[id]);
    const commands = lesson.tryIt.map(item => item.command);
    if (lesson.kind) {
      const own = commands.indexOf(`kubectl apply -f ${lesson.filename}`);
      ok(own >= 0, `${lesson.id}: Try it applies ${lesson.filename}`);
      deepEqual(commands.slice(0, own), commands.slice(0, own).filter(command => uses.some(used => command === `kubectl apply -f ${used.filename}`)), `${lesson.id}: only used files come first`);
      for (const used of uses) ok(commands.some(command => /^kubectl apply\b/.test(command) && command.endsWith(` -f ${used.filename}`)), `${lesson.id}: Try it applies ${used.filename}`);
    } else equal(lesson.tryIt.length, 0, lesson.id);
    const order = levels.flatMap(level => level.lessons).map(item => item.id);
    for (const used of uses) ok(used && order.indexOf(used.id) < order.indexOf(lesson.id), `${lesson.id} can only use an earlier, built lesson`);
    for (const item of lesson.tryIt) {
      ok(!/\b8080\b/.test(item.command), 'port 8080 is the dashboard port');
      // tests/lesson-cluster.check.mjs confirms every result on K3s, so each one needs something to check.
      const tests = check => check && (check.expect?.length || check.pattern || check.lines !== undefined);
      ok(tests(item.check), `${lesson.id}: "${item.command}" has no cluster check`);
      if (item.check.then) ok(item.check.then.run && tests(item.check.then), `${lesson.id}: "${item.command}" has an incomplete follow-up check`);
      if (item.command.includes('<')) ok(item.check.run, `${lesson.id}: "${item.command}" has a placeholder, so its check needs a command to run`);
    }
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

test('every lesson has Read it and Fix it practice that follows the style rules', () => {
  const short = (label, text, most) => {
    ok(sentences(text).length <= most, `${label}: ${text}`);
    for (const sentence of sentences(text)) ok(words(sentence) <= 20, `${label}: ${sentence}`);
  };
  for (const lesson of lessons) {
    ok(lesson.practice, `${lesson.id} has no practice`);
    const { questions, fix } = lesson.practice;
    const lines = practiceLines(lesson).map(line => line.text);
    ok(questions.length >= 2 && questions.length <= 3, `${lesson.id} needs two or three questions`);
    for (const [index, question] of questions.entries()) {
      const label = `${lesson.id} question ${index + 1}`;
      short(label, question.question, 2);
      equal(question.answers.length, 3, label);
      equal(new Set(question.answers).size, 3, `${label} repeats an answer`);
      for (const answer of question.answers) short(label, answer, 2);
      ok(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 3, label);
      ok(question.line >= 1 && question.line <= lines.length, `${label} points past the file`);
      short(label, question.explain, 2);
    }
    const label = `${lesson.id} fix`;
    ok(fix.line >= 1 && fix.line <= lines.length, `${label} points past the file`);
    const original = lines[fix.line - 1];
    ok(fix.text !== original, `${label} changes nothing`);
    // The mistake is in what the line says, not where it sits, so learners can find it by reading.
    equal(fix.text.length - fix.text.trimStart().length, original.length - original.trimStart().length, `${label} changes the indentation`);
    deepEqual(brokenFile(lesson, fix).text.split('\n').filter((line, index) => line !== lines[index] && index < lines.length), [fix.text], label);
    ok(fix.message.trim(), `${label} has no message`);
    if (lesson.kind) ok(['apply', 'command'].includes(fix.source), `${label}: a Kubernetes file shows what Kubernetes says`);
    else equal(fix.source, 'yaml', label);
    if (fix.source === 'command') ok(fix.command?.startsWith('kubectl ') && fix.expect, `${label} needs a kubectl command and the pattern it shows`);
    else ok(!fix.command && !fix.expect, label);
    short(label, fix.explain, 2);
    short(label, fix.fix, 2);
  }
});
