import {seedLegacyApiWeek} from '../helpers/legacy-weeks.mjs';
import path from 'node:path';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {expect,test,type Page} from '@playwright/test';
import {createOnlineServer} from '../../server/online-server.mjs';

async function fixture(page:Page){
  const root=path.resolve('test-results');await mkdir(root,{recursive:true});const directory=await mkdtemp(path.join(root,'question-layout-'));
  const password='Question-layout-fixture-2026!';
  const server=createOnlineServer({databasePath:path.join(directory,'data.sqlite'),staticRoot:path.resolve(process.env.BAO_AN_STATIC_ROOT??'dist'),setupToken:'question-layout-bootstrap-2026',secureCookies:false});
  server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  async function api(route:string,data?:unknown){const me=data&&!['/setup','/login'].includes(route)?await(await page.request.get(origin+'/api/online/me')).json():null;
    if(route==='/weeks')await seedLegacyApiWeek(server.onlineStore,me,data);const response=data?await page.request.post(origin+'/api/online'+route,{data,headers:{Origin:origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})}}):await page.request.get(origin+'/api/online'+route);
    expect(response.ok(),await response.text()).toBe(true);return response.json();}
  await api('/setup',{token:'question-layout-bootstrap-2026',name:'Căn chỉnh câu hỏi',username:'layout.admin',password});
  const cls=await api('/classes',{name:'Lớp kiểm tra căn chỉnh',grade:3});await api('/students',{name:'Học sinh căn chỉnh',classId:cls.id,username:'layout.child',password});
  const image=await api('/media',{name:'layout.png',mime:'image/png',base64:(await readFile(path.resolve('public/icons/bao-an-192.png'))).toString('base64')});
  const base={version:1,grade:3,subject:'thinking',source:'local',publishedAt:'2026-10-17T00:00:00.000Z'};
  const quiz={...base,id:'layout-quiz',title:'Công nghệ | quiz | Tuần 01',kind:'quiz',items:[{id:'layout-quiz-short',kind:'multiple-choice',objectiveId:'LAYOUT.QUIZ',prompt:'Vật nào sau đây là sản phẩm công nghệ?',options:['Chiếc ti vi','Bông hoa tự mọc','Hòn đá trong suối','Đám mây'],correctIndex:0,explanation:'Chiếc ti vi là sản phẩm do con người tạo ra.',media:{imageId:image.id,imageAlt:'Hình minh họa cho câu hỏi công nghệ'}},{id:'layout-quiz-long',kind:'multiple-choice',objectiveId:'LAYOUT.QUIZ',prompt:'Khi cần tìm hiểu cách sử dụng một đồ dùng trong gia đình, con nên đọc hướng dẫn và nhờ người lớn giúp đỡ để dùng đồ vật đúng cách, giữ an toàn cho mình và những người xung quanh. Con sẽ chọn cách nào sau đây?',options:['Đọc kỹ hướng dẫn, quan sát và hỏi người lớn khi có điều chưa hiểu','Bấm thử tất cả các nút khi chưa hiểu cách dùng','Để đồ dùng ở nơi có nước rồi bật điện','Tự tháo đồ dùng ra để xem bên trong'],correctIndex:0,explanation:'Cần đọc kỹ hướng dẫn và nhờ người lớn giúp đỡ.',media:{imageId:image.id,imageAlt:'Hình minh họa đồ dùng trong gia đình'}}]};
  return {api,cls,quiz,base,image,server,async login(){await page.context().clearCookies();await api('/login',{username:'layout.child',password});await page.goto(origin+'/?online=1&controls=1');},async close(){server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));server.onlineClose();expect(path.dirname(path.resolve(directory))).toBe(root);expect(path.basename(directory)).toMatch(/^question-layout-/);await rm(directory,{recursive:true,force:true});}};
}

