import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  brokenFile, defaultLessonValues, lessonContent, lessonText, matchLines, practiceFile, renderLesson, termIntroductions,
} from '../frontend/src/lesson-builder.ts';
import { levels } from '../frontend/src/lessons.ts';
import { readGuide } from '../frontend/src/guide-reader.ts';
import { labLessons, stepLines } from '../frontend/src/lab-lessons.ts';
import { setup } from '../frontend/src/setup-check.ts';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const appUrl = process.env.LKME_APP_URL ?? 'http://127.0.0.1:5173';

test('the dashboard opens into Learn Kubernetes with the Aviz Academy brand', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(appUrl);

    assert.equal(await page.title(), 'Learning Kubernetes made easy - Aviz Academy');
    await page.getByRole('heading', { name: 'Learn Kubernetes', level: 1 }).waitFor();
    assert.equal(await page.locator('.product-name').textContent(), 'Learning Kubernetes made easy');
    const logo = page.getByRole('img', { name: 'Aviz Academy' });
    await logo.waitFor();
    assert.ok(await logo.evaluate(image => image.complete && image.naturalWidth > 0), 'logo loads');
    assert.equal(await page.locator('link[rel="icon"][sizes="32x32"]').getAttribute('href'), '/brand/favicon-32.png');
    assert.equal(await page.getByRole('link', { name: 'Aviz Academy', exact: true }).getAttribute('href'), 'https://avizacademy.com');
    assert.equal(await page.getByRole('link', { name: 'Source code', exact: true }).getAttribute('href'),
      'https://github.com/avizway1/learning-kubernetes-made-easy');
    // The header has one link, to the lesson list.
    assert.deepEqual(await page.locator('.site-nav a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['#learn']);

    // Set up your laptop, Levels 0 to 8, and the labs. Set up your laptop is the first item, before Level 0.
    assert.equal(await page.locator('section.level').count(), 11);
    assert.equal(await page.locator('section.level').first().getAttribute('aria-labelledby'), 'start-here-title');
    assert.equal(await page.locator('.lesson h3').first().textContent(), 'Set up your laptop');
    assert.equal(await page.locator('section[aria-labelledby="start-here-title"] + section').getAttribute('aria-labelledby'), 'level-0-title');
    const basics = page.locator('section[aria-labelledby="level-1-title"] .lesson');
    assert.equal(await basics.count(), 8);
    assert.equal(await basics.locator('.lesson-start').count(), 8);
    assert.equal(await page.locator('section[aria-labelledby="level-0-title"] .lesson-start').count(), 2);
    assert.equal(await page.locator('section.level:not([aria-labelledby="labs-title"]) .badge-eks').count(), 7);
    // The labs list has only the two labs.
    assert.equal(await page.locator('section[aria-labelledby="labs-title"] .lesson').count(), 2);
    assert.equal(await page.locator('section[aria-labelledby="labs-title"] .setup-card').count(), 0);
    // Every lesson and lab is built. Each lab opens in the dashboard.
    assert.equal(await page.getByText('Coming soon').count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Set up your laptop', exact: true }).getAttribute('href'), '#learn/setup');
    for (const [title, id] of [['Lab 1 · Hello Kubernetes', 'lab-1'], ['Lab 2 · Your app on EKS', 'lab-2']]) {
      const link = page.getByRole('link', { name: `Open lab ${title}`, exact: true });
      assert.equal(await link.getAttribute('href'), `#learn/${id}`);
    }

    // The logo leads back to the lesson list.
    await page.goto(`${appUrl}#learn/pod`);
    await page.getByRole('heading', { name: 'Run one container', level: 1 }).waitFor();
    await page.locator('.brand').click();
    await page.getByRole('heading', { name: 'Learn Kubernetes', level: 1 }).waitFor();
    assert.equal(new URL(page.url()).hash, '#learn');
  } finally {
    await browser.close();
  }
});

test('the lesson list fits a phone screen without sideways scrolling', { timeout: 20000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    page.setDefaultTimeout(8000);
    for (const hash of ['', '#learn']) {
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
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
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
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-yaml"] .changed-line').length === 5);
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
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
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

// Every step of every lesson: the card shows that block, and the editor highlights exactly the lines it added,
// its comment included. The unit tests keep each block to one to six YAML lines.
test('every lesson step highlights the lines its block adds and shows that block on the card', { timeout: 300000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    const order = levels.flatMap(level => level.lessons).map(lesson => lesson.id);
    const first = termIntroductions(order);
    let steps = 0;
    for (const id of order) {
      const lesson = lessonContent[id];
      const values = defaultLessonValues(lesson);
      await page.goto(`${appUrl}#learn/${id}`);
      for (let step = 0; step < lesson.blocks.length; step++) {
        const label = `${id} block ${step + 1}`;
        if (step) await page.getByRole('button', { name: 'Next block' }).click();
        const block = lesson.blocks[step];
        await page.locator('#block-title').filter({ hasText: block.title }).waitFor();
        assert.equal(await page.locator('.lesson-progress').textContent(), `Block ${step + 1} of ${lesson.blocks.length}`, label);
        const before = step ? renderLesson(lesson, step - 1, values, true).map(line => line.text) : [];
        const added = matchLines(before, renderLesson(lesson, step, values, true).map(line => line.text)).filter(index => index < 0).length;
        // Long lines wrap, so count the YAML lines behind the highlighted screen lines using their line numbers.
        const highlighted = () => page.evaluate(() => {
          const editor = document.querySelector('[data-testid="lesson-yaml"]');
          const top = element => parseFloat(element.parentElement.style.top);
          const numbers = [...editor.querySelectorAll('.line-numbers')].filter(element => element.textContent.trim())
            .map(element => ({ top: top(element), line: element.textContent.trim() })).sort((a, b) => a.top - b.top);
          return new Set([...editor.querySelectorAll('.changed-line')]
            .map(element => numbers.filter(number => number.top <= top(element)).at(-1)?.line)).size;
        });
        const deadline = Date.now() + 8000;
        while ((await highlighted()) !== added && Date.now() < deadline) await page.waitForTimeout(100);
        assert.equal(await highlighted(), added, `${label}: highlighted YAML lines`);
        const term = page.locator('.lesson-term');
        if (block.term) {
          assert.equal(await term.locator('dfn').textContent(), block.term, label);
          const isNew = first[block.term].lesson === id && first[block.term].block === step;
          assert.equal(await term.locator('.lesson-term-label').textContent(), isNew ? 'New word' : 'Word to remember', label);
        } else assert.equal(await term.count(), 0, label);
        steps++;
      }
    }
    assert.ok(steps > 200, `checked ${steps} steps`);
  } finally {
    await browser.close();
  }
});

test('a lesson stacks on a phone with jump links and no sideways scrolling', { timeout: 20000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
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
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
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
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
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

test('Practise asks Read it questions and finds the Fix it mistake, keeping answers when learners go back', { timeout: 40000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    const yaml = page.getByTestId('lesson-yaml');
    const lesson = lessonContent.deployment;
    const { questions, fix } = lesson.practice;
    async function download() {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download' }).click();
      return readFileSync(await (await pending).path(), 'utf8');
    }
    const marked = selector => page.evaluate(css => document.querySelectorAll(`[data-testid="lesson-yaml"] ${css}`).length, selector);

    await page.goto(`${appUrl}#learn/deployment`);
    assert.equal(await page.getByRole('button', { name: 'Practise: Read it and Fix it' }).count(), 0, 'Practise waits for the last block');
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.getByRole('button', { name: 'Practise: Read it and Fix it' }).click();

    // Read it: the finished file without block comments, and feedback for right and wrong answers.
    await page.getByRole('heading', { name: 'Read it', level: 2 }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Read it · 0 of 3' }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByLabel('Show explanations').count(), 0);
    await yaml.locator('.view-line').filter({ hasText: 'replicas: 2' }).waitFor();
    assert.equal(await yaml.locator('.view-line').filter({ hasText: /^#/ }).count(), 0);
    assert.equal(await download(), practiceFile(lesson).text);
    const first = page.getByRole('group', { name: `1. ${questions[0].question}` });
    await first.getByLabel(questions[0].answers[1]).check();
    await first.getByText('Not quite.').waitFor();
    await first.getByLabel(questions[0].answers[questions[0].correct]).check();
    await first.getByText('Correct.').waitFor();
    await first.getByText(questions[0].explain, { exact: false }).waitFor();
    await page.getByRole('tab', { name: 'Read it · 1 of 3' }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-yaml"] .changed-line').length === 1);

    // Fix it: a wrong pick, then the right line clicked in the file, with the message Kubernetes printed on K3s.
    await page.getByRole('button', { name: 'Next: Fix it' }).click();
    await page.getByRole('heading', { name: 'Fix it', level: 2 }).waitFor();
    await yaml.locator('.view-line').filter({ hasText: fix.text.trim() }).waitFor();
    assert.equal(await download(), brokenFile(lesson, fix).text);
    const check = page.getByRole('button', { name: 'Check my answer' });
    assert.equal(await check.isDisabled(), true);
    await page.getByLabel('Wrong line').selectOption(String(fix.line - 1));
    await check.click();
    await page.getByText('Not that line.').waitFor();
    assert.equal(await marked('.lesson-mistake-line'), 0);
    await yaml.locator('.view-line').filter({ hasText: fix.text.trim() }).click();
    assert.equal(await page.getByLabel('Wrong line').inputValue(), String(fix.line));
    await check.click();
    await page.getByText(`Right, line ${fix.line}.`, { exact: false }).waitFor();
    await page.getByText(fix.message, { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Fix it · found' }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-yaml"] .lesson-mistake-line').length === 1);
    await page.getByRole('button', { name: 'Show the fixed file' }).click();
    assert.equal(await page.getByRole('button', { name: 'Show the broken copy' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await download(), practiceFile(lesson).text);
    await page.getByRole('link', { name: 'Next lesson: CPU and memory' }).waitFor();

    // Going back to the blocks keeps the answers.
    await page.getByRole('button', { name: 'Back to the blocks' }).click();
    await page.getByText('Block 7 of 7').waitFor();
    await page.getByLabel('Show explanations').waitFor();
    await page.getByRole('button', { name: 'Practise: Read it and Fix it' }).click();
    await page.getByRole('tab', { name: 'Read it · 1 of 3' }).waitFor();
    await page.getByRole('tab', { name: 'Fix it · found' }).click();
    await page.getByText(fix.message, { exact: true }).waitFor();

    // Show the answer, on a lesson whose mistake Kubernetes accepts.
    const pod = lessonContent.pod;
    await page.goto(`${appUrl}#learn/pod`);
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.getByRole('button', { name: 'Practise: Read it and Fix it' }).click();
    await page.getByRole('tab', { name: 'Fix it' }).click();
    await page.getByLabel('Wrong line').selectOption('1');
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await page.getByRole('button', { name: 'Show the answer' }).click();
    await page.getByText(`The mistake is on line ${pod.practice.fix.line}. The copy applies, but kubectl get pod web shows:`).waitFor();

    // On a phone the card stacks above the file without sideways scrolling, once the editor fits the new width.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('heading', { name: 'Fix it', level: 2 }).waitFor();
    await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth);
    const card = await page.locator('.lesson-card').boundingBox();
    const output = await page.locator('.lesson-output').boundingBox();
    assert.ok(output.y >= card.y + card.height - 1, 'YAML sits below the Practise card');
  } finally {
    await browser.close();
  }
});

test('Level 2 lessons start from the catalogue and name the earlier files they use', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(`${appUrl}#learn`);
    for (const title of ['Give your app an address', 'Find a Service by name', 'A port on every node', 'Point to an outside name']) {
      await page.getByRole('link', { name: `Start ${title}` }).waitFor();
    }
    await page.getByRole('link', { name: 'Start Find a Service by name' }).click();
    await page.getByRole('heading', { name: 'Find a Service by name', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    const uses = page.locator('.lesson-uses');
    await uses.getByText('deployment.yaml', { exact: true }).waitFor();
    await uses.getByText('service.yaml', { exact: true }).waitFor();
    await uses.getByRole('link', { name: 'Give your app an address' }).click();
    await page.getByRole('heading', { name: 'Give your app an address', level: 1 }).waitFor();

    // The ExternalName lesson needs no earlier files, and its broken copy shows the real Kubernetes message.
    const lesson = lessonContent['external-name'];
    await page.goto(`${appUrl}#learn/external-name`);
    await page.getByRole('button', { name: 'Show whole file' }).click();
    assert.equal(await page.locator('.lesson-uses').count(), 0);
    await page.getByRole('button', { name: 'Practise: Read it and Fix it' }).click();
    await page.getByRole('tab', { name: 'Fix it' }).click();
    await page.getByLabel('Wrong line').selectOption(String(lesson.practice.fix.line));
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await page.getByText(lesson.practice.fix.message, { exact: true }).waitFor();
  } finally {
    await browser.close();
  }
});

test('Level 3 and 4 lessons start from the catalogue, and Fix it says which command shows the mistake', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(`${appUrl}#learn`);
    for (const title of ['Reach every Pod directly', 'One Pod on every node', 'Default sizes for a namespace', 'A budget for a namespace',
      'Is the app healthy?', 'Start and stop timing', 'Survive node maintenance']) {
      await page.getByRole('link', { name: `Start ${title}` }).waitFor();
    }
    // The LimitRange lesson tries the CPU and memory lesson's Pod in its own namespace, after its own file.
    await page.getByRole('link', { name: 'Start Default sizes for a namespace' }).click();
    await page.getByRole('heading', { name: 'Default sizes for a namespace', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.locator('.lesson-uses').getByText('resources.yaml', { exact: true }).waitFor();
    await page.getByText('kubectl apply -n limits-demo -f resources.yaml', { exact: true }).waitFor();

    // A mistake Kubernetes accepts names the command that reveals it.
    const lesson = lessonContent.probes;
    await page.goto(`${appUrl}#learn/probes`);
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.getByRole('button', { name: 'Practise: Read it and Fix it' }).click();
    await page.getByRole('tab', { name: 'Fix it' }).click();
    await page.getByLabel('Wrong line').selectOption(String(lesson.practice.fix.line));
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await page.getByText(`Right, line ${lesson.practice.fix.line}. The copy applies, but ${lesson.practice.fix.command} shows:`).waitFor();
    await page.getByText(lesson.practice.fix.message, { exact: true }).waitFor();
  } finally {
    await browser.close();
  }
});

test('Level 5, 6, and 7 lessons start from the catalogue, and scheduling lessons say how to add nodes', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(`${appUrl}#learn`);
    for (const title of ['Pick nodes by label', 'Spread copies apart', 'Keep Pods off some nodes', 'Rolling update', 'Stop, then start',
      'Blue-green', 'Canary', 'Scale with load']) {
      await page.getByRole('link', { name: `Start ${title}`, exact: true }).waitFor();
    }
    // A three-node lesson gives the command that adds two workers to the practice cluster from the start guide.
    const addNodes = 'k3d node create worker --cluster practice --role agent --replicas 2 --image rancher/k3s:v1.37.2-k3s1 --wait';
    await page.getByRole('link', { name: 'Start Pick nodes by label', exact: true }).click();
    await page.getByRole('heading', { name: 'Pick nodes by label', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.locator('.lesson-nodes').getByText(addNodes, { exact: true }).waitFor();
    await page.getByText('kubectl label node <node> disktype=ssd', { exact: true }).waitFor();

    // Blue-green builds its second Deployment over several blocks, so Try it waits for the last one.
    await page.goto(`${appUrl}#learn/blue-green`);
    await page.getByRole('heading', { name: 'Blue-green', level: 1 }).waitFor();
    await page.getByText(/Not finished yet\. Block 11/).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.getByText('kubectl patch service shop', { exact: false }).first().waitFor();
    assert.equal(await page.locator('.lesson-nodes').count(), 0, 'one-node lessons say nothing about adding nodes');
  } finally {
    await browser.close();
  }
});

test('EKS only lessons start from the catalogue, ask for an EKS Auto Mode cluster, and name what to set up first', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.goto(`${appUrl}#learn`);
    for (const title of ['Open your app to the internet', 'Route web traffic', 'Keep data after restarts', 'Databases with their own disks',
      'Share files between Pods', 'Choose your machines', 'Let a Pod call AWS safely']) {
      await page.getByRole('link', { name: `Start ${title}`, exact: true }).waitFor();
    }
    // An EKS lesson's Try it runs against EKS Auto Mode, warns about charges, and says nothing about the K3s practice cluster.
    await page.getByRole('link', { name: 'Start Open your app to the internet', exact: true }).click();
    await page.getByRole('heading', { name: 'Open your app to the internet', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.locator('.lesson-eks').getByText(/run these commands against your EKS Auto Mode cluster\. AWS charges/).waitFor();
    assert.equal(await page.getByText('run these commands against your practice cluster', { exact: false }).count(), 0);
    await page.locator('.lesson-uses').getByText('deployment.yaml', { exact: true }).waitFor();
    assert.equal(await page.locator('.lesson-needs').count(), 0, 'only lessons with an AWS prerequisite list one');

    // The EFS lesson names the add-on and file system it needs, with the official guide.
    const efs = lessonContent.efs;
    await page.goto(`${appUrl}#learn/efs`);
    await page.getByRole('heading', { name: 'Share files between Pods', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.locator('.lesson-needs').getByText(efs.needs.text, { exact: false }).waitFor();
    assert.equal(await page.locator('.lesson-needs a').getAttribute('href'), efs.needs.url);

    // A Fix it that only EKS Auto Mode's own API rejects shows the message for its kind.
    const pool = lessonContent['node-pool'];
    await page.goto(`${appUrl}#learn/node-pool`);
    await page.getByRole('button', { name: 'Show whole file' }).click();
    await page.getByRole('button', { name: 'Practise: Read it and Fix it' }).click();
    await page.getByRole('tab', { name: 'Fix it' }).click();
    await page.getByLabel('Wrong line').selectOption(String(pool.practice.fix.line));
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await page.getByText(pool.practice.fix.message, { exact: true }).waitFor();
  } finally {
    await browser.close();
  }
});

// Set up your laptop: specs/setup-check.md. Reports follow the check command's output format.
const passingReport = `lkme-check 1
system Darwin arm64
docker 29.8.2 memory 9328558080
kubectl v1.37.2
k3d v5.9.0
aws aws-cli/2.36.37
aws-signed-in yes
eksctl 0.231.0`;

test('Set up your laptop unlocks each lab separately, and the unlock survives a reload', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    page.setDefaultTimeout(8000);
    const chips = () => page.locator('.setup-chip').allTextContents();
    // A lesson's Try it links to the setup page until the tools for its cluster pass.
    const setupLinks = async id => {
      await page.goto(`${appUrl}#learn/${id}`);
      const whole = page.getByRole('button', { name: 'Show whole file' });
      if (await whole.isEnabled()) await whole.click();
      await page.locator('.lesson-try-it').waitFor();
      return page.locator('.lesson-setup a[href="#learn/setup"]').count();
    };

    // Before any check, both labs say their hands-on part is locked, but their files are open.
    await page.goto(`${appUrl}#learn`);
    assert.deepEqual(await chips(), ['Lab 1 tools not ready', 'Lab 2 tools not ready']);
    assert.equal(await page.locator('.lab-lock-note').count(), 2);
    assert.equal(await setupLinks('pod'), 1);
    // Anywhere lessons say to check that kubectl uses the practice cluster. EKS only lessons use an EKS cluster.
    assert.match(await page.locator('.lesson-context').textContent(),
      /Run this first, so they go there\. No practice cluster yet\? Step 6 of Set up your laptop creates it\./);
    assert.equal(await page.locator('.lesson-context a').getAttribute('href'), '#learn/setup');
    assert.equal(await page.locator('.lesson-context + .command-block code').textContent(), 'kubectl config use-context k3d-practice');
    assert.equal(await setupLinks('pod-identity'), 1);
    assert.equal(await page.locator('.lesson-context').count(), 0);
    await page.goto(`${appUrl}#learn/lab-1`);
    await page.getByRole('tab', { name: /2 · Do it on your laptop/ }).click();
    await page.getByRole('heading', { name: 'Set up your laptop first' }).waitFor();
    assert.deepEqual(await page.locator('.lab-lock .setup-results li').allTextContents(), ['Docker', 'kubectl', 'k3d']);
    await page.getByRole('button', { name: 'Read the files while you wait' }).click();
    await page.locator('#block-title').filter({ hasText: labLessons['lab-1'].steps[0].title }).waitFor();

    // The setup page gives each system its own commands, and Copy copies them exactly.
    await page.goto(`${appUrl}#learn/setup`);
    await page.getByRole('heading', { name: 'Set up your laptop', level: 1 }).waitFor();
    // The page opens with what the laptop needs and ends with pointing kubectl at the practice cluster.
    assert.deepEqual(await page.locator('.setup-step > h2').allTextContents(), ['1What your laptop needs', '2Choose your system',
      '3Install the tools', '4Run the check', '5Paste what it printed', '6Create your practice cluster and point kubectl at it',
      '7Look inside your practice cluster']);
    assert.equal(await page.locator('.setup-needs > li').count(), setup.requirements.items.length);
    assert.match(await page.locator('.setup-needs').textContent(), /Memory: 8 GB of RAM or more\./);
    // Step 6 is one path: create once, then switch every time. Then each message learners may see, with its fix.
    assert.deepEqual(await page.locator('#setup-kubectl ~ .setup-cluster-step h3').allTextContents(),
      [...setup.practiceCluster.steps.map(step => step.title), 'If something goes wrong']);
    assert.equal(await page.locator('#setup-kubectl ~ .setup-cluster-step .setup-expect').count(), setup.practiceCluster.steps.length);
    // Step 7 warns before its first card, then opens a shell on the node and only reads.
    assert.equal(await page.getByRole('note').filter({ hasText: "Look, don't change." }).textContent(), setup.insideNode.warning);
    assert.deepEqual(await page.locator('#setup-inside ~ .setup-cluster-step h3').allTextContents(),
      [...setup.insideNode.steps.map(step => step.title), 'If you changed something']);
    const enter = setup.insideNode.steps[0];
    await page.getByRole('button', { name: `Copy the commands: ${enter.title}` }).click();
    await page.waitForFunction(commands => navigator.clipboard.readText().then(text => text === commands), enter.commands);
    const everyTime = setup.practiceCluster.steps[1];
    await page.getByRole('button', { name: `Copy the commands: ${everyTime.title}` }).click();
    await page.waitForFunction(commands => navigator.clipboard.readText().then(text => text === commands), everyTime.commands);
    assert.deepEqual(await page.locator('.setup-message').allTextContents(), setup.practiceCluster.problems.map(problem => problem.message));
    const stopped = setup.practiceCluster.problems[1];
    await page.getByRole('button', { name: `Copy the fix for: ${stopped.message}` }).click();
    await page.waitForFunction(commands => navigator.clipboard.readText().then(text => text === commands), stopped.commands);
    for (const system of setup.systems) {
      await page.getByRole('tab', { name: system.label }).click();
      assert.equal(await page.getByRole('heading', { name: 'First, set up WSL 2' }).count(), system.id === 'windows' ? 1 : 0, system.id);
      assert.equal((await page.locator('#setup-kubectl + p').textContent()).endsWith('Run these commands in Ubuntu.'), system.id === 'windows', system.id);
      assert.equal((await page.locator('#setup-inside + p').textContent()).endsWith('Run these commands in Ubuntu.'), system.id === 'windows', system.id);
      const kubectl = setup.tools.find(tool => tool.id === 'kubectl').install[system.id].commands;
      await page.getByRole('button', { name: 'Copy the kubectl install commands' }).click();
      await page.locator('#tool-kubectl').locator('..').getByText('Copied').waitFor();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), kubectl, system.id);
    }
    await page.getByRole('button', { name: 'Copy the check command' }).click();
    await page.waitForFunction(check => navigator.clipboard.readText().then(text => text === check), setup.check);

    // Text that isn't the check's output unlocks nothing.
    const pasted = page.getByLabel(/Everything the check printed/);
    await pasted.fill('kubectl v1.37.2');
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await page.locator('.setup-invalid').waitFor();

    // k3d is missing: Lab 1 stays locked and Lab 2 unlocks.
    await pasted.fill(passingReport.replace('k3d v5.9.0', 'k3d missing'));
    await page.getByRole('button', { name: 'Check again' }).click();
    await page.locator('.setup-results li').nth(5).waitFor();
    assert.equal(await page.locator('.setup-results .setup-ready').count(), 5);
    assert.deepEqual(await page.locator('.setup-results .setup-fix').allTextContents(),
      ['✗ Fix this: k3d is missingInstall it with the card above, then run the check again.']);
    assert.match(await page.locator('.setup-summary').textContent(), /Lab 1 needs one fix: k3d\. Lab 2 is unlocked\. Open Lab 2\./);
    await page.goto(`${appUrl}#learn/lab-1`);
    await page.getByRole('tab', { name: /2 · Do it on your laptop/ }).click();
    assert.deepEqual(await page.locator('.lab-lock .setup-results li').allTextContents(), ['k3d is missing']);
    await page.goto(`${appUrl}#learn/lab-2`);
    await page.getByRole('tab', { name: /2 · Do it on your laptop/ }).click();
    await page.locator('.lab-step').first().waitFor();
    assert.equal(await setupLinks('pod'), 1, 'Anywhere lessons need the Lab 1 tools');
    assert.equal(await setupLinks('pod-identity'), 0, 'EKS only lessons need the Lab 2 tools');

    // A passing report unlocks both labs, and the unlock is still there after a reload.
    await page.goto(`${appUrl}#learn/setup`);
    await pasted.fill(passingReport);
    await page.getByRole('button', { name: 'Check again' }).click();
    await page.locator('.setup-summary').filter({ hasText: 'Lab 1 is unlocked' }).waitFor();
    await page.goto(`${appUrl}#learn`);
    await page.reload();
    await page.getByRole('heading', { name: 'Learn Kubernetes', level: 1 }).waitFor();
    assert.deepEqual(await chips(), ['✓ Lab 1 tools ready', '✓ Lab 2 tools ready']);
    assert.equal(await page.locator('.lab-lock-note').count(), 0);
    await page.goto(`${appUrl}#learn/lab-1`);
    await page.getByRole('tab', { name: /2 · Do it on your laptop/ }).click();
    assert.match(await page.locator('.lab-step-body .setup-chip').textContent(), /Your laptop is ready for this lab · checked/);
    assert.equal(await setupLinks('pod'), 0);
  } finally {
    await browser.close();
  }
});

test('each lab step highlights exactly its object, links its lesson, and Read it works', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    // Monaco draws only the lines on screen, so make the editor tall enough to draw a whole lab file.
    const tall = '[data-testid="lesson-yaml"] { height: 4200px !important; }';
    const highlighted = () => page.evaluate(() => {
      const editor = document.querySelector('[data-testid="lesson-yaml"]');
      const top = element => parseFloat(element.parentElement.style.top);
      const numbers = [...editor.querySelectorAll('.line-numbers')].filter(element => element.textContent.trim())
        .map(element => ({ top: top(element), line: Number(element.textContent.trim()) })).sort((a, b) => a.top - b.top);
      return [...new Set([...editor.querySelectorAll('.changed-line')]
        .map(element => numbers.filter(number => number.top <= top(element)).at(-1)?.line))].sort((a, b) => a - b);
    });
    for (const lab of Object.values(labLessons)) {
      await page.goto(`${appUrl}#learn/${lab.id}`);
      await page.addStyleTag({ content: tall });
      for (const [index, step] of lab.steps.entries()) {
        const label = `${lab.id} step ${index + 1}`;
        if (index) await page.getByRole('button', { name: 'Next step' }).click();
        await page.locator('#block-title').filter({ hasText: step.title }).waitFor();
        assert.equal(await page.locator('.lesson-progress').textContent(), `Step ${index + 1} of ${lab.steps.length} · ${step.file}`, label);
        assert.equal(await page.locator('#lesson-file').textContent(), step.file, label);
        const text = readFileSync(new URL(`../templates/kubernetes/labs/${step.file}`, import.meta.url), 'utf8');
        const expected = stepLines(step, text);
        const deadline = Date.now() + 8000;
        while (JSON.stringify(await highlighted()) !== JSON.stringify(expected) && Date.now() < deadline) await page.waitForTimeout(100);
        assert.deepEqual(await highlighted(), expected, `${label}: highlighted lines`);
        const learned = page.locator('.lab-learned a').first();
        if (step.lessons.length) assert.equal(await learned.getAttribute('href'), `#learn/${step.lessons[0]}`, label);
        else assert.equal(await learned.getAttribute('href'), lab.sources[0].url, label);
        if (step.term) {
          assert.equal(await page.locator('.lesson-term dfn').textContent(), step.term, label);
          assert.equal(await page.locator('.lesson-term-label').textContent(), 'Word to remember', label);
        }
      }
      await page.getByRole('button', { name: 'Practise: Read it' }).click();
      for (const [index, question] of lab.questions.entries()) {
        const fieldset = page.locator('.practice-question').nth(index);
        await fieldset.getByLabel(question.answers[question.correct], { exact: true }).check();
        await fieldset.locator('.practice-correct').waitFor();
        await page.locator('#lesson-file').filter({ hasText: question.file }).waitFor();
        const deadline = Date.now() + 8000;
        while (JSON.stringify(await highlighted()) !== JSON.stringify([question.line]) && Date.now() < deadline) await page.waitForTimeout(100);
        assert.deepEqual(await highlighted(), [question.line], `${lab.id} question ${index + 1}`);
      }
      assert.equal(await page.locator('.lesson-progress').textContent(), `Read it · ${lab.questions.length} of ${lab.questions.length} right`);
    }
  } finally {
    await browser.close();
  }
});

test('Do it on your laptop shows each guide step with Copy on every command, and ticks survive a reload', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addInitScript(report => {
      if (!window.localStorage.getItem('learning-kubernetes:setup-check')) {
        window.localStorage.setItem('learning-kubernetes:setup-check', JSON.stringify({ report, checkedAt: '2026-11-26T09:00:00.000Z' }));
      }
    }, passingReport);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    for (const lab of Object.values(labLessons)) {
      const guide = readGuide(readFileSync(new URL(`../docs/${lab.guide}`, import.meta.url), 'utf8'));
      await page.goto(`${appUrl}#learn/${lab.id}`);
      await page.getByRole('tab', { name: '2 · Do it on your laptop' }).click();
      assert.deepEqual(await page.locator('.lab-step-head label').allTextContents(), guide.sections.map(section => section.title), lab.id);
      assert.equal(await page.locator('#lab-progress').textContent(), `0 of ${guide.sections.length} steps done`);
      // Open each step in turn. Every command has Copy, and every file is folded under Show the file.
      for (const [index, section] of guide.sections.entries()) {
        if (index) await page.getByRole('button', { name: `Show ${section.title}`, exact: true }).click();
        const body = page.locator('.lab-step-body');
        await body.waitFor();
        const commands = section.blocks.filter(block => block.type === 'code' && block.lang === 'bash');
        const files = section.blocks.filter(block => block.type === 'code' && block.lang === 'yaml');
        assert.equal(await body.locator('.command-block').count(), commands.length, `${lab.id} ${section.title} commands`);
        assert.equal(await body.locator('details.lab-file').count(), files.length, `${lab.id} ${section.title} files`);
        assert.equal(await body.locator('details.lab-file[open]').count(), 0, `${lab.id} ${section.title} files start folded`);
        assert.equal(await body.getByText('<!--').count(), 0);
      }
      // Copy copies the first command of the first step that has one, exactly.
      const first = guide.sections.findIndex(section => section.blocks.some(block => block.type === 'code' && block.lang === 'bash'));
      await page.getByRole('button', { name: `Show ${guide.sections[first].title}`, exact: true }).click();
      const command = guide.sections[first].blocks.find(block => block.type === 'code' && block.lang === 'bash').text;
      await page.locator('.lab-step-body .command-block button').first().click();
      await page.waitForFunction(text => navigator.clipboard.readText().then(copied => copied === text), command);
    }

    // Ticks are kept per lab and survive a reload. Start again clears them.
    await page.goto(`${appUrl}#learn/lab-1`);
    await page.getByRole('tab', { name: '2 · Do it on your laptop' }).click();
    await page.locator('.lab-step-head input').nth(0).check();
    await page.locator('.lab-step-head input').nth(2).check();
    await page.reload();
    await page.getByRole('tab', { name: '2 · Do it on your laptop' }).click();
    assert.equal(await page.locator('#lab-progress').textContent(), `2 of ${await page.locator('.lab-step').count()} steps done`);
    assert.deepEqual(await page.locator('.lab-step-head input').evaluateAll(inputs => inputs.map(input => input.checked)).then(list => list.slice(0, 3)), [true, false, true]);
    await page.goto(`${appUrl}#learn/lab-2`);
    await page.getByRole('tab', { name: '2 · Do it on your laptop' }).click();
    assert.match(await page.locator('#lab-progress').textContent(), /^0 of/);
    await page.goto(`${appUrl}#learn/lab-1`);
    await page.getByRole('tab', { name: '2 · Do it on your laptop' }).click();
    await page.getByRole('button', { name: 'Start again' }).click();
    assert.match(await page.locator('#lab-progress').textContent(), /^0 of/);
  } finally {
    await browser.close();
  }
});

test('the setup and lab pages fit a phone screen without sideways scrolling', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await context.addInitScript(report => {
      window.localStorage.setItem('learning-kubernetes:setup-check', JSON.stringify({ report, checkedAt: '2026-11-26T09:00:00.000Z' }));
    }, passingReport);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    for (const system of setup.systems) {
      await page.goto(`${appUrl}#learn/setup`);
      await page.getByRole('tab', { name: system.label }).click();
      assert.ok((await overflow()) <= 0, `setup on ${system.id} scrolls sideways by ${await overflow()}px`);
    }
    for (const lab of Object.keys(labLessons)) {
      await page.goto(`${appUrl}#learn/${lab}`);
      await page.locator('#block-title').waitFor();
      assert.ok((await overflow()) <= 0, `${lab} files scroll sideways by ${await overflow()}px`);
      await page.getByRole('tab', { name: '2 · Do it on your laptop' }).click();
      for (const toggle of await page.locator('.lab-step-toggle').all()) {
        await toggle.click();
        const files = page.locator('.lab-step-body details.lab-file summary');
        for (const summary of await files.all()) await summary.click();
        assert.ok((await overflow()) <= 0, `${lab} steps scroll sideways by ${await overflow()}px`);
      }
    }
  } finally {
    await browser.close();
  }
});

// Every command a learner runs can be copied exactly. specs/setup-check.md, Charan's changes on 2026-11-27.
const addWorkers = 'k3d node create worker --cluster practice --role agent --replicas 2 --image rancher/k3s:v1.37.2-k3s1 --wait';

test('every Try it command has a Copy button that copies exactly that command', { timeout: 240000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    page.setDefaultTimeout(8000);
    let copied = 0;
    for (const lesson of levels.flatMap(level => level.lessons)) {
      const content = lessonContent[lesson.id];
      if (!content.tryIt.length) continue;
      await page.goto(`${appUrl}#learn/${lesson.id}`);
      const whole = page.getByRole('button', { name: 'Show whole file' });
      if (await whole.isEnabled()) await whole.click();
      const tryIt = page.locator('.lesson-try-it');
      await tryIt.waitFor();
      // Anywhere lessons start with the command that points kubectl at the practice cluster, and three-node lessons with
      // the command that adds workers.
      const commands = [
        ...(lesson.runsOn === 'eks' ? [] : ['kubectl config use-context k3d-practice']),
        ...(content.nodes ? [addWorkers] : []),
        ...content.tryIt.map(item => item.command),
      ];
      assert.deepEqual(await tryIt.locator('.command-block code').allTextContents(), commands, lesson.id);
      // Each Copy button sits inside its command's box.
      assert.ok(await tryIt.locator('.command-block').evaluateAll(blocks => blocks.every(block => {
        const box = block.querySelector('pre').getBoundingClientRect();
        const button = block.querySelector('button').getBoundingClientRect();
        return button.top >= box.top && button.bottom <= box.bottom && button.right <= box.right;
      })), `${lesson.id}: a Copy button sticks out of its box`);
      const buttons = tryIt.locator('.command-block button');
      for (const [index, command] of commands.entries()) {
        await page.evaluate(() => navigator.clipboard.writeText(''));
        await buttons.nth(index).click();
        await page.waitForFunction(text => navigator.clipboard.readText().then(copy => copy === text), command);
        copied++;
      }
    }
    assert.equal(copied, 244, `${copied} commands copied`);
  } finally {
    await browser.close();
  }
});

test('every start guide command copies exactly what it shows, on each system', { timeout: 60000 }, async () => {
  const guide = readFileSync(new URL('../docs/getting-started.html', import.meta.url), 'utf8');
  const browser = await chromium.launch({ executablePath: process.env.LKME_CHROME_PATH, args: ['--disable-gpu'] });
  try {
    // The browser answers a localhost address with the guide itself, since the clipboard needs a secure origin and no
    // server runs there. Fonts and other requests are not needed.
    const guideUrl = 'http://localhost:5199/getting-started.html';
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.route('**/*', route => route.request().url() === guideUrl
      ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: guide })
      : route.abort());
    await page.goto(guideUrl);
    let copied = 0;
    for (const os of ['mac', 'win', 'linux']) {
      await page.locator(`#os-${os}`).click();
      // Open the common errors so their commands are checked too.
      await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = true; }));
      const blocks = page.locator('.code:visible');
      for (let index = 0; index < await blocks.count(); index++) {
        const block = blocks.nth(index);
        const shown = await block.locator('code').textContent();
        // Plain text a terminal accepts: no prompt, no tab, and no curly quote or long dash.
        assert.match(shown, /^[\x20-\x7e\n]+$/, shown);
        assert.ok(!/^\$ /m.test(shown), shown);
        assert.equal(await block.locator('pre').evaluate(pre => getComputedStyle(pre).fontVariantLigatures), 'none');
        await page.evaluate(() => navigator.clipboard.writeText(''));
        await block.getByRole('button', { name: 'Copy command' }).click();
        await page.waitForFunction(text => navigator.clipboard.readText().then(copy => copy === text), shown);
        copied++;
      }
    }
    assert.equal(copied, 22 + 26 + 22, `${copied} commands copied`);
    // The practice cluster steps are the setup page's commands.
    for (const step of setup.practiceCluster.steps) {
      await page.locator('.code code').filter({ hasText: step.commands.split('\n')[0] }).first().waitFor({ state: 'attached' });
    }
  } finally {
    await browser.close();
  }
});
