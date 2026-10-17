import path from 'node:path';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {expect,test,type Page,type APIRequestContext} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';
import {createOnlineServer} from '../../server/online-server.mjs';

const password='Media-regression-fixture-2026!';
const xml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function word(rows:Record<string,string>[]){
  const table=(values:string[][])=>'<w:tbl>'+values.map(row=>'<w:tr>'+row.map(value=>`<w:tc><w:p><w:r><w:t>${xml(value)}</w:t></w:r></w:p></w:tc>`).join('')+'</w:tr>').join('')+'</w:tbl>';
  return Buffer.from(zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+table([['schema','baoan-online-week'],['formatVersion','1']])+rows.map(row=>table([['field','value'],...Object.entries(row)])).join('')+'</w:body></w:document>')}));
}
function wav(){const samples=1600,bytes=Buffer.alloc(44+samples*2);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);return bytes;}
async function fixture(page:Page){
  const root=path.resolve('test-results');await mkdir(root,{recursive:true});const directory=await mkdtemp(path.join(root,'online-media-'));
  const server=createOnlineServer({databasePath:path.join(directory,'data.sqlite'),staticRoot:path.resolve('dist'),setupToken:'media-regression-bootstrap-2026',secureCookies:false});
  server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  async function api(request:APIRequestContext,route:string,data?:unknown){const me=data&&route!=='/setup'?await(await request.get(origin+'/api/online/me')).json():null;
    const response=data?await request.post(origin+'/api/online'+route,{data,headers:{Origin:origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})}}):await request.get(origin+'/api/online'+route);
    expect(response.ok(),await response.text()).toBe(true);return response.json();}
  async function login(target:Page,user='media.admin'){await target.goto(origin+'/?online=1&controls=1');await target.getByLabel('Tên đăng nhập',{exact:true}).fill(user);await target.getByLabel('Mật khẩu',{exact:true}).fill(password);await target.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(target.getByRole('button',{name:'Đăng xuất',exact:true})).toBeVisible();}
  await api(page.request,'/setup',{token:'media-regression-bootstrap-2026',name:'Tư liệu thử nghiệm',username:'media.admin',password});
  const cls=await api(page.request,'/classes',{name:'Lớp có hình và âm thanh',grade:4});await api(page.request,'/students',{name:'Học sinh thử nghiệm',classId:cls.id,username:'media.child',password});
  const png=await readFile(path.resolve('public/icons/bao-an-192.png'));
  const image=await api(page.request,'/media',{name:'picture.png',mime:'image/png',base64:png.toString('base64')});
  const audio=await api(page.request,'/media',{name:'sound.wav',mime:'audio/wav',base64:wav().toString('base64')});
  const pack={id:'media-regression-source',version:1,title:'Bộ nối có hình và âm thanh',kind:'pairs',grade:4,subject:'thinking',source:'local',publishedAt:'2026-10-16T00:00:00.000Z',items:[1,2,3,4].map(i=>({id:`media-item-${i}`,kind:'pair',objectiveId:'MEDIA.TEST',left:`Vế trái ${i}`,right:`Vế phải ${i}`,media:{imageId:image.id,imageAlt:`Hình câu ${i}`,audioId:audio.id,audioTranscript:'Bản chép lời thử nghiệm'}}))};
  return{api,login,cls,image,audio,pack,png,origin,server,async close(){server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));server.onlineClose();expect(path.dirname(path.resolve(directory))).toBe(root);expect(path.basename(directory)).toMatch(/^online-media-/);await rm(directory,{recursive:true,force:true});}};
}

