import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { presets, type Preset } from './builder-values';
import { UsageBuilder, type UsageDraft } from './UsageBuilder';
import { Builder, type InstallDraft } from './Builder';
import { kubernetesVersions, platform, selectConfiguration, tools } from './selection';
import { usageTemplateIds, type UsageTemplateId, type UsageTool } from './usage-values';
import './style.css';

function App() {
  const [configuration, setConfiguration] = useState(() =>
    selectConfiguration(platform.id, kubernetesVersions[0], 'argo-cd'),
  );

  const [mode, setMode] = useState<'use' | 'install'>('use');
  const [presetsByTool, setPresetsByTool] = useState<Record<string, Preset>>({});
  const [usageTemplates, setUsageTemplates] = useState<Partial<Record<UsageTool, UsageTemplateId>>>({});
  const [usageDrafts, setUsageDrafts] = useState<Partial<Record<UsageTemplateId, UsageDraft>>>({});
  const [installDrafts, setInstallDrafts] = useState<Partial<Record<string, InstallDraft>>>({});
  const tool = configuration.tool.id;
  const activePreset = presetsByTool[tool] ?? 'minimal';
  const usageTemplate = usageTemplates[tool] ?? usageTemplateIds[tool][0];
  const installKey = `${tool}/${activePreset}`;

  return (
    <main>
      <h1>Kubernetes Config Builder</h1>
      <nav className="workflow-options" aria-label="Tool workflow">
        <button type="button" aria-pressed={mode === 'use'} onClick={() => setMode('use')}>Use the tool</button>
        <button type="button" aria-pressed={mode === 'install'} onClick={() => setMode('install')}>Install the tool</button>
      </nav>
      <section aria-labelledby="choose-preset" className="step configuration-selection">
        <h2 id="choose-preset">{mode === 'install' ? '1. Choose a preset' : 'Choose a tool'}</h2>
        <label>
          Platform
          <select value={platform.id} onChange={event => setConfiguration(
            selectConfiguration(event.target.value, configuration.kubernetesVersion, configuration.tool.id),
          )}>
            <option value={platform.id}>{platform.name}</option>
          </select>
          <small>Target cluster platform.</small>
        </label>
        <label>
          Kubernetes version
          <select value={configuration.kubernetesVersion} onChange={event => setConfiguration(
            selectConfiguration(platform.id, event.target.value, configuration.tool.id),
          )}>
            {kubernetesVersions.map(version => <option key={version}>{version}</option>)}
          </select>
          <small>{mode === 'use' ? 'Use the default for the lab, or choose the version running on your cluster.' : 'Version running on your cluster.'}</small>
        </label>
        <label>
          Tool
          <select value={configuration.tool.id} onChange={event => setConfiguration(
            selectConfiguration(platform.id, configuration.kubernetesVersion, event.target.value),
          )}>
            {tools.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          <small>{mode === 'install' ? 'Chart to configure.' : 'Tool to generate usage YAML for.'}</small>
        </label>
        {mode === 'install' && <label>
          Preset
          <select value={activePreset} onChange={event => setPresetsByTool({ ...presetsByTool, [configuration.tool.id]: event.target.value as Preset })}>
            {Object.entries(presets).filter(([id]) => configuration.tool.id !== 'argo-cd' || id !== 'recommended')
              .map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <small>{configuration.tool.id === 'prometheus'
            ? 'Start with the server alone or add monitoring components.'
            : activePreset === 'minimal' ? 'Core components only. Dex, notifications, and ApplicationSet are off.'
            : 'Includes Dex, notifications, and ApplicationSet.'}</small>
        </label>}
        {mode === 'install' && configuration.tool.id === 'prometheus' && activePreset === 'recommended' && (
          <small className="preset-description">Includes Alertmanager, kube-state-metrics, and node exporter. Enable Pushgateway for short-lived service-level batch jobs.</small>
        )}
      </section>
      {mode === 'install' ? (
        <Builder key={installKey} preset={activePreset} tool={tool} chartVersion={configuration.tool.chartVersion}
          kubernetesVersion={configuration.kubernetesVersion} draft={installDrafts[installKey]}
          onDraftChange={draft => setInstallDrafts(drafts => ({ ...drafts, [installKey]: draft }))} />
      ) : (
        <UsageBuilder id={usageTemplate} tool={tool} kubernetesVersion={configuration.kubernetesVersion}
          onTemplateChange={id => setUsageTemplates(templates => ({ ...templates, [tool]: id }))}
          draft={usageDrafts[usageTemplate]}
          onDraftChange={draft => setUsageDrafts(drafts => ({ ...drafts, [usageTemplate]: draft }))} />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
