import {test,expect} from '@playwright/test';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

for(const game of ['sentence-builder','sequence-trail'])test(`${game} waits for the server hint receipt and charges one star`,async({page})=>{
 const f=await cloudBrowserFixture();let releaseHint:(()=>void)|undefined;
 try{
  async function api(route:string,data?:unknown){const me=data&&!['/setup','/login'].includes(route)?await(await page.request.get(f.origin+'/api/online/me')).json():null;const r=data?await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})},data}):await page.request.get(f.origin+'/api/online'+route);expect(r.ok(),await r.text()).toBe(true);return r.json();}
  await api('/setup',{token:f.token,name:'Hint fixture',username:'hint.admin',password:f.password});const cls=await api('/classes',{name:'Lớp gợi ý',grade:3});await api('/students',{name:'An',classId:cls.id,username:'hint.child',password:f.password});
  const base={version:1,grade:3,subject:'thinking',source:'local',publishedAt:'2026-10-17T00:00:00.000Z'};
  const math={...base,id:'hint-math',kind:'quiz',title:'Toán',items:[1,2].map(i=>({id:'hint-math-'+i,kind:'multiple-choice',objectiveId:'HINT.MATH',prompt:`${i} cộng hai?`,options:[String(i+2),'100','101','102'],correctIndex:0,explanation:'Cộng thêm hai.'}))};
  const vi={...base,id:'hint-viet',kind:'sentences',title:'Ghép câu tiếng Việt',items:[['Em','chăm','học'],['Tôi','yêu','sách']].map((words,i)=>({id:'hint-vi-'+i,kind:'sentence',objectiveId:'HINT.VI',prompt:'Sắp xếp thành câu '+i,words,hint:'Đặt chủ ngữ ở đầu câu '+i+'.'}))};
  const en={...vi,id:'hint-english',title:'Xếp câu tiếng Anh',items:[['Birds','can','fly'],['We','read','books']].map((words,i)=>({id:'hint-en-'+i,kind:'sentence',objectiveId:'HINT.EN',prompt:'Xếp đúng thứ tự '+i,words,hint:'Đặt chủ ngữ ở đầu câu '+i+'.'}))};
  await api('/weeks',{requestId:'hint-week',classId:cls.id,title:'Tuần 01',sets:[{subjectLabel:'Toán',pack:math},{subjectLabel:'Tiếng Việt',pack:vi},{subjectLabel:'Tiếng Anh',pack:en}]});
  await page.context().clearCookies();await api('/login',{username:'hint.child',password:f.password});await page.goto(f.origin+'/?online=1&controls=1');
  const pack=game==='sentence-builder'?vi:en,set=page.locator('.online-week-path > li > ul > li').filter({hasText:pack.title}),details=set.locator('details');if(await details.getAttribute('open')===null)await details.locator('summary').click();
  await set.getByRole('button',{name:'Chọn trò để học hoặc ôn lại',exact:true}).click();await set.getByRole('combobox').selectOption(game);
  const starting=page.waitForResponse(r=>r.url().endsWith('/api/online/play/compact'));await set.getByRole('button',{name:/^Học bộ này ·/}).click();const started=await(await starting).json();expect(started.presentation.items.every((item:any)=>!Object.hasOwn(item,'hint'))).toBe(true);
  const hintButton=page.getByRole('button',{name:'💡 Gợi ý',exact:true}),checkButton=page.locator(game==='sentence-builder'?'.sentence-main-action':'.trail-main-action'),bank=page.locator(game==='sentence-builder'?'.sentence-bank':'.trail-bank');
  await expect(hintButton).toBeVisible();for(const word of pack.items[0].words)await bank.getByRole('button',{name:word,exact:true}).click();await expect(checkButton).toBeEnabled();
  await page.route('**/api/online/play/*/question-hint',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Gợi ý chưa lưu, hãy thử lại.'})}),{times:1});
  await hintButton.click();await expect(page.getByRole('alert')).toContainText('Gợi ý chưa lưu');await expect(page.getByText(pack.items[0].hint,{exact:false})).toHaveCount(0);await expect(hintButton).toBeEnabled();
  const pending=new Promise<void>(resolve=>{releaseHint=resolve;});let receiptReady=false;
  await page.route('**/api/online/play/*/question-hint',async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);receiptReady=true;await pending;await route.fulfill({response});},{times:1});
  await hintButton.click();await expect.poll(()=>receiptReady).toBe(true);await expect(checkButton).toBeDisabled();await expect(hintButton).toBeDisabled();expect((await f.pool.query('SELECT count(*)::int AS n FROM bao_an.attempts')).rows[0].n).toBe(0);await expect(page.getByText(pack.items[0].hint,{exact:false})).toHaveCount(0);
  releaseHint();releaseHint=undefined;await expect(page.getByText(pack.items[0].hint,{exact:false})).toBeVisible();await expect(checkButton).toBeEnabled();
  const answering=page.waitForResponse(r=>r.url().endsWith('/attempt'));await checkButton.click();const result=await(await answering).json();expect(result.event.hintsUsed).toBe(1);expect(result.event.correct).toBe(true);expect(result.questionRewards.questions[0].tier).toBe(2);
  const stored=(await f.pool.query('SELECT json FROM bao_an.awards WHERE pack_id=$1',[pack.id])).rows[0].json;expect(stored.questionLedger.questionTiers[pack.items[0].id]).toBe(2);
 }finally{releaseHint?.();await page.unrouteAll({behavior:'wait'});await f.close();}
});
