import {seedLegacyApiWeek} from '../helpers/legacy-weeks.mjs';
import path from 'node:path';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {expect,test,type Page} from '@playwright/test';
import {createOnlineServer} from '../../server/online-server.mjs';

function wav(){const bytes=Buffer.alloc(44+80000);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);return bytes;}
async function fixture(page:Page,count:number){
  const root=path.resolve('test-results');await mkdir(root,{recursive:true});const directory=await mkdtemp(path.join(root,'pair-rounds-'));
  const password='Pair-rounds-fixture-password-2026!';
  const server=createOnlineServer({databasePath:path.join(directory,'data.sqlite'),staticRoot:path.resolve(process.env.BAO_AN_STATIC_ROOT??process.env.BAO_AN_ROUND_STATIC_ROOT??'dist'),setupToken:'pair-rounds-fixture-bootstrap',secureCookies:false});
  server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  async function api(route:string,data?:unknown){const me=data&&!['/setup','/login'].includes(route)?await(await page.request.get(origin+'/api/online/me')).json():null;
    if(route==='/weeks')await seedLegacyApiWeek(server.onlineStore,me,data);const response=data?await page.request.post(origin+'/api/online'+route,{data,headers:{Origin:origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})}}):await page.request.get(origin+'/api/online'+route);
    expect(response.ok(),await response.text()).toBe(true);return response.json();}
  await api('/setup',{token:'pair-rounds-fixture-bootstrap',name:'Kiểm tra phân màn',username:'rounds.admin',password});
  const cls=await api('/classes',{name:'Lớp phân màn',grade:3});await api('/students',{name:'Học sinh phân màn',classId:cls.id,username:'rounds.child',password});
  const image=await api('/media',{name:'round.png',mime:'image/png',base64:(await readFile(path.resolve('public/icons/bao-an-192.png'))).toString('base64')});
  const audio=await api('/media',{name:'round.wav',mime:'audio/wav',base64:wav().toString('base64')});
  const pack={id:'pair-rounds-source',version:1,title:`Bộ ${count} cặp`,kind:'pairs',grade:3,subject:'thinking',source:'local',publishedAt:'2026-10-17T00:00:00.000Z',items:Array.from({length:count},(_,i)=>({id:`round-item-${i+1}`,kind:'pair',objectiveId:'ROUNDS.TEST',left:`Câu hỏi số ${i+1}`,right:`Đáp án số ${i+1}`,media:{imageId:image.id,imageAlt:`Hình ${i+1}`,audioId:audio.id,audioTranscript:`Âm thanh câu ${i+1}`}}))};
  await api('/weeks',{requestId:'pair-rounds-week',classId:cls.id,title:'Tuần chia màn',sets:[{subjectLabel:'Ghép cặp',pack}]});
  await page.context().clearCookies();await api('/login',{username:'rounds.child',password});
  return{api,origin,pack,server,attempts:()=>Number(server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n),awards:()=>Number(server.onlineStore.db.prepare('SELECT count(*) AS n FROM awards').get().n),async open(game:string){await page.goto(origin+'/?online=1&controls=1');await page.getByRole('button',{name:'Chọn '+game,exact:true}).click();await page.getByRole('button',{name:/^Bắt đầu/}).click();},async close(){server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));server.onlineClose();expect(path.dirname(path.resolve(directory))).toBe(root);expect(path.basename(directory)).toMatch(/^pair-rounds-/);await rm(directory,{recursive:true,force:true});}};
}

