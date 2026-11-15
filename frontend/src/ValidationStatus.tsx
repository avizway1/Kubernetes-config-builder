import { useEffect, useState } from 'react';

type Diagnostic = { check: string; severity: string; message: string; field?: string };
type Result = { status: string; diagnostics: Diagnostic[]; completed?: string[] };

type Configuration = {
  tool: string;
  kubernetesVersion: string;
  values: string;
  usageTemplate?: string;
};

export function useValidation({ tool, kubernetesVersion, values, usageTemplate }: Configuration) {
  const body = JSON.stringify({ tool, kubernetesVersion, values, usageTemplate });
  const [response, setResponse] = useState<{ body: string; result: Result }>();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const request = await fetch(usageTemplate ? '/api/usage/validate' : '/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        });
        if (!request.ok) throw new Error('The local validator is unavailable.');
        const result: Result = await request.json();
        if (!controller.signal.aborted) setResponse({ body, result });
      } catch {
        if (!controller.signal.aborted) {
          setResponse({ body, result: {
            status: 'incomplete',
            diagnostics: [{ check: 'Validation', severity: 'incomplete', message: 'Start the local Go backend to run validation.' }],
          } });
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body, usageTemplate]);

  return response?.body === body ? response.result : undefined;
}

export function ValidationStatus(config: Configuration) {
  const result = useValidation(config);
  return <ValidationReport result={result} usageTemplate={config.usageTemplate} />;
}

const clusterChecks: Record<string, string> = {
  application: 'cluster access and permissions, the AppProject and Git source, sync, and workload health',
  'app-project': 'cluster access and permissions, and whether the project allows the actual Application source and destination',
  'application-set': 'cluster access and permissions, the ApplicationSet controller, Git and project access, and the generated Applications',
  'service-scrape': 'cluster access and permissions, matching Pods and endpoints, and whether Prometheus can scrape them',
  'scrape-job': 'the existing Helm release and its values, target reachability, and successful scrapes',
  'alert-rule': 'the existing Helm release and its values, whether the query finds live data, and whether the alert fires',
};

export function ValidationReport({ result, usageTemplate, projectWarning }: { result?: Result; usageTemplate?: string; projectWarning?: string }) {
  return (
    <div className="validation-status" aria-live="polite">
      <h2>Validation</h2>
      {!result && <p>Checking configuration…</p>}
      {result?.status === 'passed' && !usageTemplate && <p>Helm lint and schema validation passed.</p>}
      {result?.status === 'error' && <p>Validation found errors.</p>}
      {result?.status === 'incomplete' && <p>Validation is incomplete.</p>}
      {result?.status === 'warning' && <p>Validation found a warning.</p>}
      {!!result?.completed?.length && <p>Local checks passed: {result.completed.join(', ')}.</p>}
      {result?.diagnostics.length ? (
        <ul>
          {result.diagnostics.map(({ check, severity, message }, index) => (
            <li key={index}><strong>{check} ({severity})</strong> {message}</li>
          ))}
        </ul>
      ) : null}
      {projectWarning && <p><strong>AppProject namespace permission (warning)</strong> {projectWarning}</p>}
      {usageTemplate && <p><strong>Check on your cluster:</strong> {clusterChecks[usageTemplate]}.</p>}
    </div>
  );
}
