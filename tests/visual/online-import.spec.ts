import {test,expect,type Page} from '@playwright/test';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';
import {waveFixture} from '../helpers/media-fixture.mjs';

function document(invalid=false,mediaFailure=false,goodAudio=false){
  const cell=(text:string)=>'<w:tc><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc>';
  const table=(rows:string[][])=>'<w:tbl>'+rows.map(row=>'<w:tr>'+row.map(cell).join('')+'</w:tr>').join('')+'</w:tbl>';
  const questions=Array.from({length:mediaFailure?8:140},(_,i)=>table([['field','value'],['subjectLabel','Môn '+(mediaFailure?i<4?0:i<6?1:2:Math.floor(i/20))],['kind','quiz'],['prompt','Câu hỏi '+i],['A','Đúng '+i],['B','Sai A'],['C','Sai B'],['D','Sai C'],['answer',invalid&&i===139?'Z':'A'],...(mediaFailure&&i<2?[['audioFile','broken.wav'],['audioTranscript','Âm thanh câu '+i]]:goodAudio&&i===2?[['audioFile','good.wav'],['audioTranscript','Âm thanh tốt']]:!mediaFailure&&i<2?[['imageFile','combined.png'],['imageAlt','Ảnh minh họa câu '+i],['audioFile',`audio-${i}.wav`],['audioTranscript','Âm thanh câu '+i]]:[])]));
  return Buffer.from(zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+table([['schema','baoan-online-week'],['formatVersion','1'],['title','Tên tuần trong tài liệu']])+questions.join('')+'</w:body></w:document>')}));
}

const doc=(name:string,buffer:Buffer)=>({name,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer});
async function setup(page:Page,f:Awaited<ReturnType<typeof cloudBrowserFixture>>){
  const response=await page.request.post(f.origin+'/api/online/setup',{headers:{Origin:f.origin},data:{token:f.token,name:'Cloud import fixture',username:'import.admin',password:f.password}});expect(response.ok()).toBe(true);const identity=await response.json();
  const cls=await page.request.post(f.origin+'/api/online/classes',{headers:{Origin:f.origin,'X-CSRF-Token':identity.csrfToken},data:{name:'Lớp nhập nhiều câu',grade:3}});expect(cls.ok()).toBe(true);
  await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
}

test('a legacy 140-question file previews valid rows lazily and requires a compliant new weekly plan',async({page},testInfo)=>{
  const f=await cloudBrowserFixture();
  try{
    await setup(page,f);
    const requests:string[]=[];page.on('request',request=>{if(request.url().includes('/api/online/'))requests.push(request.method()+' '+new URL(request.url()).pathname);});
    await page.getByRole('combobox',{name:'Tuần học',exact:true}).selectOption({label:'Tuần 03'});
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles([doc('140-questions.docx',document()),{name:'combined.png',mimeType:'image/png',buffer:png},...Array.from({length:16},(_,i)=>({name:`audio-${i}.wav`,mimeType:'audio/wav',buffer:waveFixture()}))]);
    expect(f.objects.size).toBe(0);expect(requests.filter(value=>value.startsWith('POST /api/online/media'))).toHaveLength(0);
    const started=Date.now();await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();const preview=page.getByRole('region',{name:'Xem trước tuần học'});await expect(preview).toBeVisible();const previewMs=Date.now()-started;
    expect(f.objects.size).toBe(3);expect(requests.filter(value=>value==='POST /api/online/media/batch')).toHaveLength(1);expect(requests.filter(value=>value==='POST /api/online/media')).toHaveLength(0);
    await expect(preview).toContainText('Tuần 03');await expect(preview.getByRole('button',{name:'Giao 140 câu hợp lệ cho lớp',exact:true})).toBeDisabled();
    await expect(preview.locator('.online-review-item')).toHaveCount(50);await preview.getByRole('button',{name:'Bộ tiếp',exact:true}).click();await expect(preview.locator('.online-question-review')).toHaveCount(2);await preview.locator('.online-question-review').last().getByRole('button',{name:'Câu tiếp',exact:true}).click();await expect(preview.locator('.online-question-try')).toHaveCount(0);
    const last=preview.locator('.online-review-item').last();await last.locator('summary').click();const trial=last.getByRole('group',{name:'Thử câu 20',exact:true});await trial.getByRole('button',{name:'A. Đúng 139',exact:true}).click();await trial.getByRole('button',{name:'Kiểm tra câu thử',exact:true}).click();await expect(trial.getByRole('status')).toContainText('Khớp đáp án');
    await expect(preview.locator('.online-question-try')).toHaveCount(1);expect(requests.filter(value=>value==='GET /api/online/dashboard')).toHaveLength(0);
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles(doc('invalid.docx',document(true)));await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();
    const excluded=page.getByRole('region',{name:'Câu hỏi không được tải lên',exact:true});await expect(excluded).toContainText('Word, bảng 141');await expect(excluded).toContainText('answer');
    await expect(preview.locator('.online-review-item')).toHaveCount(50);await expect(preview.locator('.online-review-item').filter({hasText:'Câu hỏi 139'})).toHaveCount(0);
    await expect(preview.getByRole('button',{name:'Giao 139 câu hợp lệ cho lớp',exact:true})).toBeDisabled();await expect(preview).toContainText('3–4 môn');
    const dashboard=await(await page.request.get(f.origin+'/api/online/dashboard')).json();expect(dashboard.weeks).toHaveLength(0);expect(dashboard.stats.questions).toBe(0);
    console.log(JSON.stringify({browser:testInfo.project.name,selectedAudioFiles:16,uploadedAudioFiles:2,unusedAudioFiles:14,imageFiles:1,questions:140,previewMs,batchPosts:1,dashboardFetchesDuringPreview:0,published:0,excluded:1,weeklyPlanBlocked:true}));
  }finally{await f.close();}
});