for(const game of ['Khu Rừng Trí Nhớ','Đảo Nối Từ'])test(`${game}: balanced rounds wait for saved answers, release media and complete the whole source once`,async({page},testInfo)=>{
  const f=await fixture(page,13),memory=game==='Khu Rừng Trí Nhớ',errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const left=()=>page.locator(memory?'.memory-card[data-pair-side="left"]':'.connect-col-left .connect-card');
  const chooseLeft=(id:string)=>page.locator(memory?`.memory-card[data-pair-id="${id}"][data-pair-side="left"]`:`.connect-col-left [data-pair-id="${id}"]`).click();
  const chooseRight=(id:string)=>page.locator(memory?`.memory-card[data-pair-id="${id}"][data-pair-side="right"]`:`.connect-col-right [data-pair-id="${id}"]`).click();
  try{
    await page.setViewportSize({width:1440,height:1000});await f.open(game);await expect(left()).toHaveCount(5);
    await page.setViewportSize({width:390,height:844});await expect(left()).toHaveCount(5);
    await page.setViewportSize({width:1219,height:615});const allIds:string[]=[];
    for(const [roundIndex,count]of [5,4,4].entries()){
      await expect(left()).toHaveCount(count);await expect(page.locator('.pair-round-navigation')).toContainText(`Màn ${roundIndex+1}/3 · ${count} cặp`);
      const ids=await left().evaluateAll(elements=>elements.map(element=>element.getAttribute('data-pair-id')!));allIds.push(...ids);
      const next=page.getByRole('button',{name:'Sang màn tiếp theo →',exact:true});
      if(roundIndex<2)await expect(next).toBeDisabled();
      let oldAudio:Awaited<ReturnType<ReturnType<typeof page.locator>['elementHandle']>>=null;
      for(const [index,id]of ids.entries()){
        await chooseLeft(id);
        if(index===0){const audio=page.locator('.pair-question-audio audio').first();await expect(audio).toBeVisible();oldAudio=await audio.elementHandle();await audio.evaluate(async(element:HTMLAudioElement)=>{element.muted=true;await element.play();});}
        let release:(()=>void)|undefined;
        if(index===count-1&&roundIndex===0){
          const held=new Promise<void>(resolve=>{release=resolve;});
          await page.route('**/api/online/play/*/attempt',async route=>{await held;await route.continue();},{times:1});
        }
        await chooseRight(id);
        if(release){await expect(next).toBeDisabled();await expect(page.locator(memory?'.memory-feedback-message':'.connect-feedback-message')).toContainText('Đang lưu');release();}
        await expect(page.locator('.hud-score')).toContainText(`${allIds.length-count+index+1}/13 cặp`);
        if(!memory&&index===0&&oldAudio)expect(await oldAudio.evaluate((element:HTMLAudioElement)=>element.paused&&!element.hasAttribute('src'))).toBe(true);
      }
      if(roundIndex<2){
        expect(f.awards()).toBe(1);const before=f.attempts(),earned=(await f.api('/student')).balance.earned;expect(earned).toBe(allIds.length*3);await expect(next).toBeEnabled();
        if(memory){const audio=page.locator('.pair-question-audio audio');await audio.nth(0).evaluate(async(element:HTMLAudioElement)=>{element.muted=true;await element.play();});await audio.nth(1).evaluate(async(element:HTMLAudioElement)=>{element.muted=true;await element.play();});expect(await audio.nth(0).evaluate((element:HTMLAudioElement)=>element.paused)).toBe(true);oldAudio=await audio.nth(1).elementHandle();}
        await next.click();await expect(page.locator('.pair-round-navigation')).toContainText(`Màn ${roundIndex+2}/3`);
        expect(f.attempts()).toBe(before);expect(f.awards()).toBe(1);expect((await f.api('/student')).balance.earned).toBe(earned);
        if(oldAudio)expect(await oldAudio.evaluate((element:HTMLAudioElement)=>element.paused&&!element.hasAttribute('src'))).toBe(true);
        for(const id of ids)await expect(page.locator(`[data-pair-id="${id}"]`)).toHaveCount(0);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
    expect(new Set(allIds).size).toBe(13);expect([...allIds].sort()).toEqual(f.pack.items.map(item=>item.id).sort());await expect(page.locator('.game-star-receipt')).toContainText('3/3 sao');await expect(page.locator('.question-completion')).toBeVisible();await expect(page.locator('.premium-reward-stars')).toHaveCount(0);expect((await f.api('/student')).balance.earned).toBe(39);expect(f.attempts()).toBe(13);expect(f.awards()).toBe(1);expect(errors).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(memory?'memory-rounds-complete.png':'connect-rounds-complete.png')});
  }finally{await f.close();}
});

test('mobile sessions cap a 30-pair source at four pairs and keep that partition after resize',async({page})=>{
  const f=await fixture(page,30);
  try{
    await page.setViewportSize({width:360,height:740});await f.open('Khu Rừng Trí Nhớ');await expect(page.locator('.memory-card')).toHaveCount(8);await expect(page.locator('.pair-round-navigation')).toContainText('Màn 1/8 · 4 cặp');
    await page.setViewportSize({width:1440,height:1000});await expect(page.locator('.memory-card')).toHaveCount(8);await expect(page.locator('.pair-round-navigation')).toContainText('Màn 1/8 · 4 cặp');
    expect(f.attempts()).toBe(0);expect(f.awards()).toBe(0);await expect(page.locator('.pair-question-audio audio')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.close();}
});
