import assert from 'node:assert/strict';
import './workflow-layout.browser.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright-core');

const editsByTool = {
  prometheus: [
    ['Scrape interval', 'input', '30s'],
    ['Retention period', 'input', '7d'],
    ['Storage size', 'input', '4Gi'],
    ['CPU and memory', 'fieldset', '75m'],
    ['Persistent storage', 'check'],
    ['Enable Alertmanager', 'check'],
    ['Enable kube-state-metrics', 'check'],
    ['Enable Node exporter', 'check'],
    ['Enable Pushgateway', 'check'],
  ],
  'argo-cd': [
    ['Server service type', 'select', 'NodePort'],
    ['API and UI server replicas', 'input', '2'],
    ['Repository server replicas', 'input', '2'],
    ['API and UI server CPU and memory', 'fieldset', '75m'],
    ['Repository server CPU and memory', 'fieldset', '80m'],
    ['API server metrics', 'check'],
    ['Dex', 'check'],
  ],
};

function optionControl(page, name, type) {
  const panel = page.locator('.builder-options');
  if (type === 'fieldset') {
    return panel.locator('fieldset').filter({ has: page.getByText(name, { exact: true }) }).locator('input').first();
  }
  return panel.locator('label').filter({ hasText: new RegExp('^' + name) })
    .locator(type === 'check' ? 'input[type=checkbox]' : type);
}

test('usage validation distinguishes field errors, local checks, and cluster checks', { timeout: 20000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage();
    const validation = page.locator('.validation-status');
    const name = page.getByRole('textbox', { name: 'Application name', exact: true });
    await page.goto(process.env.KCB_APP_URL ?? 'http://127.0.0.1:5173');
    await validation.getByText(/Local checks passed:.*Argo CD CRD schema/).waitFor();
    await name.fill('My First App');
    await page.locator('#usage-name-error').getByText(/lowercase letters/).waitFor();
    assert.equal(await name.getAttribute('aria-invalid'), 'true');
    await validation.getByText('Validation found errors.').waitFor();
    assert.equal(await validation.getByText(/Local checks passed:/).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Copy', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Download', exact: true }).isEnabled(), true);
    await name.fill('my-first-app');
    await validation.getByText(/Local checks passed:.*Argo CD CRD schema/).waitFor();
    assert.equal(await name.getAttribute('aria-invalid'), null);
    await validation.getByText(/the AppProject and Git source, sync, and workload health/).waitFor();

    await page.getByRole('combobox', { name: /^Tool/ }).selectOption('prometheus');
    const port = page.getByRole('spinbutton', { name: 'Service port', exact: true });
    await port.fill('99999');
    await page.locator('#usage-servicePort-error').getByText('Enter a whole number from 1 to 65535.').waitFor();
    assert.equal(await port.getAttribute('aria-invalid'), 'true');
    await port.fill('65535');
    await validation.getByText(/Local checks passed:.*Kubernetes Service schema/).waitFor();
    assert.equal(await port.getAttribute('aria-invalid'), null);
    await validation.getByText(/matching Pods and endpoints/).waitFor();

    await page.route('**/api/usage/validate', route => route.fulfill({ status: 503 }));
    await port.fill('1');
    await validation.getByText('Validation is incomplete.').waitFor();
    assert.equal(await validation.getByText(/Local checks passed:/).count(), 0);
  } finally {
    await browser.close();
  }
});

