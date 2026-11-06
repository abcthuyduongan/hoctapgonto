import {build} from 'esbuild';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {writeFile,mkdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,expect} from '@playwright/test';
import {OnlineStore} from '../../server/online-store.mjs';

const root='test-results/audit-2026-11-06',mode=process.argv[2]??'timeout';await mkdir(root,{recursive:true});
const bundle=await build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import{ContestMockScreen}from'./src/screens/ContestMockScreen.tsx';createRoot(document.getElementById('root')).render(<ContestMockScreen onClose={()=>{}}/>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',write:false,loader:{'.css':'empty'},jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const store=new OnlineStore(':memory:'),at=new Date().toISOString(),workspaceId='ui-audit-workspace',adminId='ui-audit-admin';
store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'UI audit isolated',at);
store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(adminId,workspaceId,'ui.audit.admin','fixture',at);
const admin={id:adminId,workspaceId,username:'ui.audit.admin',role:'admin'},cls=store.createClass(admin,{name:'Audit class',grade:3});
const student=store.createStudent(admin,{name:'Audit child',classId:cls.id,username:'ui.audit.child'},'fixture','ui.audit.child');
const user=store.db.prepare('SELECT * FROM users WHERE student_id=?').get(student.id);
const auth={id:user.id,workspaceId,studentId:student.id,username:user.username,role:'student'};
const started=store.startContest(auth,{presetId:'violympic-math-g3',requestId:'audit-timeout'});
const sessionId=started.sessionId,items=JSON.parse(store.db.prepare('SELECT items_json FROM contest_sessions WHERE session_id=?').get(sessionId).items_json);
const first=items[0],observations={kind:'Isolated UI reproduction; actual ContestMockScreen and actual SQLite store; network adapter test-only',mode,displayCountdownSeconds:mode==='timeout'?3:300,saveRequestsStarted:0,savedSnapshots:[],submitPayloads:[],consoleErrors:[]};
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/bundle.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle.outputFiles[0].contents);return;}
  if(!req.url.startsWith('/api/online/')){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><div id="root"></div><script src="/bundle.js"></script></html>');return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const input=chunks.length?JSON.parse(Buffer.concat(chunks)):undefined;
  const route=req.url.slice('/api/online'.length);let result;
  if(route==='/contest/presets')result=store.contestPresets(auth);
  else if(route==='/contest/active'){result=store.activeContest(auth);result.session.remainingSeconds=observations.displayCountdownSeconds;}
  else if(route==='/contest/history')result=store.contestHistory(auth);
  else if(route.endsWith('/save')){const requestNumber=++observations.saveRequestsStarted;if(mode==='autosave'&&requestNumber===1)await delay(900);result=store.saveContestProgress(auth,sessionId,input);observations.savedSnapshots.push(JSON.parse(store.db.prepare('SELECT answers_json FROM contest_sessions WHERE session_id=?').get(sessionId).answers_json));}
  else if(route.endsWith('/submit')){observations.submitPayloads.push(input);result=store.submitContest(auth,sessionId,input);observations.result={score:result.score,correctCount:result.correctCount,totalItems:result.totalItems};}
  else throw Error('Unknown test route '+route);
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>observations.consoleErrors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await expect(page.locator('[data-testid="contest-question-card"]')).toBeVisible();
 async function answer(item){if(item.kind==='choice')await page.locator('.contest-option-btn').nth(item.options.indexOf(String(item.correctAnswer))).click();else await page.locator('.contest-fill-input').fill(String(item.correctAnswer));}
 await answer(first);
 if(mode==='autosave'){
  await expect.poll(()=>observations.saveRequestsStarted).toBe(1);
  await page.locator('.question-nav-btn').nth(1).click();
  await answer(items[1]);
  await expect.poll(()=>observations.savedSnapshots.length).toBe(2);
  observations.uiAnsweredCount=await page.locator('.question-nav-btn.answered').count();
  observations.finalAnswers=JSON.parse(store.db.prepare('SELECT answers_json FROM contest_sessions WHERE session_id=?').get(sessionId).answers_json);
  observations.reproduced=observations.uiAnsweredCount===2&&Object.keys(observations.finalAnswers).length===1;
  await page.screenshot({path:root+'/contest-autosave-reordered.png',fullPage:true});
  await writeFile(root+'/contest-autosave-reproduction.json',JSON.stringify(observations,null,2));
  console.log(JSON.stringify(observations));
 }else{
 await expect.poll(()=>observations.savedSnapshots.length).toBeGreaterThan(0);
 observations.savedCorrectBeforeTimeout=observations.savedSnapshots.at(-1)[first.id]===String(first.correctAnswer);
 await expect.poll(()=>observations.submitPayloads.length,{timeout:7000}).toBeGreaterThan(0);
 observations.finalAnswers=JSON.parse(store.db.prepare('SELECT answers_json FROM contest_sessions WHERE session_id=?').get(sessionId).answers_json);
 await page.screenshot({path:root+'/contest-timeout-result.png',fullPage:true});
 observations.reproduced=observations.savedCorrectBeforeTimeout&&Object.keys(observations.submitPayloads[0].answers).length===0&&Object.keys(observations.finalAnswers).length===0;
 await writeFile(root+'/contest-timeout-reproduction.json',JSON.stringify(observations,null,2));
 console.log(JSON.stringify(observations));
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}
