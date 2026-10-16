import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect,test } from '@playwright/test';
import { rows,answer,advancedLearningPath } from './helpers/self-study';
import { createLearningStorageServer } from './helpers/learning-storage';
import { LESSON_CURRICULA,LESSON_PACKS } from '../../src/core/lesson-starter';
import { LIBRARY_CURRICULA } from '../../src/core/lesson-seed';
import { buildLessonSession } from '../../src/core/lesson-host';
import { parseLearningBackup } from '../../src/core/backup-io';
test.use({serviceWorkers:'block'});
let server:Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async()=>{server=await createLearningStorageServer(path.resolve('test-results',`ba13-core-${process.pid}-${Date.now()}`));});
test.afterAll(async()=>server?.close());
const pairs=[['Toán','Vận dụng bảng nhân và chia','Giải bài toán một bước'],['Tiếng Việt','Hiểu nghĩa từ và từ trái nghĩa','Đọc đoạn ngắn, tìm thông tin'],['Tiếng Anh','Từ vựng gia đình','Câu giới thiệu đơn giản']];
for(const [subject,first,second] of pairs)test(`BA13: both ${subject} pilot lessons run through reading, practice and independent assessment`,async({page},testInfo)=>{
  await page.goto(advancedLearningPath);await page.getByRole('button',{name:subject,exact:true}).click();const next=page.getByRole('article',{name:`Bài ${second}`});
  await expect(next.getByRole('button',{name:'Học bài này',exact:true})).toBeDisabled();
  for(const title of [first,second]){
    const card=page.getByRole('article',{name:`Bài ${title}`});await expect(card.getByRole('button',{name:'Học bài này',exact:true})).toBeEnabled();
    await card.getByRole('button',{name:'Học bài này',exact:true}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();
    await card.getByRole('button',{name:'Tự mình thử sức',exact:true}).click();await answer(page);
    await expect(card.getByText('Đã vượt qua',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();
  }
  const saved=await rows(page),latest=Math.max(...LIBRARY_CURRICULA.map(row=>row.revision));expect(saved.lessonProgress).toHaveLength(2);expect(saved.lessonProgress.every(row=>row.bestStars===2&&row.passed&&row.scope.curriculumRevision===latest)).toBe(true);
  await testInfo.attach(`pilot-${subject}`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const backup=page.getByRole('region',{name:'Sao lưu hồ sơ học tập'});
  const pending=page.waitForEvent('download');await backup.getByRole('button',{name:'Tải bản sao hồ sơ',exact:true}).click();const download=await pending;expect(await download.failure()).toBeNull();
  const restored=parseLearningBackup(await readFile((await download.path())!,'utf8'));
  expect(restored.curricula).toHaveLength(LIBRARY_CURRICULA.length);expect(restored.sessionResults).toHaveLength(4);expect(restored.lessonProgress.every(row=>row.bestStars===2)).toBe(true);
});
test('BA13: installing pilot v2 keeps published starter bytes, pinned v1 and an unfinished lesson unchanged',async({page})=>{
  await page.goto(`${server.origin}/qa-storage`);await page.waitForFunction(()=>!!(window as any).__learningStorage);
  const invoke=(method:string,args:any[]=[])=>page.evaluate(async({method,args})=>await (window as any).__learningStorage.storage[method](...args),{method,args});
  await invoke('ensureLearningLibrary',[LESSON_PACKS,LESSON_CURRICULA]);const profile=(await invoke('listProfiles'))[0];const pinned=await invoke('enrollLearningCurriculum',[profile.profileId,LESSON_CURRICULA[0]]);
  const lesson=LESSON_CURRICULA[0].lessons[0],session=buildLessonSession(profile.profileId,LESSON_CURRICULA[0],lesson,lesson.forms[0],
    {packs:LESSON_PACKS,curricula:LESSON_CURRICULA,sessions:[],events:[],results:[],profiles:[pinned]},'old-pilot-owner','old-pilot-session',new Date().toISOString());
  await invoke('createLearningSession',[session]);await invoke('markLessonStep',[session.sessionId,'old-pilot-owner',lesson.steps[0].stepId]);
  const before=await rows(page),old=(await invoke('getLearningSession',[session.sessionId])).checkpoint;
  await page.goto(server.origin+advancedLearningPath);await page.getByRole('button',{name:'Tiếp tục bài đang học',exact:true}).click();await expect(page.getByRole('heading',{name:lesson.steps[1].title,exact:true})).toBeVisible();
  const after=await rows(page),saved=after.sessions.find(row=>row.sessionId===session.sessionId);
  expect(saved.scope.curriculumRevision).toBe(1);expect(saved.checkpoint).toMatchObject({seed:old.seed,itemOrder:old.itemOrder,readStepIds:old.readStepIds,formId:old.formId});
  for(const pack of before.packs)expect(after.packs.find(row=>row.key===pack.key)).toEqual(pack);
  for(const curriculum of before.curricula)expect(after.curricula.find(row=>row.key===curriculum.key)).toEqual(curriculum);
  expect(after.curricula).toHaveLength(LIBRARY_CURRICULA.length);expect(after.profiles[0].learningSettings.enrollments).toEqual(pinned.learningSettings.enrollments);
});
