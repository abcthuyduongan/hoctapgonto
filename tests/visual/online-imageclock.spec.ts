import path from 'node:path';
import {once} from 'node:events';
import {createServer,type Server} from 'node:http';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {test,expect} from '@playwright/test';

let server:Server,origin:string;
test.beforeAll(async()=>{
  const bundle=await build({stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import MathQuest from './src/games/MathQuest';import OnlineExerciseRunner from './src/screens/OnlineExerciseRunner';
    const numeric=location.search.includes('numeric'),base={id:'image-clock',version:1,title:'Hình tải chậm',grade:3,subject:'thinking',source:'local',publishedAt:'2026-10-17T00:00:00Z'},media={imageId:'11111111-1111-4111-8111-111111111111',imageAlt:'Hình câu hỏi tải chậm'};
    const pack=numeric?{...base,kind:'learning',contentFormatVersion:2,passages:[],media:[],items:[{id:'image-q',kind:'numeric-answer',objectiveId:'IMAGE',prompt:'Điền hai',answer:'2',explanation:'Hai.',media}]}:{...base,kind:'quiz',items:[{id:'image-q',kind:'multiple-choice',objectiveId:'IMAGE',prompt:'Chọn đúng',options:['Đúng','Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đúng.',media}]};
    window.imageClock={opens:0};
    createRoot(document.getElementById('root')).render(React.createElement(numeric?OnlineExerciseRunner:MathQuest,{pack,questionMode:true,onQuestionOpen:async()=>{window.imageClock.opens++;const now=new Date().toISOString();return{openedAt:now,serverNow:now,threeStarMs:30000,twoStarMs:60000};},onAttempt:async()=>{},onComplete:async()=>{},onExit:()=>{}}));
  `,resolveDir:path.resolve('.'),loader:'tsx'},bundle:true,write:false,external:['/art/*'],outdir:'image-clock-harness',entryNames:'app',format:'esm',jsx:'automatic',logLevel:'silent'});
  server=createServer((request,response)=>{if(request.url==='/app.js'){response.setHeader('Content-Type','text/javascript');response.end(bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.contents);return;}if(request.url?.startsWith('/api/')||request.url?.startsWith('/art/')){response.writeHead(404);response.end();return;}response.setHeader('Content-Type','text/html; charset=utf-8');response.end('<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');});
  server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
});
test.afterAll(async()=>{if(!server)return;server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));});

for(const kind of ['quiz','numeric'])test(`${kind}: failed and delayed question images do not consume the server clock`,async({page})=>{
  const png=await readFile(path.resolve('public/icons/bao-an-192.png'));let requests=0,release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/online/media/**',async route=>{requests++;if(requests===1){await route.fulfill({status:503,body:'Image temporarily unavailable'});return;}await held;await route.fulfill({status:200,contentType:'image/png',body:png});});
  try{
    await page.goto(origin+'/?'+kind,{waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'Tải lại',exact:true})).toBeVisible();
    const opens=()=>page.evaluate(()=>(window as any).imageClock.opens);expect(await opens()).toBe(0);
    await page.getByRole('button',{name:'Tải lại',exact:true}).click();await expect.poll(()=>requests).toBe(2);expect(await opens()).toBe(0);
    const control=kind==='quiz'?page.locator('.answer-option').first():page.getByLabel('Đáp án của con',{exact:true});await expect(control).toBeDisabled();
    release();await expect.poll(opens).toBe(1);await expect(control).toBeEnabled();await expect(page.locator('.question-clock')).toContainText('Đã dùng khoảng');
    expect(await opens()).toBe(1);
  }finally{release();}
});