test('refresh synchronizes media from another tab and previews its image and audio without a reload',async({page,browser},testInfo)=>{
  const f=await fixture(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.context().clearCookies();await f.login(page);await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
    await expect(page.locator('.online-media-manager summary')).toContainText('2 tệp');
    const remote=await browser.newContext();try{const tab=await remote.newPage();await f.login(tab);await f.api(remote.request,'/media',{name:'remote.png',mime:'image/png',base64:f.png.toString('base64')});await f.api(remote.request,'/media',{name:'remote.wav',mime:'audio/wav',base64:wav().toString('base64')});}finally{await remote.close();}
    await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).click();await expect(page.locator('.online-media-manager summary')).toContainText('4 tệp');
    await page.getByRole('combobox',{name:'Tuần học',exact:true}).selectOption({label:'Tuần 01'});
    const rows=[1,2].map(i=>({kind:'pairs',subjectLabel:'Nghe và nhìn',left:`Trái ${i}`,right:`Phải ${i}`,imageFile:'remote.png',imageAlt:`Ảnh từ tab khác ${i}`,audioFile:'remote.wav',audioTranscript:'Âm thanh tải từ tab khác'}));
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles({name:'media.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:word(rows)});
    await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();const preview=page.getByRole('region',{name:'Xem trước tuần học'});await expect(preview).toBeVisible();
    const item=preview.locator('.online-review-item').first();await item.locator('summary').click();
    await expect.poll(()=>item.locator('img').evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
    await item.locator('audio').evaluate(async(e:HTMLAudioElement)=>{e.muted=true;await e.play();});await expect.poll(()=>item.locator('audio').evaluate((e:HTMLAudioElement)=>e.ended)).toBe(true);
    await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).click();await expect(preview).toBeVisible();
    await page.route('**/api/online/media',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Chưa đọc được kho tư liệu.'})}));
    await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(preview).toBeVisible();
    await page.unroute('**/api/online/media');await page.getByRole('button',{name:'Thử lại',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.online-media-manager summary')).toContainText('4 tệp');
    for(const width of [360,390,768,1024,1366,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
    await page.setViewportSize({width:390,height:1000});await page.screenshot({path:testInfo.outputPath('media-preview-mobile.png'),fullPage:true});
    await f.api(page.request,'/media',{name:'later.png',mime:'image/png',base64:f.png.toString('base64')});
    await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).click();await expect(page.locator('.online-media-manager summary')).toContainText('5 tệp');await expect(preview).toHaveCount(0);
    expect(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n).toBe(0);expect(errors).toEqual([]);
  }finally{await f.close();}
});

test('matching cards keep their question text visible alongside images at mobile, tablet and desktop sizes',async({page},testInfo)=>{
  const f=await fixture(page);
  try{
    await f.api(page.request,'/weeks',{requestId:'image-text-week',classId:f.cls.id,title:'Tuần có hình',sets:[{subjectLabel:'Quan sát',pack:f.pack}]});
    await page.context().clearCookies();await f.login(page,'media.child');await page.getByRole('button',{name:'Chọn Đảo Nối Từ',exact:true}).click();await page.getByRole('button',{name:/^Bắt đầu/}).click();
    for(const width of [360,768,1440]){
      await page.setViewportSize({width,height:1000});const labels=page.locator('.connect-col-left .connect-card-text');await expect(labels).toHaveCount(4);
      for(const label of await labels.all()){await expect(label).toBeVisible();const rect=await label.boundingBox();expect(rect!.height).toBeGreaterThan(15);}
      await expect.poll(()=>page.locator('.connect-card img').first().evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
      await page.screenshot({path:testInfo.outputPath(`matching-with-images-${width}.png`),fullPage:true});
    }
  }finally{await f.close();}
});

for(const game of ['Đảo Nối Từ','Khu Rừng Trí Nhớ'])test(`${game}: failed card images can retry outside answer buttons without recording an attempt`,async({page},testInfo)=>{
  const f=await fixture(page);
  try{
    await f.api(page.request,'/weeks',{requestId:'image-retry-week',classId:f.cls.id,title:'Tuần tải lại hình',sets:[{subjectLabel:'Quan sát',pack:f.pack}]});
    await page.context().clearCookies();await f.login(page,'media.child');await page.route(`**/api/online/media/${f.image.id}*`,route=>route.abort());
    await page.getByRole('button',{name:'Chọn '+game,exact:true}).click();await page.getByRole('button',{name:/^Bắt đầu/}).click();
    if(game==='Khu Rừng Trí Nhớ'){expect(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n).toBe(0);const card=page.locator('.memory-card').filter({hasText:'Vế trái 1'});await card.click();}
    await expect(page.getByRole('button',{name:'Tải lại hình',exact:true})).toBeVisible();await expect(page.locator('button button')).toHaveCount(0);
    const attempts=Number(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n);
    await page.getByRole('button',{name:'Tải lại hình',exact:true}).click();await expect(page.getByRole('button',{name:'Tải lại hình',exact:true})).toBeVisible();
    await page.unroute(`**/api/online/media/${f.image.id}*`);await page.getByRole('button',{name:'Tải lại hình',exact:true}).click();
    await expect.poll(()=>page.locator('.question-media-image-only img').first().evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
    await expect(page.getByRole('button',{name:'Tải lại hình',exact:true})).toHaveCount(0);expect(Number(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n)).toBe(attempts);
    await page.screenshot({path:testInfo.outputPath('card-image-recovered.png'),fullPage:true});
  }finally{await f.close();}
});
