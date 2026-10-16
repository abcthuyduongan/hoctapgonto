import { expect, test, type Page } from '@playwright/test';
import { BUILTIN_PACKS } from '../../src/core/seed';
import type { LearningEvent, PlaySession, QuizPack, PairsPack, SentencePack, ModuleId } from '../../src/core/contracts';

test.use({serviceWorkers:'block'});
const islands:Record<ModuleId,string>={'math-quest':'Đảo Toán Học','memory-match':'Khu Rừng Trí Nhớ','sentence-builder':'Xưởng Ghép Câu','word-connect':'Đảo Nối Từ','sequence-trail':'Bậc Thang Quy Luật'};
const defaultPacks:Record<ModuleId,string>={'math-quest':'math3-adventure','memory-match':'english3-family','sentence-builder':'english3-sentences','word-connect':'english3-family','sequence-trail':'logic3-sequence'};
const picker=(page:Page)=>page.getByRole('navigation',{name:'Chọn đảo học tập'}).getByRole('button');
async function prompt(page:Page,selector:string,text:string){
  await expect.poll(()=>page.locator(selector).evaluate(element=>{
    const copy=element.cloneNode(true) as HTMLElement;copy.querySelectorAll('button').forEach(button=>button.remove());return copy.textContent?.trim();
  })).toBe(text);
}

// These reads inspect the actual production origin's IndexedDB. The application
// creates its own database and sessions; tests never replace the storage adapter.
async function history(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const read = (name: string) => new Promise<unknown[]>((resolve, reject) => {
        const transaction = db.transaction(name, 'readonly');
        const request = transaction.objectStore(name).getAll();
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
      });
      const [sessions, events, packs] = await Promise.all([read('sessions'), read('events'), read('packs')]);
      return { sessions, events, packs, version: db.version, stores: [...db.objectStoreNames] };
    } finally { db.close(); }
  }) as Promise<{ sessions: PlaySession[]; events: LearningEvent[]; packs: { key: string; pack: QuizPack }[]; version: number; stores: string[] }>;
}

async function openGame(page: Page, moduleId: ModuleId,packId=defaultPacks[moduleId]) {
  await page.getByRole('button',{name:`Chọn ${islands[moduleId]}`,exact:true}).click();
  await page.locator(`#ba3d-pack-${moduleId}`).selectOption(`${packId}@1`);
  await page.locator(`.ba3d-${moduleId} .ba3d-play`).click();
  await expect(page.locator('.immersive-dialog')).toBeVisible();
}

async function assertCompleted(page: Page, moduleId: string, packId: string, itemCount: number, eventCount = itemCount) {
  await expect(page.locator('.reward-panel')).toBeVisible();
  const saved = await history(page);
  expect(saved.version).toBe(4);
  expect(saved.stores).toEqual(['curricula', 'events', 'lessonProgress', 'packs', 'profiles', 'reviews', 'sessionResults', 'sessions']);
  expect(saved.sessions).toHaveLength(1);
  const session = saved.sessions[0];
  expect(session).toMatchObject({ moduleId, packId, contentVersion: 1, status: 'completed',profileId:'default-learner' });
  expect(Date.parse(session.endedAt!)).toBeGreaterThanOrEqual(Date.parse(session.startedAt));
  expect(saved.events).toHaveLength(eventCount);
  expect(new Set(saved.events.map(event => event.eventId)).size).toBe(eventCount);
  expect(saved.events.filter(event => event.correct)).toHaveLength(itemCount);
  saved.events.forEach(event => {
    expect(event).toMatchObject({ sessionId: session.sessionId, moduleId, packId, contentVersion: 1, moduleVersion: session.moduleVersion,profileId:session.profileId });
    expect(event.itemId).not.toBe('');
    expect(event.objectiveId).not.toBe('');
    expect(event.elapsedMs).toBeGreaterThanOrEqual(0);
  });
  await page.locator('.reward-home').click();
  await page.reload();
  await expect(picker(page)).toHaveCount(5);
  const refreshed = await history(page);
  expect(refreshed.sessions).toEqual(saved.sessions);
  expect(refreshed.events).toEqual(saved.events);
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(page.locator('.screen-space')).toBeVisible();
  return saved;
}

