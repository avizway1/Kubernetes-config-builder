import type { LessonContent, LessonFix } from './lesson-builder';

export type PracticeTab = 'read' | 'fix';

// Read it and Fix it answers, kept per lesson like block progress.
export type PracticeProgress = {
  tab: PracticeTab;
  answers: (number | undefined)[];
  // The question answered last. Its line is highlighted in the file.
  focus?: number;
  picked?: number;
  checked?: boolean;
  revealed?: boolean;
  showFixed?: boolean;
};

export const newPractice = (): PracticeProgress => ({ tab: 'read', answers: [] });

export const fixFound = (fix: LessonFix, practice: PracticeProgress) =>
  Boolean(practice.revealed || (practice.checked && practice.picked === fix.line));

const sourceIntro = (fix: LessonFix) => ({
  yaml: 'The YAML reader says:',
  apply: 'When you apply this copy, Kubernetes says:',
  command: `The copy applies, but ${fix.command} shows:`,
}[fix.source]);

export function LessonPractice({ content, practice, lineCount, onChange, onLeave, next }: {
  content: LessonContent;
  practice: PracticeProgress;
  lineCount: number;
  onChange: (practice: PracticeProgress) => void;
  onLeave: () => void;
  next: React.ReactNode;
}) {
  const { questions, fix } = content.practice!;
  const blocks = content.blocks.length;
  const score = questions.filter((question, index) => practice.answers[index] === question.correct).length;
  const found = fixFound(fix, practice);
  const tab = (id: PracticeTab, label: string) => (
    <button type="button" role="tab" id={`practice-tab-${id}`} aria-selected={practice.tab === id} aria-controls="practice-panel"
      onClick={() => onChange({ ...practice, tab: id })}>
      {label}
    </button>
  );

  return (
    <>
      <p className="lesson-progress" id="lesson-progress">Practise · after block {blocks} of {blocks}</p>
      <progress max={blocks} value={blocks} aria-labelledby="lesson-progress" />
      <div className="practice-tabs" role="tablist" aria-label="Practise">
        {tab('read', `Read it · ${score} of ${questions.length}`)}
        {tab('fix', found ? 'Fix it · found' : 'Fix it')}
      </div>
      <div role="tabpanel" id="practice-panel" aria-labelledby={`practice-tab-${practice.tab}`} className="practice-panel">
        {practice.tab === 'read' ? (
          <>
            <h2 id="block-title" tabIndex={-1}>Read it</h2>
            <p>Read the finished file. Pick an answer to each question.</p>
            {questions.map((question, index) => {
              const answer = practice.answers[index];
              return (
                <fieldset className="practice-question" key={question.question}>
                  <legend>{index + 1}. {question.question}</legend>
                  {question.answers.map((text, choice) => (
                    <label key={text}>
                      <input type="radio" name={`practice-${content.id}-${index}`} checked={answer === choice}
                        onChange={() => {
                          const answers = [...practice.answers];
                          answers[index] = choice;
                          onChange({ ...practice, answers, focus: index });
                        }} />
                      {text}
                    </label>
                  ))}
                  <div aria-live="polite">
                    {answer !== undefined && (
                      <p className={answer === question.correct ? 'practice-correct' : 'practice-wrong'}>
                        <strong>{answer === question.correct ? 'Correct.' : 'Not quite.'}</strong> {question.explain} See line {question.line}.
                      </p>
                    )}
                  </div>
                </fieldset>
              );
            })}
            <div className="lesson-nav">
              <button type="button" onClick={onLeave}>Back to the blocks</button>
              <button type="button" className="lesson-next" onClick={() => onChange({ ...practice, tab: 'fix' })}>Next: Fix it</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="block-title" tabIndex={-1}>Fix it</h2>
            <p>This copy has one mistake. Click the line you think is wrong, or pick its number.</p>
            {!found && (
              <div className="practice-pick">
                <label htmlFor="practice-line">Wrong line</label>
                <select id="practice-line" value={practice.picked ?? ''}
                  onChange={event => onChange({ ...practice, picked: Number(event.target.value) || undefined, checked: false })}>
                  <option value="">Choose</option>
                  {Array.from({ length: lineCount }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
                </select>
                <button type="button" className="lesson-mistake-toggle" disabled={!practice.picked}
                  onClick={() => onChange({ ...practice, checked: true })}>
                  Check my answer
                </button>
              </div>
            )}
            <div aria-live="polite">
              {practice.checked && !found && (
                <div className="practice-wrong">
                  <p><strong>Not that line.</strong> Look again, or show the answer.</p>
                  <button type="button" onClick={() => onChange({ ...practice, revealed: true })}>Show the answer</button>
                </div>
              )}
              {found && (
                <div className="lesson-mistake">
                  <p className="lesson-mistake-label">
                    {practice.checked && practice.picked === fix.line ? `Right, line ${fix.line}.` : `The mistake is on line ${fix.line}.`}{' '}
                    {sourceIntro(fix)}
                  </p>
                  <p><code>{fix.message}</code></p>
                  <h3>Why</h3>
                  <p>{fix.explain}</p>
                  <h3>How to fix it</h3>
                  <p>{fix.fix}</p>
                </div>
              )}
            </div>
            <div className="lesson-nav">
              <button type="button" onClick={onLeave}>Back to the blocks</button>
              {found && (
                <button type="button" aria-pressed={Boolean(practice.showFixed)}
                  onClick={() => onChange({ ...practice, showFixed: !practice.showFixed })}>
                  {practice.showFixed ? 'Show the broken copy' : 'Show the fixed file'}
                </button>
              )}
            </div>
            {found && <p className="lesson-done">{next}</p>}
          </>
        )}
      </div>
    </>
  );
}
