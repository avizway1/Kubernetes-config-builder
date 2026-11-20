import { useEffect, useMemo, useRef, useState } from 'react';
import { ExportActions } from './ExportActions';
import { LessonEditor } from './LessonEditor';
import {
  brokenFile, glossary, lessonContent, lessonText, lineNote, matchLines, practiceFile, renderLesson, renderMistake,
  type LessonContent, type LessonValues,
} from './lesson-builder';
import { fixFound, LessonPractice, newPractice, type PracticeProgress } from './LessonPractice';
import { levels, runsOnLabels, type Lesson } from './lessons';

// `practising` shows Read it and Fix it after the last block. `practice` keeps their answers when learners go back.
const lessonTitle = (id: string) => levels.flatMap(level => level.lessons).find(lesson => lesson.id === id)?.title ?? id;

export type LessonProgress = {
  step: number;
  values: LessonValues;
  explanations: boolean;
  practising?: boolean;
  practice?: PracticeProgress;
};

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

  // Read it and Fix it show the finished file without block comments, so line numbers match the questions and messages.
  const practice = progress.practising && content.practice ? progress.practice ?? newPractice() : undefined;
  const setPractice = (next: PracticeProgress) => onProgress({ ...progress, practising: true, practice: next });
  const practiceView = useMemo(() => {
    if (!practice || !content.practice) return undefined;
    const { fix, questions } = content.practice;
    if (practice.tab === 'read') {
      const focus = practice.focus === undefined ? [] : [questions[practice.focus].line];
      return { ...practiceFile(content), highlights: focus, highlightClass: undefined, label: `${content.filename}, finished file to read` };
    }
    if (practice.showFixed) return { ...practiceFile(content), highlights: [fix.line], highlightClass: undefined, label: `${content.filename}, fixed file` };
    const found = fixFound(fix, practice);
    return {
      ...brokenFile(content, fix),
      highlights: found ? [fix.line] : practice.picked ? [practice.picked] : [],
      highlightClass: found ? 'lesson-mistake-line' : undefined,
      label: `${content.filename}, broken copy with one mistake`,
    };
  }, [content, practice]);
  const pickable = practice?.tab === 'fix' && !practice.showFixed && !fixFound(content.practice!.fix, practice);
  const nextLink = next ? <a href={`#learn/${next.id}`}>Next lesson: {next.title}</a> : <a href="#learn">Back to all lessons</a>;
  const shownText = practiceView?.text ?? broken?.text ?? text;

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
          {practice ? (
            <LessonPractice content={content} practice={practice} lineCount={practiceView!.notes.length} onChange={setPractice}
              onLeave={() => onProgress({ ...progress, practising: false })} next={nextLink} />
          ) : (<>
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
              You built the whole file.{' '}{nextLink}
            </p>
          )}
          {step === last && content.practice && (
            <button type="button" className="lesson-practise" onClick={() => setPractice(practice ?? progress.practice ?? newPractice())}>
              Practise: Read it and Fix it
            </button>
          )}
          </>)}
        </section>
        <section className="step builder-output lesson-output" aria-labelledby="lesson-file">
          <div className="lesson-output-heading">
            <h2 id="lesson-file" tabIndex={-1}>{content.filename}</h2>
            <a className="pane-jump" href="#block-title">Back to the lesson</a>
            {!practice && (
              <label className="lesson-switch">
                <input type="checkbox" checked={explanations}
                  onChange={event => onProgress({ ...progress, explanations: event.target.checked })} />
                Show explanations
              </label>
            )}
          </div>
          {practiceView ? (
            <LessonEditor text={practiceView.text} notes={practiceView.notes} highlights={practiceView.highlights}
              highlightClass={practiceView.highlightClass} label={practiceView.label}
              onLineClick={pickable ? line => setPractice({ ...practice!, picked: line, checked: false }) : undefined} />
          ) : broken && mistake ? (
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
              {content.uses && (
                <p className="lesson-uses">
                  This lesson also uses{' '}
                  {content.uses.map((id, index) => (
                    <span key={id}>
                      {index > 0 && (index === content.uses!.length - 1 ? ' and ' : ', ')}
                      <code>{lessonContent[id].filename}</code> from <a href={`#learn/${id}`}>{lessonTitle(id)}</a>
                    </span>
                  ))}
                  . Download {content.uses.length > 1 ? 'them' : 'it'} there if you no longer have {content.uses.length > 1 ? 'them' : 'it'}.
                </p>
              )}
              <ol>
                {/* A command can appear twice, such as checking a Pod before and after a probe fails. */}
                {content.tryIt.map((item, index) => (
                  <li key={`${index}-${item.command}`}><code>{item.command}</code><span>{item.result}</span></li>
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
