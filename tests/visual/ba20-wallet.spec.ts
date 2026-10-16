import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect,test,type Page } from '@playwright/test';
import { createLearningStorageServer } from './helpers/learning-storage';
import { learningStorageFixture } from './helpers/learning-storage-fixture';
import { answer,rows,advancedLearningPath } from './helpers/self-study';
import { parseLearningBackup } from '../../src/core/backup-io';

test.use({serviceWorkers:'block'});
let server:Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async()=>{server=await createLearningStorageServer(path.resolve('test-results',`ba20-core-${process.pid}-${Date.now()}`));});
test.afterAll(async()=>{await server?.close();});
async function harness(page:Page){await page.goto(`${server.origin}/qa-storage`);await page.waitForFunction(()=>!!(window as any).__learningStorage);}
async function invoke(page:Page,method:string,args:unknown[]=[]){return page.evaluate(async({method,args})=>{try{return{ok:true,value:await(window as any).__learningStorage.storage[method](...args)};}catch(error){return{ok:false,message:error instanceof Error?error.message:String(error)};}},{method,args});}
async function call(page:Page,method:string,args:unknown[]=[]):Promise<any>{const response=await invoke(page,method,args);if(!response.ok)throw new Error(`${method}: ${response.message}`);return response.value;}
async function coreWithOneStar(page:Page,prefix:string){await harness(page);const f=learningStorageFixture(prefix),owner=`${prefix}-owner`;
  await call(page,'listProfiles');await call(page,'savePack',[f.pack]);await call(page,'saveCurriculum',[f.curriculum]);await call(page,'saveProfile',[f.profile]);
  const session={...structuredClone(f.session),status:'active',ownerTabId:owner,checkpoint:{...f.session.checkpoint,stepIndex:0,readStepIds:[],receipts:[],exposedItemKeys:[],updatedAt:f.session.startedAt}};delete(session as any).endedAt;
  await call(page,'createLearningSession',[session]);await call(page,'markLessonStep',[session.sessionId,owner,f.curriculum.lessons[0].steps[0].stepId,'2026-10-12T10:00:01.000Z']);
  for(const [index,itemRef]of session.checkpoint.itemOrder.entries())await call(page,'submitLessonAttempt',[session.sessionId,owner,{attemptKey:`a-${index}`,itemRef,response:{version:1,kind:'choice',selectedIndex:0},hintsUsed:0,elapsedMs:1000},`2026-10-12T10:00:${String(index+10).padStart(2,'0')}.000Z`]);
  const receipt=await call(page,'finalizeLearningSession',[session.sessionId,owner,'2026-10-12T10:01:00.000Z']);expect(receipt.result.starTier).toBe(1);await call(page,'configureRewardWallet',[f.profile.profileId,true,1000]);return f;
}
async function approveDialog(page:Page,action:()=>Promise<unknown>,contains:string){page.once('dialog',async dialog=>{expect(dialog.message()).toContain(contains);await dialog.accept();});await action();}
const parentWallet=(page:Page)=>page.getByRole('region',{name:'Quản lý đổi sao'});
const childWallet=(page:Page)=>page.getByRole('region',{name:'Ví đổi sao'});

