import podLesson from '../../templates/kubernetes/lessons/pod.json' with { type: 'json' };
import deploymentLesson from '../../templates/kubernetes/lessons/deployment.json' with { type: 'json' };
import glossaryData from '../../templates/kubernetes/glossary.json' with { type: 'json' };

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
  yaml: string;
};

export type LessonContent = {
  id: string;
  kind: string;
  filename: string;
  finishedAt: number;
  choices?: Record<string, LessonChoice>;
  blocks: LessonBlock[];
  notes: Record<string, string>;
  tryIt: { command: string; result: string }[];
  sources: { title: string; url: string }[];
};

export type LessonValues = Record<string, string>;

export type LessonLine = { text: string; block: number; path?: string; comment?: boolean };

export const lessonContent: Record<string, LessonContent> = {
  pod: podLesson as LessonContent,
  deployment: deploymentLesson as LessonContent,
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
export function yamlPaths(lines: string[]): (string | undefined)[] {
  const stack: { indent: number; path: string }[] = [];
  return lines.map(line => {
    const trimmed = line.trim();
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
  const commented = new Set<number>();
  const output: LessonLine[] = [];
  lines.forEach((text, index) => {
    const block = owners[index];
    if (explanations && !commented.has(block)) {
      commented.add(block);
      const indent = text.slice(0, text.length - text.trimStart().length);
      output.push({ text: `${indent}# ${lesson.blocks[block].comment}`, block, comment: true });
    }
    output.push({ text, block, path: paths[index] });
  });
  return output;
}

export function lessonText(lines: LessonLine[]) {
  return `${lines.map(line => line.text).join('\n')}\n`;
}

export function lineNote(lesson: LessonContent, line: LessonLine) {
  return line.comment ? lesson.blocks[line.block].what : line.path && lesson.notes[line.path];
}
