import {defineConfig} from '@playwright/test';
const channels=process.env.BAO_AN_BROWSER_CHANNEL?[process.env.BAO_AN_BROWSER_CHANNEL]:['chrome','msedge'];

// Each online spec starts a real local HTTP server and isolated SQLite database.
export default defineConfig({
  testDir:'./tests/visual',testMatch:/online(?:-[a-z]+)?\.spec\.ts$/,timeout:180000,
  expect:{timeout:15000},fullyParallel:false,workers:1,retries:0,
  outputDir:'test-results/online-browser-output',
  reporter:[['list'],['json',{outputFile:'test-results/online-browser-report.json'}]],
  projects:channels.map(channel=>({name:`online-${channel}`,use:{channel}})),
  use:{headless:true,actionTimeout:30000,navigationTimeout:30000,viewport:{width:1440,height:1000},extraHTTPHeaders:{'X-Bao-An-Question-Protocol':'1'},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
});
