import { defineConfig, devices } from '@playwright/test';

/** Live screenshot verification on the user's development machine.
 *  Not a substitute for human side-by-side approval against docs/concept.
 */
export default defineConfig({
  testDir: './tests/visual',
  testMatch:'**/real3d31.spec.ts',
  timeout: 30_000,
  use: {baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}}],
  webServer:{command:'npm run dev -- --host 127.0.0.1',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:45_000}
});
