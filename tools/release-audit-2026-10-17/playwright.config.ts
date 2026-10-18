import {defineConfig} from '@playwright/test';
import path from 'node:path';
const output=process.env.BAO_AN_AUDIT_OUTPUT_ROOT??'test-results/deep-release-audit';
export default defineConfig({testDir:'.',testMatch:'original-import.spec.ts',timeout:120000,workers:1,retries:0,outputDir:path.resolve(output,'original-browser-output'),reporter:[['list'],['json',{outputFile:path.resolve(output,'original-browser-report.json')}]],projects:['chrome','msedge'].map(channel=>({name:channel,use:{channel}})),use:{headless:true,viewport:{width:1440,height:1000},serviceWorkers:'block',screenshot:'only-on-failure',trace:'retain-on-failure'}});
