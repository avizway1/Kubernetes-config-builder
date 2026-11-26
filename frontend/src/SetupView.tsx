import { useState } from 'react';
import { CommandBlock } from './CommandBlock';
import {
  guessSystem, labMissing, labReady, readReport, setup, systemLabel, toolLabels, toolNeeds, type SavedCheck, type SystemId, type ToolId,
} from './setup-check';

const labNames = { 'lab-1': 'Lab 1', 'lab-2': 'Lab 2' } as const;
const reportOrder: ToolId[] = ['docker', 'kubectl', 'k3d', 'aws', 'aws-signed-in', 'eksctl'];

export function checkedDate(check: SavedCheck) {
  return new Date(check.checkedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SetupView({ check, onCheck }: { check?: SavedCheck; onCheck: (check: SavedCheck) => void }) {
  const [system, setSystem] = useState<SystemId>(() => guessSystem(navigator.userAgent));
  const [pasted, setPasted] = useState(check?.report ?? '');
  const report = check ? readReport(check.report) : undefined;
  const tools = (ids: string[]) => setup.tools.filter(tool => ids.includes(tool.id));

  const toolCard = (tool: (typeof setup.tools)[number]) => {
    const install = tool.install[system];
    return (
      <section key={tool.id} className="setup-tool" aria-labelledby={`tool-${tool.id}`}>
        <h3 id={`tool-${tool.id}`}>{tool.name}</h3>
        <p className="setup-need">Needed: {toolNeeds[tool.id]}</p>
        <p>{tool.what}</p>
        <p>{install.text}</p>
        {install.commands && <CommandBlock text={install.commands} name={`the ${tool.name} install commands`} />}
        {tool.after && <p>{tool.after}</p>}
        <p className="setup-sources">
          Official guide:{' '}
          {tool.sources.map((source, index) => (
            <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noopener">{source.title}</a></span>
          ))}
        </p>
      </section>
    );
  };

  return (
    <section className="setup-view" aria-labelledby="setup-title">
      <p className="lesson-breadcrumb"><a href="#learn">All lessons</a></p>
      <div className="lesson-heading"><h1 id="setup-title">Set up your laptop</h1></div>
      <p className="lead">The labs run on your laptop. Install the tools, then run one check so the dashboard knows you are ready.</p>

      <section className="setup-step" aria-labelledby="setup-system">
        <h2 id="setup-system"><span className="setup-number" aria-hidden="true">1</span>Choose your system</h2>
        <div className="practice-tabs" role="tablist" aria-label="Your system">
          {setup.systems.map(option => (
            <button key={option.id} type="button" role="tab" aria-selected={system === option.id} onClick={() => setSystem(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        <p>We picked this from your browser. Choose another if it is wrong.</p>
      </section>

      <section className="setup-step" aria-labelledby="setup-install">
        <h2 id="setup-install"><span className="setup-number" aria-hidden="true">2</span>Install the tools</h2>
        <p>Open a terminal and run the commands for each tool you don't have yet. Each card links to the official guide it comes from.</p>
        {system === 'windows' && (
          <section className="setup-tool setup-first" aria-labelledby="setup-wsl">
            <h3 id="setup-wsl">{setup.windowsFirst.title}</h3>
            <ol>
              {setup.windowsFirst.steps.map(step => (
                <li key={step.text}>{step.text}{step.commands && <CommandBlock text={step.commands} name="the WSL install command" />}</li>
              ))}
            </ol>
            <p className="setup-sources">
              Official guides:{' '}
              {setup.windowsFirst.sources.map((source, index) => (
                <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noopener">{source.title}</a></span>
              ))}
            </p>
          </section>
        )}
        <h3 className="setup-group">For Lab 1 and Lab 2</h3>
        <div className="setup-tools">{tools(['docker', 'kubectl', 'k3d']).map(toolCard)}</div>
        <h3 className="setup-group">Only for Lab 2</h3>
        <div className="setup-tools">{tools(['aws', 'eksctl']).map(toolCard)}</div>
      </section>

      <section className="setup-step" aria-labelledby="setup-run">
        <h2 id="setup-run"><span className="setup-number" aria-hidden="true">3</span>Run the check</h2>
        <p>Paste this into your terminal{system === 'windows' ? ' in Ubuntu' : ''}. It prints only tool names and versions, never your account number.</p>
        <CommandBlock text={setup.check} name="the check command" />
      </section>

      <section className="setup-step" aria-labelledby="setup-paste">
        <h2 id="setup-paste"><span className="setup-number" aria-hidden="true">4</span>Paste what it printed</h2>
        <label htmlFor="setup-report">Everything the check printed, starting with <code>kms-check 1</code></label>
        <textarea id="setup-report" className="setup-report" rows={9} spellCheck={false} value={pasted}
          onChange={event => setPasted(event.target.value)} />
        <p>
          <button type="button" className="setup-submit" disabled={!pasted.trim()}
            onClick={() => onCheck({ report: pasted, checkedAt: new Date().toISOString() })}>
            {check ? 'Check again' : 'Check'}
          </button>
        </p>
        <div aria-live="polite">
          {report && !report.valid && (
            <p className="setup-invalid">This doesn't look like the check's output. Paste everything it printed, starting with kms-check 1.</p>
          )}
          {report?.valid && (
            <>
              <p className="setup-checked">
                Checked on {checkedDate(check!)}{systemLabel(report.system) ? `, on ${systemLabel(report.system)}` : ''}.
              </p>
              <ul className="setup-results">
                {reportOrder.filter(id => report.tools[id]).map(id => {
                  const result = report.tools[id]!;
                  return (
                    <li key={id} className={result.ready ? 'setup-ready' : 'setup-fix'}>
                      <span aria-hidden="true">{result.ready ? '✓ ' : '✗ '}</span>
                      <span className="visually-hidden">{result.ready ? 'Ready: ' : 'Fix this: '}</span>
                      {result.message}
                      {result.fix && <small>{result.fix}</small>}
                    </li>
                  );
                })}
              </ul>
              <p className="setup-summary">
                {(['lab-1', 'lab-2'] as const).map(lab => {
                  const missing = labMissing(report, lab).length;
                  return (
                    <span key={lab}>
                      {labReady(report, lab)
                        ? <>{labNames[lab]} is unlocked. <a href={`#learn/${lab}`}>Open {labNames[lab]}</a>. </>
                        : <>{labNames[lab]} needs {missing === 1 ? 'one fix' : `${missing} fixes`}: {labMissing(report, lab).map(result => toolLabels[result.id]).join(', ')}. </>}
                    </span>
                  );
                })}
              </p>
            </>
          )}
        </div>
      </section>
    </section>
  );
}
