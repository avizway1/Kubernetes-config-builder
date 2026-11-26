import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CommandBlock } from './CommandBlock';
import { ExportActions } from './ExportActions';
import { readInline, type GuideBlock, type Inline } from './guide-reader';
import { labFiles, labGuides } from './lab-content';
import { labLessons, labNotes, stepLines, type LabLesson } from './lab-lessons';
import { LessonEditor } from './LessonEditor';
import { glossary } from './lesson-builder';
import { levels, runsOnLabels, type Lab } from './lessons';
import { labMissing, labReady, readReport, toolLabels, type SavedCheck } from './setup-check';
import { checkedDate } from './SetupView';

export type LabProgress = { part: 'files' | 'steps'; step: number; practising: boolean; answers: (number | undefined)[]; focus?: number };
export const newLabProgress = (): LabProgress => ({ part: 'files', step: 0, practising: false, answers: [] });

const repoBlob = 'https://github.com/avizway1/learning-kubernetes-made-easy/blob/main/';
const lessonTitles = Object.fromEntries(levels.flatMap(level => level.lessons).map(lesson => [lesson.id, lesson.title]));

// Guide links: other labs open in the dashboard, other repository files on GitHub, and web pages in a new tab.
function guideLink(href: string) {
  if (/^https?:/.test(href)) return { href, external: true };
  const lab = Object.values(labLessons).find(item => item.guide === href);
  if (lab) return { href: `#learn/${lab.id}`, external: false };
  return { href: new URL(href, `${repoBlob}docs/`).href, external: true };
}

function InlineText({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === 'text') return <span key={index}>{item.text}</span>;
        if (item.type === 'code') return <code key={index}>{item.text}</code>;
        if (item.type === 'strong') return <strong key={index}><InlineText items={item.children} /></strong>;
        const link = guideLink(item.href);
        return (
          <a key={index} href={link.href} {...(link.external ? { target: '_blank', rel: 'noopener' } : {})}>
            <InlineText items={item.children} />
          </a>
        );
      })}
    </>
  );
}

const Text = ({ text }: { text: string }) => <InlineText items={readInline(text)} />;

function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={index}><Text text={block.text} /></p>;
          case 'list':
            return <ul key={index}>{block.items.map(item => <li key={item}><Text text={item} /></li>)}</ul>;
          case 'table':
            return (
              <div key={index} className="lab-table">
                <table>
                  <thead><tr>{block.head.map(cell => <th key={cell} scope="col"><Text text={cell} /></th>)}</tr></thead>
                  <tbody>{block.rows.map(row => <tr key={row.join('|')}>{row.map((cell, column) => <td key={column}><Text text={cell} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          case 'code': {
            if (block.lang !== 'yaml') return <CommandBlock key={index} text={block.text} name="these commands" />;
            const filename = Object.keys(labFiles).find(name => labFiles[name] === `${block.text}\n`) ?? 'file.yaml';
            return (
              <details key={index} className="lab-file">
                <summary>Show the file <code>{filename}</code></summary>
                <pre><code>{block.text}</code></pre>
                <ExportActions text={`${block.text}\n`} filename={filename} />
              </details>
            );
          }
        }
      })}
    </>
  );
}

// Ticks are kept per lab in this browser. Storage can be blocked, so the page keeps them for the visit too.
const ticksKey = (lab: string) => `learning-kubernetes:lab-steps:${lab}`;
function loadTicks(lab: string): number[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ticksKey(lab)) ?? '[]');
    return Array.isArray(saved) ? saved.filter(item => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}
function saveTicks(lab: string, ticks: number[]) {
  try {
    window.localStorage.setItem(ticksKey(lab), JSON.stringify(ticks));
  } catch {
    // Ticks then last for this visit.
  }
}

