import { ExportActions } from './ExportActions';
import { Preview } from './Preview';
import { ValidationStatus } from './ValidationStatus';
import { defaultUsageValues, renderUsage, usageFilename, usageTemplateIds, usageTemplates, type UsageTemplateId, type UsageTool, type UsageValues } from './usage-values';

export type UsageDraft = { current: UsageValues; previous: UsageValues; learning: boolean };

export function UsageBuilder({ id, tool, kubernetesVersion, draft, onDraftChange, onTemplateChange }: {
  id: UsageTemplateId;
  tool: UsageTool;
  kubernetesVersion: string;
  draft?: UsageDraft;
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
        {template.fields.map(field => (
          <label key={field.id}>
            {field.label}
            {field.type === 'boolean' ? (
              <input type="checkbox" checked={values.current[field.id] === true} onChange={event => update(field.id, event.target.checked)} />
            ) : field.type === 'select' ? (
              <select value={String(values.current[field.id])} onChange={event => update(field.id, event.target.value)}>
                {field.choices.map(choice => <option key={choice}>{choice}</option>)}
              </select>
            ) : field.type === 'number' ? (
              <input type="number" min={1} max={65535} value={String(values.current[field.id])}
                onChange={event => update(field.id, event.target.value === '' ? '' : event.target.valueAsNumber)} />
            ) : (
              <input type="text" value={String(values.current[field.id])} onChange={event => update(field.id, event.target.value)} />
            )}
            <small>{field.description}{'example' in field && field.example ? ` Example ${field.example}.` : ''}</small>
          </label>
        ))}
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
        <ValidationStatus tool={tool} kubernetesVersion={kubernetesVersion} values={current.text} usageTemplate={id} />
        <Preview key={id} current={current} previous={previous} />
      </section>
    </div>
  );
}
