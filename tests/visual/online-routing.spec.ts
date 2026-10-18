import {seedLegacyApiWeek} from '../helpers/legacy-weeks.mjs';
import path from 'node:path';
import {cp,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {expect,test,type APIRequestContext,type Page} from '@playwright/test';
import {createOnlineServer} from '../../server/online-server.mjs';

test.use({serviceWorkers:'block'});
test.describe.configure({mode:'serial'});
let server:ReturnType<typeof createOnlineServer>,origin:string,directory:string;
const resultsRoot=path.resolve('test-results'),setupToken='m1-routing-fixture-bootstrap-token',password='M1-fixture-password-2026!';
test.beforeAll(async()=>{await mkdir(resultsRoot,{recursive:true});directory=await mkdtemp(path.join(resultsRoot,'online-routing-'));const staticRoot=path.join(directory,'public');await cp(path.resolve(process.env.BAO_AN_STATIC_ROOT??'dist'),staticRoot,{recursive:true});server=createOnlineServer({databasePath:path.join(directory,'online.sqlite'),staticRoot,setupToken,secureCookies:false});server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close((error:Error|undefined)=>error?reject(error):resolve()));server.onlineClose();}if(directory){const target=path.resolve(directory);expect(path.dirname(target)).toBe(resultsRoot);expect(path.basename(target)).toMatch(/^online-routing-/);await rm(target,{recursive:true,force:true});}});
async function watchDatabase(page:Page){await page.addInitScript(()=>{(window as any).__m1Database={opens:0,writes:0,upgrades:0};const open=indexedDB.open.bind(indexedDB);indexedDB.open=((...args:[string,number?])=>{(window as any).__m1Database.opens++;const result=open(...args);result.addEventListener('upgradeneeded',()=>{(window as any).__m1Database.upgrades++;});return result;}) as typeof indexedDB.open;for(const name of['add','put','delete','clear'] as const){const original=IDBObjectStore.prototype[name];(IDBObjectStore.prototype as any)[name]=function(...args:unknown[]){(window as any).__m1Database.writes++;return Reflect.apply(original,this,args);};}});}
async function api(request:APIRequestContext,route:string,data?:unknown){const identity=data!==undefined&&route!=='/setup'?await(await request.get(origin+'/api/online/me')).json():null;if(route==='/weeks')await seedLegacyApiWeek(server.onlineStore,identity,data);const result=data===undefined?await request.get(origin+'/api/online'+route):await request.post(origin+'/api/online'+route,{headers:{Origin:origin,...(identity?{'X-CSRF-Token':identity.csrfToken}:{})},data});expect(result.ok(),await result.text()).toBe(true);return result.json();}
async function databaseRows(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('bao-an-learning-v3-alpha');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{return await new Promise<Record<string,unknown[]>>((resolve,reject)=>{const result:Record<string,unknown[]>={},names=[...db.objectStoreNames],tx=db.transaction(names,'readonly');for(const name of names){const request=tx.objectStore(name).getAll();request.onsuccess=()=>{result[name]=request.result;};}tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error);});}finally{db.close();}});}

test('M1: canonical local entry and auth brand keep a fresh account workspace free of browser profiles',async({page})=>{
  await watchDatabase(page);await page.goto(origin+'/');await expect(page).toHaveURL(/online=1/);await expect(page.getByRole('heading',{name:'Tạo không gian học tập'})).toBeVisible();await expect(page.locator('.game-hub')).toHaveCount(0);await expect(page.getByRole('button',{name:/Bảng cửu chương/})).toHaveCount(0);
  const brand=page.locator('.online-auth .online-brand');expect(new URL((await brand.getAttribute('href'))!,origin).searchParams.get('online')).toBe('1');await brand.click();await expect(page.getByRole('heading',{name:'Tạo không gian học tập'})).toBeVisible();expect(await page.evaluate(()=>(window as any).__m1Database)).toEqual({opens:0,writes:0,upgrades:0});
});

