import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';
import {authFor} from '../helpers/postgres-fixture.mjs';

function workbook(rows:Record<string,string>[]){
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row)))],xml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;');
  const sheet=(matrix:string[][])=>'<worksheet><sheetData>'+matrix.map((row,index)=>'<row r="'+(index+1)+'">'+row.map((value,col)=>'<c r="'+String.fromCharCode(65+col)+(index+1)+'" t="inlineStr"><is><t>'+xml(value)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
  return Buffer.from(zipSync({'xl/workbook.xml':strToU8('<workbook xmlns:r="urn:relationships"><sheets><sheet name="Thông tin bộ" r:id="info"/><sheet name="Câu hỏi" r:id="questions"/></sheets></workbook>'),'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="info" Type="urn:/worksheet" Target="worksheets/info.xml"/><Relationship Id="questions" Type="urn:/worksheet" Target="worksheets/questions.xml"/></Relationships>'),'xl/worksheets/info.xml':strToU8(sheet([['schema','baoan-online-week'],['formatVersion','1'],['title','Tuần kiểm tra']])),'xl/worksheets/questions.xml':strToU8(sheet([['baoan-online-week','1'],headers,...rows.map(row=>headers.map(header=>row[header]??''))]))}));
}
test('Excel-only samples and null diagnostics publish only valid questions across three subjects',async({page},testInfo)=>{
 const f=await cloudBrowserFixture();
 try{
  async function api(route:string,data:unknown,csrf=''){const response=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data});expect(response.ok(),await response.text()).toBe(true);return response.json();}
  const admin=await api('/setup',{token:f.token,name:'Kiểm tra kế hoạch tuần',username:'weekplan.admin',password:f.password});const cls=await api('/classes',{name:'Lớp 3',grade:3},admin.csrfToken);
  const requests:string[]=[],summaries:unknown[]=[];page.on('request',request=>requests.push(new URL(request.url()).pathname));page.on('response',async response=>{if(new URL(response.url()).pathname==='/api/online/admin/summary'&&response.ok())summaries.push(await response.json());});
  await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();await expect(page.getByRole('link',{name:/Tải mẫu Excel trống/})).toBeVisible();await expect(page.getByRole('link',{name:/Tải mẫu Word/})).toHaveCount(0);
  const rows=['Toán','Tiếng Việt','Tiếng Anh'].flatMap((subjectLabel,subject)=>[1,2].map(i=>({subjectLabel,kind:'quiz',prompt:`${subjectLabel} câu ${i}`,A:`Đúng ${subject}.${i}`,B:'Sai B',C:'Sai C',D:'Sai D',answer:'A',difficulty:i===1?'easy':'hard',imageFile:'NuLl',imageAlt:'null'})));
  const bytes=workbook([...rows,{...rows[0],prompt:'NULL'},{...rows[0],prompt:'#NULL!'}]);
  const select=async(buffer:Buffer)=>{await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles({name:'questions.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();};
  await select(bytes);const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true});await expect(preview).toContainText('6/8 câu hợp lệ');await expect(preview).toContainText('3 môn · 6 câu · tối đa 18 sao');
  const issues=preview.getByRole('region',{name:'Câu hỏi không được tải lên',exact:true});await expect(issues).toContainText('dòng 9');await expect(issues).toContainText('prompt: thiếu dữ liệu');await expect(issues).toContainText('dòng 10');await expect(issues).toContainText('lỗi Excel #NULL!');
  await expect(preview.getByRole('button',{name:'Giao 6 câu hợp lệ cho lớp',exact:true})).toBeEnabled();
  for(const width of[320,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await preview.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('null-preview-'+width+'.png'),fullPage:true});}
  await preview.getByRole('button',{name:'Giao 6 câu hợp lệ cho lớp',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Đã giao'})).toBeVisible();const weeks=await f.store.weeks(admin.user,cls.id);expect(weeks[0].sets.flatMap((set:any)=>set.pack.items)).toHaveLength(6);expect(weeks[0].plan.subjects).toHaveLength(3);
  expect(requests).not.toContain('/api/online/dashboard');expect(requests).not.toContain('/api/online/media');expect(requests).not.toContain('/api/online/admin/media/lookup');for(const value of summaries)expect(JSON.stringify(value)).not.toContain('"items"');
  // Enforce the aggregate cap in preview, without silently dropping questions.
  const over=['Toán','Tiếng Việt','Tiếng Anh'].flatMap((subjectLabel,s)=>Array.from({length:s===0?13:2},(_,i)=>({...rows[0],subjectLabel,prompt:`Đề ${s}.${i}`,A:`Đúng ${s}.${i}`})));await select(workbook(over));await expect(preview).toContainText('Toán có 13 câu');await expect(preview.getByRole('button',{name:/Giao 17 câu hợp lệ cho lớp|Chọn cập nhật tuần đã giao/})).toBeDisabled();
 }finally{await f.close();}
});