test('Math Quest completes all 8 answers once, including rapid answer/next clicks, and persists after refresh', async ({ page }) => {
  const pack = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  expect(pack.items).toHaveLength(8);
  await page.goto('/?premium3d=1&controls=1');
  await openGame(page, 'math-quest');
  for (let index = 0; index < pack.items.length; index++) {
    const item = pack.items[index];
    await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
    const answer = page.locator('.answer-option').nth(item.correctIndex);
    if (index === 0) await answer.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    else await answer.click();
    await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
    expect((await history(page)).events).toHaveLength(index + 1);
    const next = page.locator('.result-next');
    if (index === 0) await next.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    else await next.click();
  }
  await assertCompleted(page, 'math-quest', pack.id, pack.items.length);
});

test('Memory Match recovers from rapid mismatched taps, completes 6 pairs and preserves exactly 7 attempts', async ({ page }) => {
  const pack = BUILTIN_PACKS.find(pack => pack.id === 'english3-family') as PairsPack;
  expect(pack.items).toHaveLength(6);
  await page.goto('/?premium3d=1&controls=1');
  await openGame(page, 'memory-match');
  await expect(page.locator('.memory-card')).toHaveCount(12);
  const card = (label: string) => page.locator('.memory-card').filter({ has: page.getByText(label, { exact: true }) });
  const indices = await page.locator('.memory-front').allTextContents();
  await page.locator('.memory-grid').evaluate((grid, chosen) => {
    const cards = [...grid.querySelectorAll<HTMLButtonElement>('.memory-card')];
    cards[chosen[0]].click(); cards[chosen[0]].click();
    cards[chosen[1]].click(); cards[chosen[2]].click();
  }, [indices.indexOf(pack.items[0].left), indices.indexOf(pack.items[1].left), indices.indexOf(pack.items[2].left)]);
  await expect(page.locator('.memory-feedback-message')).toContainText(/chưa khớp/i);
  await expect(page.locator('.memory-card:not(:disabled)')).toHaveCount(12);
  expect((await history(page)).events).toHaveLength(1);
  for (let index = 0; index < pack.items.length; index++) {
    const pair = pack.items[index];
    await card(pair.left).click();
    await card(pair.right).click();
    await expect(page.locator('.memory-card.found')).toHaveCount((index + 1) * 2);
  }
  await assertCompleted(page, 'memory-match', pack.id, pack.items.length, 7);
});

test('Sentence Builder completes the actual 6-sentence seed, rejects invalid drag indices and persists', async ({ page }) => {
  const pack = BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences') as SentencePack;
  // The plan mentions 5 sentences; the preserved V3.6.2 seed contains 6.
  expect(pack.items).toHaveLength(6);
  await page.goto('/?premium3d=1&controls=1');
  await openGame(page, 'sentence-builder');
  for (const value of ['-1', '999', '0.5', 'abc']) {
    await page.locator('.sentence-drop').evaluate((drop, raw) => {
      const dataTransfer = new DataTransfer(); dataTransfer.setData('text/plain', raw);
      drop.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    }, value);
  }
  await expect(page.locator('.sentence-drop .word-tile')).toHaveCount(0);
  for (const item of pack.items) {
    await prompt(page,'.sentence-prompt',item.prompt);
    for (const word of item.words) await page.locator('.sentence-bank').getByRole('button', { name: word, exact: true }).click();
    await page.getByRole('button', { name: /Kiểm tra câu/ }).click();
    await expect(page.locator('.sentence-result-reserve')).toContainText('Chính xác');
    await page.locator('.sentence-main-action').click();
  }
  await assertCompleted(page, 'sentence-builder', pack.id, pack.items.length);
});