test('both tools update both preview formats, highlight edits, and explain YAML fields', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({
    executablePath: process.env.KCB_CHROME_PATH,
    timeout: 15000,
    args: ['--disable-gpu'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    page.setDefaultTimeout(8000);
    await page.goto(process.env.KCB_APP_URL ?? 'http://127.0.0.1:5173');
    assert.equal(await page.getByRole('button', { name: 'Use the tool' }).getAttribute('aria-pressed'), 'true');
    const usageTemplate = page.getByRole('combobox', { name: 'Usage template' });
    const nextSteps = page.locator('[aria-labelledby="usage-next-steps"]');
    const localChecks = page.getByText(/^Local checks passed:/);

    async function checkUsageHandoff(text, filename) {
      const header = text.split('\n\n', 1)[0].split('\n');
      assert.match(await nextSteps.textContent(), /Prerequisites:.*Confirm/s);
      const commands = await nextSteps.locator('pre code').allTextContents();
      assert.ok(commands.some(command => command.endsWith(filename)));
      for (const command of commands) assert.ok(header.includes(`# ${command}`), command);
      await page.getByRole('button', { name: 'Copy', exact: true }).click();
      await page.getByText('Copied to clipboard.').waitFor();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text);
    }
    for (const id of ['application', 'app-project', 'application-set']) {
      await usageTemplate.selectOption(id);
      await localChecks.filter({ hasText: 'Argo CD CRD schema' }).waitFor();
      await page.getByText('Check on your cluster:', { exact: true }).waitFor();
      const pendingDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download', exact: true }).click();
      const download = await pendingDownload;
      const learning = readFileSync(await download.path(), 'utf8');
      await checkUsageHandoff(learning, download.suggestedFilename());
      assert.match(learning, /apiVersion: argoproj.io\/v1alpha1/);
      const lines = learning.trimEnd().split('\n');
      for (const [index, line] of lines.entries()) {
        if (line.trim() && !line.trimStart().startsWith('#')) {
          assert.match(lines[index - 1] ?? '', /^\s*# .+/);
        }
      }
      await page.getByRole('combobox', { name: 'Comment density' }).selectOption('compact');
      const compactDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download', exact: true }).click();
      const compact = await compactDownload;
      const compactText = readFileSync(await compact.path(), 'utf8');
      await checkUsageHandoff(compactText, compact.suggestedFilename());
      assert.doesNotMatch(compactText.split('\n\n', 2)[1], /^\s*#/m);
    }
    await page.getByRole('combobox', { name: /^Tool/ }).selectOption('prometheus');
    assert.deepEqual(await usageTemplate.locator('option').evaluateAll(options => options.map(option => option.value)),
      ['service-scrape', 'scrape-job', 'alert-rule']);
    for (const id of ['service-scrape', 'scrape-job', 'alert-rule']) {
      await usageTemplate.selectOption(id);
      await localChecks.filter({ hasText: id === 'service-scrape'
        ? 'Kubernetes Service schema'
        : /Helm render with the pinned chart, promtool/ }).waitFor();
      const pendingDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download', exact: true }).click();
      const download = await pendingDownload;
      const learning = readFileSync(await download.path(), 'utf8');
      await checkUsageHandoff(learning, download.suggestedFilename());
      const lines = learning.trimEnd().split('\n');
      for (const [index, line] of lines.entries()) {
        if (line.trim() && !line.trimStart().startsWith('#')) {
          assert.match(lines[index - 1] ?? '', /^\s*# .+/);
        }
      }
      if (id === 'service-scrape') {
        assert.equal(download.suggestedFilename(), 'service-scrape.yaml');
        assert.match(learning, /^kind: Service$/m);
        assert.match(learning, /prometheus.io\/scrape: "true"/);
      } else {
        assert.equal(download.suggestedFilename(), `prometheus-${id}-values.yaml`);
        assert.match(learning, /^# Helm values to add to an existing standalone Prometheus install\. Use Helm to apply this file\./);
        assert.ok(learning.includes(`--version 29.45.1 --reuse-values --values ${download.suggestedFilename()}\n`));
      }
      await page.getByRole('combobox', { name: 'Comment density' }).selectOption('compact');
      const compactDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download', exact: true }).click();
      const compact = await compactDownload;
      const compactText = readFileSync(await compact.path(), 'utf8');
      await checkUsageHandoff(compactText, compact.suggestedFilename());
      assert.doesNotMatch(compactText.split('\n\n', 2)[1], /^\s*#/m);
    }
    await page.getByRole('button', { name: 'Install the tool' }).click();
    await page.getByRole('combobox', { name: /^Tool/ }).selectOption('prometheus');
    await page.locator('.view-line').first().waitFor();
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource')
        .find(entry => /\/monaco-editor\.js(?:\?|$)/.test(entry.name))?.name;
      if (!url) throw new Error('Monaco dev module could not be found');
      globalThis.testMonaco = (await import(url)).editor;
    });

    const currentVersion = () => page.evaluate(() => globalThis.testMonaco.getModels().at(-1)?.getVersionId());
    const chooser = page.getByRole('combobox', { name: /^Tool/ });
    const preset = page.getByRole('combobox', { name: /^Preset/ });
    const formatControl = page.locator('.builder-output select').first();
    assert.equal(await preset.inputValue(), 'minimal');
    await page.setViewportSize({ width: 375, height: 800 });
    const presetBox = await preset.boundingBox();
    const cardBox = await page.locator('.configuration-selection').boundingBox();
    assert.ok(presetBox.x + presetBox.width <= cardBox.x + cardBox.width);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('heading', { name: '1. Choose a preset' }).waitFor();
    await page.getByRole('heading', { name: '2. Customize (optional)' }).waitFor();
    await page.getByRole('heading', { name: '3. Deploy' }).waitFor();
    for (const [name] of editsByTool.prometheus.filter(([name]) => name.startsWith('Enable '))) {
      assert.equal(await optionControl(page, name, 'check').isChecked(), false, name);
    }
    await page.getByText(/Prometheus server · about/).waitFor();
    assert.equal(await page.getByText(/Pushgateway · about/).count(), 0);
    await optionControl(page, 'Enable Pushgateway', 'check').check();
    await page.getByRole('button', { name: /Pushgateway · about/ }).click();
    const pushgateway = page.locator('details[id="component-Pushgateway"]');
    assert.equal(await pushgateway.evaluate(section => section.open), true);
    assert.equal(await pushgateway.locator('summary').evaluate(summary => summary === document.activeElement), true);
    await pushgateway.locator('summary').click();
    assert.equal(await pushgateway.evaluate(section => section.open), false);
    await preset.selectOption('recommended');
    assert.equal(await optionControl(page, 'Enable Alertmanager', 'check').isChecked(), true);
    assert.equal(await optionControl(page, 'Enable Pushgateway', 'check').isChecked(), false);
    await preset.selectOption('full');
    const elapsed = [];
    for (const format of ['values', 'manifests']) {
      for (const [tool, edits] of Object.entries(editsByTool)) {
        await chooser.selectOption(tool === 'prometheus' ? 'argo-cd' : 'prometheus');
        await chooser.selectOption(tool);
        await formatControl.selectOption(format);
        await page.waitForFunction(() => Boolean(globalThis.testMonaco.getModels().at(-1)?.getValue()));
        if (tool === 'prometheus') {
          await optionControl(page, 'Persistent storage', 'check').check();
        }
        for (const [name, type, value] of edits) {
          const control = optionControl(page, name, type);
          const before = await currentVersion();
          const start = performance.now();
          let checked;
          if (type === 'check') {
            checked = !(await control.isChecked());
            await control.setChecked(checked);
          } else if (type === 'select') {
            await control.selectOption(value === await control.inputValue() ? 'ClusterIP' : value);
          } else {
            const alternate = { '30s': '25s', '7d': '8d', '4Gi': '5Gi', '75m': '76m', '80m': '81m', '2': '3' };
            await control.fill(value === await control.inputValue() ? alternate[value] : value);
          }
          if (format === 'manifests' && tool === 'prometheus' && name.startsWith('Enable ')) {
            await page.getByRole('button', { name: new RegExp(name.slice(7) + ' · about') })
              .waitFor({ state: checked ? 'visible' : 'detached' });
          } else await page.waitForFunction(old => {
            const model = globalThis.testMonaco.getModels().at(-1);
            return Boolean(model && model.getValueLength() > 0 && model.getVersionId() !== old);
          }, before);
          const milliseconds = performance.now() - start;
          elapsed.push(milliseconds);
          assert.ok(milliseconds < 1000, `${tool} ${format} ${name} took ${milliseconds.toFixed(0)} ms`);
        }
      }
    }

    await chooser.selectOption('prometheus');
    await formatControl.selectOption('values');
    const interval = optionControl(page, 'Scrape interval', 'input');
    for (const value of ['31s', '32s', '33s', '35s']) await interval.fill(value);
    const field = page.locator('.view-line').filter({ hasText: /scrape_interval.*35s/ }).last();
    await field.waitFor();
    await page.locator('.line-insert, .char-insert').first().waitFor({ state: 'attached' });
    await field.locator('span').filter({ hasText: 'scrape_interval' }).last().hover();
    await page.locator('.monaco-hover').getByText(/How often Prometheus collects metrics/).waitFor();

    await formatControl.selectOption('manifests');
    await page.waitForFunction(() => globalThis.testMonaco.getModels().at(-1)?.getValue().includes('securityContext:'));
    const manifestHover = page.locator('.monaco-hover').getByText(/Constrain the identity and privileges/i);
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.evaluate(() => {
        const model = globalThis.testMonaco.getModels().at(-1);
        const { startLineNumber, startColumn } = model.findMatches('securityContext:', false, false, true, null, false)[0].range;
        const editor = globalThis.testMonaco.getEditors().find(editor => editor.getModel() === model);
        editor.setPosition({ lineNumber: startLineNumber, column: startColumn + 1 });
        editor.revealLineInCenter(startLineNumber);
        editor.focus();
        editor.trigger('test', 'editor.action.showHover', {});
      });
      if (await manifestHover.isVisible()) break;
      await page.waitForTimeout(100);
    }
    await manifestHover.waitFor();

    async function download(label) {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: label }).click();
      const file = await pending;
      const stream = await file.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      return { name: file.suggestedFilename(), text: bytes.toString(), file };
    }

    async function copy(label) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByText('Copied to clipboard.').waitFor();
      return page.evaluate(() => navigator.clipboard.readText());
    }

    const installCommands = page.getByLabel('Install commands');
    const exportActions = page.getByLabel('Export active format');
    const checksums = readFileSync(new URL('../backend/chart-checksums.txt', import.meta.url), 'utf8');
    for (const [tool, version] of [['prometheus', '29.45.1'], ['argo-cd', '10.17.1']]) {
      await chooser.selectOption(tool);
      await formatControl.selectOption('values');
      const values = await copy('Copy values');
      const bundle = await download('Download Helm bundle');
      assert.equal(bundle.name, `${tool}-helm-bundle.zip`);
      const scratch = mkdtempSync(join(tmpdir(), 'kcb-browser-bundle-'));
      try {
        const filename = `${tool}-${version}.tgz`;
        execFileSync('unzip', ['-q', await bundle.file.path(), '-d', scratch]);
        assert.equal(readFileSync(join(scratch, `${tool}-values.yaml`), 'utf8'), values);
        const hash = createHash('sha256').update(readFileSync(join(scratch, filename))).digest('hex');
        assert.ok(checksums.includes(`${hash}  ${filename}`));
        const install = await installCommands.textContent();
        const readme = readFileSync(join(scratch, 'README.txt'), 'utf8');
        assert.ok(values.startsWith('# ' + install + '\n'));
        assert.ok(readme.startsWith(install + '\n'));
        assert.match(values, /Indentation groups settings/);
        assert.match(readme, /After install:/);
        assert.match(readme, /^kubectl .*port-forward/m);
        if (tool === 'argo-cd') {
          assert.match(install, /--hide-notes/);
          assert.match(readme, /localhost:8081/);
          assert.match(readme, /port-forward .* 8081:443/);
          assert.match(readme, /argocd admin initial-password/);
        }
        execFileSync('helm', ['template', tool, './' + filename, '-f', `${tool}-values.yaml`], {
          cwd: scratch, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, HELM_CONFIG_HOME: scratch, HELM_CACHE_HOME: scratch, HELM_DATA_HOME: scratch },
        });
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
      await formatControl.selectOption('manifests');
      const yaml = await download('Download');
      assert.equal(yaml.name, `${tool}-manifests.yaml`);
      assert.equal(yaml.text, await copy('Copy'));
      assert.ok(yaml.text.startsWith('# ' + (await installCommands.textContent())));
      assert.match(yaml.text, /# After install:/);
      assert.match(yaml.text, /# kubectl .*port-forward/);
      for (const field of ['apiVersion', 'labels', 'readinessProbe', 'livenessProbe', 'securityContext', 'resources', 'rules']) {
        assert.match(yaml.text, new RegExp('^ *# Why: .+\\n *(?:- )?' + field + ':', 'm'), field);
      }
      assert.doesNotMatch(yaml.text.split('\n---\n')[0], /Helm release/);
      if (tool === 'prometheus') {
        const density = page.getByRole('combobox', { name: 'Comment density' });
        assert.equal(await density.inputValue(), 'learning');
        await density.selectOption('compact');
        const compact = await download('Download');
        assert.equal(compact.text, await copy('Copy'));
        assert.match(compact.text, /# Purpose:/);
        const scrapeNote = '    # Why: These jobs tell Prometheus which targets to discover and where to collect metrics.\n';
        assert.ok(compact.text.includes(scrapeNote + '    scrape_configs:'));
        assert.match(compact.text, /# v0\.95\.2 supplies ARM64 images/);
        assert.doesNotMatch(compact.text.replace(scrapeNote, ''), /# Why:|# Source:/);
        await density.selectOption('learning');
        for (const field of ['hostNetwork', 'hostPID', 'storage']) {
          assert.match(yaml.text, new RegExp('^ *# Why: .+\\n *(?:- )?' + field + ':', 'm'), field);
        }
      } else {
        assert.match(yaml.text, /# argocd admin initial-password/);
        assert.match(yaml.text, /# kubectl port-forward .* 8081:443/);
        await page.getByText('After install', { exact: true }).click();
        assert.match(await page.getByLabel('Access commands').innerText(), /localhost:8081.*\n.*port-forward .* 8081:443/);
      }
    }
    assert.equal(await preset.inputValue(), 'minimal');
    assert.deepEqual(await preset.locator('option').evaluateAll(options => options.map(option => option.value)), ['minimal', 'full']);
    for (const name of ['minimal', 'full']) {
      await preset.selectOption(name);
      await formatControl.selectOption('manifests');
      const schemas = page.locator('details[id="component-CRD schemas"]');
      await schemas.locator('summary').waitFor();
      assert.equal(await schemas.evaluate(section => section.open), false, name);
      assert.equal(await schemas.locator('pre').count(), 0, name);
      await page.waitForFunction(() => {
        const model = globalThis.testMonaco.getModels().at(-1);
        const entries = model?.findMatches('Settings read from the argocd-cmd-params-cm ConfigMap are all optional.', false, false, true, null, false);
        if (!entries || entries.length < 2) return false;
        const editor = globalThis.testMonaco.getEditors().find(candidate => candidate.getModel() === model);
        return editor && entries.every(({ range }) =>
          editor.getTopForLineNumber(range.startLineNumber + 2) === editor.getTopForLineNumber(range.startLineNumber + 3));
      });
      const { text } = await download('Download');
      assert.match(text, /name: ARGOCD_SERVER_INSECURE/);
      assert.match(text, /name: argocd-cmd-params-cm/);
      assert.doesNotMatch(text, /Settings read from the argocd-cmd-params-cm ConfigMap are all optional/);
      const workloads = text.split(/^---$/m).filter(doc => !/^kind: CustomResourceDefinition$/m.test(doc)).join('---');
      if (name === 'minimal') assert.ok(workloads.trimEnd().split('\n').length <= 3600);
      const deployments = workloads.split(/^---$/m).filter(doc => /^kind: Deployment$/m.test(doc));
      for (const component of ['dex-server', 'notifications-controller']) {
        assert.equal(deployments.some(doc => doc.includes('name: argo-cd-argocd-' + component)), name === 'full', component);
      }
      const applicationSet = deployments.find(doc => doc.includes('name: argo-cd-argocd-applicationset-controller'));
      assert.match(applicationSet, new RegExp('^  replicas: ' + (name === 'minimal' ? 0 : 1) + '$', 'm'));
    }
    await page.getByText('CRD schemas', { exact: true }).waitFor();
    assert.equal(await page.locator('details[id="component-CRD schemas"]').getAttribute('open'), null);
    assert.deepEqual(await exportActions.getByRole('button').allTextContents(), ['Copy', 'Download']);
    const comparison = page.getByRole('button', { name: 'Compare Helm and Kubernetes YAML manifest' });
    await comparison.click();
    const panes = page.locator('.comparison-panes .preview');
    await panes.nth(1).waitFor();
    assert.equal(await panes.count(), 2);
    for (const pane of await panes.all()) {
      await pane.locator('.modified .line-numbers').first().waitFor();
      assert.equal(await pane.locator('.original .line-numbers').count(), 0);
    }
    await comparison.click();
    const workloads = await download('Download');
    assert.equal(workloads.name, 'argo-cd-manifests.yaml');
    assert.ok(workloads.text.startsWith('# ' + (await installCommands.textContent())));
    assert.match(workloads.text, /Server-side apply avoids the annotation size limit/);
    assert.match(workloads.text, /# Why: Use apps\/v1 because/);
    assert.match(workloads.text, /REQUIRED IF you enable/);
    assert.match(workloads.text, /^kind: CustomResourceDefinition$/m);
    assert.match(workloads.text, /Run this Redis initialization Job first/);

    console.log(`All ${elapsed.length} option edits updated the preview in under one second. Slowest ${Math.max(...elapsed).toFixed(0)} ms.`);
  } finally {
    await browser.close();
  }
});
