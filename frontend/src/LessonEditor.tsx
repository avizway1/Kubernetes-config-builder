import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

self.MonacoEnvironment ??= { getWorker: () => new EditorWorker() };

// Read-only YAML for a lesson. Highlighted lines are what the last action added or changed.
// `onLineClick` lets Fix it learners pick a line by clicking it.
export function LessonEditor({ text, notes, highlights, label, highlightClass = 'changed-line', onLineClick }: {
  text: string;
  notes: (string | undefined)[];
  highlights: number[];
  label: string;
  highlightClass?: string;
  onLineClick?: (line: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const notesRef = useRef(notes);
  const clickRef = useRef(onLineClick);
  clickRef.current = onLineClick;

  useEffect(() => {
    const model = monaco.editor.createModel('', 'yaml');
    const editor = monaco.editor.create(container.current!, {
      model,
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      ariaLabel: label,
    });
    const hover = monaco.languages.registerHoverProvider('yaml', {
      provideHover(target, position) {
        if (target !== model) return;
        const note = notesRef.current[position.lineNumber - 1];
        if (note) return { contents: [{ value: note.replace(/[\\`*_{}\[\]()<>#+.!|]/g, '\\$&') }] };
      },
    });
    const click = editor.onMouseDown(event => {
      const line = event.target.position?.lineNumber;
      if (line) clickRef.current?.(line);
    });
    editorRef.current = editor;
    return () => {
      click.dispose();
      hover.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, [label]);

  useEffect(() => {
    notesRef.current = notes;
    const editor = editorRef.current!;
    const model = editor.getModel()!;
    if (model.getValue() !== text) model.setValue(text);
    const decorations = editor.createDecorationsCollection(highlights.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: highlightClass },
    })));
    if (highlights.length) editor.revealLinesInCenterIfOutsideViewport(highlights[0], highlights[highlights.length - 1]);
    return () => decorations.clear();
  }, [text, notes, highlights, highlightClass]);

  return <div className="preview lesson-preview" ref={container} data-testid="lesson-yaml" />;
}