test('Refreshing an active game abandons its session without losing the recorded answer', async ({ page }) => {
  await page.goto('/?premium3d=1&controls=1');
  await openGame(page, 'math-quest');
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.result-next')).toBeVisible();
  const prior = await history(page);
  expect(prior.sessions[0].status).toBe('active');
  await page.reload();
  await expect(picker(page)).toHaveCount(5);
  await expect.poll(async()=>(await history(page)).sessions[0].status).toBe('abandoned');
  const saved = await history(page);
  expect(saved.sessions[0]).toMatchObject({ sessionId: prior.sessions[0].sessionId, status: 'abandoned' });
  expect(saved.events).toEqual(prior.events);
  await openGame(page, 'math-quest');
  await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  expect((await history(page)).sessions.map(session => session.status)).toEqual(['abandoned', 'abandoned']);
});

test('Closing and reopening a tab on the same origin preserves the answer and abandons the interrupted session', async ({ page, context }) => {
  await page.goto('/?premium3d=1&controls=1');
  await openGame(page, 'math-quest');
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.result-next')).toBeVisible();
  const beforeClose = await history(page);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/?premium3d=1&controls=1');
  await expect(picker(reopened)).toHaveCount(5);
  await expect.poll(async()=>(await history(reopened)).sessions[0].status).toBe('abandoned');
  const saved = await history(reopened);
  expect(saved.events).toEqual(beforeClose.events);
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0]).toMatchObject({ sessionId: beforeClose.sessions[0].sessionId, status: 'abandoned' });
  await openGame(reopened, 'math-quest');
  expect((await history(reopened)).sessions).toHaveLength(2);
});

test('A new teacher JSON pack imports through the UI, plays fully and survives refresh without overwriting', async ({ page }) => {
  const original = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  const pack: QuizPack = { ...original, id: 'qa-v37-quiz', title: 'QA V3.7 · Hai câu toán mới', source: 'local', items: [
    { ...original.items[0], id: 'qa-new-1', prompt: '11 + 12 = ?', options: ['22', '23', '24', '25'], correctIndex: 1, explanation: '11 + 12 = 23.' },
    { ...original.items[1], id: 'qa-new-2', prompt: '6 × 5 = ?', options: ['25', '35', '30', '40'], correctIndex: 2, explanation: '6 × 5 = 30.' },
  ] };
  const file = { name: 'qa-v37-content.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schema: 'baoan-learning-content', formatVersion: 1, packs: [pack] })) };
  await page.goto('/?premium3d=1&controls=1');
  await page.getByRole('button', { name: /Xưởng học liệu/ }).click();
  await page.getByLabel('Chọn tệp bộ học liệu JSON').setInputFiles(file);
  await expect(page.locator('.creator-workspace [role="status"]')).toContainText('Đã nhập 1 bộ mới');
  await page.getByLabel('Chọn tệp bộ học liệu JSON').setInputFiles(file);
  await expect(page.locator('.creator-workspace [role="status"]')).toContainText('Đã nhập 0 bộ mới');
  expect((await history(page)).packs).toHaveLength(1);
  await page.getByRole('button', { name: /Thế giới game/ }).click();
  await openGame(page, 'math-quest',pack.id);
  for (const item of pack.items) {
    await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
    await page.locator('.answer-option').nth(item.correctIndex).click();
    await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
    await page.locator('.result-next').click();
  }
  await assertCompleted(page, 'math-quest', pack.id, pack.items.length);
  expect((await history(page)).packs[0]).toMatchObject({ key: `${pack.id}@1`, pack: { id: pack.id, version: 1, items: pack.items } });
});

test('Word Connect records a wrong pair, completes all matching pairs and persists isolated profile evidence', async ({page})=>{
  const pack=BUILTIN_PACKS.find(pack=>pack.id==='english3-family') as PairsPack;
  await page.goto('/?view=games&controls=1');await openGame(page,'word-connect');
  const card=(side:'A'|'B',label:string)=>page.getByRole('button',{name:`Thẻ ${side}: ${label}`,exact:true});
  await card('A',pack.items[0].left).click();await card('B',pack.items[1].right).click();
  await expect(page.locator('.connect-card:not(:disabled)')).toHaveCount(pack.items.length*2);
  expect((await history(page)).events).toHaveLength(1);
  for(let index=0;index<pack.items.length;index++){
    await card('A',pack.items[index].left).click();await card('B',pack.items[index].right).click();
    await expect(page.locator('.connect-card.matched')).toHaveCount((index+1)*2);
  }
  await assertCompleted(page,'word-connect',pack.id,pack.items.length,pack.items.length+1);
});

test('Sequence Trail retries a wrong order, rejects invalid drop indices and preserves every committed attempt', async({page})=>{
  const pack=BUILTIN_PACKS.find(pack=>pack.id==='logic3-sequence') as SentencePack;
  await page.goto('/?view=games&controls=1');await openGame(page,'sequence-trail');
  for(const value of ['-1','999','0.5','abc']){
    await page.locator('.trail-mountain').evaluate((mountain,raw)=>{
      const dataTransfer=new DataTransfer();dataTransfer.setData('text/plain',raw);
      mountain.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer}));
    },value);
  }
  await expect(page.locator('.trail-tile.placed')).toHaveCount(0);
  for(const word of [...pack.items[0].words].reverse())await page.locator('.trail-bank').getByRole('button',{name:word,exact:true}).click();
  await page.getByRole('button',{name:/Kiểm tra quy luật/}).click();
  await expect(page.locator('.trail-result-reserve')).toContainText('Chưa đúng');
  await page.locator('.trail-main-action').click();
  for(const item of pack.items){
    await prompt(page,'.trail-prompt',item.prompt);
    for(const word of item.words)await page.locator('.trail-bank').getByRole('button',{name:word,exact:true}).click();
    await page.getByRole('button',{name:/Kiểm tra quy luật/}).click();
    await expect(page.locator('.trail-result-reserve')).toContainText('Chính xác');
    await page.locator('.trail-main-action').click();
  }
  await assertCompleted(page,'sequence-trail',pack.id,pack.items.length,pack.items.length+1);
});

