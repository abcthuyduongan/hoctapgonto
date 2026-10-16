import { test,expect } from '@playwright/test';
import { rows,readCards,answer,advancedLearningPath } from './helpers/self-study';
test.use({serviceWorkers:'block'});
test('BA11: actual UI earns 1→2→3 stars, unlocks prerequisite and keeps passed separate from review due',async({page})=>{
  await page.clock.install({time:new Date(Date.now()+3_600_000)});
  await page.goto(advancedLearningPath);const card=page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'}),next=page.getByRole('article',{name:'Bài Giải bài toán một bước'});
  await expect(card.getByRole('button',{name:'Học bài này'})).toBeEnabled();await expect(next.getByRole('button',{name:'Học bài này'})).toBeDisabled();
  await card.getByRole('button',{name:'Học bài này'}).click();await expect(page.getByRole('button',{name:'Đổi hồ sơ học sinh'})).toBeDisabled();await answer(page,true);
  expect((await rows(page)).sessionResults[0]).toMatchObject({starTier:1,firstAttemptCorrect:7,practiceCorrected:true});await expect(next.getByRole('button',{name:'Học bài này'})).toBeDisabled();
  await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự mình thử sức'}).click();await answer(page);
  await expect(next.getByRole('button',{name:'Học bài này'})).toBeEnabled();await expect(card.getByText('Đã vượt qua',{exact:true})).toBeVisible();
  await expect(card.getByRole('button',{name:'Ôn nhận sao thứ ba'})).toHaveCount(0);
  const db=await rows(page),eligible=db.lessonProgress[0].reviewEligibleAt;
  await page.clock.setSystemTime(new Date(Date.parse(eligible)+60_000));await page.clock.runFor(61_000);
  await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Ôn nhận sao thứ ba'}).click();await answer(page);
  await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('3');await expect(card.getByText('Đã vượt qua',{exact:true})).toBeVisible();
  expect((await rows(page)).sessionResults.sort((a,b)=>a.completedAt.localeCompare(b.completedAt)).map(row=>row.starTier)).toEqual([1,2,3]);
  await page.reload();await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('3');await expect(next.getByRole('button',{name:'Học bài này'})).toBeEnabled();
});
test('BA11: pause and reload preserve exact form and receipt; another tab cannot take over a live lesson',async({page,context})=>{
  await page.goto(advancedLearningPath);await page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'}).getByRole('button',{name:'Học bài này'}).click();
  await readCards(page);await page.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').first().click();await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();
  const before=(await rows(page)).sessions.find(row=>row.status==='active'&&row.mode),other=await context.newPage();await other.goto(advancedLearningPath);
  await other.getByRole('button',{name:'Tiếp tục bài đang học'}).click();await expect(other.getByRole('alert')).toContainText('tab khác');expect((await rows(other)).sessions.find(row=>row.sessionId===before.sessionId).status).toBe('active');
  await page.reload();await page.getByRole('button',{name:'Tiếp tục bài đang học'}).click();
  const resumed=(await rows(page)).sessions.find(row=>row.sessionId===before.sessionId);
  expect(resumed.checkpoint).toMatchObject({formId:before.formId,seed:before.checkpoint.seed,itemOrder:before.checkpoint.itemOrder,receipts:before.checkpoint.receipts,readStepIds:before.checkpoint.readStepIds});
  await page.getByRole('button',{name:'Tạm dừng và lưu',exact:false}).click();expect((await rows(page)).sessions.find(row=>row.sessionId===before.sessionId).status).toBe('paused');
});
for(const width of [320,390])test(`BA11: ${width}px has usable DOM subjects, reading cards and touch controls without overflow`,async({page})=>{
  await page.setViewportSize({width,height:780});await page.goto(advancedLearningPath);await expect(page.getByRole('navigation',{name:'Chọn môn tự học'})).toBeVisible();
  for(const subject of ['Toán','Tiếng Việt','Tiếng Anh']){await page.getByRole('button',{name:subject,exact:true}).click();await expect(page.getByRole('button',{name:'Học bài này'}).first()).toBeEnabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.getByRole('button',{name:'Học bài này'}).first().click();const read=page.getByRole('button',{name:'Con đã đọc xong'});await expect(read).toBeVisible();
  expect((await read.boundingBox())!.height).toBeGreaterThanOrEqual(44);await read.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'Gia đình của con',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('BA11: guided practice hint retains stars and a failed first assessment uses a fresh form',async({page})=>{
  await page.goto(advancedLearningPath);const card=page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'});await card.getByRole('button',{name:'Học bài này'}).click();await answer(page);
  await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự mình thử sức'}).click();
  await expect(page.getByRole('button',{name:'Con cần gợi ý'})).toBeVisible();
  const first=(await rows(page)).sessions.find(row=>row.status==='active'&&row.mode);
  await page.getByRole('button',{name:'Con cần gợi ý'}).click();await page.getByRole('button',{name:'Con tự làm tiếp'}).click();
  expect((await rows(page)).sessions.find(row=>row.sessionId===first.sessionId).mode).toBe('lesson-assessment');
  await page.getByRole('button',{name:'Con cần gợi ý'}).click();await page.getByRole('button',{name:'Chuyển sang luyện và xem gợi ý'}).click();await answer(page);
  await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('1');
  await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự mình thử sức'}).click();
  await expect(page.getByRole('button',{name:'Con cần gợi ý'})).toBeVisible();
  const second=(await rows(page)).sessions.find(row=>row.status==='active'&&row.mode);expect(second.formId).not.toBe(first.formId);
});
test('BA11: stars and learning checkpoints belong to the selected profile',async({page})=>{
  await page.goto(advancedLearningPath);await page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'}).getByRole('button',{name:'Học bài này'}).click();await answer(page);
  await page.getByRole('button',{name:'Đổi hồ sơ học sinh'}).click();await page.getByRole('button',{name:'+ Thêm hồ sơ cho bé khác'}).click();
  await page.getByLabel('Tên gọi của bé').fill('Hồ sơ thứ hai');await page.getByRole('button',{name:'Tạo hồ sơ',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Chào Hồ sơ thứ hai!'})).toBeVisible();await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('0');
  await expect(page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'}).getByRole('button',{name:'Học bài này'})).toBeEnabled();
  await page.getByRole('button',{name:'Đổi hồ sơ học sinh'}).click();await page.getByRole('button',{name:/Bé Học Giỏi Lớp 3/}).click();
  await expect(page.getByRole('status',{name:'Sao bài học'})).toContainText('1');
  await page.getByRole('button',{name:'Thế giới game',exact:true}).click();await page.getByRole('button',{name:'Chọn Đảo Toán Học',exact:true}).click();
  const choices=await page.locator('#ba3d-pack-math-quest option').allTextContents();expect(choices.some(label=>label.includes('Kiểm tra')||label.includes('· Ôn'))).toBe(false);
  await expect(page.getByRole('button',{name:'Ví đổi sao',exact:true})).toContainText('1 sao');
});