test('BA20: child earns stars, requests a real-life goal; parent changes rate, approves and records handover without erasing achievement',async({page})=>{
  await page.goto(advancedLearningPath);const lesson=page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'});await lesson.getByRole('button',{name:'Học bài này',exact:true}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo',exact:true}).click();
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const parent=parentWallet(page);await parent.getByLabel('Cho phép con đổi sao').check();await parent.getByLabel('Giá trị 1 sao (đồng)').fill('1000');
  await approveDialog(page,()=>parent.getByRole('button',{name:'Lưu tỷ lệ đổi sao',exact:true}).click(),'1 sao');await expect(parent.getByRole('status')).toContainText('Đã lưu tỷ lệ');
  await page.getByRole('button',{name:'Tự học',exact:true}).click();const child=childWallet(page);await child.getByRole('button',{name:'Mở ví đổi sao'}).click();await child.getByLabel('Món đồ con muốn').fill('Bút chì xanh');await child.getByLabel('Mục tiêu tiền (đồng)').fill('700');
  await expect(child).toContainText('Cần 1 sao');await child.getByRole('button',{name:'Gửi ước muốn cho phụ huynh'}).click();await expect(child.getByRole('status')).toContainText('đã gửi');await expect(child).toContainText('0 sao khả dụng');
  const before=await rows(page);expect(before.sessionResults).toHaveLength(1);expect(before.profiles[0].learningSettings.rewardWallet.requests[0]).toMatchObject({stars:1,rateVnd:1000,amountVnd:1000,goalVnd:700});
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();await parent.getByLabel('Giá trị 1 sao (đồng)').fill('2000');await approveDialog(page,()=>parent.getByRole('button',{name:'Lưu tỷ lệ đổi sao',exact:true}).click(),'1 sao');await expect(parent.getByRole('status')).toContainText('Đã lưu tỷ lệ');
  await approveDialog(page,()=>parent.getByRole('button',{name:'Duyệt Bút chì xanh',exact:true}).click(),'Bút chì xanh');await expect(parent.getByRole('button',{name:'Xác nhận đã trao Bút chì xanh',exact:true})).toBeVisible();
  await parent.getByLabel('Ghi chú cho yêu cầu Bút chì xanh').fill('Đã trao bút cho con');await approveDialog(page,()=>parent.getByRole('button',{name:'Xác nhận đã trao Bút chì xanh',exact:true}).click(),'ĐÃ TRAO');await expect(parent.getByRole('status')).toContainText('Đã lưu việc');
  const after=await rows(page);expect(after.sessionResults).toEqual(before.sessionResults);expect(after.lessonProgress).toEqual(before.lessonProgress);expect(after.profiles[0].learningSettings.rewardWallet.requests[0].history.map((row:any)=>row.status)).toEqual(['pending','approved','fulfilled']);expect(after.profiles[0].learningSettings.rewardWallet.requests[0].rateVnd).toBe(1000);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Tải bản sao hồ sơ',exact:true}).click();const downloaded=await pending,backup=parseLearningBackup(await readFile((await downloaded.path())!,'utf8'));expect(backup.profiles[0].learningSettings?.rewardWallet).toEqual(after.profiles[0].learningSettings.rewardWallet);
  await page.getByRole('button',{name:'Tự học',exact:true}).click();await child.getByRole('button',{name:'Mở ví đổi sao'}).click();await expect(child).toContainText('1 sao đã đổi');await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('1');await page.reload();await child.getByRole('button',{name:'Mở ví đổi sao'}).click();await expect(child).toContainText('1 sao đã đổi');
});

test('BA20: two tabs serialize competing withdrawals, canonical retries and cancellation restore the same single star',async({page,context})=>{
  const f=await coreWithOneStar(page,'wallet-race'),other=await context.newPage();await harness(other);const id=f.profile.profileId;
  const results=await Promise.all([invoke(page,'requestReward',[id,{requestId:'race-one',title:'Thước kẻ',goalVnd:1000}]),invoke(other,'requestReward',[id,{requestId:'race-two',title:'Bút mực',goalVnd:1000}])]);expect(results.filter(row=>row.ok)).toHaveLength(1);expect(results.filter(row=>!row.ok)[0].message).toContain('chưa đủ');
  const accepted=results.find(row=>row.ok)!.value;const retry=await call(other,'requestReward',[id,{requestId:accepted.requestId,title:accepted.title,goalVnd:accepted.goalVnd}]);expect(retry).toEqual(accepted);
  await call(page,'updateRewardRequest',[id,accepted.requestId,'cancelled']);await call(other,'requestReward',[id,{requestId:'after-cancel',title:'Tẩy nhỏ',goalVnd:1000}]);const profiles=await call(page,'listProfiles');expect(profiles.find((row:any)=>row.profileId===id).learningSettings.rewardWallet.requests).toHaveLength(2);
  expect((await rows(page)).sessionResults).toHaveLength(1);expect((await rows(page)).lessonProgress[0].bestStars).toBe(1);await other.close();
});

