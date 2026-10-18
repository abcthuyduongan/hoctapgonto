import path from 'node:path';
import {once} from 'node:events';
import {createServer,type Server} from 'node:http';
import {build} from 'esbuild';
import {expect,test,type Page} from '@playwright/test';

// Exercise the real game components with a deliberately delayed server-clock ACK.
// Reward arithmetic and server idempotency are covered by the store tests.
let server:Server,origin:string;
test.beforeAll(async()=>{
  const bundle=await build({stdin:{contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import MathQuest from './src/games/MathQuest';
    import OnlineExerciseRunner from './src/screens/OnlineExerciseRunner';
    import SentenceBuilder from './src/games/SentenceBuilder';
    import SequenceTrail from './src/games/SequenceTrail';
    import MemoryMatch from './src/games/MemoryMatch';
    import WordConnect from './src/games/WordConnect';
    const params=new URLSearchParams(location.search),kind=params.get('kind')||'quiz';
    const base={id:'clock-pack',version:1,title:'Kiểm tra đồng hồ',grade:3,subject:'vietnamese',source:'local',publishedAt:'2026-10-17T00:00:00.000Z'};
    const quiz={...base,kind:'quiz',items:[1,2].map(i=>({id:'clock-'+i,kind:'multiple-choice',objectiveId:'CLOCK',prompt:'Câu hỏi '+i,options:['Đúng','Sai','Khác','Không biết'],correctIndex:0,explanation:'Lời giải chỉ hiện sau khi đúng.'}))};
    const numeric={...base,kind:'learning',contentFormatVersion:2,passages:[],media:[],items:[{id:'clock-number',kind:'numeric-answer',objectiveId:'CLOCK',prompt:'Hai cộng hai bằng mấy?',answer:'4',hint:'Đếm thêm hai.',explanation:'Hai cộng hai bằng bốn.'}]};
    const listening={...base,kind:'learning',contentFormatVersion:2,passages:[],media:[],items:[{id:'clock-listening',kind:'listening-choice',objectiveId:'CLOCK',prompt:'Nghe và chọn.',audioId:'11111111-1111-4111-8111-111111111111',options:['Đúng','Sai','Khác','Không biết'],correctIndex:0,hint:'Nghe thật kỹ.',explanation:'Đáp án đúng là Đúng.'}]};
    const sentences={...base,kind:'sentences',items:[1,2].map(i=>({id:'order-'+i,kind:'sentence',objectiveId:'ORDER',prompt:'Xếp câu '+i,words:['Con','học','vui'],hint:'Bắt đầu bằng Con.'}))};
    const pairs={...base,kind:'pairs',items:[1,2,3].map(i=>({id:'pair-'+i,kind:'pair',objectiveId:'PAIR',left:'Trái '+i,right:'Phải '+i}))};
    let openFailures=Number(params.get('openFailure')||0),saveFailures=Number(params.get('saveFailure')||0),release=null;
    const harness=window.clockHarness={opens:[],attempts:[],committed:[],completed:0,exited:0,releaseClock(){release?.();},unmount(){root.unmount();}};
    async function onQuestionOpen(id){harness.opens.push(id);if(openFailures-->0)throw new Error('Mạng đang gián đoạn.');await new Promise(resolve=>release=resolve);const now=new Date().toISOString();return{openedAt:new Date(Date.parse(now)-20000).toISOString(),serverNow:now,threeStarMs:30000,twoStarMs:60000};}
    async function onAttempt(input){harness.attempts.push(structuredClone(input));if(saveFailures-->0)throw new Error('Chưa lưu được đáp án.');harness.committed.push(structuredClone(input));}
    const props={pack:kind==='quiz'||kind==='legacy'?quiz:kind==='listening'?listening:kind==='sentence'||kind==='sequence'?sentences:kind==='memory'||kind==='connect'?pairs:numeric,onAttempt,onQuestionOpen,questionMode:kind!=='legacy',onComplete:async()=>{harness.completed++;},onExit:()=>harness.exited++};
    const root=createRoot(document.getElementById('root'));
    const Component=kind==='quiz'||kind==='legacy'?MathQuest:kind==='sentence'?SentenceBuilder:kind==='sequence'?SequenceTrail:kind==='memory'?MemoryMatch:kind==='connect'?WordConnect:OnlineExerciseRunner;
    root.render(React.createElement(Component,props));
  `,resolveDir:path.resolve('.'),loader:'tsx'},bundle:true,write:false,outdir:'clock-harness',entryNames:'app',format:'esm',jsx:'automatic',logLevel:'silent'});
  const script=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.contents;
  const css=bundle.outputFiles.find(file=>file.path.endsWith('.css'))?.contents;
  server=createServer((request,response)=>{
    if(request.url==='/app.js'){response.setHeader('Content-Type','text/javascript');response.end(script);return;}
    if(request.url==='/app.css'){response.setHeader('Content-Type','text/css');response.end(css??'');return;}
    if(request.url?.startsWith('/api/online/media/')||request.url?.startsWith('/art/')){response.writeHead(404);response.end();return;}
    response.setHeader('Content-Type','text/html; charset=utf-8');response.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"><style>body{margin:0}section{height:900px}button,input{min-height:44px}.world-guide{display:none}.answer-grid{display:grid;gap:8px}.answer-option{display:flex;gap:8px}.question-clock{font-size:14px}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
});
test.afterAll(async()=>{server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));});

async function snapshot(page:Page){return page.evaluate(()=>{const h=(window as any).clockHarness;return{opens:h.opens,attempts:h.attempts,committed:h.committed,completed:h.completed};});}
async function releaseClock(page:Page){await expect.poll(async()=>(await snapshot(page)).opens.length).toBeGreaterThan(0);await page.evaluate(()=>(window as any).clockHarness.releaseClock());await expect(page.locator('.question-clock')).toContainText('Đã dùng khoảng');}

test('quiz waits for the clock ACK and only advances after a saved correct answer',async({page})=>{
  await page.goto(origin+'/?kind=quiz');const stage=page.locator('.world-math');
  await expect(stage.getByRole('button',{name:'A Đúng',exact:true})).toBeDisabled();await releaseClock(page);
  await stage.getByRole('button',{name:'B Sai',exact:true}).click();await expect(stage.getByRole('button',{name:'Trả lời lại',exact:true})).toBeVisible();
  await expect(stage.getByRole('button',{name:'Đến trạm kế tiếp ➜',exact:true})).toHaveCount(0);await expect(stage.locator('.answer-option.correct')).toHaveCount(0);await expect(stage.locator('.result-copy')).not.toContainText('Lời giải');
  await stage.getByRole('button',{name:'Trả lời lại',exact:true}).click();await stage.getByRole('button',{name:'A Đúng',exact:true}).click();
  let saved=await snapshot(page);expect(saved.attempts.map((row:any)=>row.attemptKey)).toEqual(['clock-1:answer:1','clock-1:answer:2']);expect(saved.opens).toEqual(['clock-1']);
  await stage.getByRole('button',{name:'Đến trạm kế tiếp ➜',exact:true}).click();await expect(stage.locator('.quiz-question')).toHaveText('Câu hỏi 2');await expect(stage.getByRole('button',{name:'A Đúng',exact:true})).toBeDisabled();
  saved=await snapshot(page);expect(saved.opens).toEqual(['clock-1','clock-2']);
});

test('quiz retries the exact saved attempt after a failed response and can retry opening the clock',async({page})=>{
  await page.goto(origin+'/?kind=quiz&openFailure=1&saveFailure=1');const stage=page.locator('.world-math');
  await expect(stage.getByRole('button',{name:'Thử mở lại câu hỏi',exact:true})).toBeVisible();await stage.getByRole('button',{name:'Thử mở lại câu hỏi',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).opens.length).toBe(2);await releaseClock(page);await stage.getByRole('button',{name:'A Đúng',exact:true}).click();
  await expect(stage.getByRole('button',{name:'Thử gửi lại đáp án',exact:true})).toBeVisible();await expect(stage.getByRole('button',{name:'B Sai',exact:true})).toBeDisabled();
  await stage.getByRole('button',{name:'Thử gửi lại đáp án',exact:true}).click();await expect(stage.getByRole('button',{name:'Đến trạm kế tiếp ➜',exact:true})).toBeVisible();
  const saved=await snapshot(page);expect(saved.attempts).toHaveLength(2);expect(saved.attempts[0]).toEqual(saved.attempts[1]);expect(saved.committed).toHaveLength(1);expect(saved.opens).toEqual(['clock-1','clock-1']);
});

test('rich exercise keeps its clock and hints across wrong answers and freezes a failed save for exact retry',async({page})=>{
  await page.goto(origin+'/?kind=numeric&saveFailure=1');const stage=page.locator('.online-exercise');
  await expect(stage.getByRole('textbox')).toBeDisabled();await releaseClock(page);await stage.getByRole('button',{name:'Xem gợi ý',exact:true}).click();await stage.getByRole('textbox').fill('3');await stage.getByRole('button',{name:'Kiểm tra đáp án',exact:true}).click();
  await expect(stage.getByRole('button',{name:'Thử gửi lại đáp án',exact:true})).toBeVisible();await expect(stage.getByRole('textbox')).toBeDisabled();await stage.getByRole('button',{name:'Thử gửi lại đáp án',exact:true}).click();
  await expect(stage.getByRole('button',{name:'Trả lời lại',exact:true})).toBeVisible();await expect(stage.locator('.online-exercise-feedback')).not.toContainText('Đáp án:');await stage.getByRole('button',{name:'Trả lời lại',exact:true}).click();
  await expect(stage.getByRole('button',{name:'Đã xem gợi ý',exact:true})).toBeDisabled();await stage.getByRole('textbox').fill('4');await stage.getByRole('button',{name:'Kiểm tra đáp án',exact:true}).click();
  await stage.getByRole('button',{name:'Hoàn thành & lưu thành tích',exact:true}).click();const saved=await snapshot(page);expect(saved.attempts).toHaveLength(3);expect(saved.attempts[0]).toEqual(saved.attempts[1]);expect(saved.attempts[2].attemptKey).toBe('clock-number:answer:2');expect(saved.attempts[2].hintsUsed).toBe(1);expect(saved.opens).toEqual(['clock-number']);expect(saved.completed).toBe(1);
});

test('listening opens its clock after audio ends and requires the clock ACK before answering',async({page})=>{
  await page.goto(origin+'/?kind=listening');const stage=page.locator('.online-exercise');await expect(stage.locator('audio')).toBeVisible();expect((await snapshot(page)).opens).toEqual([]);
  await expect(stage.getByRole('button',{name:'A Đúng',exact:true})).toBeDisabled();await stage.locator('audio').evaluate(audio=>audio.dispatchEvent(new Event('ended',{bubbles:true})));
  await expect.poll(async()=>(await snapshot(page)).opens).toEqual(['clock-listening']);await expect(stage.getByRole('button',{name:'A Đúng',exact:true})).toBeDisabled();await releaseClock(page);
  await stage.getByRole('button',{name:'A Đúng',exact:true}).click();await stage.getByRole('button',{name:'Kiểm tra đáp án',exact:true}).click();await stage.getByRole('button',{name:'Hoàn thành & lưu thành tích',exact:true}).click();expect((await snapshot(page)).completed).toBe(1);
});

test('legacy quiz keeps its original attempt key and may advance after a wrong answer',async({page})=>{
  await page.goto(origin+'/?kind=legacy');const stage=page.locator('.world-math');await stage.getByRole('button',{name:'B Sai',exact:true}).click();await stage.getByRole('button',{name:'Đến trạm kế tiếp ➜',exact:true}).click();await expect(stage.locator('.quiz-question')).toHaveText('Câu hỏi 2');
  const saved=await snapshot(page);expect(saved.opens).toEqual([]);expect(saved.attempts[0].attemptKey).toBe('clock-1');
});

for(const kind of ['sentence','sequence'])test(`${kind} preserves pending order submissions and only advances committed attempt keys`,async({page})=>{
  await page.goto(origin+'/?kind='+kind+'&saveFailure=1');const stage=page.locator(kind==='sentence'?'.world-sentence':'.trail-panel'),bank=stage.getByLabel(kind==='sentence'?'Kho từ':'Kho thẻ lựa chọn',{exact:true}),placed=stage.getByLabel(kind==='sentence'?'Câu đang sắp xếp':'Bậc thang quy luật',{exact:true});
  const check=stage.getByRole('button',{name:kind==='sentence'?'✓ Kiểm tra câu':'✓ Kiểm tra quy luật',exact:true});
  for(const word of ['Con','học','vui'])await bank.getByRole('button',{name:word,exact:true}).click();await check.click();
  const retry=stage.getByRole('button',{name:'Thử gửi lại kết quả',exact:true});await expect(retry).toBeVisible();for(const token of await placed.getByRole('button').all())await expect(token).toBeDisabled();
  await retry.click();await stage.getByRole('button',{name:kind==='sentence'?'Câu tiếp theo ➜':'Bậc tiếp theo ➜',exact:true}).click();
  for(const word of ['học','Con','vui'])await bank.getByRole('button',{name:word,exact:true}).click();await check.click();await stage.getByRole('button',{name:'↺ Thử xếp lại',exact:true}).click();
  for(const word of ['Con','học','vui'])await bank.getByRole('button',{name:word,exact:true}).click();await check.click();await stage.getByRole('button',{name:'Hoàn thành bộ câu hỏi',exact:true}).click();
  await expect(stage.locator('.question-completion')).toBeVisible();await expect(stage.locator('.premium-reward-stars')).toHaveCount(0);await expect(stage.getByRole('button',{name:'Trở về hành trình',exact:true})).toBeVisible();
  const saved=await snapshot(page);expect(saved.attempts).toHaveLength(4);expect(saved.attempts[0]).toEqual(saved.attempts[1]);expect(saved.attempts.map((row:any)=>row.attemptKey)).toEqual(['order-1:try:1','order-1:try:1','order-2:try:1','order-2:try:2']);expect(saved.committed).toHaveLength(3);expect(saved.completed).toBe(1);
});

for(const kind of ['memory','connect'])test(`${kind} freezes a failed pair save and retries the exact pair without minting a move`,async({page})=>{
  await page.goto(origin+'/?kind='+kind+'&saveFailure=1');const stage=page.locator(kind==='memory'?'.world-memory':'.word-connect-panel');
  const card=(id:number,side:'left'|'right')=>kind==='memory'?stage.locator(`.memory-card[data-pair-id="pair-${id}"][data-pair-side="${side}"]`):stage.locator(`.connect-col-${side} [data-pair-id="pair-${id}"]`);
  await card(1,'left').click();await card(1,'right').click();const retry=stage.getByRole('button',{name:kind==='memory'?'Thử gửi lại lượt lật':'Thử gửi lại lượt nối',exact:true});await expect(retry).toBeVisible();await expect(card(2,'left')).toBeDisabled();await expect(card(2,'right')).toBeDisabled();
  await retry.click();await expect(card(2,'left')).toBeEnabled();await card(2,'left').click();await card(3,'right').click();await expect(stage.locator('.game-reaction-retry')).toHaveCount(1);await expect(card(2,'left')).toBeEnabled();
  await card(2,'left').click();await card(2,'right').click();await expect(card(3,'left')).toBeEnabled();await card(3,'left').click();await card(3,'right').click();
  await expect(stage.locator('.question-completion')).toBeVisible();await expect(stage.locator('.premium-reward-stars')).toHaveCount(0);const saved=await snapshot(page);expect(saved.attempts).toHaveLength(5);expect(saved.attempts[0]).toEqual(saved.attempts[1]);const prefix=kind==='memory'?'move-':'connect-';expect(saved.attempts.map((row:any)=>row.attemptKey)).toEqual([prefix+'1',prefix+'1',prefix+'2',prefix+'3',prefix+'4']);expect(saved.committed).toHaveLength(4);expect(saved.completed).toBe(1);
});
