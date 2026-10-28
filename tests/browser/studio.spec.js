import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const source = '\uFEFF1,하나\n하나,1\n"Hello, friend","He said ""hi"" 👋"\n"Line 1\nLine 2",คำตอบ\n\n1,하나\n<img src=x onerror=alert(1)>,<script>alert(1)</script>';
const pairs = [['1', '하나'], ['하나', '1'], ['Hello, friend', 'He said "hi" 👋'], ['Line 1\nLine 2', 'คำตอบ'], ['1', '하나'], ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>']];

async function getDownload(page, info, title, cards) {
  const button = page.locator('#download-button');
  await expect(button).toBeEnabled();
  await expect(page.locator('#download-label')).toHaveText('Create study set');
  await button.click();
  await expect(page.locator('#download-label')).toHaveText('Download study set', { timeout: 40000 });
  const downloadEvent = page.waitForEvent('download');
  await button.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(`${title.replaceAll(' ', '_')}.goodnotes`);
  expect(await download.failure()).toBeNull();
  const archive = info.outputPath('download.goodnotes');
  await download.saveAs(archive);
  expect((await stat(archive)).size).toBeGreaterThan(100);
  const expected = info.outputPath('expected.json');
  await writeFile(expected, JSON.stringify({ title, cards }));
  const result = spawnSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [resolve('tests/inspect_archive.py'), archive, expected], { encoding: 'utf8' });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  await info.attach('independent-inspection', { body: result.stdout, contentType: 'text/plain' });
  await expect(page.locator('#export-status')).toContainText('cannot confirm that it was saved');
}

test('paste, Unicode CSV, reverse ordering, preview and real download @smoke', async ({ page, context }, info) => {
  const requests = [];
  const errors = [];
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('#reverse-cards')).not.toBeChecked();
  await expect(page.locator('#download-button')).toBeDisabled();
  await page.locator('#source-text').fill(source);
  await page.locator('#deck-title').fill('한국어 ภาษาไทย 🐱');
  await expect(page.locator('#input-count')).toHaveText('6');
  await expect(page.locator('#card-count')).toHaveText('6');
  await expect(page.locator('#preview-text')).toHaveText('1');
  await page.locator('#preview-card').click();
  await expect(page.locator('#preview-text')).toHaveText('하나');
  await page.locator('#next-card').click();
  await expect(page.locator('#preview-side')).toHaveText('QUESTION');
  await expect(page.locator('#preview-text')).toHaveText('하나');
  await page.locator('#reverse-cards').check();
  await expect(page.locator('#card-count')).toHaveText('12');
  await expect(page.locator('#input-count')).toHaveText('6');
  await page.locator('#next-card').click();
  await expect(page.locator('#preview-text')).toHaveText('하나');
  await page.locator('#preview-card').click();
  await expect(page.locator('#preview-text')).toHaveText('1');
  for (let n = 0; n < 9; n++) await page.locator('#next-card').click();
  await expect(page.locator('#preview-text')).toHaveText(pairs[5][0]);
  await expect(page.locator('#preview-card img, #preview-card script')).toHaveCount(0);
  await getDownload(page, info, '한국어 ภาษาไทย 🐱', pairs.flatMap(([q, a]) => [[q, a], [a, q]]));
  await page.locator('#source-text').fill('new,card');
  await expect(page.locator('#download-label')).toHaveText('Create study set');
  await expect(page.locator('#download-help')).toBeHidden();
  expect(errors).toEqual([]);
  const base = new URL(page.url());
  const allowed = new Set(['', 'index.html', 'styles.css', 'app.js', 'app-utils.js', 'conversion-worker.js', 'converter.js', 'assets/icon.svg', 'favicon.ico']);
  for (const request of requests) {
    if (request.url.startsWith('blob:')) continue;
    const url = new URL(request.url);
    expect(url.origin).toBe(base.origin);
    expect(url.search).toBe('');
    expect(request.method).toBe('GET');
    expect(request.body).toBeNull();
    expect(allowed.has(url.pathname.replace(base.pathname, '')) || url.pathname === '/favicon.ico').toBe(true);
  }
});

