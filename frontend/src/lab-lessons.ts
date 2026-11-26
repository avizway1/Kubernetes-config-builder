import lab1 from '../../templates/kubernetes/labs/lab-1.json' with { type: 'json' };
import lab2 from '../../templates/kubernetes/labs/lab-2.json' with { type: 'json' };
import { lessonContent, yamlPaths } from './lesson-builder.ts';

// Lab lessons: one recap step per object in a lab's files, then the lab's own guide. See specs/lab-lessons.md.
// This module reads text it is given, so the unit tests and the dashboard share it.

export type LabStep = {
  file: string;
  object: { kind: string; name: string };
  title: string;
  what: string;
  why: string;
  // The lesson that taught the object first, then lessons for other parts it uses.
  lessons: string[];
  term?: string;
};

export type LabQuestion = { file: string; question: string; answers: string[]; correct: number; explain: string; line: number };

export type LabLesson = {
  id: 'lab-1' | 'lab-2';
  guide: string;
  files: string[];
  steps: LabStep[];
  notes: Record<string, string>;
  questions: LabQuestion[];
  sources: { title: string; url: string }[];
};

export const labLessons: Record<string, LabLesson> = { 'lab-1': lab1 as LabLesson, 'lab-2': lab2 as LabLesson };

export type LabObject = { kind?: string; name?: string; start: number; end: number };

const splitLines = (text: string) => text.replace(/\n$/, '').split('\n');

// Each object in a file with its line range, counted from 1. An object owns the comments above it, after the --- line.
export function labObjects(text: string): LabObject[] {
  const lines = splitLines(text);
  const objects: LabObject[] = [];
  let start = 0;
  for (let end = 0; end <= lines.length; end++) {
    if (end < lines.length && lines[end].trim() !== '---') continue;
    const body = lines.slice(start, end);
    const kind = body.find(line => line.startsWith('kind:'))?.slice(5).trim();
    const metadata = body.findIndex(line => line === 'metadata:');
    const name = metadata < 0 ? undefined : body.slice(metadata + 1).find(line => line.startsWith('  name:'))?.slice(7).trim();
    objects.push({ kind, name, start: start + 1, end });
    start = end + 1;
  }
  return objects;
}

export function stepLines(step: LabStep, text: string) {
  const object = labObjects(text).find(item => item.kind === step.object.kind && item.name === step.object.name);
  if (!object) return [];
  return Array.from({ length: object.end - object.start + 1 }, (_, index) => object.start + index);
}

// Field path and kind for every line. Lines inside a block of text, such as a script after `key: |`, belong to that key.
export function labLinePaths(text: string): { path?: string; kind?: string }[] {
  const lines = splitLines(text);
  let blockIndent = -1;
  let blockOwner = -1;
  const owners: number[] = [];
  const masked = lines.map((line, index) => {
    const indent = line.length - line.trimStart().length;
    if (blockIndent >= 0 && (line.trim() === '' || indent > blockIndent)) {
      owners[index] = blockOwner;
      return '';
    }
    blockIndent = -1;
    if (/:\s*\|[-+]?$/.test(line)) {
      blockIndent = indent;
      blockOwner = index;
    }
    return line;
  });
  const paths = yamlPaths(masked);
  const objects = labObjects(text);
  return lines.map((_, index) => ({
    path: owners[index] !== undefined ? paths[owners[index]] : paths[index],
    kind: objects.find(object => index + 1 >= object.start && index + 1 <= object.end)?.kind,
  }));
}

// A Deployment's Pod template holds the same fields as a Pod, so Pod lessons can explain them.
function podPaths(path: string) {
  if (path.startsWith('spec.template.spec.')) return [path, `spec.${path.slice('spec.template.spec.'.length)}`];
  if (path.startsWith('spec.template.metadata.')) return [path, `metadata.${path.slice('spec.template.metadata.'.length)}`];
  return [path];
}

// The hover note for one field: the lab's own note first, then the lessons the step names, then any lesson about the same kind.
export function labFieldNote(lab: LabLesson, step: LabStep | undefined, kind: string | undefined, path: string) {
  const own = (kind && lab.notes[`${kind}:${path}`]) || lab.notes[path];
  if (own) return own;
  const named = step?.lessons ?? [];
  const lessons = [...named, ...Object.keys(lessonContent).filter(id => !named.includes(id))];
  for (const candidate of podPaths(path)) {
    for (const id of lessons) {
      const lesson = lessonContent[id];
      const related = named.includes(id) || lesson.kind === kind || lesson.kind === 'Pod';
      const note = lesson.notes[`${kind}:${candidate}`] ?? (candidate !== path ? lesson.notes[`Pod:${candidate}`] : undefined)
        ?? (related ? lesson.notes[candidate] : undefined);
      if (note) return note;
    }
  }
  return undefined;
}

// Hover notes for a whole lab file. Comment lines explain the object they sit above.
export function labNotes(lab: LabLesson, file: string, text: string): (string | undefined)[] {
  const lines = splitLines(text);
  const info = labLinePaths(text);
  const objects = labObjects(text);
  return lines.map((line, index) => {
    const object = objects.find(item => index + 1 >= item.start && index + 1 <= item.end);
    const step = lab.steps.find(item => item.file === file && item.object.kind === object?.kind && item.object.name === object?.name);
    if (line.trim().startsWith('#')) return step?.what;
    const { path, kind } = info[index];
    if (!path || path === '---') return undefined;
    return labFieldNote(lab, step, kind, path);
  });
}
