import { usageNextSteps } from './usage-next-steps.ts';
import { usageFilename, type UsageTemplateId, type UsageValues } from './usage-values';

export function UsageNextSteps({ id, values }: { id: UsageTemplateId; values: UsageValues }) {
  const steps = usageNextSteps(id, values, usageFilename(id));

  return (
    <div aria-labelledby="usage-next-steps">
      <h3 id="usage-next-steps">Next steps</h3>
      <p>In the lab, Argo CD deploys <code>sample-app</code>. The sample uses a pinned Prometheus binary to serve <code>/metrics</code>. A separate monitoring Prometheus scrapes that endpoint and evaluates the alert.</p>
      <ol>
        {steps.map(({ text, command }) => (
          <li key={text}>
            {text}
            {command && <pre><code>{command}</code></pre>}
          </li>
        ))}
      </ol>
    </div>
  );
}
