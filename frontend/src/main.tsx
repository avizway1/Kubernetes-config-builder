import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { presets, type Preset } from './builder-values';
import { UsageBuilder, type UsageDraft } from './UsageBuilder';
import { Builder, type InstallDraft } from './Builder';
import { kubernetesVersions, platform, selectConfiguration, tools } from './selection';
import { Home, Learn, showBuildAConfig, SiteFooter, SiteHeader, type View } from './Site';
import { levels } from './lessons';
import { defaultLessonValues, lessonContent } from './lesson-builder';
import { LessonView, type LessonProgress } from './LessonView';
import { defaultUsageValues, usageTemplateIds, type UsageTemplateId, type UsageTool } from './usage-values';
import './style.css';

const startKey = 'kubernetes-made-simple:start';

const allLessons = levels.flatMap(level => level.lessons);

// While Build a config is hidden there is no choice to make, so the home page is Learn Kubernetes.
const homeView: View = showBuildAConfig ? 'home' : 'learn';

// #learn/pod opens a lesson inside Learn Kubernetes.
function routeFromHash(): { view?: View; lesson?: string } {
  const [view, lesson] = window.location.hash.slice(1).split('/');
  if (view === 'learn' && lesson && lessonContent[lesson]) return { view, lesson };
  if (view === 'home') return { view: homeView };
  return view === 'learn' || view === 'build' ? { view } : {};
}

// Returning visitors skip the starting options. Storage can be unavailable, so the page works without it.
function storedStart(): View | undefined {
  if (!showBuildAConfig) return undefined;
  try {
    const value = window.localStorage.getItem(startKey);
    return value === 'learn' || value === 'build' ? value : undefined;
  } catch {
    return undefined;
  }
}

function App() {
  const [route, setRoute] = useState(() => {
    const initial = routeFromHash();
    return { view: initial.view ?? storedStart() ?? homeView, lesson: initial.lesson };
  });
  const view = route.view;
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgress>>({});

  useEffect(() => {
    const onHashChange = () => {
      const next = routeFromHash();
      // Jump links such as #usage-preview are anchors on the current page, not routes. Let the browser scroll to them.
      if (!next.view && window.location.hash.length > 1) return;
      setRoute({ view: next.view ?? homeView, lesson: next.lesson });
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (view === 'home') return;
    try {
      window.localStorage.setItem(startKey, view);
    } catch {
      // The choice is only a convenience.
    }
  }, [view]);

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
    <>
      <SiteHeader view={view} />
      {view === 'home' && <main><Home /></main>}
      {view === 'learn' && !route.lesson && <main><Learn /></main>}
      {view === 'learn' && route.lesson && (() => {
        const id = route.lesson;
        const content = lessonContent[id];
        const index = allLessons.findIndex(lesson => lesson.id === id);
        const next = allLessons.slice(index + 1).find(lesson => lessonContent[lesson.id]);
        return (
          <main>
            <LessonView key={id} lesson={allLessons[index]} content={content} next={next}
              progress={lessonProgress[id] ?? { step: 0, values: defaultLessonValues(content), explanations: true }}
              onProgress={progress => setLessonProgress(all => ({ ...all, [id]: progress }))} />
          </main>
        );
      })()}
      {view === 'build' && (
        <main>
          <div className="build-heading">
            <h1>Build a config</h1>
            <nav className="workflow-options" aria-label="Tool workflow">
              <button type="button" aria-pressed={mode === 'use'} onClick={() => setMode('use')}>Use the tool</button>
              <button type="button" aria-pressed={mode === 'install'} onClick={() => setMode('install')}>Install the tool</button>
            </nav>
            <span className="badge badge-k3s">Tested on K3s</span>
          </div>
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
              projectValues={usageDrafts['app-project']?.current ?? defaultUsageValues('app-project')}
              onDraftChange={draft => setUsageDrafts(drafts => ({ ...drafts, [usageTemplate]: draft }))} />
          )}
        </main>
      )}
      <SiteFooter />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