test('a corrupt selected audio file excludes its dependent questions while unrelated questions can be published',async({page})=>{
  const f=await cloudBrowserFixture();
  try{
    await setup(page,f);await page.getByRole('combobox',{name:'Tuần học',exact:true}).selectOption({label:'Tuần 04'});
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles([doc('media-errors.docx',document(false,true)),{name:'broken.wav',mimeType:'audio/wav',buffer:Buffer.from('invalid wave contents')}]);
    await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();const preview=page.getByRole('region',{name:'Xem trước tuần học'});await expect(preview).toBeVisible();
    const excluded=page.getByRole('region',{name:'Câu hỏi không được tải lên',exact:true});await expect(excluded).toContainText('Word, bảng 2');await expect(excluded).toContainText('Word, bảng 3');await expect(excluded).toContainText('broken.wav');
    await expect(preview.locator('.online-review-item')).toHaveCount(6);expect(f.objects.size).toBe(0);
    await preview.getByRole('button',{name:'Giao 6 câu hợp lệ cho lớp',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Đã giao'})).toBeVisible();
    const dashboard=await(await page.request.get(f.origin+'/api/online/dashboard')).json();expect(dashboard.stats.questions).toBe(6);expect(dashboard.weeks[0].title).toBe('Tuần 04');expect(dashboard.weeks[0].sets.flatMap((set:any)=>set.pack.items).map((item:any)=>item.prompt)).toEqual(['Câu hỏi 2','Câu hỏi 3','Câu hỏi 4','Câu hỏi 5','Câu hỏi 6','Câu hỏi 7']);
  }finally{await f.close();}
});

test('a server-rejected audio batch isolates its bad file and preserves good media and questions',async({page})=>{
  const f=await cloudBrowserFixture();
  try{
    await setup(page,f);const singles:string[]=[];let batches=0;
    await page.route('**/api/online/media/batch',async route=>{batches++;await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'Không xác minh được thời lượng âm thanh.'})});});
    await page.route('**/api/online/media',async route=>{const data=route.request().postDataJSON();singles.push(data.name);if(data.name==='broken.wav')await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'Không xác minh được thời lượng âm thanh.'})});else await route.continue();});
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles([doc('server-audio-check.docx',document(false,true,true)),...['broken.wav','good.wav'].map(name=>({name,mimeType:'audio/wav',buffer:waveFixture()}))]);
    await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true});await expect(preview).toBeVisible();
    const excluded=page.getByRole('region',{name:'Câu hỏi không được tải lên',exact:true});await expect(excluded).toContainText('broken.wav');await expect(excluded).not.toContainText('good.wav');await expect(preview.locator('.online-review-item')).toHaveCount(6);
    expect(batches).toBe(1);expect(singles).toEqual(['broken.wav','good.wav']);expect(f.objects.size).toBe(1);
    await preview.getByRole('button',{name:'Giao 6 câu hợp lệ cho lớp',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Đã giao'})).toBeVisible();
    const dashboard=await(await page.request.get(f.origin+'/api/online/dashboard')).json();expect(dashboard.stats.questions).toBe(6);const assets=await(await page.request.get(f.origin+'/api/online/media')).json();expect(assets.map((asset:any)=>asset.name)).toEqual(['good.wav']);
  }finally{await f.close();}
});

