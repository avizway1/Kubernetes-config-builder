import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const appUrl = process.env.KCB_APP_URL ?? 'http://127.0.0.1:5173';

test('first visit offers two starting options and the lesson overview opens existing templates', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(appUrl);

    assert.equal(await page.title(), 'Kubernetes Made Simple');
    await page.getByRole('heading', { name: 'What would you like to do?' }).waitFor();
    assert.equal(await page.locator('.door').count(), 2);
    const logo = page.getByRole('img', { name: 'Aviz Academy' });
    await logo.waitFor();
    assert.ok(await logo.evaluate(image => image.complete && image.naturalWidth > 0), 'logo loads');
    assert.equal(await page.locator('link[rel="icon"][sizes="32x32"]').getAttribute('href'), '/brand/favicon-32.png');
    assert.equal(await page.getByRole('link', { name: 'Aviz Academy', exact: true }).getAttribute('href'), 'https://avizacademy.com');

    await page.locator('.door-primary').click();
    await page.getByRole('heading', { name: 'Learn Kubernetes', level: 1 }).waitFor();
    assert.equal(new URL(page.url()).hash, '#learn');
    const basics = page.locator('section[aria-labelledby="level-1-title"] .lesson');
    assert.equal(await basics.count(), 12);
    assert.equal(await basics.locator('.badge-eks').count(), 4);
    assert.equal(await basics.getByText('Coming soon').count(), 12);

    await page.getByRole('button', { name: 'Open Deploy an app from Git' }).click();
    await page.getByRole('heading', { name: 'Build a config', level: 1 }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Use the tool' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('combobox', { name: 'Usage template' }).inputValue(), 'application');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learn Kubernetes' }).click();
    await page.getByRole('button', { name: 'Open Get an alert' }).click();
    assert.equal(await page.getByRole('combobox', { name: /^Tool/ }).inputValue(), 'prometheus');
    assert.equal(await page.getByRole('combobox', { name: 'Usage template' }).inputValue(), 'alert-rule');

    await page.goto(appUrl);
    await page.getByRole('heading', { name: 'Build a config', level: 1 }).waitFor();

    await page.locator('.brand').click();
    await page.getByRole('heading', { name: 'What would you like to do?' }).waitFor();
  } finally {
    await browser.close();
  }
});

test('starting options and lessons fit a phone screen without sideways scrolling', { timeout: 20000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    page.setDefaultTimeout(8000);
    for (const hash of ['#home', '#learn']) {
      await page.goto(`${appUrl}${hash}`);
      await page.locator('main h1').waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${hash} scrolls sideways by ${overflow}px`);
    }
  } finally {
    await browser.close();
  }
});