test('file picker, decoding errors, malformed CSV and stale export protection', async ({ page }) => {
  await page.goto('./');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file', exact: true }).click();
  await (await chooser).setFiles({ name: 'cards.csv', mimeType: 'text/csv', buffer: Buffer.from(source) });
  await expect(page.locator('#card-count')).toHaveText('6');
  for (const [input, error] of [['q,a\nbroken', 'Line 2:'], ['"unclosed,a', 'line 1:'], ['q,', 'nonempty'], ['q,a,extra', 'exactly 2 fields'], ['bad"quote,a', 'quotation marks']]) {
    await page.locator('#source-text').fill(input);
    await expect(page.locator('#error-message')).toContainText(error);
    await expect(page.locator('#source-text')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#download-button')).toBeDisabled();
  }
  await page.locator('#file-input').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from([0xff, 0xfe, 0x41]) });
  await expect(page.locator('#error-message')).toContainText('not valid UTF-8');
  await page.locator('#file-input').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('q,a') });
  await expect(page.locator('#error-message')).toContainText('.csv or .txt');
  await page.locator('#load-example').click();
  await expect(page.locator('#card-count')).toHaveText('5');
  await page.locator('#deck-title').fill('  ');
  await expect(page.locator('#title-error')).toBeVisible();
  await expect(page.locator('#download-button')).toBeDisabled();
  await page.locator('#clear-input').click();
  await expect(page.locator('#source-text')).toHaveValue('');
  await expect(page.locator('#card-count')).toHaveText('0');
  await expect(page.locator('#error-message')).toBeHidden();
});

test('1,000-card export stays responsive and preserves order', async ({ page }, info) => {
  await page.goto('./');
  const cards = Array.from({ length: 1000 }, (_, i) => [`질문 ${i + 1} 🐱`, `คำตอบ ${i + 1}`]);
  await page.locator('#source-text').fill(cards.map(pair => pair.join(',')).join('\n'));
  await page.locator('#deck-title').fill('1000 cards');
  await expect(page.locator('#card-count')).toHaveText('1,000');
  await page.evaluate(() => {
    window.frameTimes = [];
    let last = performance.now();
    window.frameInterval = setInterval(() => { const now = performance.now(); window.frameTimes.push(now - last); last = now; }, 20);
  });
  await getDownload(page, info, '1000 cards', cards);
  const gaps = await page.evaluate(() => { clearInterval(window.frameInterval); return window.frameTimes; });
  expect(gaps.length).toBeGreaterThan(2);
  expect(Math.max(...gaps)).toBeLessThan(1500);
  await info.attach('main-thread-timing', { body: JSON.stringify({ ticks: gaps.length, maxGapMs: Math.max(...gaps) }), contentType: 'application/json' });
});

test('responsive layout, touch targets, keyboard help and accessibility', async ({ page }, info) => {
  await page.goto('./');
  await page.locator('#load-example').click();
  await page.locator('#deck-title').fill('A little Korean, every day');
  await expect(page.locator('#card-count')).toHaveText('5');
  await page.locator('#preview-card').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#preview-text')).toHaveText('하나');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#preview-position')).toHaveText('2 of 5');
  await page.locator('#help-open').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#help-dialog')).toBeVisible();
  const helpAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(helpAudit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('#help-dialog')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await expect(page.locator('#help-open')).toBeFocused();
  await expect(page.locator('#help-open')).toHaveCSS('outline-style', 'solid');
  const layout = await page.evaluate(() => {
    const small = [...document.querySelectorAll('button, a, input:not([type=file]), textarea')].filter(el => {
      if (!el.getClientRects().length || el.closest('dialog:not([open])') || el.classList.contains('skip-link')) return false;
      const target = el.type === 'checkbox' ? el.closest('label') : el;
      const box = target.getBoundingClientRect();
      return box.width < 44 || box.height < 44;
    }).map(el => el.id || el.className);
    return { overflow: document.documentElement.scrollWidth > innerWidth, small, fontSizes: ['source-text', 'deck-title'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).fontSize)) };
  });
  expect(layout.overflow).toBe(false);
  expect(layout.small).toEqual([]);
  expect(Math.min(...layout.fontSizes)).toBeGreaterThanOrEqual(16);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.locator('#previous-card').click();
  await page.locator('#source-text').blur();
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.screenshot({ path: info.outputPath('layout.png'), fullPage: true, scale: 'css' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});

test('share feature uses an actual ready file in the click activation; cancellation keeps download', async ({ page }) => {
  // This deliberately tests our API contract, not a physical OS share sheet.
  await page.addInitScript(() => {
    window.shareChecks = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => {
      window.shareChecks.push({ name: files[0].name, size: files[0].size, isFile: files[0] instanceof File });
      return true;
    } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: ({ files }) => {
      window.sharedFile = { name: files[0].name, size: files[0].size, active: navigator.userActivation.isActive };
      return Promise.reject(new DOMException('Canceled', 'AbortError'));
    } });
  });
  await page.goto('./');
  await page.locator('#load-example').click();
  await expect(page.locator('#download-button')).toBeEnabled();
  await page.locator('#download-button').click();
  await expect(page.locator('#share-button')).toBeVisible();
  await page.locator('#share-button').click();
  await expect(page.locator('#export-status')).toContainText('Sharing canceled');
  const checked = await page.evaluate(() => ({ checks: window.shareChecks, shared: window.sharedFile }));
  expect(checked.checks[0].isFile).toBe(true);
  expect(checked.checks[0].size).toBeGreaterThan(100);
  expect(checked.shared.name).toBe('My_study_set.goodnotes');
  expect(checked.shared.active).toBe(true);
  await expect(page.locator('#download-button')).toBeEnabled();
});

