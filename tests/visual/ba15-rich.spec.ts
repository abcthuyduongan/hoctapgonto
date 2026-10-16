import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test,expect } from '@playwright/test';
import { rows,readCards,answer,advancedLearningPath } from './helpers/self-study';
import { answerRich } from './helpers/rich-study';
import { createReleaseServer } from './helpers/offline-release';
import { createLearningStorageServer } from './helpers/learning-storage';
import { RICH_CURRICULA,RICH_PACKS } from '../../src/core/lesson-seed';
import { buildLessonSession } from '../../src/core/lesson-host';
import { parseLearningBackup } from '../../src/core/backup-io';
test.use({serviceWorkers:'block'});
let server:Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async()=>{server=await createLearningStorageServer(path.resolve('test-results',`ba15-core-${process.pid}-${Date.now()}`));});
test.afterAll(async()=>server?.close());
async function home(page:any,subject='Toán'){await page.goto(advancedLearningPath);await page.getByRole('button',{name:subject,exact:true}).click();await expect(page.getByRole('button',{name:'Học bài này',exact:true}).first()).toBeEnabled();}
async function passFirst(page:any,title:string){const card=page.getByRole('article',{name:`Bài ${title}`});await card.getByRole('button',{name:'Học bài này',exact:true}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự mình thử sức',exact:true}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();}
test('BA15: numeric entry rejects malformed text without an event, then stores exact response and corrects a genuine mistake',async({page})=>{
  await home(page);const card=page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'});await card.getByRole('button',{name:'Luyện thêm: Nhập số',exact:true}).click();await readCards(page);
  const field=page.getByRole('textbox');await field.fill('abc');await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Con chỉ nhập số');expect((await rows(page)).events).toHaveLength(0);
  await field.fill('99');await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();await page.getByRole('button',{name:'Thử lại câu này'}).click();await field.fill('0006,00');await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();await expect(page.getByText('Đúng rồi!',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await answerRich(page);
  const saved=await rows(page),result=saved.sessionResults[0];expect(result).toMatchObject({firstAttemptCorrect:4,totalItems:5,starTier:1,practiceCorrected:true});expect(saved.events.find(row=>row.response?.value==='0006,00')).toMatchObject({correct:true,submissionIndex:2});
});
test('BA15: Vietnamese fill preserves accents and accepts canonical Unicode on a correction',async({page})=>{
  await home(page,'Tiếng Việt');await page.getByRole('article',{name:'Bài Hiểu nghĩa từ và từ trái nghĩa'}).getByRole('button',{name:'Luyện thêm: Điền từ'}).click();await readCards(page);
  const field=page.getByRole('textbox');await field.fill('hep');await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();await expect(page.getByText('Mình cùng xem lại nhé.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Thử lại câu này'}).click();await field.fill('HẸP'.normalize('NFD'));await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await answerRich(page);
  const saved=await rows(page);expect(saved.events.find(row=>row.response?.value==='hep')).toMatchObject({correct:false,submissionIndex:1});expect(saved.sessionResults[0]).toMatchObject({firstAttemptCorrect:4,starTier:1});
});
test('BA15: structured reading keeps passage visible and scores all five evidence questions at 320px',async({page})=>{
  await home(page,'Tiếng Việt');await passFirst(page,'Hiểu nghĩa từ và từ trái nghĩa');await page.setViewportSize({width:320,height:780});
  await page.getByRole('article',{name:'Bài Đọc đoạn ngắn, tìm thông tin'}).getByRole('button',{name:'Luyện thêm: Đọc đoạn văn'}).click();await readCards(page);
  await expect(page.getByRole('region',{name:'Đoạn đọc'})).toContainText('Mai tưới nước, Nam nhặt lá khô');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await answerRich(page);
  expect((await rows(page)).sessionResults.find(row=>row.scope.lessonId==='vi-reading')).toMatchObject({firstAttemptCorrect:5,starTier:1});
});
test('BA15: actual WAV playback unlocks each independent listening choice and 4/5 earns tier two',async({page})=>{
  await home(page,'Tiếng Anh');const card=page.getByRole('article',{name:'Bài Từ vựng gia đình'});await expect(card.getByRole('button',{name:'Tự thử sức: Nghe tiếng Anh'})).toBeDisabled();
  await card.getByRole('button',{name:'Học bài này'}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự thử sức: Nghe tiếng Anh'}).click();
  await expect(page.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').first()).toBeDisabled();await answerRich(page,4);
  const saved=await rows(page),result=saved.sessionResults.find(row=>row.mode==='lesson-assessment');expect(result).toMatchObject({firstAttemptCorrect:4,independent:true,starTier:2});
  expect(saved.sessions.find(row=>row.sessionId===result.sessionId).checkpoint.mediaPlayback).toHaveLength(5);await expect(page.getByLabel('Câu cần xem lại')).toContainText('Âm thanh nói:');
});
test('BA15: listening-gap accepts the heard age and backup keeps all playback receipts',async({page})=>{
  test.setTimeout(90_000);await home(page,'Tiếng Anh');await passFirst(page,'Từ vựng gia đình');const card=page.getByRole('article',{name:'Bài Câu giới thiệu đơn giản'});
  await card.getByRole('button',{name:'Học bài này'}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự thử sức: Nghe tiếng Anh'}).click();await answerRich(page);
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Tải bản sao hồ sơ',exact:true}).click();const file=await pending,backup=parseLearningBackup(await readFile((await file.path())!,'utf8'));
  const session=backup.sessions.find(row=>'mode' in row&&row.scope.lessonId==='en-introduction'&&row.mode==='lesson-assessment');expect(session?.checkpoint.mediaPlayback).toHaveLength(5);
  expect(backup.sessionResults.find(row=>row.sessionId===session?.sessionId)).toMatchObject({starTier:2,firstAttemptCorrect:5});
});
test('BA15: a corrupt clip fails its hash, keeps answers disabled and leaves a resumable checkpoint',async({page})=>{
  await page.route('**/audio/family-01.v1.wav',route=>route.fulfill({status:200,contentType:'audio/wav',body:'corrupt audio'}));await home(page,'Tiếng Anh');
  await page.getByRole('article',{name:'Bài Từ vựng gia đình'}).getByRole('button',{name:'Luyện thêm: Nghe tiếng Anh'}).click();await readCards(page);await page.getByRole('button',{name:'Nghe âm thanh',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('không đúng bản');await expect(page.getByRole('button',{name:'Gửi câu trả lời',exact:true})).toBeDisabled();expect((await rows(page)).events).toHaveLength(0);
  await page.getByRole('button',{name:/Tạm dừng và lưu/}).click();await expect(page.getByRole('button',{name:'Tiếp tục bài đang học'})).toBeVisible();
  await page.getByRole('article',{name:'Bài Từ vựng gia đình'}).getByRole('button',{name:'Luyện thêm: Điền từ',exact:true}).click();await readCards(page);await expect(page.getByRole('textbox')).toBeEnabled();
  const saved=await rows(page);expect(saved.sessions.filter(row=>row.status==='paused')).toHaveLength(1);expect(saved.sessions.filter(row=>row.status==='active')).toHaveLength(1);
});
test('BA15: real offline worker caches all ten clips and listening still commits a played receipt without network',async({browser},testInfo)=>{
  test.setTimeout(90_000);const release=await createReleaseServer(testInfo.outputPath('audio-offline')),context=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});
  try{const page=await context.newPage();await page.goto(release.origin+advancedLearningPath);await expect(page.getByRole('status',{name:'Trạng thái ngoại tuyến'})).toContainText('Sẵn sàng học ngoại tuyến');
    const cached=await page.evaluate(async()=>{const urls:string[]=[];for(const key of await caches.keys())if(key.startsWith('bao-an-learning-build-'))for(const request of await(await caches.open(key)).keys())urls.push(new URL(request.url).pathname);return urls;});
    expect(cached.filter(url=>url.startsWith('/audio/'))).toHaveLength(10);await context.setOffline(true);await page.getByRole('button',{name:'Tiếng Anh',exact:true}).click();await page.getByRole('article',{name:'Bài Từ vựng gia đình'}).getByRole('button',{name:'Luyện thêm: Nghe tiếng Anh'}).click();await readCards(page);
    await page.getByRole('button',{name:'Nghe âm thanh',exact:true}).click();await expect(page.getByRole('article',{name:'Câu hỏi đang làm'}).getByRole('status')).toContainText('Đã nghe clip này');
    const current=(await rows(page)).sessions.find(row=>row.status==='active'&&row.mode);expect(current.checkpoint.mediaPlayback).toHaveLength(1);expect((await rows(page)).events).toHaveLength(0);
  }finally{await context.close();await release.close();}
});
test('BA15: production creation clears caller playback claims and cannot score before a pinned played receipt',async({page})=>{
  await page.goto(`${server.origin}/qa-storage`);await page.waitForFunction(()=>!!(window as any).__learningStorage);
  const invoke=(method:string,args:any[]=[])=>page.evaluate(async({method,args})=>{try{return {ok:true,value:await(window as any).__learningStorage.storage[method](...args)};}catch(error){return {ok:false,error:String(error)};}},{method,args});
  expect((await invoke('ensureLearningLibrary',[RICH_PACKS,RICH_CURRICULA])).ok).toBe(true);const profile=(await invoke('listProfiles')).value[0],curriculum=RICH_CURRICULA.find(row=>row.subject==='english')!;
  const enrolled=(await invoke('enrollLearningCurriculum',[profile.profileId,curriculum])).value,lesson=curriculum.lessons[0],form=lesson.forms.find(row=>row.formId==='en-family-nghe-chon')!,pack=RICH_PACKS.find(row=>row.id===form.formId)!;
  if(pack.kind!=='learning')throw new Error('Expected rich learning pack');const media=pack.media[0],start=new Date().toISOString(),session=buildLessonSession(profile.profileId,curriculum,lesson,form,{packs:RICH_PACKS,curricula:RICH_CURRICULA,sessions:[],events:[],results:[],profiles:[enrolled]},'audio-owner','audio-host-session',start);
  session.mode='lesson-practice';session.guidedFrom='lesson-assessment';session.checkpoint.mediaPlayback=[{mediaId:media.mediaId,sha256:media.sha256,completedAt:start}];
  const created=await invoke('createLearningSession',[session]);expect(created.ok).toBe(true);expect(created.value.checkpoint.mediaPlayback).toEqual([]);
  const rejected=await invoke('submitLessonAttempt',[session.sessionId,'audio-owner',{attemptKey:'before-listen',itemRef:form.itemRefs[0],response:{version:1,kind:'choice',selectedIndex:0},hintsUsed:0,elapsedMs:1000}]);expect(rejected.ok).toBe(false);expect(rejected.error).toContain('nghe clip');
  expect((await invoke('markLessonMediaPlayback',[session.sessionId,'audio-owner',media.mediaId,'f'.repeat(64)])).ok).toBe(false);expect((await rows(page)).events).toHaveLength(0);
});
