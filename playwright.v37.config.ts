import { defineConfig, devices } from '@playwright/test';

/** Release verification uses the built React application, never Vite's dev server.
 * Run `npm run build` first. An occupied port fails instead of testing another app.
 */
export default defineConfig({
  testDir: './tests/visual',
  testMatch: /(?:premium-world|mobile-ui-lock|gameplay-regression)\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/v37',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/v37', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5177',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{
    name: 'edge-production',
    use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1440, height: 900 } },
  }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5177 --strictPort',
    url: 'http://127.0.0.1:5177',
    reuseExistingServer: false,
    timeout: 45_000,
  },
});