test('retired links open the account UI without reading or changing browser records',async({page})=>{
  await page.goto(origin+'/?online=1');
  await page.evaluate(async()=>{await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('bao-an-learning-v3-alpha',1);request.onupgradeneeded=()=>request.result.createObjectStore('profiles',{keyPath:'profileId'});request.onsuccess=()=>{const db=request.result,tx=db.transaction('profiles','readwrite');tx.objectStore('profiles').put({profileId:'old-browser-record',name:'Giữ nguyên dữ liệu cũ'});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});});
  const before=await databaseRows(page);await watchDatabase(page);
  for(const route of['/?online=0','/?online=0&legacy=archive','/legacy-archive']){await page.goto(origin+route);await expect(page.getByRole('heading',{name:'Tạo không gian học tập',exact:true})).toBeVisible();await expect(page.locator('.legacy-workspace-notice,.creator-screen,.site-header')).toHaveCount(0);await expect(page).toHaveURL(/online=1/);expect(await page.evaluate(()=>(window as any).__m1Database)).toEqual({opens:0,writes:0,upgrades:0});}
  expect(await databaseRows(page)).toEqual(before);
});

test('M1: graphics fallback exposes every allowed assigned game and no built-in lesson, retaining retries and server stars',async({page,context},testInfo)=>{
  await api(page.request,'/setup',{token:setupToken,name:'M1 workspace',username:'m1.manager',password});const cls=await api(page.request,'/classes',{name:'Lớp M1 tự đặt',grade:3});await api(page.request,'/students',{name:'Học sinh M1',classId:cls.id,username:'m1.student',password});const pack={id:'m1-assigned-pairs',version:1,title:'Bộ tự soạn duy nhất',kind:'pairs',subject:'thinking',grade:3,source:'local',publishedAt:new Date().toISOString(),items:[{id:'m1-pair-a',objectiveId:'AUTHOR.M1',kind:'pair',left:'Trái tự soạn A',right:'Phải tự soạn A'},{id:'m1-pair-b',objectiveId:'AUTHOR.M1',kind:'pair',left:'Trái tự soạn B',right:'Phải tự soạn B'}]};await api(page.request,'/weeks',{requestId:'m1-fixture-week',title:'Tuần M1 tự đặt',classId:cls.id,sets:[{subjectLabel:'Môn do người soạn quyết định',pack}]});await context.clearCookies();await watchDatabase(page);await page.route('**/models/math-world.glb',route=>route.fulfill({status:404,contentType:'text/plain',body:'Intentional M1 graphics failure'}));await page.goto(origin+'/?online=1');await page.getByLabel('Tên đăng nhập',{exact:true}).fill('m1.student');await page.getByLabel('Mật khẩu',{exact:true}).fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state',/fallback|unavailable/);const fallback=page.getByRole('region',{name:'Trò chơi phù hợp bộ được giao'});await expect(fallback).toBeVisible();await expect(fallback.getByRole('button')).toHaveCount(2);await expect(page.getByRole('button',{name:/Bảng cửu chương/})).toHaveCount(0);await expect(page.getByRole('button',{name:/Tự học|Luyện thi|Xưởng học liệu|Góc phụ huynh/})).toHaveCount(0);await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('student-assigned-fallback-320.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});await fallback.getByRole('button',{name:'Chơi Nối Từ Khám Phá bằng bộ được giao',exact:true}).click();await expect(page.locator('.word-connect-panel')).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button',{name:'Thẻ A: Trái tự soạn A',exact:true}).click();
  await page.getByRole('button',{name:'Thẻ B: Phải tự soạn A',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Chưa kết nối được máy chủ');
  await expect(page.getByRole('alert')).not.toContainText(/giải phóng|dung lượng|xóa.*bộ nhớ/);
  expect(server.onlineStore.db.prepare('SELECT count(*) AS count FROM attempts').get().count).toBe(0);
  await context.setOffline(false);
  await page.getByRole('button',{name:'Thử gửi lại lượt nối',exact:true}).click();
  await expect(page.getByRole('button',{name:'Thẻ A: Trái tự soạn A',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Thẻ A: Trái tự soạn B',exact:true}).click();
  await page.getByRole('button',{name:'Thẻ B: Phải tự soạn B',exact:true}).click();
  await page.getByRole('button',{name:'Trở về hành trình',exact:true}).click();
  const state=await api(page.request,'/student');
  expect(state.balance.earned).toBe(6);
  expect(state.current?.pack.id).toBe(pack.id);
  expect(server.onlineStore.db.prepare('SELECT count(*) AS count FROM attempts').get().count).toBe(2);
  expect(server.onlineStore.db.prepare('SELECT json FROM plays').all().map((row:any)=>JSON.parse(row.json).packId)).toEqual([pack.id]);
  expect(await page.evaluate(()=>(window as any).__m1Database)).toEqual({opens:0,writes:0,upgrades:0});
  await expect(fallback.getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Chưa có tuần tiếp theo',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('0 câu 2 sao · 2 câu 3 sao');
});
