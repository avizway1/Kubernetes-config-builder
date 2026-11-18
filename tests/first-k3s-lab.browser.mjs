import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const [action, destination] = process.argv.slice(2);
assert.ok(destination && ['download', 'applicationset'].includes(action));

const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, timeout: 15000 });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${process.env.KCB_APP_URL ?? 'http://127.0.0.1:8080'}#build`);
  const tool = page.getByRole('combobox', { name: /^Tool/ });
  const template = page.getByRole('combobox', { name: 'Usage template' });
  const button = name => page.getByRole('button', { name, exact: true });

  async function download(label, filename, dir = destination) {
    const pending = page.waitForEvent('download');
    await button(label).click();
    const file = await pending;
    assert.equal(file.suggestedFilename(), filename);
    await file.saveAs(join(dir, filename));
  }

  async function installBundle(toolId, preset) {
    await button('Install the tool').click();
    await tool.selectOption(toolId);
    await page.getByRole('combobox', { name: /^Preset/ }).selectOption(preset);
    await download('Download Helm bundle', `${toolId}-helm-bundle.zip`);
    await button('Use the tool').click();
  }

  if (action === 'applicationset') {
    await tool.selectOption('argo-cd');
    await template.selectOption('application-set');
    await download('Download', 'application-set.yaml');
    await installBundle('argo-cd', 'full');
  } else {
    for (const id of ['application', 'app-project']) {
      await template.selectOption(id);
      await download('Download', `${id}.yaml`);
    }
    await installBundle('argo-cd', 'minimal');
    await tool.selectOption('prometheus');
    await template.selectOption('service-scrape');
    await download('Download', 'service-scrape.yaml');
    await template.selectOption('scrape-job');
    await download('Download', 'prometheus-scrape-job-values.yaml');
    await page.getByRole('textbox', { name: /^Metrics path/ }).fill('/lab-missing');
    const broken = join(destination, 'broken');
    await mkdir(broken, { recursive: true });
    await download('Download', 'prometheus-scrape-job-values.yaml', broken);
    await template.selectOption('alert-rule');
    await download('Download', 'prometheus-alert-rule-values.yaml');
    await installBundle('prometheus', 'minimal');
  }
} finally {
  await browser.close();
}