function LabSteps({ lab, check }: { lab: LabLesson; check: SavedCheck }) {
  const guide = labGuides[lab.id];
  const [ticks, setTicks] = useState(() => loadTicks(lab.id));
  const [open, setOpen] = useState(() => guide.sections.findIndex((_, index) => !loadTicks(lab.id).includes(index)));
  useEffect(() => saveTicks(lab.id, ticks), [lab.id, ticks]);
  const toggle = (index: number) => setTicks(ticks.includes(index) ? ticks.filter(item => item !== index) : [...ticks, index].sort((a, b) => a - b));

  return (
    <section className="lab-steps-part" aria-labelledby="lab-steps-title">
      <h2 id="lab-steps-title" className="visually-hidden">Do it on your laptop</h2>
      <GuideBlocks blocks={guide.intro} />
      <div className="lab-progress">
        <span id="lab-progress">{ticks.length} of {guide.sections.length} steps done</span>
        <button type="button" onClick={() => { setTicks([]); setOpen(0); }} disabled={!ticks.length}>Start again</button>
      </div>
      <ol className="lab-steps">
        {guide.sections.map((section, index) => {
          const done = ticks.includes(index);
          const isOpen = open === index;
          return (
            <li key={section.title} className={isOpen ? 'lab-step lab-step-open' : 'lab-step'}>
              <div className="lab-step-head">
                <input type="checkbox" id={`lab-step-${index}`} checked={done} onChange={() => toggle(index)} />
                <label htmlFor={`lab-step-${index}`} className={done ? 'lab-step-done' : undefined}>{section.title}</label>
                <button type="button" className="lab-step-toggle" aria-expanded={isOpen} aria-controls={`lab-step-body-${index}`}
                  onClick={() => setOpen(isOpen ? -1 : index)}>
                  {isOpen ? 'Hide' : 'Show'}<span className="visually-hidden"> {section.title}</span>
                </button>
              </div>
              {isOpen && (
                <div className="lab-step-body" id={`lab-step-body-${index}`}>
                  {section.title === 'Before you start' && (
                    <p className="setup-chip setup-chip-ready">✓ Your laptop is ready for this lab · checked {checkedDate(check)}</p>
                  )}
                  <GuideBlocks blocks={section.blocks} />
                  {index < guide.sections.length - 1 ? (
                    <button type="button" className="lab-step-next" onClick={() => {
                      if (!done) toggle(index);
                      setOpen(index + 1);
                    }}>Done, next step</button>
                  ) : !done && (
                    <button type="button" className="lab-step-next" onClick={() => toggle(index)}>Done</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function LabView({ lab, content, check, progress, onProgress }: {
  lab: Lab;
  content: LabLesson;
  check?: SavedCheck;
  progress: LabProgress;
  onProgress: (progress: LabProgress) => void;
}) {
  const report = check ? readReport(check.report) : undefined;
  const ready = labReady(report, content.id);
  const { part, step, practising, answers, focus } = progress;
  const last = content.steps.length - 1;
  const current = content.steps[step];
  const questions = content.questions;
  const question = focus === undefined ? undefined : questions[focus];
  const file = practising ? (question ?? questions[0]).file : current.file;
  const text = labFiles[file];
  const notes = useMemo(() => labNotes(content, file, text), [content, file, text]);
  const highlights = useMemo(
    () => (practising ? (question ? [question.line] : []) : stepLines(current, text)),
    [practising, question, current, text],
  );
  const score = questions.filter((item, index) => answers[index] === item.correct).length;
  const set = (next: Partial<LabProgress>) => onProgress({ ...progress, ...next });
  const go = (target: number) => set({ step: Math.max(0, Math.min(last, target)) });

  const tab = (id: LabProgress['part'], label: ReactNode) => (
    <button type="button" role="tab" id={`lab-tab-${id}`} aria-selected={part === id} aria-controls="lab-panel" onClick={() => set({ part: id })}>
      {label}
    </button>
  );

  const learned = (lessons: string[]): ReactNode => {
    if (!lessons.length) {
      return <>Not covered in a lesson. See <a href={content.sources[0].url} target="_blank" rel="noopener">{content.sources[0].title}</a>.</>;
    }
    const [first, ...others] = lessons;
    const link = (id: string) => <a key={id} href={`#learn/${id}`}>{lessonTitles[id]}</a>;
    return (
      <>
        Learned in: {link(first)}
        {others.length > 0 && <> · also uses {others.map((id, index) => (
          <span key={id}>{index > 0 && (index === others.length - 1 ? ' and ' : ', ')}{link(id)}</span>
        ))}</>}
      </>
    );
  };

  return (
    <section className="lesson-view lab-view" aria-labelledby="lab-title">
      <p className="lesson-breadcrumb"><a href="#learn">All lessons</a></p>
      <div className="lesson-heading">
        <h1 id="lab-title">{lab.title}</h1>
        <span className={`badge badge-${lab.runsOn}`}>{runsOnLabels[lab.runsOn]}</span>
      </div>
      <div className="practice-tabs lab-tabs" role="tablist" aria-label="Lab parts">
        {tab('files', '1 · Understand the files')}
        {tab('steps', <>2 · Do it on your laptop{!ready && <><span aria-hidden="true"> 🔒</span><span className="visually-hidden"> (locked)</span></>}</>)}
      </div>
      <div role="tabpanel" id="lab-panel" aria-labelledby={`lab-tab-${part}`}>
        {part === 'files' ? (
          <div className="builder lesson-builder">
            <section className="step lesson-card" aria-labelledby="block-title">
              <a className="pane-jump" href="#lesson-file">Jump to the YAML</a>
              {!practising ? (
                <>
                  <p className="lesson-progress" id="lesson-progress">Step {step + 1} of {content.steps.length} · {current.file}</p>
                  <progress max={content.steps.length} value={step + 1} aria-labelledby="lesson-progress" />
                  <h2 id="block-title" tabIndex={-1}>{current.title}</h2>
                  <h3>What it does in this app</h3>
                  <p>{current.what}</p>
                  <h3>Why the lab needs it</h3>
                  <p>{current.why}</p>
                  <p className="lab-learned">{learned(current.lessons)}</p>
                  {current.term && (
                    <p className="lesson-term"><span className="lesson-term-label">Word to remember</span> <dfn>{current.term}</dfn>: {glossary[current.term]}</p>
                  )}
                  <div className="lesson-nav">
                    <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>Back</button>
                    <button type="button" className="lesson-next" onClick={() => go(step + 1)} disabled={step === last}>Next step</button>
                  </div>
                  {step === last && (
                    <button type="button" className="lesson-practise" onClick={() => set({ practising: true })}>Practise: Read it</button>
                  )}
                </>
              ) : (
                <>
                  <p className="lesson-progress">Read it · {score} of {questions.length} right</p>
                  <h2 id="block-title" tabIndex={-1}>Read it</h2>
                  <p>Read the files. Pick an answer to each question.</p>
                  {questions.map((item, index) => {
                    const answer = answers[index];
                    return (
                      <fieldset className="practice-question" key={item.question} onFocus={() => focus !== index && set({ focus: index })}>
                        <legend>{index + 1}. {item.question} <span className="lab-question-file">{item.file}</span></legend>
                        {item.answers.map((choice, number) => (
                          <label key={choice}>
                            <input type="radio" name={`lab-${content.id}-${index}`} checked={answer === number}
                              onChange={() => {
                                const next = [...answers];
                                next[index] = number;
                                set({ answers: next, focus: index });
                              }} />
                            {choice}
                          </label>
                        ))}
                        <div aria-live="polite">
                          {answer !== undefined && (
                            <p className={answer === item.correct ? 'practice-correct' : 'practice-wrong'}>
                              <strong>{answer === item.correct ? 'Correct.' : 'Not quite.'}</strong> {item.explain} See line {item.line} of {item.file}.
                            </p>
                          )}
                        </div>
                      </fieldset>
                    );
                  })}
                  <div className="lesson-nav">
                    <button type="button" onClick={() => set({ practising: false })}>Back to the steps</button>
                    <button type="button" className="lesson-next" onClick={() => set({ part: 'steps' })}>Next: Do it on your laptop</button>
                  </div>
                </>
              )}
            </section>
            <section className="step builder-output lesson-output" aria-labelledby="lesson-file">
              <div className="lesson-output-heading">
                <h2 id="lesson-file" tabIndex={-1}>{file}</h2>
                <a className="pane-jump" href="#block-title">Back to the lesson</a>
              </div>
              <LessonEditor text={text} notes={notes} highlights={highlights}
                label={practising ? `${file}, finished file to read` : `${file}, step ${step + 1} of ${content.steps.length}`} />
              <p className="lesson-hint">Hover over any line to see what it means.</p>
              <ExportActions text={text} filename={file} />
              <p className="lesson-sources">
                Source: {content.sources.map((source, index) => (
                  <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noopener">{source.title}</a></span>
                ))}
              </p>
            </section>
          </div>
        ) : ready ? (
          <LabSteps lab={content} check={check!} />
        ) : (
          <section className="lab-lock" aria-labelledby="lab-lock-title">
            <h2 id="lab-lock-title">Set up your laptop first</h2>
            <p>
              {content.id === 'lab-2' ? 'Lab 2 runs commands that create real AWS resources. ' : 'Lab 1 runs a cluster on your laptop. '}
              {check ? `Your last check, on ${checkedDate(check)}, found ${labMissing(report, content.id).length === 1 ? 'one thing' : 'some things'} to fix:` : 'Run the check on the setup page. This lab needs:'}
            </p>
            <ul className="setup-results">
              {labMissing(report, content.id).map(result => (
                <li key={result.id} className="setup-fix">{check ? result.message : toolLabels[result.id]}</li>
              ))}
            </ul>
            <p>
              <a className="lesson-start" href="#learn/setup">Set up your laptop</a>{' '}
              <button type="button" className="lab-read-files" onClick={() => set({ part: 'files' })}>Read the files while you wait</button>
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
