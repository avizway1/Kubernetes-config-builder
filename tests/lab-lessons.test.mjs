import { deepEqual, equal, ok, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { guideText, readGuide, readInline } from '../frontend/src/guide-reader.ts';
import { labLessons, labNotes, labObjects, stepLines } from '../frontend/src/lab-lessons.ts';
import { glossary, lessonContent } from '../frontend/src/lesson-builder.ts';
import { labs } from '../frontend/src/lessons.ts';

const root = new URL('../', import.meta.url);
const labFile = name => readFileSync(new URL(`templates/kubernetes/labs/${name}`, root), 'utf8');
const guideFile = name => readFileSync(new URL(`docs/${name}`, root), 'utf8');
const lineCount = text => text.replace(/\n$/, '').split('\n').length;

// The lesson writing rules: at most 20 words a sentence and two sentences a section.
function shortText(text, label) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/);
  ok(sentences.length <= 2, `${label}: more than two sentences: ${text}`);
  for (const sentence of sentences) ok(sentence.split(/\s+/).length <= 20, `${label}: over 20 words: ${sentence}`);
}

test('every lab in the catalogue has a lab lesson, and each names its guide and files', () => {
  deepEqual(Object.keys(labLessons), labs.map(lab => lab.id));
  for (const lab of labs) {
    const lesson = labLessons[lab.id];
    equal(lesson.id, lab.id);
    ok(lab.link.endsWith(`/docs/${lesson.guide}`), `${lab.id} guide ${lesson.guide}`);
    deepEqual([...new Set(lesson.steps.map(step => step.file))], lesson.files, `${lab.id} steps follow its files in order`);
  }
});

test('Understand the files has one step for every object, in file order, and highlights exactly its lines', () => {
  for (const lab of Object.values(labLessons)) {
    for (const file of lab.files) {
      const text = labFile(file);
      const objects = labObjects(text);
      const steps = lab.steps.filter(step => step.file === file);
      deepEqual(steps.map(step => `${step.object.kind}/${step.object.name}`), objects.map(object => `${object.kind}/${object.name}`), file);
      let covered = 0;
      for (const step of steps) {
        const lines = stepLines(step, text);
        const body = lines.map(line => text.split('\n')[line - 1]);
        ok(body.includes(`kind: ${step.object.kind}`), `${file} ${step.title} highlights its kind`);
        ok(body.includes(`  name: ${step.object.name}`), `${file} ${step.title} highlights its name`);
        ok(!body.includes('---'), `${file} ${step.title} highlights a separator`);
        covered += lines.length;
      }
      // Every line except the separators belongs to one step.
      equal(covered, lineCount(text) - (objects.length - 1), `${file} lines covered`);
    }
  }
});

test('lab steps link lessons that exist, use glossary words, and follow the writing rules', () => {
  for (const lab of Object.values(labLessons)) {
    for (const step of lab.steps) {
      const label = `${lab.id} ${step.title}`;
      for (const id of step.lessons) ok(lessonContent[id], `${label}: no lesson ${id}`);
      // Only the eksctl ClusterConfig, which is not a Kubernetes object, has no lesson.
      if (!step.lessons.length) equal(step.object.kind, 'ClusterConfig', label);
      if (step.term) ok(glossary[step.term], `${label}: ${step.term} is not in the glossary`);
      ok(step.title.split(/\s+/).length <= 10, `${label}: long title`);
      shortText(step.what, `${label} what`);
      shortText(step.why, `${label} why`);
    }
    for (const [key, note] of Object.entries(lab.notes)) shortText(note, `${lab.id} note ${key}`);
  }
});

test('Read it asks three questions per lab file, with three answers and a line in range', () => {
  for (const lab of Object.values(labLessons)) {
    for (const file of lab.files) equal(lab.questions.filter(question => question.file === file).length, 3, `${lab.id} ${file}`);
    for (const question of lab.questions) {
      const label = `${lab.id}: ${question.question}`;
      ok(lab.files.includes(question.file), label);
      equal(question.answers.length, 3, label);
      ok(question.correct >= 0 && question.correct < 3, label);
      ok(question.line >= 1 && question.line <= lineCount(labFile(question.file)), label);
      shortText(question.explain, label);
    }
  }
});

