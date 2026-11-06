import {cloudBrowserFixture} from '../../tests/helpers/cloud-browser-fixture.mjs';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile} from 'node:fs/promises';
const f=await cloudBrowserFixture(),browser=await chromium.launch({channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 async function api(route,data,csrf=''){const r=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data});expect(r.ok(),await r.text()).toBe(true);return r.json();}
 const admin=await api('/setup',{token:f.token,name:'A11y scope fixture',username:'audit.a11y.admin',password:f.password});const cls=await api('/classes',{name:'Lớp3a',grade:3},admin.csrfToken);await api('/students',{name:'A11y child',classId:cls.id,username:'audit.a11y.child',password:f.password},admin.csrfToken);
 await context.clearCookies();await api('/login',{username:'audit.a11y.child',password:f.password});await page.goto(f.origin+'/?online=1&controls=1');await expect(page.locator('.online-student')).toBeVisible();
 const observation={kind:'Same empty-data setup and axe disableRules as online-a11y.spec.ts; Chrome desktop; actual PGlite cloud browser fixture',worldMapElements:await page.locator('.world-map-container').count(),mapScanViolations:[]};
 const mapScan=await new AxeBuilder({page}).disableRules(['color-contrast']).analyze();observation.mapScanViolations=mapScan.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));
 const btn=page.getByRole('button',{name:/Thị trấn/i});await btn.focus();await page.keyboard.press('Enter');await expect(page.getByText('Thị trấn của con')).toBeVisible();
 observation.townGridCountBeforeScan=await page.locator('.town-grid-10').count();
 const townScan=await new AxeBuilder({page}).disableRules(['color-contrast']).analyze();observation.townScanViolations=townScan.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));
 observation.townText=await page.getByRole('dialog',{name:'Thị trấn của con',exact:true}).first().innerText();observation.townGridCountAfterScan=await page.locator('.town-grid-10').count();
 await page.screenshot({path:'test-results/audit-2026-11-06/a11y-empty-fixture-town.png',fullPage:true});await writeFile('test-results/audit-2026-11-06/a11y-scope-reproduction.json',JSON.stringify(observation,null,2));console.log(JSON.stringify(observation));
}finally{await browser.close();await f.close();}