test('BA20: quota failure rolls the entire reservation back; stale profile and settings forms preserve the committed wallet',async({page})=>{
  const f=await coreWithOneStar(page,'wallet-quota'),id=f.profile.profileId,stale=(await call(page,'listProfiles')).find((row:any)=>row.profileId===id),before=await rows(page);
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value:any,...args:any[]){if(this.name==='profiles'){IDBObjectStore.prototype.put=original;throw new DOMException('BA20 quota','QuotaExceededError');}return original.call(this,value,...args);};});
  const request={requestId:'retry-after-quota',title:'Vở nhỏ',goalVnd:1000};expect((await invoke(page,'requestReward',[id,request])).ok).toBe(false);expect(await rows(page)).toEqual(before);
  await call(page,'requestReward',[id,request]);await call(page,'configureLearner',[id,{textbook:'Toán lớp 3'}]);await call(page,'saveProfile',[{...stale,name:'Bảo An mới'}]);let current=(await call(page,'listProfiles')).find((row:any)=>row.profileId===id);expect(current.learningSettings.rewardWallet.requests).toHaveLength(1);
  const forged=await invoke(page,'configureLearner',[id,{rewardWallet:{schemaVersion:1,enabled:true,rateVnd:1,updatedAt:new Date().toISOString(),requests:[]}}]);expect(forged.ok).toBe(false);
  await call(page,'updateRewardRequest',[id,request.requestId,'rejected','Chọn món phù hợp hơn']);await call(page,'requestReward',[id,{requestId:'after-reject',title:'Vở khác',goalVnd:1000}]);current=(await call(page,'listProfiles')).find((row:any)=>row.profileId===id);expect(current.learningSettings.rewardWallet.requests.map((row:any)=>row.history.at(-1).status)).toEqual(['rejected','pending']);
});

test('BA20: parent disabled by default, zero stars cannot be redeemed; profile isolation and narrow layout keep the wallet usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(advancedLearningPath);const child=childWallet(page);await child.getByRole('button',{name:'Mở ví đổi sao'}).click();await expect(child).toContainText('Phụ huynh có thể bật');
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const parent=parentWallet(page);await expect(parent.getByLabel('Cho phép con đổi sao')).not.toBeChecked();await parent.getByLabel('Cho phép con đổi sao').check();await approveDialog(page,()=>parent.getByRole('button',{name:'Lưu tỷ lệ đổi sao',exact:true}).click(),'Lưu cấu hình');await expect(parent.getByRole('status')).toContainText('Đã lưu tỷ lệ');
  await page.getByRole('button',{name:'Tự học',exact:true}).click();await child.getByRole('button',{name:'Mở ví đổi sao'}).click();await child.getByLabel('Món đồ con muốn').fill('Đồ chơi');await child.getByLabel('Mục tiêu tiền (đồng)').fill('1000');await expect(child.getByRole('button',{name:'Gửi ước muốn cho phụ huynh'})).toBeDisabled();await expect(child).toContainText('cần thêm 1 sao');
  await page.getByRole('button',{name:'Đổi hồ sơ học sinh'}).click();await page.getByRole('button',{name:'+ Thêm hồ sơ cho bé khác'}).click();await page.getByLabel('Tên gọi của bé').fill('Bé khác');await page.getByRole('button',{name:'Tạo hồ sơ',exact:true}).click();await child.getByRole('button',{name:'Mở ví đổi sao'}).click();await expect(child).toContainText('Phụ huynh có thể bật');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('BA20: a forged progress cache cannot fund redemption, disabled wallets keep pending history and fulfillment retries do not spend twice',async({page})=>{
  const f=await coreWithOneStar(page,'wallet-source'),id=f.profile.profileId;
  await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('bao-an-learning-v3-alpha');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('lessonProgress','readwrite'),store=tx.objectStore('lessonProgress'),request=store.getAll();request.onsuccess=()=>{for(const progress of request.result)store.put({...progress,bestStars:3});};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}});
  expect((await invoke(page,'requestReward',[id,{requestId:'too-many',title:'Không đủ sao',goalVnd:3000}])).ok).toBe(false);
  const request=await call(page,'requestReward',[id,{requestId:'one-star',title:'Sổ tay',goalVnd:1000}]);await call(page,'configureRewardWallet',[id,false,2000]);expect((await invoke(page,'requestReward',[id,{requestId:'disabled',title:'Thêm món đồ',goalVnd:1000}])).ok).toBe(false);
  await call(page,'updateRewardRequest',[id,request.requestId,'approved']);expect((await invoke(page,'updateRewardRequest',[id,request.requestId,'cancelled'])).ok).toBe(false);
  const fulfilled=await call(page,'updateRewardRequest',[id,request.requestId,'fulfilled']);expect(await call(page,'updateRewardRequest',[id,request.requestId,'fulfilled'])).toEqual(fulfilled);
  const saved=(await call(page,'listProfiles')).find((row:any)=>row.profileId===id).learningSettings.rewardWallet;expect(saved.requests).toHaveLength(1);expect(saved.requests[0].rateVnd).toBe(1000);expect(saved.requests[0].history).toHaveLength(3);
  await call(page,'rebuildProgress');expect((await rows(page)).lessonProgress[0].bestStars).toBe(1);
});
