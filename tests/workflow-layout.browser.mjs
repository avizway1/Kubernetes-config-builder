import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright-core');

test('usage and install previews share the viewport and retain independent drafts', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(process.env.KCB_APP_URL ?? 'http://127.0.0.1:5173');

    async function assertDesktopPanes() {
      const settings = await page.locator('.builder-options').boundingBox();
      const preview = await page.locator('.builder-output .preview').first().boundingBox();
      assert.ok(settings.x + settings.width < preview.x, 'settings are to the left of live YAML');
      assert.ok(preview.y + 100 < 900, 'live YAML is readable in the first viewport');
    }

    await page.locator('.builder-output .view-line').first().waitFor();
    await assertDesktopPanes();
    const tool = page.getByRole('combobox', { name: /^Tool/ });
    const use = page.getByRole('button', { name: 'Use the tool' });
    const install = page.getByRole('button', { name: 'Install the tool' });
    const template = page.getByRole('combobox', { name: 'Usage template' });
    const density = page.getByRole('combobox', { name: 'Comment density' });
    const application = page.getByRole('textbox', { name: /^Application name/ });
    const project = page.getByRole('textbox', { name: /^Project name/ });
    await application.fill('session-app');
    await density.selectOption('compact');
    await template.selectOption('app-project');
    await project.fill('session-project');
    await template.selectOption('application');
    assert.equal(await application.inputValue(), 'session-app');
    assert.equal(await density.inputValue(), 'compact');
    await template.selectOption('app-project');
    assert.equal(await project.inputValue(), 'session-project');
    assert.equal(await density.inputValue(), 'learning');

    await tool.selectOption('prometheus');
    await template.selectOption('scrape-job');
    const job = page.getByRole('textbox', { name: /^Job name/ });
    await job.fill('session-scrape');
    await install.click();
    await page.locator('.builder-output .view-line').first().waitFor();
    await assertDesktopPanes();
    const interval = page.locator('.builder-options label').filter({ hasText: /^Scrape interval/ }).locator('input');
    await interval.fill('42s');
    await tool.selectOption('argo-cd');
    const argoServiceType = page.getByRole('combobox', { name: /^Server service type/ });
    await argoServiceType.selectOption('NodePort');
    await use.click();
    assert.equal(await template.inputValue(), 'app-project');
    assert.equal(await project.inputValue(), 'session-project');
    await tool.selectOption('prometheus');
    assert.equal(await template.inputValue(), 'scrape-job');
    assert.equal(await job.inputValue(), 'session-scrape');
    await install.click();
    assert.equal(await interval.inputValue(), '42s');
    await tool.selectOption('argo-cd');
    assert.equal(await argoServiceType.inputValue(), 'NodePort');

    await use.click();
    await page.setViewportSize({ width: 390, height: 844 });
    const toYaml = page.getByRole('link', { name: 'Jump to live YAML' });
    const toSettings = page.getByRole('link', { name: 'Back to settings' });
    await toYaml.click();
    await page.waitForFunction(() => document.activeElement?.id === 'usage-preview');
    assert.match(page.url(), /#usage-preview$/);
    const preview = await page.locator('#usage-preview').boundingBox();
    assert.ok(preview.y >= 0 && preview.y < 844, 'preview is visible after jumping from settings');
    await toSettings.click();
    await page.waitForFunction(() => document.activeElement?.id === 'usage-fields');
    assert.match(page.url(), /#usage-fields$/);
  } finally {
    await browser.close();
  }
});
