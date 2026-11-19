import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lessonContent, lessonText, renderLesson } from '../frontend/src/lesson-builder.ts';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const appUrl = process.env.KCB_APP_URL ?? 'http://127.0.0.1:5173';

test('the dashboard opens into Learn Kubernetes and nothing links to Build a config in phase 1', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(appUrl);

    assert.equal(await page.title(), 'Kubernetes Made Simple');
    await page.getByRole('heading', { name: 'Learn Kubernetes', level: 1 }).waitFor();
    const logo = page.getByRole('img', { name: 'Aviz Academy' });
    await logo.waitFor();
    assert.ok(await logo.evaluate(image => image.complete && image.naturalWidth > 0), 'logo loads');
    assert.equal(await page.locator('link[rel="icon"][sizes="32x32"]').getAttribute('href'), '/brand/favicon-32.png');
    assert.equal(await page.getByRole('link', { name: 'Aviz Academy', exact: true }).getAttribute('href'), 'https://avizacademy.com');

    // Build a config is hidden until phase 2: no doors, no header link, and no lesson opens it.
    assert.equal(await page.locator('.door').count(), 0);
    assert.equal(await page.locator('a[href="#build"]').count(), 0);
    assert.equal(await page.getByText('Build a config').count(), 0);
    assert.equal(await page.locator('.lesson-meta button').count(), 0);
    assert.equal(await page.locator('.badge-k3s').count(), 0);

    assert.equal(await page.locator('section.level').count(), 11);
    const basics = page.locator('section[aria-labelledby="level-1-title"] .lesson');
    assert.equal(await basics.count(), 8);
    assert.equal(await basics.locator('.lesson-start').count(), 8);
    assert.equal(await basics.getByText('Coming soon').count(), 0);
    assert.equal(await page.locator('section[aria-labelledby="level-0-title"] .lesson-start').count(), 2);
    assert.equal(await page.locator('section.level:not([aria-labelledby="labs-title"]) .badge-eks').count(), 7);
    assert.equal(await page.locator('section[aria-labelledby="labs-title"] .lesson').count(), 2);

    // Old #home links and the logo both land on Learn Kubernetes.
    await page.goto(`${appUrl}#home`);
    await page.getByRole('heading', { name: 'Learn Kubernetes', level: 1 }).waitFor();
    await page.goto(`${appUrl}#learn/pod`);
    await page.getByRole('heading', { name: 'Run one container', level: 1 }).waitFor();
    await page.locator('.brand').click();
    await page.getByRole('heading', { name: 'Learn Kubernetes', level: 1 }).waitFor();
    assert.equal(new URL(page.url()).hash, '#learn');

    // The Build a config screen still works when typed directly, so its existing tests keep running.
    await page.goto(`${appUrl}#build`);
    await page.getByRole('heading', { name: 'Build a config', level: 1 }).waitFor();
  } finally {
    await browser.close();
  }
});

test('the lesson list fits a phone screen without sideways scrolling', { timeout: 20000 }, async () => {
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

test('Level 0 shows the indentation mistake with the real error, then returns to the fixed file', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.KCB_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    const yaml = page.getByTestId('lesson-yaml');
    const lesson = lessonContent['reading-yaml'];
    const mistake = lesson.blocks[1].mistake;
    async function download() {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download' }).click();
      return readFileSync(await (await pending).path(), 'utf8');
    }

    await page.goto(`${appUrl}#learn`);
    await page.getByRole('link', { name: 'Start Read a YAML file' }).click();
    await page.getByRole('heading', { name: 'Read a YAML file', level: 1 }).waitFor();
    await yaml.locator('.view-line').filter({ hasText: 'name: Asha' }).waitFor();
    assert.equal(await page.getByText('Not finished yet.').count(), 0);
    await page.getByText('Nothing to run for this lesson.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'See the mistake' }).count(), 0);

    await page.getByRole('button', { name: 'Next block' }).click();
    const toggle = page.getByRole('button', { name: 'See the mistake' });
    await toggle.click();
    await page.getByText(mistake.error, { exact: true }).waitFor();
    await page.getByText(`Line ${mistake.line} is wrong.`, { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Show the fixed file' }).getAttribute('aria-pressed'), 'true');
    // Only the broken line is marked, and the broken copy has no comments, so its line number matches the error.
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-yaml"] .lesson-mistake-line').length === 1);
    assert.equal(await yaml.locator('.view-line').filter({ hasText: /^#/ }).count(), 0);
    assert.equal(await download(), mistake.yaml);
    await yaml.locator('.view-line span').filter({ hasText: /^country$/ }).first().hover();
    await page.locator('.monaco-hover').getByText(/one more than city/).waitFor();

    await page.getByRole('button', { name: 'Show the fixed file' }).click();
    await yaml.locator('.view-line').filter({ hasText: 'address holds two keys' }).waitFor();
    assert.equal(await download(), lessonText(renderLesson(lesson, 1, {}, true)));

    // Moving to another block always returns to the fixed file.
    await toggle.click();
    await page.getByRole('button', { name: 'Next block' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'See the mistake' }).waitFor();
    assert.equal(await page.getByText(mistake.error, { exact: true }).count(), 0);

    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.getByRole('link', { name: 'Next lesson: Parts of every manifest' }).click();
    await page.getByRole('heading', { name: 'Parts of every manifest', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.getByRole('heading', { name: 'Try it' }).waitFor();
    await page.getByText('kubectl explain pod.spec.containers', { exact: true }).waitFor();
    assert.equal(await page.locator('.lesson-term dfn').textContent(), 'status');
  } finally {
    await browser.close();
  }
});
