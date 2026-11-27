import { useState } from 'react';
import { CommandBlock } from './CommandBlock';
import {
  guessSystem, labMissing, labReady, readReport, setup, systemLabel, toolLabels, toolNeeds, type CommandStep, type SavedCheck, type SystemId,
  type ToolId,
} from './setup-check';

const labNames = { 'lab-1': 'Lab 1', 'lab-2': 'Lab 2' } as const;
const reportOrder: ToolId[] = ['docker', 'kubectl', 'k3d', 'aws', 'aws-signed-in', 'eksctl'];

type Source = { title: string; url: string };

function Sources({ label, sources }: { label: string; sources: Source[] }) {
  return (
    <p className="setup-sources">
      {label}:{' '}
      {sources.map((source, index) => (
        <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noopener">{source.title}</a></span>
      ))}
    </p>
  );
}

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
        <Sources label="Official guide" sources={tool.sources} />
      </section>
    );
  };

  return (
    <section className="setup-view" aria-labelledby="setup-title">
      <p className="lesson-breadcrumb"><a href="#learn">All lessons</a></p>
      <div className="lesson-heading"><h1 id="setup-title">Set up your laptop</h1></div>
      <p className="lead">
        Try it and the labs run on your laptop. Check what your laptop needs, install the tools, run one check so the dashboard
        knows you are ready, then point kubectl at your practice cluster and look inside it.
      </p>

      <section className="setup-step" aria-labelledby="setup-needs">
        <h2 id="setup-needs"><span className="setup-number" aria-hidden="true">1</span>What your laptop needs</h2>
        <p>{setup.requirements.intro}</p>
        <ul className="setup-needs">
          {setup.requirements.items.map(item => (
            <li key={item.label}>
              <strong>{item.label}:</strong> {item.text}
              {item.systems && (
                <ul>
                  {setup.systems.map(option => <li key={option.id}>{item.systems![option.id]}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <Sources label="Sources" sources={setup.requirements.sources} />
      </section>

      <section className="setup-step" aria-labelledby="setup-system">
        <h2 id="setup-system"><span className="setup-number" aria-hidden="true">2</span>Choose your system</h2>
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
        <h2 id="setup-install"><span className="setup-number" aria-hidden="true">3</span>Install the tools</h2>
        <p>
          The quickest way is one script that looks at your laptop and installs everything that is missing. You can also install
          each tool yourself with the cards after it, which link to the official guides they come from.
        </p>
        <section className="setup-tool setup-first setup-script" aria-labelledby="setup-script">
          <h3 id="setup-script">{setup.installScript.title}</h3>
          <p>{setup.installScript.text}</p>
          <p>{setup.installScript.systems[system].where}</p>
          <CommandBlock text={setup.installScript.systems[system].commands} name="the install script commands" />
          <p className="setup-expect">{setup.installScript.systems[system].expect}</p>
          <Sources label="Read the script" sources={[{
            title: setup.installScript.systems[system].file,
            url: `${setup.installScript.source}${setup.installScript.systems[system].file}`,
          }]} />
        </section>
        <h3 className="setup-group" id="setup-by-hand">Or install each tool yourself</h3>
        {system === 'windows' && (
          <section className="setup-tool setup-first" aria-labelledby="setup-wsl">
            <h3 id="setup-wsl">{setup.windowsFirst.title}</h3>
            <ol>
              {setup.windowsFirst.steps.map(step => (
                <li key={step.text}>{step.text}{step.commands && <CommandBlock text={step.commands} name="the WSL install command" />}</li>
              ))}
            </ol>
            <Sources label="Official guides" sources={setup.windowsFirst.sources} />
          </section>
        )}
        <h3 className="setup-group">For Lab 1 and Lab 2</h3>
        <div className="setup-tools">{tools(['docker', 'kubectl', 'k3d']).map(toolCard)}</div>
        <h3 className="setup-group">Only for Lab 2</h3>
        <div className="setup-tools">{tools(['aws', 'eksctl']).map(toolCard)}</div>
      </section>

      <section className="setup-step" aria-labelledby="setup-run">
        <h2 id="setup-run"><span className="setup-number" aria-hidden="true">4</span>Run the check</h2>
        <p>Paste this into your terminal{system === 'windows' ? ' in Ubuntu' : ''}. It prints only tool names and versions, never your account number.</p>
        <p>If you used the script, it ran this check for you. Run it again whenever you change a tool.</p>
        <CommandBlock text={setup.check} name="the check command" />
      </section>

      <section className="setup-step" aria-labelledby="setup-paste">
        <h2 id="setup-paste"><span className="setup-number" aria-hidden="true">5</span>Paste what it printed</h2>
        <label htmlFor="setup-report">Everything the check printed, starting with <code>lkme-check 1</code></label>
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
            <p className="setup-invalid">This doesn't look like the check's output. Paste everything it printed, starting with lkme-check 1.</p>
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

      <section className="setup-step" aria-labelledby="setup-kubectl">
        <h2 id="setup-kubectl"><span className="setup-number" aria-hidden="true">6</span>Create your practice cluster and point kubectl at it</h2>
        <p>{setup.practiceCluster.intro}{system === 'windows' ? ' Run these commands in Ubuntu.' : ''}</p>
        {setup.practiceCluster.steps.map((item, index) => commandStep(item, `setup-kubectl-${index}`))}
        <section className="setup-tool setup-cluster-step" aria-labelledby="setup-kubectl-problems">
          <h3 id="setup-kubectl-problems">If something goes wrong</h3>
          <p>Find the message you see, then run its fix.</p>
          <ul className="setup-problems">
            {setup.practiceCluster.problems.map(problem => (
              <li key={problem.message}>
                <p><code className="setup-message">{problem.message}</code></p>
                <p>{problem.text}</p>
                {problem.commands && <CommandBlock text={problem.commands} name={`the fix for: ${problem.message}`} />}
                <Sources label="Official guide" sources={problem.sources} />
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className="setup-step" aria-labelledby="setup-inside">
        <h2 id="setup-inside"><span className="setup-number" aria-hidden="true">7</span>Look inside your practice cluster</h2>
        <p>{setup.insideNode.intro}{system === 'windows' ? ' Run these commands in Ubuntu.' : ''}</p>
        <div className="setup-warning" role="note">
          <p>{setup.insideNode.warning}</p>
        </div>
        {setup.insideNode.steps.map((item, index) => commandStep(item, `setup-inside-${index}`))}
        <section className="setup-tool setup-cluster-step" aria-labelledby="setup-inside-again">
          <h3 id="setup-inside-again">If you changed something</h3>
          <p>{setup.insideNode.startAgain.text}</p>
          <CommandBlock text={setup.insideNode.startAgain.commands} name="the command that deletes the practice cluster" />
          <Sources label="Official guide" sources={setup.insideNode.startAgain.sources} />
        </section>
      </section>
    </section>
  );
}

// One card on the practice cluster steps: what to do, the commands, what success looks like, and where it comes from.
function commandStep(item: CommandStep, id: string) {
  return (
    <section key={item.title} className="setup-tool setup-cluster-step" aria-labelledby={id}>
      <h3 id={id}>{item.title}</h3>
      <p>{item.text}</p>
      <CommandBlock text={item.commands} name={`the commands: ${item.title}`} />
      <p className="setup-expect"><strong>You should see</strong> {item.expect}</p>
      <Sources label={item.sources.length > 1 ? 'Official guides' : 'Official guide'} sources={item.sources} />
    </section>
  );
}
