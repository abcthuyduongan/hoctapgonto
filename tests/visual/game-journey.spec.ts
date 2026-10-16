import {expect,test,type Page} from '@playwright/test';
import {BUILTIN_PACKS} from '../../src/core/seed';
import {sampleGameJourney,JOURNEY_SUBJECTS} from '../../src/core/game-journey';
import type {PairsPack,SentencePack} from '../../src/core/contracts';

test.use({serviceWorkers:'block'});
const parent=(page:Page)=>page.getByRole('region',{name:'Lộ trình ôn qua game',exact:true});
async function applySample(page:Page){
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();
  await parent(page).getByRole('button',{name:'Áp dụng lộ trình',exact:true}).click();
  await expect(parent(page).getByText('Đã áp dụng lộ trình.',{exact:false})).toBeVisible();
}
async function goWorld(page:Page){await page.getByRole('button',{name:'Thế giới game',exact:true}).click();}
async function selectCharacter(page:Page,id:string){
  const canvas=page.getByRole('img',{name:/Điều khiển Cáo/});
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state','ready');
  await canvas.focus();
  for(let index=0;index<6;index++){
    const selected=await page.locator('.ba3d-render-host').evaluate(host=>JSON.parse((host as HTMLElement).dataset.diagnostics??'{}').selectedWorld);
    if(selected===id)break;await page.keyboard.press('ArrowRight');
    await expect.poll(()=>page.locator('.ba3d-render-host').evaluate(host=>JSON.parse((host as HTMLElement).dataset.diagnostics??'{}').selectedWorld)).not.toBe(selected);
    await expect.poll(()=>page.locator('.ba3d-render-host').evaluate(host=>JSON.parse((host as HTMLElement).dataset.diagnostics??'{}').carouselMoving)).toBe(false);
  }
  await expect.poll(()=>page.locator('.ba3d-render-host').evaluate(host=>JSON.parse((host as HTMLElement).dataset.diagnostics??'{}').mascotLocation)).toBe(id);
  await page.keyboard.press('Enter');
}
async function finishPairsQuiz(page:Page,pack:PairsPack,wrong=0){
  for(const [index,item]of pack.items.entries()){
    await expect(page.locator('.quiz-question')).toContainText(item.left);
    if(index<wrong)await page.locator('.answer-option').filter({hasNot:page.getByText(item.right,{exact:true})}).first().click();
    else await page.locator('.answer-option').filter({has:page.getByText(item.right,{exact:true})}).click();
    await page.locator('.result-next').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
}
async function returnHome(page:Page){await page.locator('.reward-home').click();await expect(page.locator('.immersive-dialog')).toHaveCount(0);}
async function finishOrder(page:Page,pack:SentencePack){
  for(const item of pack.items){
    for(const word of item.words)await page.locator('.sentence-bank').getByRole('button',{name:word,exact:true}).click();
    await page.locator('.sentence-main-action').click();await expect(page.locator('.sentence-result-reserve')).toContainText('Chính xác');
    await page.locator('.sentence-main-action').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
}
test('Character entry uses one source pack across islands, preserves three-star maximum and gives an island introduction',async({page})=>{
  test.setTimeout(150_000);await page.goto('/');await applySample(page);await goWorld(page);
  await expect(page.locator('.game-journey-brief')).toContainText('Tuần 1');
  await expect(page.locator('.ba3d-island-picker,.game-hub-bottom')).toHaveCount(0);
  await selectCharacter(page,'sentence-builder');await expect(page.locator('.immersive-dialog')).toHaveCount(0);
  await expect(page.locator('.game-character-hint')).toContainText('Xưởng Ghép Câu');
  await expect(page.locator('.game-character-hint')).toContainText('Bộ này chơi được ở:');
  await selectCharacter(page,'math-quest');
  const source=BUILTIN_PACKS.find(pack=>pack.id==='math3-equations') as PairsPack;
  await expect(page.locator('.game-dialog-head h2')).toHaveText(source.title);
  await finishPairsQuiz(page,source);await expect(page.locator('.game-star-receipt')).toContainText('+3 sao mới');
  await returnHome(page);await expect(page.locator('.game-journey-brief')).toContainText('Tiếng Việt');
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();
  await parent(page).getByRole('button',{name:'Cho con ôn Toán chặng 1',exact:true}).click();
  await expect(parent(page).locator('.journey-current')).toContainText('Toán');await goWorld(page);
  await selectCharacter(page,'word-connect');
  for(const item of source.items){await page.getByRole('button',{name:`Thẻ A: ${item.left}`,exact:true}).click();await page.getByRole('button',{name:`Thẻ B: ${item.right}`,exact:true}).click();}
  await expect(page.locator('.game-star-receipt')).toContainText('không cộng lặp');await returnHome(page);
  await expect(page.getByRole('button',{name:'Ví đổi sao',exact:true})).toContainText('3 sao');
  await page.reload();await expect(page.locator('.game-journey-brief')).toContainText('Toán');
  const sessions=await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open('bao-an-learning-v3-alpha');request.onsuccess=()=>resolve(request.result);});
    try{return await new Promise<any[]>(resolve=>{const tx=db.transaction('sessions','readonly'),request=tx.objectStore('sessions').getAll();tx.oncomplete=()=>resolve(request.result);});}finally{db.close();}
  });
  expect(sessions.filter(s=>s.status==='completed')).toHaveLength(2);
  expect(sessions.every(s=>s.packId===source.id&&s.contentVersion===1&&s.presentationVersion===1)).toBe(true);
});
test('Finishing the three subjects unlocks week two, then completing the basics unlocks advanced',async({page})=>{
  test.setTimeout(180_000);await page.goto('/?controls=1');await applySample(page);
  await expect(parent(page).getByRole('button',{name:'Cho con ôn Toán chặng 2',exact:true})).toBeDisabled();
  await expect(parent(page).getByRole('button',{name:'Cho con ôn Toán chặng 3',exact:true})).toBeDisabled();
  await goWorld(page);const journey=sampleGameJourney();
  for(const [stageIndex,stage]of journey.stages.slice(0,2).entries()){
    for(const subject of JOURNEY_SUBJECTS){
      const pack=BUILTIN_PACKS.find(p=>p.id===stage.packs[subject].packId)!;
      await page.getByRole('button',{name:pack.kind==='pairs'?'Chọn Đảo Toán Học':'Chọn Xưởng Ghép Câu',exact:true}).click();
      await page.locator('.ba3d-play').click();
      if(pack.kind==='pairs')await finishPairsQuiz(page,pack,1); // 5/6 = 2 stars, enough to progress.
      else await finishOrder(page,pack as SentencePack);
      await returnHome(page);
    }
    await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();
    await expect(parent(page).getByRole('button',{name:`Cho con ôn Toán chặng ${stageIndex+2}`,exact:true})).toBeEnabled();
    if(stageIndex===0)await expect(parent(page).getByRole('button',{name:'Cho con ôn Toán chặng 3',exact:true})).toBeDisabled();
    await goWorld(page);
  }
  await expect(page.locator('.game-journey-brief')).toContainText('Nâng cao');
  await page.reload();await expect(page.locator('.game-journey-brief')).toContainText('Nâng cao');
});
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:640}])test(`Weekly parent setup and character hints fit ${viewport.width}px`,async({page},testInfo)=>{
  await page.setViewportSize(viewport);await page.goto('/');await applySample(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await parent(page).screenshot({path:`test-results/journey-parent-${viewport.width}.png`});
  await goWorld(page);await selectCharacter(page,'sentence-builder');
  for(const selector of ['.game-journey-brief','.game-character-hint','.game-world-help > summary','.game-wallet-button','.ba3d-overview-reset']){
    const box=await page.locator(selector).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+1);
    expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height+1);
  }
  const top=await page.locator('.game-journey-brief').boundingBox(),reset=await page.locator('.ba3d-overview-reset').boundingBox();
  expect(reset!.y).toBeGreaterThanOrEqual(top!.y+top!.height);
  const screenshot=await page.screenshot({path:`test-results/journey-${viewport.width}.png`});await testInfo.attach('weekly-world',{body:screenshot,contentType:'image/png'});
});
