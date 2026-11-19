import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lessonContent, lessonText, renderLesson } from '../frontend/src/lesson-builder.ts';

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
    assert.equal(await page.locator('section.level').count(), 11);
    const basics = page.locator('section[aria-labelledby="level-1-title"] .lesson');
    assert.equal(await basics.count(), 8);
    assert.equal(await basics.locator('.lesson-start').count(), 8);
    assert.equal(await basics.getByText('Coming soon').count(), 0);
    assert.equal(await page.locator('section.level:not([aria-labelledby="labs-title"]) .badge-eks').count(), 7);

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

test('a lesson builds the file one block at a time and exports exactly what is shown', { timeout: 40000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    page.setDefaultTimeout(8000);
    const yaml = page.getByTestId('lesson-yaml');
    const progress = page.locator('.lesson-progress');
    async function download() {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download' }).click();
      const file = await pending;
      return { name: file.suggestedFilename(), text: readFileSync(await file.path(), 'utf8') };
    }

    await page.goto(`${appUrl}#learn`);
    await page.getByRole('link', { name: 'Start Run one container' }).click();
    await page.getByRole('heading', { name: 'Run one container', level: 1 }).waitFor();
    assert.equal(new URL(page.url()).hash, '#learn/pod');
    assert.equal(await progress.textContent(), 'Block 1 of 4');
    assert.equal(await page.getByRole('button', { name: 'Back' }).isDisabled(), true);
    await yaml.locator('.view-line').filter({ hasText: 'kind: Pod' }).waitFor();
    await page.getByText('Not finished yet.').waitFor();

    // The new block and its comment are highlighted: four YAML lines plus one comment.
    await page.getByRole('button', { name: 'Next block' }).click();
    assert.equal(await progress.textContent(), 'Block 2 of 4');
    await yaml.locator('.view-line').filter({ hasText: 'app: web' }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-yaml"] .comparison-value-line').length === 5);
    assert.equal(await page.locator('.lesson-term dfn').textContent(), 'label');

    // Hovering a line explains it in plain English.
    await yaml.locator('.view-line span').filter({ hasText: /^name$/ }).first().hover();
    await page.locator('.monaco-hover').getByText(/unique among Pods in the same namespace/).waitFor();

    await page.getByRole('button', { name: 'Next block' }).click();
    await page.getByRole('heading', { name: 'Try it' }).waitFor();
    await page.getByRole('button', { name: 'Back' }).click();
    assert.equal(await progress.textContent(), 'Block 2 of 4');
    await page.getByRole('button', { name: 'Show whole file' }).click();
    assert.equal(await progress.textContent(), 'Block 4 of 4');
    assert.equal(await page.getByRole('button', { name: 'Next block' }).isDisabled(), true);
    const pod = lessonContent.pod;
    const whole = await download();
    assert.equal(whole.name, 'pod.yaml');
    assert.equal(whole.text, lessonText(renderLesson(pod, 3, {}, true)));
    await page.getByRole('button', { name: 'Copy' }).click();
    await page.getByText('Copied to clipboard.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), whole.text);
    await page.getByLabel('Show explanations').uncheck();
    assert.equal((await download()).text, lessonText(renderLesson(pod, 3, {}, false)));

    // The next lesson follows the catalogue. Each lesson keeps its own progress.
    await page.getByRole('link', { name: 'Next lesson: Keep copies running' }).click();
    await page.getByRole('heading', { name: 'Keep copies running', level: 1 }).waitFor();
    await page.goto(`${appUrl}#learn/deployment`);
    await page.getByRole('heading', { name: 'Keep your app running', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Next block' }).click();
    await page.getByRole('button', { name: 'Next block' }).click();
    await page.getByLabel(/Try changing/).selectOption('3');
    await yaml.locator('.view-line').filter({ hasText: 'replicas: 3' }).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    const deployment = await download();
    assert.equal(deployment.name, 'deployment.yaml');
    assert.equal(deployment.text, lessonText(renderLesson(lessonContent.deployment, 6, { replicas: '3' }, true)));

    await page.getByRole('link', { name: 'All lessons', exact: true }).click();
    await page.getByRole('link', { name: 'Start Run one container' }).click();
    assert.equal(await progress.textContent(), 'Block 4 of 4');
    assert.equal(await page.getByLabel('Show explanations').isChecked(), false);
  } finally {
    await browser.close();
  }
});

test('a lesson stacks on a phone with jump links and no sideways scrolling', { timeout: 20000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    page.setDefaultTimeout(8000);
    await page.goto(`${appUrl}#learn/deployment`);
    await page.getByRole('heading', { name: 'Keep your app running', level: 1 }).waitFor();
    await page.getByRole('link', { name: 'Jump to the YAML' }).click();
    // Font metrics differ between systems, so allow a pixel of rounding at the top edge.
    const visible = id => page.evaluate(target => {
      const top = document.getElementById(target).getBoundingClientRect().top;
      return top > -1 && top < window.innerHeight;
    }, id);
    await page.waitForFunction(() => document.activeElement?.id === 'lesson-file');
    assert.match(page.url(), /#lesson-file$/);
    assert.ok(await visible('lesson-file'), 'YAML heading is on screen after the jump');
    await page.getByRole('link', { name: 'Back to the lesson' }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'block-title');
    assert.ok(await visible('block-title'), 'lesson card is on screen after jumping back');
    await page.getByRole('heading', { name: 'Keep your app running', level: 1 }).waitFor({ state: 'attached' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `lesson scrolls sideways by ${overflow}px`);
    const card = await page.locator('.lesson-card').boundingBox();
    const output = await page.locator('.lesson-output').boundingBox();
    assert.ok(output.y >= card.y + card.height - 1, 'YAML sits below the lesson card');
  } finally {
    await browser.close();
  }
});

test('a file with two objects explains each one and exports both', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    const yaml = page.getByTestId('lesson-yaml');
    await page.goto(`${appUrl}#learn/configmap`);
    await page.getByRole('heading', { name: 'Settings outside the image', level: 1 }).waitFor();
    for (let step = 1; step < 4; step++) await page.getByRole('button', { name: 'Next block' }).click();
    await yaml.locator('.view-line').filter({ hasText: /^---$/ }).waitFor();
    await yaml.locator('.view-line span').filter({ hasText: /^kind$/ }).last().hover();
    await page.locator('.monaco-hover').getByText(/A Pod runs one or more containers/).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    const file = await pending;
    assert.equal(file.suggestedFilename(), 'configmap.yaml');
    const content = lessonContent.configmap;
    assert.equal(readFileSync(await file.path(), 'utf8'), lessonText(renderLesson(content, content.blocks.length - 1, {}, true)));
  } finally {
    await browser.close();
  }
});
