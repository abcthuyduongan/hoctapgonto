import { readFile } from 'node:fs/promises';
import { expect,test } from '@playwright/test';
import { rows,answer,advancedLearningPath,advancedGamesPath } from './helpers/self-study';
import { parseLearningBackup } from '../../src/core/backup-io';
import { BUILTIN_PACKS } from '../../src/core/seed';
test.use({serviceWorkers:'block'});
async function home(page:any){await page.goto(advancedLearningPath);await expect(page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'}).getByRole('button',{name:'Học bài này',exact:true})).toBeEnabled();}
test('BA14: parent settings and a manual unlock preserve zero stars, affect the child UI and survive backup',async({page})=>{
  await home(page);await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const panel=page.getByRole('region',{name:'Tiến độ tự học'});
  await panel.getByLabel('Bộ sách / ghi chú bài đang học').fill('Toán lớp 3 · Kết nối tri thức');await panel.getByLabel('Chữ lớn khi mở bài').check();await panel.getByLabel('Giảm chuyển động',{exact:true}).check();await panel.getByLabel('Cho phép công cụ đọc hướng dẫn/đề').uncheck();
  await panel.getByRole('button',{name:'Lưu cài đặt học',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Đã lưu cài đặt');
  const open=panel.getByRole('form',{name:'Mở bài cho con thử'});await open.getByLabel('Bài cần mở').selectOption('math-one-step');await open.getByLabel('Lý do mở bài').fill('Con đã học phần này ở trường');
  await open.getByRole('button',{name:'Mở bài và lưu lý do'}).click();await expect(panel.getByRole('status')).toContainText('Đã mở');
  const saved=await rows(page);expect(saved.sessionResults).toHaveLength(0);expect(saved.lessonProgress).toHaveLength(0);expect(saved.profiles[0].learningSettings.enrollments[0].manualUnlocks[0]).toMatchObject({lessonId:'math-one-step',reason:'Con đã học phần này ở trường'});
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Tải bản sao hồ sơ',exact:true}).click();const downloaded=await pending;
  const backup=parseLearningBackup(await readFile((await downloaded.path())!,'utf8'));expect(backup.profiles[0].learningSettings).toEqual(saved.profiles[0].learningSettings);
  await panel.getByRole('button',{name:'Mở trang tự học',exact:true}).click();const card=page.getByRole('article',{name:'Bài Giải bài toán một bước'});
  await expect(card.getByRole('button',{name:'Học bài này',exact:true})).toBeEnabled();await card.getByRole('button',{name:'Học bài này',exact:true}).click();
  await expect(page.getByRole('button',{name:'Chữ lớn',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'🔊 Đọc hướng dẫn'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.dataset.motion)).toBe('off');await page.getByRole('button',{name:/Tạm dừng và lưu/}).click();
  await page.reload();await expect(page.getByRole('button',{name:'Tiếp tục bài đang học',exact:true})).toBeVisible();await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();
  await expect(page.getByLabel('Bộ sách / ghi chú bài đang học')).toHaveValue('Toán lớp 3 · Kết nối tri thức');await expect(page.getByLabel('Chữ lớn khi mở bài')).toBeChecked();
});
test('BA14: due guided review preserves passed and independent review intervals; parent reads first score separately',async({page})=>{
  await page.clock.install({time:new Date(Date.now()+3_600_000)});await home(page);const card=page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'});
  await card.getByRole('button',{name:'Học bài này'}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự mình thử sức',exact:true}).click();await answer(page,false,1);
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const panel=page.getByRole('region',{name:'Tiến độ tự học'});
  await expect(panel.getByRole('article',{name:'Tổng sao tự học'})).toContainText('2 sao');await expect(panel.getByText(/Kiểm tra độc lập · 4\/5 đúng lượt đầu · Đạt/)).toBeVisible();
  await expect(panel.getByText('Cần xem lại 1 câu của bài này.',{exact:true})).toBeVisible();const before=await rows(page),eligible=before.lessonProgress[0].reviewEligibleAt;
  await page.clock.setSystemTime(new Date(Date.parse(eligible)+60_000));await page.clock.runFor(61_000);
  await expect(panel.getByRole('row').filter({hasText:'Vận dụng bảng nhân và chia'})).toContainText('Đã vượt qua');await expect(panel.getByRole('row').filter({hasText:'Vận dụng bảng nhân và chia'})).toContainText('Đến hạn ôn');
  await panel.getByRole('button',{name:'Mở trang tự học'}).click();const queue=page.getByRole('region',{name:'Câu đến hạn ôn luyện'});await expect(queue).toBeVisible();
  await queue.getByRole('button',{name:'Ôn luyện Vận dụng bảng nhân và chia',exact:true}).last().click();await answer(page);
  const after=await rows(page);expect(after.lessonProgress[0]).toMatchObject({passed:true,bestStars:2});expect(after.sessionResults.filter(row=>row.mode==='lesson-assessment')).toEqual(before.sessionResults.filter(row=>row.mode==='lesson-assessment'));
  for(const prior of before.reviews){const next=after.reviews.find(row=>row.cardId===prior.cardId);for(const field of ['repetitions','intervalDays','easeFactor','lastEvidenceDay','lastEvidenceSessionId'])expect(next[field],`${prior.cardId}: ${field}`).toEqual(prior[field]);}
  await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('2');await expect(card.getByText('Đã vượt qua',{exact:true})).toBeVisible();
});
test('BA14: a legacy wrong answer can be reviewed through its game without granting lesson stars',async({page})=>{
  const pack=BUILTIN_PACKS.find(row=>row.id==='math3-adventure')!;if(pack.kind!=='quiz')throw new Error('Expected math quiz');
  await page.goto(advancedGamesPath);await page.getByRole('button',{name:'Chọn Đảo Toán Học',exact:true}).click();await page.locator('.ba3d-math-quest .ba3d-play').click();
  await page.locator('.answer-option').nth((pack.items[0].correctIndex+1)%4).click();await expect(page.locator('.answer-feedback')).toBeVisible();await page.getByRole('button',{name:/Thoát trò chơi/}).click();
  await page.getByRole('button',{name:'Tự học',exact:true}).click();const queue=page.getByRole('region',{name:'Câu đến hạn ôn luyện'});
  await queue.getByRole('button',{name:`Luyện qua game: ${pack.title}`,exact:true}).click();await page.locator('.answer-option').nth(pack.items[0].correctIndex).click();await expect(page.locator('.answer-feedback')).toBeVisible();
  await page.getByRole('button',{name:/Thoát trò chơi/}).click();await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('0');await expect(queue).toHaveCount(0);
  const saved=await rows(page);expect(saved.events).toHaveLength(2);expect(saved.sessionResults).toHaveLength(0);expect(saved.lessonProgress).toHaveLength(0);
});
test('BA14: a parent write quota failure leaves profile, enrollment and stars unchanged',async({page})=>{
  await home(page);await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const open=page.getByRole('form',{name:'Mở bài cho con thử'});await open.getByLabel('Lý do mở bài').fill('Thử bài đã học');const before=await rows(page);
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value:any,...args:any[]){if(this.name==='profiles'){IDBObjectStore.prototype.put=original;throw new DOMException('BA14 quota','QuotaExceededError');}return original.call(this,value,...args);};});
  await open.getByRole('button',{name:'Mở bài và lưu lý do'}).click();await expect(page.getByRole('region',{name:'Tiến độ tự học'}).getByRole('alert')).toContainText('BA14 quota');expect(await rows(page)).toEqual(before);
  await open.getByRole('button',{name:'Mở bài và lưu lý do'}).click();await expect(page.getByRole('region',{name:'Tiến độ tự học'}).getByRole('status')).toContainText('Đã mở');
  expect((await rows(page)).lessonProgress).toHaveLength(0);
});
test('BA14: parent settings and progress switch with the selected learner at 390px',async({page})=>{
  await page.setViewportSize({width:390,height:844});await home(page);await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();
  await page.getByLabel('Bộ sách / ghi chú bài đang học').fill('Bộ sách của hồ sơ một');await page.getByRole('button',{name:'Lưu cài đặt học',exact:true}).click();await expect(page.getByRole('region',{name:'Tiến độ tự học'}).getByRole('status')).toContainText('Đã lưu');
  await page.getByRole('button',{name:'Đổi hồ sơ học sinh'}).click();await page.getByRole('button',{name:'+ Thêm hồ sơ cho bé khác'}).click();await page.getByLabel('Tên gọi của bé').fill('Bé thứ hai');await page.getByRole('button',{name:'Tạo hồ sơ',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tự học của Bé thứ hai',exact:true})).toBeVisible();await expect(page.getByLabel('Bộ sách / ghi chú bài đang học')).toHaveValue('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('article',{name:'Tổng sao tự học'})).toContainText('0 sao');
});