test('complete Excel archive imports all 36 questions with image and audio in one selection',async({page})=>{
 const f=await cloudBrowserFixture();
 try{
  async function api(route:string,data:unknown,csrf=''){const response=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data});expect(response.ok(),await response.text()).toBe(true);return response.json();}
  const identity=await api('/setup',{token:f.token,name:'Mẫu đầy đủ',username:'sample.admin',password:f.password});await api('/classes',{name:'Lớp mẫu',grade:3},identity.csrfToken);
  await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
  const files=unzipSync(await readFile('public/question-templates/bo-mau-day-du.zip')),selected=Object.entries(files).filter(([name])=>/\.(xlsx|png|wav)$/.test(name)).map(([path,bytes])=>({name:path.endsWith('.png')?path.split('/').pop()!.toLocaleUpperCase('vi'):path.split('/').pop()!,buffer:Buffer.from(bytes),mimeType:path.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':path.endsWith('.png')?'image/png':'audio/wav'}));expect(selected).toHaveLength(5);
  await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles(selected);await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true});await expect(preview).toContainText('36/36 câu hợp lệ');await expect(preview).toContainText('10 bộ đủ điều kiện chơi');await expect(preview).toContainText('3 môn · 36 câu · tối đa 108 sao');await expect(preview.locator('.online-subject-summary tbody tr')).toHaveCount(3);await preview.getByRole('button',{name:'Giao 36 câu hợp lệ cho lớp',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Đã giao'})).toBeVisible();
 }finally{await f.close();}
});

test('continue selects only unfinished questions and twenty enter/exit cycles release game UI resources',async({page},testInfo)=>{
 const f=await cloudBrowserFixture();
 try{
  const setup=await page.request.post(f.origin+'/api/online/setup',{headers:{Origin:f.origin},data:{token:f.token,name:'Vòng đời trò chơi',username:'cycles.admin',password:f.password}});expect(setup.ok()).toBe(true);const identity=await setup.json(),admin=identity.user;
  const cls=await f.store.createClass(admin,{name:'Lớp vòng đời',grade:3});await f.store.createStudent(admin,{classId:cls.id,name:'An',username:'cycles.child'},'fixture-hash','cycles.child');
  const sets=['Toán','Tiếng Việt','Tiếng Anh'].map((subjectLabel,s)=>({subjectLabel,pack:{id:'cycle-source-'+s,version:1,title:'Bộ '+s,kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-17T00:00:00.000Z',items:[1,2].map(i=>({id:'q'+i,kind:'multiple-choice',objectiveId:'CYCLES',prompt:`Môn ${s} câu ${i}`,options:[`Đúng ${s}.${i}`,'Sai B','Sai C','Sai D'],correctIndex:0,explanation:'Đáp án A.'}))}}));await f.store.publishWeek(admin,{requestId:'cycle-week',classId:cls.id,title:'Tuần 01',sets});
  const user=await f.store.findUserByUsername('cycles.child'),auth=authFor(user),play=await f.store.startPlay(auth,{requestId:'completed-one',moduleId:'math-quest',packId:sets[0].pack.id,contentVersion:1},true);await f.store.openQuestion(auth,play.session.sessionId,{itemId:'q1'});await f.store.attempt(auth,play.session.sessionId,{attemptKey:'q1',itemId:'q1',response:{kind:'choice',choiceIndex:0},hintsUsed:0,elapsedMs:0});await f.store.finishPlay(auth,play.session.sessionId,true,true);
  // Create a real password/session through the admin endpoint, then log in normally.
  const reset=await page.request.post(f.origin+'/api/online/students/'+user.student_id+'/reset-password',{headers:{Origin:f.origin,'X-CSRF-Token':identity.csrfToken},data:{}});expect(reset.ok()).toBe(true);const credentials=await reset.json();await page.context().clearCookies();const login=await page.request.post(f.origin+'/api/online/login',{headers:{Origin:f.origin},data:{username:'cycles.child',password:credentials.password}});expect(login.ok()).toBe(true);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(f.origin+'/?online=1&controls=1');await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  const cdp=await page.context().newCDPSession(page),samples:any[]=[];
  for(let iteration=1;iteration<=20;iteration++){
   const set=page.locator('.online-week-path > li > ul > li').first(),details=set.locator('details');if(await details.getAttribute('open')===null)await details.locator('summary').click();
   // The native toggle event updates React asynchronously; wait for the body
   // before deciding whether game metadata still needs to be loaded.
   await expect(details.locator('.online-question-stars-body')).toBeVisible();
   const continueButton=set.getByRole('button',{name:'Tiếp tục 1 câu chưa đạt 2 sao',exact:true});if(!await continueButton.count())await set.getByRole('button',{name:'Chọn trò để học hoặc ôn lại',exact:true}).click();await continueButton.click();await expect(page.locator('.quiz-question')).toContainText('Môn 0 câu 2');
   await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await expect(page.locator('.immersive-dialog')).toHaveCount(0);await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage'),resources=await page.evaluate(()=>({dom:document.querySelectorAll('*').length,audio:document.querySelectorAll('audio').length,canvas:document.querySelectorAll('canvas').length}));samples.push({iteration,heap:heap.usedSize,...resources});
  }
  expect(Math.max(...samples.slice(5).map(s=>s.dom))-Math.min(...samples.slice(5).map(s=>s.dom))).toBeLessThan(40);expect(samples.every(s=>s.audio===0)).toBe(true);expect(samples.at(-1).canvas).toBe(samples[4].canvas);expect(samples.at(-1).heap-samples[4].heap).toBeLessThan(16*1024*1024);expect(errors).toEqual([]);await testInfo.attach('twenty-game-cycles',{body:JSON.stringify(samples,null,2),contentType:'application/json'});await cdp.detach();
 }finally{await f.close();}
});