test('Database v1 migrates to eight stores while keeping its existing pack, session and event unchanged',async({page})=>{
  const builtin=BUILTIN_PACKS.find(pack=>pack.id==='math3-adventure') as QuizPack;
  const local:QuizPack={...builtin,id:'qa-v1-preserved',title:'QA legacy data',source:'local'};
  const session:PlaySession={sessionId:'qa-v1-session',packId:local.id,contentVersion:1,moduleId:'math-quest',moduleVersion:'1.0.0',startedAt:'2026-10-12T01:00:00.000Z',endedAt:'2026-10-12T01:01:00.000Z',status:'completed'};
  const event:LearningEvent={eventId:'qa-v1-event',sessionId:session.sessionId,packId:local.id,contentVersion:1,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId:local.items[0].id,objectiveId:local.items[0].objectiveId,correct:true,hintsUsed:0,elapsedMs:1000,occurredAt:'2026-10-12T01:00:30.000Z'};
  // A real blank page establishes the production origin before the application opens its database.
  await page.route('**/qa-v1-origin',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Migration fixture</title>'}));
  await page.goto('/qa-v1-origin');
  await page.evaluate(async fixture=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('bao-an-learning-v3-alpha',1);
      request.onupgradeneeded=()=>{
        request.result.createObjectStore('packs',{keyPath:'key'});request.result.createObjectStore('sessions',{keyPath:'sessionId'});request.result.createObjectStore('events',{keyPath:'eventId'});
      };
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    try{await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['packs','sessions','events'],'readwrite');
      tx.objectStore('packs').add({key:`${fixture.local.id}@1`,pack:fixture.local});tx.objectStore('sessions').add(fixture.session);tx.objectStore('events').add(fixture.event);
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },{local,session,event});
  await page.goto('/?view=games&controls=1');await expect(picker(page)).toHaveCount(5);
  await expect.poll(async()=>(await history(page)).version).toBe(4);
  const migrated=await history(page);
  expect(migrated.stores).toEqual(['curricula','events','lessonProgress','packs','profiles','reviews','sessionResults','sessions']);
  expect(migrated.packs).toEqual([{key:`${local.id}@1`,pack:local}]);expect(migrated.sessions).toEqual([session]);expect(migrated.events).toEqual([event]);
  await page.getByRole('button',{name:'Chọn Đảo Toán Học',exact:true}).click();
  await expect(page.locator(`#ba3d-pack-math-quest option[value="${local.id}@1"]`)).toContainText('QA legacy data');
});
