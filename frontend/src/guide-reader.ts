// Read a lab guide's Markdown into blocks the lab page renders as elements, never as HTML.
// It knows only what the guides use, and throws on anything else, so a guide change cannot vanish from the page.
// Hidden <!-- do: --> and <!-- check: --> lines are for tests/lab-guide.check.mjs and are dropped.

export type GuideBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'code'; lang: string; text: string };

export type GuideSection = { title: string; blocks: GuideBlock[] };
export type Guide = { title: string; intro: GuideBlock[]; sections: GuideSection[] };

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] };

const cells = (line: string) => line.slice(1, -1).split('|').map(cell => cell.trim());

export function readGuide(markdown: string): Guide {
  const lines = markdown.replace(/\n$/, '').split('\n');
  const guide: Guide = { title: '', intro: [], sections: [] };
  let blocks = guide.intro;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const where = `line ${index + 1}`;
    if (!line.trim()) continue;
    if (/^<!-- (do|check): .* -->$/.test(line)) continue;
    if (line.startsWith('# ')) {
      if (guide.title) throw new Error(`A second title at ${where}`);
      guide.title = line.slice(2);
      continue;
    }
    if (line.startsWith('## ')) {
      const section = { title: line.slice(3), blocks: [] };
      guide.sections.push(section);
      blocks = section.blocks;
      continue;
    }
    const fence = line.match(/^```(\w*)$/);
    if (fence) {
      const end = lines.indexOf('```', index + 1);
      if (end < 0) throw new Error(`An unclosed code block at ${where}`);
      blocks.push({ type: 'code', lang: fence[1], text: lines.slice(index + 1, end).join('\n') });
      index = end;
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (index < lines.length && lines[index].startsWith('- ')) items.push(lines[index++].slice(2));
      index--;
      blocks.push({ type: 'list', items });
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (index < lines.length && lines[index].startsWith('|')) rows.push(cells(lines[index++]));
      index--;
      if (rows.length < 2 || !rows[1].every(cell => /^-+$/.test(cell))) throw new Error(`A table without a header row at ${where}`);
      blocks.push({ type: 'table', head: rows[0], rows: rows.slice(2) });
      continue;
    }
    if (/^(#{3,} |\d+\. |> |\* |<|!\[|\s)/.test(line)) throw new Error(`Markdown the lab page cannot show at ${where}: ${line}`);
    blocks.push({ type: 'paragraph', text: line });
  }
  if (!guide.title) throw new Error('The guide has no title');
  return guide;
}

// Inline code, bold, and links. A link's label may hold code or bold.
export function readInline(text: string): Inline[] {
  const output: Inline[] = [];
  let rest = text;
  const pattern = /`([^`]+)`|\*\*(.+?)\*\*|\[((?:[^\]`]|`[^`]*`)+)\]\(([^)\s]+)\)/;
  while (rest) {
    const match = rest.match(pattern);
    if (!match || match.index === undefined) {
      output.push({ type: 'text', text: rest });
      break;
    }
    if (match.index > 0) output.push({ type: 'text', text: rest.slice(0, match.index) });
    if (match[1] !== undefined) output.push({ type: 'code', text: match[1] });
    else if (match[2] !== undefined) output.push({ type: 'strong', children: readInline(match[2]) });
    else output.push({ type: 'link', href: match[4], children: readInline(match[3]) });
    rest = rest.slice(match.index + match[0].length);
  }
  if (output.some(item => item.type === 'text' && /\*\*|\]\(|`/.test(item.text))) {
    throw new Error(`Inline Markdown the lab page cannot show: ${text}`);
  }
  return output;
}

// Every piece of text a learner reads, in order, so a test can prove nothing is dropped.
export function guideText(guide: Guide): string[] {
  const plain = (items: Inline[]): string => items.map(item => (item.type === 'text' || item.type === 'code' ? item.text : plain(item.children))).join('');
  const inline = (text: string) => plain(readInline(text));
  const blockText = (block: GuideBlock): string[] => {
    switch (block.type) {
      case 'paragraph': return [inline(block.text)];
      case 'list': return block.items.map(inline);
      case 'table': return [...block.head, ...block.rows.flat()].map(inline);
      case 'code': return [block.text];
    }
  };
  return [guide.title, ...guide.intro.flatMap(blockText), ...guide.sections.flatMap(section => [section.title, ...section.blocks.flatMap(blockText)])];
}