test('a server failure during media batch upload does not retry every file or label good media as corrupt',async({page})=>{
  const f=await cloudBrowserFixture();
  try{
    await setup(page,f);let batches=0,singles=0;
    await page.route('**/api/online/media/batch',async route=>{batches++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Máy chủ thử tạm chưa xử lý được yêu cầu.'})});});
    await page.route('**/api/online/media',async route=>{singles++;await route.continue();});
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles([doc('temporary-server-error.docx',document(false,true,true)),...['broken.wav','good.wav'].map(name=>({name,mimeType:'audio/wav',buffer:waveFixture()}))]);
    await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Máy chủ thử tạm chưa xử lý');
    expect(batches).toBe(1);expect(singles).toBe(0);expect(f.objects.size).toBe(0);await expect(page.getByRole('region',{name:'Xem trước tuần học',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Tệp không được sử dụng',exact:true})).toHaveCount(0);
  }finally{await f.close();}
});

test('the downloadable full sample imports all eight question types with images and playable audio in one selection',async({page},testInfo)=>{
  const f=await cloudBrowserFixture();
  try{
    await setup(page,f);
    const sampleLink=page.getByRole('link',{name:'Tải bộ mẫu đầy đủ (.zip)',exact:true}),href=await sampleLink.getAttribute('href');expect(href).toBeTruthy();
    const response=await page.request.get(new URL(href!,f.origin).href);expect(response.ok()).toBe(true);
    const files=Object.entries(unzipSync(new Uint8Array(await response.body()))).filter(([name])=>/\.(xlsx|png|wav)$/i.test(name));
    expect(files.filter(([name])=>/\.xlsx$/i.test(name))).toHaveLength(1);expect(files.filter(([name])=>/\.png$/i.test(name))).toHaveLength(2);expect(files.filter(([name])=>/\.wav$/i.test(name))).toHaveLength(2);
    await page.getByRole('combobox',{name:'Tuần học',exact:true}).selectOption({label:'Tuần 05'});
    await page.getByLabel('Bộ câu hỏi, hình ảnh và âm thanh',{exact:true}).setInputFiles(files.map(([name,bytes])=>({name:name.split('/').at(-1)!,mimeType:/\.xlsx$/i.test(name)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':/\.png$/i.test(name)?'image/png':'audio/wav',buffer:Buffer.from(bytes)})));
    expect(f.objects.size).toBe(0);await page.getByRole('button',{name:'Kiểm tra & xem trước',exact:true}).click();
    const preview=page.getByRole('region',{name:'Xem trước tuần học',exact:true});await expect(preview).toContainText('36/36 câu hợp lệ');await expect(preview).toContainText('10 bộ đủ điều kiện chơi');
    await expect(page.getByRole('region',{name:'Câu hỏi không được tải lên',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Tệp không được sử dụng',exact:true})).toHaveCount(0);
    await expect(preview.locator('.online-question-review')).toHaveCount(5);const firstPageQuestions=await preview.locator('.online-review-item').count();await expect(preview.locator('.online-question-try')).toHaveCount(0);expect(f.objects.size).toBe(4);
    const imageQuestion=preview.locator('.online-review-item').filter({has:page.locator('summary').filter({hasText:'Trắc nghiệm'})}).first();await imageQuestion.locator('summary').click();
    const image=imageQuestion.locator('img').first();await expect(image).toBeVisible();await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);
    await preview.getByRole('button',{name:'Bộ tiếp',exact:true}).click();await expect(preview.locator('.online-question-review')).toHaveCount(5);expect(firstPageQuestions+await preview.locator('.online-review-item').count()).toBe(36);const listeningQuestion=preview.locator('.online-review-item').filter({has:page.locator('summary').filter({hasText:'Nghe & chọn đáp án'})}).first();await listeningQuestion.locator('summary').click();
    const audio=listeningQuestion.locator('audio');await audio.evaluate((node:HTMLAudioElement)=>node.load());await expect.poll(()=>audio.evaluate((node:HTMLAudioElement)=>Number.isFinite(node.duration)&&node.duration>0)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('full-sample-preview.png'),fullPage:true});
    await preview.getByRole('button',{name:'Giao 36 câu hợp lệ cho lớp',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Đã giao'})).toBeVisible();
    const dashboard=await(await page.request.get(f.origin+'/api/online/dashboard')).json();expect(dashboard.weeks).toHaveLength(1);expect(dashboard.weeks[0].title).toBe('Tuần 05');expect(dashboard.weeks[0].sets).toHaveLength(10);expect(dashboard.stats.questions).toBe(36);
  }finally{await f.close();}
});