test('every field in every lab file has a hover note, in the lab’s own values', () => {
  for (const lab of Object.values(labLessons)) {
    for (const file of lab.files) {
      const text = labFile(file);
      const lines = text.replace(/\n$/, '').split('\n');
      const notes = labNotes(lab, file, text);
      const keys = new Set(lines.map(line => line.match(/^\s*(?:- )?([\w./-]+):/)?.[1]).filter(Boolean));
      lines.forEach((line, index) => {
        const label = `${file}:${index + 1} ${line.trim()}`;
        if (line.trim() === '---') return equal(notes[index], undefined, label);
        const note = notes[index];
        ok(note, `${label} has no note`);
        shortText(note, label);
        // Notes borrowed from a lesson must not name the lesson or its example values, such as "app: web".
        ok(!/lesson/i.test(note), `${label}: ${note}`);
        // A quoted value closes its sentence or clause, as in "app: hello,", unlike prose such as "template: the Pods".
        for (const [, key, value] of note.matchAll(/\b([\w./-]+): ([\w./-]+?)(?:[.,;]|$)(?=\s|$)/g)) {
          if (keys.has(key)) {
            ok(new RegExp(`\\b${key}: "?${value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"?$`, 'm').test(text),
              `${label}: the note names ${key}: ${value}, which the file does not use`);
          }
        }
      });
    }
  }
});

// Strip the Markdown a learner never sees, so the page's text can be compared with the guide word for word.
function visibleWords(markdown) {
  let fenced = false;
  const words = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      words.push(...line.split(/\s+/));
      continue;
    }
    if (/^<!-- (do|check): .* -->$/.test(line) || /^\|[\s|-]+\|$/.test(line)) continue;
    const text = line.replace(/^#{1,2} /, '').replace(/^- /, '')
      .replace(/\[((?:[^\]`]|`[^`]*`)+)\]\([^)\s]+\)/g, '$1').replaceAll('**', '').replaceAll('`', '').replaceAll('|', ' ');
    words.push(...text.split(/\s+/));
  }
  return words.filter(Boolean);
}

test('Do it on your laptop shows every section, paragraph, command, and file of each guide in order, and no hidden steps', () => {
  for (const lab of Object.values(labLessons)) {
    const markdown = guideFile(lab.guide);
    const guide = readGuide(markdown);
    const shown = guideText(guide);
    deepEqual(shown.join(' ').split(/\s+/).filter(Boolean), visibleWords(markdown), lab.guide);
    ok(!shown.some(text => text.includes('<!--')), `${lab.guide} shows a hidden step`);
    deepEqual(guide.sections.map(section => section.title), [...markdown.matchAll(/^## (.+)$/gm)].map(match => match[1]));
    // Commands are shown exactly as the guide check runs them, and each YAML file exactly as learners download it.
    const blocks = guide.sections.flatMap(section => section.blocks).filter(block => block.type === 'code');
    deepEqual(blocks.map(block => block.text), [...markdown.matchAll(/^```\w*\n([\s\S]*?)\n```$/gm)].map(match => match[1]));
    for (const block of blocks.filter(block => block.lang === 'yaml')) {
      ok(lab.files.some(file => labFile(file) === `${block.text}\n`), `${lab.guide}: a YAML block is not a lab file`);
    }
    ok(blocks.every(block => ['bash', 'yaml'].includes(block.lang)), `${lab.guide} code languages`);
  }
});

test('the guide reader fails on Markdown the lab page cannot show', () => {
  for (const markdown of [
    '# One\n\n### A smaller heading',
    '# One\n\n1. A numbered list',
    '# One\n\n> A quote',
    '# One\n\n* A star list',
    '# One\n\n<div>HTML</div>',
    '# One\n\n![An image](a.png)',
    '# One\n\n    indented code',
    '# One\n\n```bash\nnever closed',
    '# One\n\n| a | b |\n| c | d |',
    '# One\n\n# Two',
    'No title',
  ]) throws(() => readGuide(markdown), undefined, markdown);
  for (const text of ['an **unclosed bold', 'a stray ` backtick', 'a [link](with space)']) throws(() => readInline(text), undefined, text);
  deepEqual(readInline('Run `kubectl get pods` in **[the `hello` Namespace](a.md)**.'), [
    { type: 'text', text: 'Run ' },
    { type: 'code', text: 'kubectl get pods' },
    { type: 'text', text: ' in ' },
    { type: 'strong', children: [{ type: 'link', href: 'a.md', children: [{ type: 'text', text: 'the ' }, { type: 'code', text: 'hello' }, { type: 'text', text: ' Namespace' }] }] },
    { type: 'text', text: '.' },
  ]);
});