test('quiz fits its question, image and four readable answers on desktop and allows complete mobile scrolling',async({page},testInfo)=>{
  const f=await fixture(page),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await f.api('/weeks',{requestId:'layout-quiz-week',classId:f.cls.id,title:'Tuần 01',sets:[{subjectLabel:'Công nghệ',pack:f.quiz}]});await f.login();
    await page.getByRole('button',{name:'Chọn Đảo Câu Hỏi',exact:true}).click();await page.getByRole('button',{name:/^Bắt đầu/}).click();
    const stage=page.locator('.world-math');await expect(stage).toBeVisible();
    for(const viewport of [{width:1828,height:922},{width:1219,height:615}]){
      await page.setViewportSize(viewport);await expect.poll(()=>stage.getAttribute('data-question-layout')).toBe('quiz');
      await expect.poll(()=>stage.locator('img[alt="Hình minh họa cho câu hỏi công nghệ"]').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
      await expect.poll(()=>stage.evaluate(element=>{
        const stage=element.getBoundingClientRect();
        return [...element.querySelectorAll('.quiz-question,.quest-scroll>.question-media>img,.answer-option')].every(node=>{const box=node.getBoundingClientRect();return box.width>0&&box.height>0&&box.top>=stage.top-1&&box.bottom<=Math.min(stage.bottom,innerHeight)+1&&node.scrollHeight<=node.clientHeight+1&&node.scrollWidth<=node.clientWidth+1;});
      })).toBe(true);
      expect(await stage.locator('.quiz-question').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(20);
      for(const answer of await stage.locator('.answer-option').all()){expect(await answer.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);expect((await answer.boundingBox())!.height).toBeGreaterThanOrEqual(44);}
      await page.screenshot({path:testInfo.outputPath(`quiz-fitted-${viewport.width}-${viewport.height}.png`)});
    }
    await page.setViewportSize({width:390,height:740});await stage.getByRole('button',{name:'A Chiếc ti vi',exact:true}).click();await page.getByRole('button',{name:'Đến trạm kế tiếp ➜',exact:true}).click();
    await expect(stage.locator('.quiz-question')).toHaveText(f.quiz.items[1].prompt);await expect.poll(()=>stage.evaluate(element=>element.scrollTop)).toBe(0);
    const prompt=stage.locator('.quiz-question');expect(await prompt.evaluate(element=>element.scrollHeight<=element.clientHeight+1&&element.scrollWidth<=element.clientWidth+1)).toBe(true);
    for(const answer of await stage.locator('.answer-option').all()){await answer.scrollIntoViewIfNeeded();await expect(answer).toBeInViewport();expect(await answer.evaluate(element=>element.scrollHeight<=element.clientHeight+1&&element.scrollWidth<=element.clientWidth+1)).toBe(true);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(Number(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n)).toBe(1);
    await stage.getByRole('button',{name:'A '+f.quiz.items[1].options[0],exact:true}).click();await page.getByRole('button',{name:'Hoàn thành bộ câu hỏi',exact:true}).click();await expect(page.locator('.game-star-receipt')).toBeVisible();
    expect(Number(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n)).toBe(2);expect(errors).toEqual([]);
  }finally{await f.close();}
});

test('reading exercise keeps its complete passage, prompt and controls reachable and resets only for the next question',async({page},testInfo)=>{
  const f=await fixture(page);
  try{
    const body='Mỗi sáng, Lan tưới cây rồi quan sát những chiếc lá mới mọc. Bạn ghi chép những điều nhìn thấy vào một cuốn sổ nhỏ. '.repeat(12).trim();
    const pack={...f.base,id:'layout-reading',title:'Đọc và quan sát',kind:'learning',contentFormatVersion:2,passages:[{passageId:'layout-passage',title:'Vườn cây nhỏ',body,source:'Tác giả thử nghiệm',rights:'Được phép sử dụng',approvedAt:'2026-10-17T00:00:00.000Z'}],media:[],items:[1,2].map(i=>({id:'layout-reading-'+i,kind:'reading-choice',objectiveId:'LAYOUT.READING',passageId:'layout-passage',prompt:i===1?'Lan làm gì vào mỗi sáng?':'Lan ghi chép vào đâu?',options:i===1?['Tưới cây và quan sát','Đi ngủ','Xem ti vi','Chơi bóng']:['Một cuốn sổ nhỏ','Một chiếc lá','Bức tường','Bàn tay'],correctIndex:0,explanation:'Chi tiết được nêu trong đoạn đọc.',hint:'Đọc lại đoạn đầu.'}))};
    await f.api('/weeks',{requestId:'layout-reading-week',classId:f.cls.id,title:'Tuần 01',sets:[{subjectLabel:'Đọc hiểu',pack}]});await f.login();
    await page.getByRole('button',{name:'Chọn Đảo Câu Hỏi',exact:true}).click();await page.getByRole('button',{name:/^Bắt đầu/}).click();
    const stage=page.locator('.online-exercise');await expect(stage).toHaveAttribute('data-question-layout','reading-choice');await page.setViewportSize({width:390,height:740});
    await expect(stage.getByLabel('Đoạn đọc')).toContainText(body);expect(await stage.locator('.online-reading p').evaluate(element=>element.scrollHeight<=element.clientHeight+1)).toBe(true);
    await expect(stage.locator('.answer-option.correct')).toHaveCount(0);
    await stage.getByRole('button',{name:'A Tưới cây và quan sát',exact:true}).click();const beforeSubmit=await stage.evaluate(element=>element.scrollTop);expect(beforeSubmit).toBeGreaterThan(0);
    await stage.getByRole('button',{name:'Kiểm tra đáp án',exact:true}).click();await expect(stage.locator('.online-exercise-feedback')).toBeVisible();await expect(stage.locator('.answer-option.correct')).toHaveCount(1);await expect(stage.getByRole('button',{name:'A Tưới cây và quan sát',exact:true})).toHaveClass(/\bcorrect\b/);expect(await stage.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    await stage.getByRole('button',{name:'Câu tiếp theo →',exact:true}).click();await expect(stage.locator('.online-exercise-card>h2')).toHaveText('Lan ghi chép vào đâu?');await expect.poll(()=>stage.evaluate(element=>element.scrollTop)).toBe(0);
    await expect(stage.locator('.answer-option.correct')).toHaveCount(0);await stage.getByRole('button',{name:'A Một cuốn sổ nhỏ',exact:true}).click();await stage.getByRole('button',{name:'Kiểm tra đáp án',exact:true}).click();await expect(stage.getByRole('button',{name:'A Một cuốn sổ nhỏ',exact:true})).toHaveClass(/\bcorrect\b/);await stage.getByRole('button',{name:'Hoàn thành & lưu thành tích',exact:true}).click();await expect(page.locator('.game-star-receipt')).toBeVisible();
    expect(Number(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n)).toBe(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('reading-complete-mobile.png')});
  }finally{await f.close();}
});
