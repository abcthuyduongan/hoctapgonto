import path from 'node:path';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {expect,test} from '@playwright/test';
import {createOnlineServer} from '../../server/online-server.mjs';
import {seedLegacyApiWeek} from '../helpers/legacy-weeks.mjs';

for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  test.describe(`student journey scrolling at ${viewport.width}×${viewport.height}`,()=>{
    test.use({viewport,hasTouch:viewport.width<600,isMobile:viewport.width<600});

    test('reaches the weekly material and restores scrolling after leaving a game',async({page},testInfo)=>{
      const root=path.resolve('test-results');
      await mkdir(root,{recursive:true});
      const directory=await mkdtemp(path.join(root,'student-scrolling-'));
      const server=createOnlineServer({databasePath:path.join(directory,'data.sqlite'),staticRoot:path.resolve(process.env.BAO_AN_STATIC_ROOT??'dist'),setupToken:'scrolling-bootstrap',secureCookies:false});
      server.listen(0,'127.0.0.1');await once(server,'listening');
      const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
      const password='Scrolling-fixture-password-2026!';
      async function api(route:string,data?:unknown){
        const me=data&&!['/setup','/login'].includes(route)?await(await page.request.get(origin+'/api/online/me')).json():null;
        if(route==='/weeks')await seedLegacyApiWeek(server.onlineStore,me,data);
        const response=data?await page.request.post(origin+'/api/online'+route,{headers:{Origin:origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})},data}):await page.request.get(origin+'/api/online'+route);
        expect(response.ok(),await response.text()).toBe(true);return response.json();
      }
      try{
        await api('/setup',{token:'scrolling-bootstrap',name:'Lớp kiểm tra cuộn',username:'scroll.admin',password});
        const cls=await api('/classes',{name:'Lớp 3',grade:3});
        await api('/students',{name:'Bảo An',classId:cls.id,username:'scroll.child',password});
        const pack={id:'scrolling-pack',version:1,title:'Bộ câu hỏi kiểm tra cuộn',kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-17T00:00:00Z',items:[1,2,3,4].map(i=>({id:`scrolling-${i}`,objectiveId:'SCROLL',kind:'multiple-choice',prompt:`Câu hỏi ${i}`,options:['Đúng','Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đáp án đúng.'}))};
        await api('/weeks',{requestId:'scrolling-week',classId:cls.id,title:'Tuần 01',sets:[{subjectLabel:'Tư duy',pack}]});
        await page.context().clearCookies();await api('/login',{username:'scroll.child',password});
        await page.goto(origin+'/');
        await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();
        const material=page.locator('.online-week-path');
        await expect(material).toContainText(pack.title);
        expect((await material.boundingBox())!.y).toBeGreaterThan(viewport.height);

        // Use real input: programmatic scrollIntoView can scroll overflow:hidden
        // containers and would miss the original document-level scroll lock.
        async function scrollDown(){
          if(viewport.width>=600){await page.mouse.move(viewport.width/2,viewport.height/2);await page.mouse.wheel(0,2400);}
          else{
            const session=await page.context().newCDPSession(page);
            try{
              for(let swipe=0;swipe<3;swipe++){
                const x=viewport.width/2,startY=viewport.height-100;
                await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});
                for(let step=1;step<=8;step++){
                  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY-step*70}]});
                  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
                }
                await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
              }
            }finally{await session.detach();}
          }
          await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(100);
          await expect(material).toBeInViewport();
          expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        }
        await scrollDown();
        await page.screenshot({path:testInfo.outputPath('weekly-material-after-scroll.png')});

        await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();
        await expect(page.locator('.quiz-question')).toBeVisible();
        expect(await page.evaluate(()=>getComputedStyle(document.body).overflow)).toBe('hidden');
        const lockedY=await page.evaluate(()=>window.scrollY);
        await page.mouse.move(5,viewport.height/2);await page.mouse.wheel(0,600);
        expect(await page.evaluate(()=>window.scrollY)).toBe(lockedY);
        await page.getByRole('button',{name:/Thoát trò chơi/}).click();
        await expect(page.locator('.immersive-dialog')).toHaveCount(0);
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
        await scrollDown();
      }finally{
        server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));server.onlineClose();
        expect(path.dirname(path.resolve(directory))).toBe(root);expect(path.basename(directory)).toMatch(/^student-scrolling-/);
        await rm(directory,{recursive:true,force:true});
      }
    });
  });
}
