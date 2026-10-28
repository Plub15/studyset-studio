import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localBrowsers = fileURLToPath(new URL('./.local/browsers', import.meta.url));
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(localBrowsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
const apple = ['iPhone SE', 'iPhone 13', 'iPad Mini', 'iPad Pro 11'];
export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173/studyset-studio/',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } } },
    { name: 'android-pixel-7', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'narrow-320', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 740 }, hasTouch: true } },
    ...apple.flatMap(name => ['portrait', 'landscape'].map(orientation => {
      const profile = devices[orientation === 'portrait' ? name : `${name} landscape`];
      if (!profile) throw new Error(`Missing device profile: ${name} ${orientation}`);
      return { name: `${name.toLowerCase().replaceAll(' ', '-')}-${orientation}`, use: { ...profile, browserName: 'webkit' } };
    })),
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'node scripts/build.mjs && node scripts/serve.mjs', url: 'http://127.0.0.1:4173/studyset-studio/', reuseExistingServer: !process.env.CI },
});
