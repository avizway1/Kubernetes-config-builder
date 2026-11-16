import { ExportActions } from './ExportActions';
import { Preview } from './Preview';
import { UsageNextSteps } from './UsageNextSteps';
import { useValidation, ValidationReport } from './ValidationStatus';
import { defaultUsageValues, guestbookExample, renderUsage, usageFilename, usageTemplateIds, usageTemplates, type UsageTemplateId, type UsageTool, type UsageValues } from './usage-values';

export type UsageDraft = { current: UsageValues; previous: UsageValues; learning: boolean };

export function UsageBuilder({ id, tool, kubernetesVersion, draft, projectValues, onDraftChange, onTemplateChange }: {
  id: UsageTemplateId;
  tool: UsageTool;
  kubernetesVersion: string;
  draft?: UsageDraft;
  projectValues: UsageValues;
  onDraftChange: (draft: UsageDraft) => void;
  onTemplateChange: (id: UsageTemplateId) => void;
}) {
  const ids = usageTemplateIds[tool];
  const template = usageTemplates[id];
  const defaults = defaultUsageValues(id);
  const values = draft ?? { current: defaults, previous: defaults, learning: true };
  const { learning } = values;
  const current = renderUsage(id, values.current, learning);
  const previous = renderUsage(id, values.previous, learning);
  const validation = useValidation({ tool, kubernetesVersion, values: current.text, usageTemplate: id });
  // The AppProject template grants deployment to a namespace without granting cluster-wide resources.
  const projectWarning = id === 'application' && values.current.createNamespace === true &&
    values.current.project === projectValues.name && values.current.namespace === projectValues.namespace
    ? 'This AppProject only lets Argo CD deploy inside an existing namespace. Create the destination namespace separately, then turn off Create destination namespace.'
    : undefined;

  function update(field: string, value: UsageValues[string]) {
    onDraftChange({ ...values, current: { ...values.current, [field]: value }, previous: values.current });
  }

  return (
    <div className="builder">
      <section className="step builder-options" aria-labelledby="usage-fields">
        <h2 id="usage-fields" tabIndex={-1}>{template.label} settings</h2>
        <a className="pane-jump" href="#usage-preview">Jump to live YAML</a>
        <label>
          Usage template
          <select value={id} onChange={event => onTemplateChange(event.target.value as UsageTemplateId)}>
            {ids.map(key => <option key={key} value={key}>{usageTemplates[key].label}</option>)}
          </select>
        </label>
        <p className="usage-description">{template.description}</p>
        <a href="https://github.com/cavula/Kubernetes-config-builder/blob/main/docs/first-k3s-lab.md">Start the first lab or set up a cluster</a>
        {id === 'application' && (
          <div className="example-actions" aria-label="Application examples">
            <button className="example-button" type="button" onClick={() => onDraftChange({
              ...values, current: defaults, previous: values.current,
            })}>Load lab example</button>
            <button className="example-button" type="button" onClick={() => onDraftChange({
              ...values, current: { ...defaults, ...guestbookExample }, previous: values.current,
            })}>Load Guestbook example</button>
          </div>
        )}
        {template.fields.map(field => {
          const errors = validation?.diagnostics.filter(issue => issue.severity === 'error' && issue.field === field.id) ?? [];
          const description = `usage-${field.id}-help`;
          const error = `usage-${field.id}-error`;
          const accessibility = {
            'aria-invalid': errors.length ? true : undefined,
            'aria-describedby': errors.length ? `${description} ${error}` : description,
          };
          return (
            <div key={field.id}>
              <label>
                {field.label}
                {field.type === 'boolean' ? (
                  <input type="checkbox" {...accessibility} checked={values.current[field.id] === true} onChange={event => update(field.id, event.target.checked)} />
                ) : field.type === 'select' ? (
                  <select {...accessibility} value={String(values.current[field.id])} onChange={event => update(field.id, event.target.value)}>
                    {field.choices.map(choice => <option key={choice}>{choice}</option>)}
                  </select>
                ) : field.type === 'number' ? (
                  <input type="number" {...accessibility} min={1} max={65535} value={String(values.current[field.id])}
                    onChange={event => update(field.id, event.target.value === '' ? '' : event.target.valueAsNumber)} />
                ) : (
                  <input type="text" {...accessibility} value={String(values.current[field.id])} onChange={event => update(field.id, event.target.value)} />
                )}
              </label>
              <small id={description}>{field.description}{field.example ? ` Example ${field.example}.` : ''}</small>
              {errors.length > 0 && <small id={error} className="usage-field-error">{errors.map(issue => issue.message).join(' ')}</small>}
            </div>
          );
        })}
      </section>
      <section className="step builder-output" aria-labelledby="usage-preview">
        <h2 id="usage-preview" tabIndex={-1}>{id === 'scrape-job' || id === 'alert-rule' ? 'Helm values' : 'Usage YAML'}</h2>
        <a className="pane-jump" href="#usage-fields">Back to settings</a>
        <div className="output-controls">
          <label>
            Comment density
            <select value={learning ? 'learning' : 'compact'} onChange={event =>
              onDraftChange({ ...values, learning: event.target.value === 'learning' })}>
              <option value="learning">Learning</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <ExportActions key={id} text={current.text} filename={usageFilename(id)} />
        </div>
        <ValidationReport result={validation} usageTemplate={id} projectWarning={projectWarning} />
        <Preview key={id} current={current} previous={previous} />
        <UsageNextSteps id={id} values={values.current} />
      </section>
    </div>
  );
}
