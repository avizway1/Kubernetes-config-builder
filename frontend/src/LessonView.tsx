import { useEffect, useMemo, useRef, useState } from 'react';
import { ExportActions } from './ExportActions';
import { LessonEditor } from './LessonEditor';
import {
  glossary, lessonText, lineNote, matchLines, renderLesson, renderMistake,
  type LessonContent, type LessonValues,
} from './lesson-builder';
import { runsOnLabels, type Lesson } from './lessons';

export type LessonProgress = { step: number; values: LessonValues; explanations: boolean };

export function LessonView({ lesson, content, progress, onProgress, next }: {
  lesson: Lesson;
  content: LessonContent;
  progress: LessonProgress;
  onProgress: (progress: LessonProgress) => void;
  next?: Lesson;
}) {
  const { step, values, explanations } = progress;
  const last = content.blocks.length - 1;
  const block = content.blocks[step];
  const lines = useMemo(() => renderLesson(content, step, values, explanations), [content, step, values, explanations]);
  const text = lessonText(lines);
  const notes = useMemo(() => lines.map(line => lineNote(content, line)), [content, lines]);

  // Highlight whatever the last action added or changed, starting with the current block on first view.
  const shown = useRef<string[] | null>(null);
  shown.current ??= step > 0 ? renderLesson(content, step - 1, values, explanations).map(line => line.text) : [];
  const highlights = useMemo(() => {
    const matches = matchLines(shown.current!, lines.map(line => line.text));
    return matches.flatMap((match, index) => (match < 0 ? [index + 1] : []));
  }, [lines]);
  useEffect(() => {
    shown.current = lines.map(line => line.text);
  }, [lines]);

  // The broken copy replaces the file until the learner returns to it or moves to another block.
  const [mistakeShown, setMistakeShown] = useState(false);
  const mistake = mistakeShown ? block.mistake : undefined;
  const broken = useMemo(() => (mistake ? renderMistake(content, mistake) : undefined), [content, mistake]);
  const shownText = broken?.text ?? text;

  const choice = block.tryChange ? content.choices?.[block.tryChange] : undefined;
  const finished = step >= content.finishedAt;
  const go = (target: number) => {
    setMistakeShown(false);
    onProgress({ ...progress, step: Math.max(0, Math.min(last, target)) });
  };

  return (
    <section className="lesson-view" aria-labelledby="lesson-title">
      <p className="lesson-breadcrumb"><a href="#learn">All lessons</a></p>
      <div className="lesson-heading">
        <h1 id="lesson-title">{lesson.title}</h1>
        <span className={`badge badge-${lesson.runsOn}`}>{runsOnLabels[lesson.runsOn]}</span>
      </div>
      <div className="builder lesson-builder">
        <section className="step lesson-card" aria-labelledby="block-title">
          <a className="pane-jump" href="#lesson-file">Jump to the YAML</a>
          <p className="lesson-progress" id="lesson-progress">Block {step + 1} of {content.blocks.length}</p>
          <progress max={content.blocks.length} value={step + 1} aria-labelledby="lesson-progress" />
          <h2 id="block-title" tabIndex={-1}>{block.title}</h2>
          <h3>What it does</h3>
          <p>{block.what}</p>
          <h3>Why it is there</h3>
          <p>{block.why}</p>
          <h3>What happens if I remove it?</h3>
          <p>{block.ifRemoved}</p>
          {block.term && (
            <p className="lesson-term"><span className="lesson-term-label">New word</span> <dfn>{block.term}</dfn>: {glossary[block.term]}</p>
          )}
          {choice && block.tryChange && (
            <label className="lesson-try">
              Try changing: {choice.label}
              <select value={values[block.tryChange]} onChange={event => onProgress({
                ...progress, values: { ...values, [block.tryChange!]: event.target.value },
              })}>
                {choice.options.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
          )}
          {block.mistake && (
            <div className="lesson-mistake-area">
              <button type="button" className="lesson-mistake-toggle" aria-pressed={mistakeShown}
                onClick={() => setMistakeShown(!mistakeShown)}>
                {mistakeShown ? 'Show the fixed file' : 'See the mistake'}
              </button>
              <div aria-live="polite">
                {mistake && (
                  <div className="lesson-mistake">
                    <p className="lesson-mistake-label">Line {mistake.line} is wrong. The YAML reader says:</p>
                    <p><code>{mistake.error}</code></p>
                    <h3>Why</h3>
                    <p>{mistake.explain}</p>
                    <h3>How to fix it</h3>
                    <p>{mistake.fix}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {!finished && (
            <p className="lesson-unfinished">
              Not finished yet. Block {content.finishedAt + 1}, “{content.blocks[content.finishedAt].title}”, makes this a working file.
            </p>
          )}
          <div className="lesson-nav">
            <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>Back</button>
            <button type="button" className="lesson-next" onClick={() => go(step + 1)} disabled={step === last}>Next block</button>
            <button type="button" onClick={() => go(last)} disabled={step === last}>Show whole file</button>
          </div>
          {step === last && (
            <p className="lesson-done">
              You built the whole file.{' '}
              {next ? <a href={`#learn/${next.id}`}>Next lesson: {next.title}</a> : <a href="#learn">Back to all lessons</a>}
            </p>
          )}
        </section>
        <section className="step builder-output lesson-output" aria-labelledby="lesson-file">
          <div className="lesson-output-heading">
            <h2 id="lesson-file" tabIndex={-1}>{content.filename}</h2>
            <a className="pane-jump" href="#block-title">Back to the lesson</a>
            <label className="lesson-switch">
              <input type="checkbox" checked={explanations}
                onChange={event => onProgress({ ...progress, explanations: event.target.checked })} />
              Show explanations
            </label>
          </div>
          {broken && mistake ? (
            <LessonEditor text={broken.text} notes={broken.notes} highlights={[mistake.line]} highlightClass="lesson-mistake-line"
              label={`${content.filename}, broken copy with a mistake on line ${mistake.line}`} />
          ) : (
            <LessonEditor text={text} notes={notes} highlights={highlights} label={`${content.filename}, block ${step + 1} of ${content.blocks.length}`} />
          )}
          <p className="lesson-hint">Hover over any line to see what it means.</p>
          <ExportActions text={shownText} filename={content.filename} />
          {!content.tryIt.length ? (
            <p className="lesson-hint">Nothing to run for this lesson. You only need a text editor to write YAML.</p>
          ) : finished ? (
            <section className="lesson-try-it" aria-labelledby="try-it-title">
              <h3 id="try-it-title">Try it</h3>
              <p>Save the file, then run these commands against your practice cluster.</p>
              <ol>
                {content.tryIt.map(item => (
                  <li key={item.command}><code>{item.command}</code><span>{item.result}</span></li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="lesson-hint">Commands to try it appear when the file is ready to apply.</p>
          )}
          <p className="lesson-sources">
            Source: {content.sources.map((source, index) => (
              <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noopener">{source.title}</a></span>
            ))}
          </p>
        </section>
      </div>
    </section>
  );
}