test('worker failure is recoverable and cancel discards in-flight exports', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let failOnce = true;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        if (failOnce) { failOnce = false; throw new Error('Simulated worker failure'); }
        super(...args);
      }
    };
  });
  await page.goto('./');
  await page.locator('#load-example').click();
  await expect(page.locator('#error-message')).toContainText('Conversion could not finish');
  await page.locator('#retry-conversion').click();
  await expect(page.locator('#card-count')).toHaveText('5');
  await page.locator('#source-text').fill(Array.from({ length: 5000 }, (_, i) => `q${i},a${i}`).join('\n'));
  await expect(page.locator('#card-count')).toHaveText('5,000');
  await page.locator('#download-button').click();
  await page.locator('#cancel-build').click();
  await expect(page.locator('#export-status')).toContainText('Creation canceled');
  await expect(page.locator('#download-label')).toHaveText('Create study set');
  await expect(page.locator('#card-count')).toHaveText('5,000');
  await page.locator('#download-button').click();
  await page.locator('#source-text').fill('latest,ล่าสุด');
  await expect(page.locator('#card-count')).toHaveText('1');
  await expect(page.locator('#download-label')).toHaveText('Create study set');
  await expect(page.locator('#share-button')).toBeHidden();
});

test('limits are explicit and unsupported sharing keeps download available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await page.goto('./');
  await page.locator('#file-input').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 'a') });
  await expect(page.locator('#error-message')).toContainText('2 MiB');
  await page.locator('#source-text').fill('q,a\n'.repeat(2501));
  await expect(page.locator('#card-count')).toHaveText('2,501');
  await page.locator('#reverse-cards').check();
  await expect(page.locator('#error-message')).toContainText('5,000 output cards');
  await expect(page.locator('#download-button')).toBeDisabled();
  await page.locator('#source-text').fill('q'.repeat(20001) + ',a');
  await expect(page.locator('#error-message')).toContainText('20,000 characters');
  await page.locator('#load-example').click();
  await expect(page.locator('#download-button')).toBeEnabled();
  await page.locator('#download-button').click();
  await expect(page.locator('#download-label')).toHaveText('Download study set');
  await expect(page.locator('#share-button')).toBeHidden();
  await expect(page.locator('#download-button')).toBeEnabled();
});

test('optional drop loads UTF-8 TXT and a quoted multiline field', async ({ page }) => {
  await page.goto('./');
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['\uFEFF"First\nsecond",คำตอบ 🐱\nq,a'], 'dropped.txt', { type: 'text/plain' }));
    return data;
  });
  await page.locator('#drop-zone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.locator('#card-count')).toHaveText('2');
  await expect(page.locator('#preview-text')).toHaveText('First\nsecond');
  await page.locator('#preview-card').click();
  await expect(page.locator('#preview-text')).toHaveText('คำตอบ 🐱');
  await transfer.dispose();
});
