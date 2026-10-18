import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
import {createOnlineServer} from '../../server/online-server.mjs';
import {createCloudApi} from '../../server/cloud-api.mjs';
import {createPostgresFixture} from '../../tests/helpers/postgres-fixture.mjs';

const root=path.resolve('test-results/deep-release-audit');
const originCloud='https://audit.invalid',token='audit-only-bootstrap-2026',password='Audit-only-password-2026!';
const at='2026-10-17T00:00:00.000Z';
await mkdir(root,{recursive:true});
class Client{
  constructor(send,origin){this.send=send;this.origin=origin;this.cookie='';this.csrf='';this.routes=[];}
  async request(route,body){
    const headers={};if(this.cookie)headers.Cookie=this.cookie;
    if(body!==undefined){headers.Origin=this.origin;headers['Content-Type']='application/json';if(this.csrf)headers['X-CSRF-Token']=this.csrf;}
    this.routes.push(route);
    const response=await this.send(new Request(this.origin+'/api/online'+route,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})}));
    const cookies=response.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(v=>v.split(';',1)[0]).join('; ');
    const data=await response.json();if(data.csrfToken)this.csrf=data.csrfToken;
    return {status:response.status,data};
  }
  async ok(route,body){const result=await this.request(route,body);assert.ok(result.status>=200&&result.status<300,`${route}: ${result.status} ${JSON.stringify(result.data)}`);return result.data;}
}
async function fixture(engine){
  if(engine==='sqlite'){
    const directory=await mkdtemp(path.join(root,'api-fixture-')),staticRoot=path.join(directory,'public');await mkdir(staticRoot);await writeFile(path.join(staticRoot,'index.html'),'<title>Audit only</title>');
    const server=createOnlineServer({databasePath:path.join(directory,'fixture.sqlite'),staticRoot,setupToken:token,secureCookies:false});server.listen(0,'127.0.0.1');await once(server,'listening');
    const origin='http://127.0.0.1:'+server.address().port;
    return {client:()=>new Client(request=>fetch(request),origin),async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await server.onlineClose();assert.equal(path.dirname(path.resolve(directory)),root);assert.ok(path.basename(directory).startsWith('api-fixture-'));await rm(directory,{recursive:true,force:true});}};
  }
  const cleanups=[],f=await createPostgresFixture({after:fn=>cleanups.push(fn)},{bootstrap:false}),objects=new Map();
  const api=createCloudApi({store:f.store,storage:{async upload(key,bytes){objects.set(key,Buffer.from(bytes));},async download(key){return objects.get(key);},async remove(key){objects.delete(key);}},publicOrigin:originCloud,setupToken:token});
  return {client:()=>new Client(request=>api(request,{ip:'192.0.2.200'}),originCloud),async close(){for(const cleanup of cleanups.reverse())await cleanup();}};
}
function wave(seconds){const samples=8000*seconds,b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);return b;}
function packs(audio){return [
  {subjectLabel:'Tiếng Anh',pack:{id:'audit-listening',version:1,title:'Nghe tên bạn',subject:'thinking',grade:3,source:'local',publishedAt:at,kind:'learning',contentFormatVersion:2,passages:[],media:[{mediaId:audio.id,kind:'audio',url:'/audio/'+audio.id+'.wav',sha256:audio.sha256,transcript:'My name is Lucy. I am nine.',source:'Audit fixture',rights:'Self authored',approvedAt:at}],items:[0,1].map(i=>({id:'listen-'+i,objectiveId:'AUDIT.LISTEN',kind:'listening-choice',prompt:i?'Bạn ấy bao nhiêu tuổi?':'Tên của bạn ấy là gì?',audioId:audio.id,options:i?['Bảy','Tám','Chín','Mười']:['Mai','Lucy','Nam','Lan'],correctIndex:i?2:1,explanation:'Đối chiếu lời nghe.'}))}},
  {subjectLabel:'Toán',pack:{id:'audit-math',version:1,title:'Phép cộng',subject:'thinking',grade:3,source:'local',publishedAt:at,kind:'quiz',items:[0,1].map(i=>({id:'math-'+i,kind:'multiple-choice',objectiveId:'AUDIT.MATH',prompt:i?'3 + 4 bằng bao nhiêu?':'2 + 3 bằng bao nhiêu?',options:i?['6','7','8','9']:['5','6','7','8'],correctIndex:i?1:0,explanation:'Tính tổng.'}))}},
  {subjectLabel:'Tiếng Việt',pack:{id:'audit-viet',version:1,title:'Từ và nghĩa',subject:'thinking',grade:3,source:'local',publishedAt:at,kind:'pairs',items:[{id:'viet-0',kind:'pair',objectiveId:'AUDIT.VIET',left:'Chăm chỉ',right:'Siêng năng'},{id:'viet-1',kind:'pair',objectiveId:'AUDIT.VIET',left:'Vui vẻ',right:'Hân hoan'}]}}
];}
const findings=[];
for(const engine of ['sqlite','postgres-wasm']){
  const f=await fixture(engine);
  try{
    const manager=f.client();await manager.ok('/setup',{token,name:'Isolated release audit',username:'audit.manager',password});
    const cls=await manager.ok('/classes',{name:'Audit class',grade:3});
    await manager.ok('/students',{name:'Audit learner',username:'audit.child',classId:cls.id,password});
    const audio=await manager.ok('/media',{name:'twenty-seconds.wav',mime:'audio/wav',base64:wave(20).toString('base64')});
    const sets=packs(audio);for(const s of sets)for(const q of s.pack.items)q.hint='Đọc kỹ hoặc nghe lại câu hỏi.';
    const week=await manager.ok('/weeks',{requestId:'audit-week',title:'Tuần kiểm tra',classId:cls.id,sets});
    const child=f.client();await child.ok('/login',{username:'audit.child',password});await child.ok('/student/summary');
    const play=await child.ok('/play/compact',{requestId:'audit-listen',moduleId:'math-quest',packId:sets[0].pack.id,contentVersion:1});
    const item=play.presentation.items[0];assert.equal(typeof item.correctIndex,'number');
    const start=performance.now(),clock=await child.ok(`/play/${play.session.sessionId}/question-open`,{itemId:item.id});
    const receipt=await child.ok(`/play/${play.session.sessionId}/attempt`,{attemptKey:'audio-bypass',itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:0});
    assert.equal(receipt.questionRewards.questions[0].tier,3);assert.equal(child.routes.filter(r=>r.startsWith('/media/')).length,0);
    findings.push({engine,id:'AUDIT-01',result:'REPRODUCED',answerKeyExposed:true,transcriptExposed:JSON.stringify(play.presentation).includes('My name is Lucy'),audioDurationMs:20000,audioGetRequests:0,clock,elapsedWallMs:Math.round(performance.now()-start),awardedTier:receipt.questionRewards.questions[0].tier});
    const math=sets[1].pack,p=await child.ok('/play/compact',{requestId:'audit-math',moduleId:'math-quest',packId:math.id,contentVersion:1});
    for(const q of p.presentation.items){await child.ok(`/play/${p.session.sessionId}/question-open`,{itemId:q.id});await child.ok(`/play/${p.session.sessionId}/attempt`,{attemptKey:'math-'+q.id,itemId:q.id,response:{kind:'choice',choiceIndex:q.correctIndex},hintsUsed:0,elapsedMs:0});}
    for(const source of [sets[0].pack,sets[2].pack]){
      const pair=source.kind==='pairs',round=await child.ok('/play/compact',{requestId:'master-'+source.id,moduleId:pair?'memory-match':'math-quest',packId:source.id,contentVersion:1});
      for(const q of round.presentation.items){if(!pair)await child.ok(`/play/${round.session.sessionId}/question-open`,{itemId:q.id});await child.ok(`/play/${round.session.sessionId}/attempt`,{attemptKey:'master-'+q.id,itemId:q.id,response:pair?{kind:'pair',first:{itemId:q.id,side:'left'},second:{itemId:q.id,side:'right'}}:{kind:'choice',choiceIndex:q.correctIndex},hintsUsed:0,elapsedMs:0});}
    }
    const before=await child.ok('/student/summary');
    const revised=structuredClone(sets);for(const s of revised)s.pack.version=2;
    const changed=revised[1].pack.items[0];changed.prompt='5 + 7 bằng bao nhiêu?';changed.options=['11','12','13','14'];changed.correctIndex=1;changed.explanation='5 cộng 7 bằng 12.';
    await manager.ok('/weeks',{requestId:'audit-revise',replaceWeekId:week.id,title:'Tuần kiểm tra',classId:cls.id,sets:revised});
    const after=await child.ok('/student/summary');
    const next=await child.ok('/play/compact',{requestId:'audit-revised-play',moduleId:'math-quest',packId:math.id,contentVersion:2});
    const oldMath=before.currentWeekSummary,newMath=after.currentWeekSummary;
    const questionTier=summary=>summary.weeks.flatMap(week=>week.sets).find(set=>set.pack.id===math.id).questionProgress.questions.find(q=>q.itemId===changed.id).tier;
    assert.equal(next.presentation.items[0].prompt,changed.prompt);
    assert.equal(newMath.three,oldMath.three);
    assert.equal(newMath.ready,true);assert.equal(questionTier(after),3);
    findings.push({engine,id:'AUDIT-02',result:'REPRODUCED',questionId:changed.id,beforePrompt:math.items[0].prompt,afterPrompt:next.presentation.items[0].prompt,beforeTier:questionTier(before),afterTier:questionTier(after),beforeSummary:oldMath,afterSummary:newMath,newQuestionHasNoAttempt:true});
  }finally{await f.close();}
}
await writeFile(path.join(root,'adversarial-api.json'),JSON.stringify({at:new Date().toISOString(),method:'Authenticated public HTTP / cloud Request-Response; isolated databases; no production mutations',findings},null,2));
console.log(JSON.stringify(findings,null,2));
