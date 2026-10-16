import {readFile} from 'node:fs/promises';
import {expect,test,type Page,type Locator} from '@playwright/test';
import type {ContentPack} from '../../src/core/contracts';
import {QUESTION_HEADERS,templateMatrix,serializeQuestionCsv,parseQuestionDocument} from '../../src/core/question-import';
import {LIBRARY_PACKS} from '../../src/core/lesson-seed';
import {parseContentImport} from '../../src/core/content-io';
import {parseQuestionWorkbookBytes} from '../../src/core/excel-import';
import {rows} from './helpers/self-study';
import {createReleaseServer} from './helpers/offline-release';

test.use({serviceWorkers:'block'});
const panel=(page:Page)=>page.getByRole('region',{name:'Mẫu câu hỏi và nhập bổ sung',exact:true});
const preview=(page:Page)=>panel(page).getByRole('region',{name:'Xem trước câu hỏi',exact:true});
const publish=(page:Page)=>panel(page).getByRole('button',{name:'Xuất bản các câu đã chọn',exact:true});
const col=(name:string)=>QUESTION_HEADERS.indexOf(name as typeof QUESTION_HEADERS[number]);
async function creator(page:Page,url='/'){
  await page.goto(url);await page.getByRole('button',{name:/Xưởng học liệu/}).click();await expect(panel(page)).toBeVisible();
}
async function upload(page:Page,text:string,name='bao-an-cau-hoi.csv'){
  await panel(page).getByLabel('Tệp câu hỏi theo mẫu',{exact:true}).setInputFiles({name,mimeType:name.endsWith('.json')?'application/json':'text/csv',buffer:Buffer.from(text)});
  await expect(preview(page)).toBeVisible();
}
async function downloaded(page:Page,button:Locator){const pending=page.waitForEvent('download');await button.click();const file=await pending;expect(await file.failure()).toBeNull();return {name:file.suggestedFilename(),bytes:await readFile((await file.path())!)};}
function matrix(count:number,start=0,id='ba19-bang-cau-hoi'){
  const header=[...QUESTION_HEADERS],template=templateMatrix('quiz')[1],result:string[][]=[header];
  for(let i=start;i<start+count;i++){const row=[...template];
    for(const [key,value] of Object.entries({packId:id,packTitle:`BA19 · ${id}`,itemId:`qa-item-${i}`,prompt:`Bài ${i}: ${i} + 1 bằng bao nhiêu?`,optionA:String(i),optionB:String(i+1),optionC:String(i+2),optionD:String(i+3),answer:'B',isExample:'false',objectiveId:`TOAN3.KY_NANG.${i%2}`,knowledgeId:`TOAN3.KIEN_THUC.${i%2}`,topicId:'tu-bien-soan',source:'Gia đình Bảo An tự biên soạn',rights:'Gia đình cho phép sử dụng',reviewStatus:'draft',difficulty:i%2?'medium':'easy',contentRole:'unassigned'}))row[col(key)]=value;
    result.push(row);
  }return result;
}
async function saveCsv(page:Page,data:string[][],message:string){await upload(page,serializeQuestionCsv(data));await expect(publish(page)).toBeEnabled();await publish(page).click();await expect(panel(page).getByRole('status')).toContainText(message);}
async function stored(page:Page,id:string){return (await rows(page)).packs.filter(row=>row.pack.id===id).map(row=>row.pack as ContentPack).sort((a,b)=>a.version-b.version);}

test('BA19: actual three-sheet Excel download preserves custom topic and explicitly imports examples before JSON review and publication',async({page})=>{
  await creator(page);await panel(page).getByLabel('Chủ đề / mã bài',{exact:true}).fill('toan3-bang-nhan-bao-an');
  const file=await downloaded(page,panel(page).getByRole('button',{name:'Tải mẫu XLSX',exact:true}));expect(file.name).toMatch(/\.xlsx$/);expect(file.bytes.subarray(0,2).toString()).toBe('PK');
  const workbook=parseQuestionWorkbookBytes(new Uint8Array(file.bytes));expect(Object.keys(workbook.sheets)).toEqual(['Hướng dẫn','Thông tin bộ','Câu hỏi']);
  expect(workbook.sheets['Thông tin bộ'].find(row=>row[0]==='topicId')?.[1]).toBe('toan3-bang-nhan-bao-an');
  const input=panel(page).getByLabel('Tệp câu hỏi theo mẫu',{exact:true});await input.setInputFiles({name:file.name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file.bytes});
  await expect(preview(page)).toContainText('Đọc 2 dòng · hợp lệ 0');await expect(preview(page)).toContainText('2 dòng minh họa');await expect(publish(page)).toBeDisabled();
  await panel(page).getByLabel('Nhận cả các dòng minh họa ở lần đọc tiếp theo',{exact:true}).check();await input.setInputFiles({name:file.name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file.bytes});
  await expect(preview(page)).toContainText('Đọc 2 dòng · hợp lệ 2 · lỗi 0');
  const exported=await downloaded(page,panel(page).getByRole('button',{name:'Xuất JSON để rà soát',exact:true})),review=parseContentImport(exported.bytes.toString('utf8'))[0];
  expect(review.items).toHaveLength(2);expect(review.templateInfo?.topicId).toBe('toan3-bang-nhan-bao-an');expect(review.items.every(item=>item.metadata?.topicId==='toan3-bang-nhan-bao-an'&&item.metadata?.reviewStatus==='draft'&&item.metadata?.contentRole==='unassigned')).toBe(true);
  await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v1: 2 câu');const saved=await stored(page,review.id);expect(saved).toHaveLength(1);expect(saved[0].items).toEqual(review.items);
});

test('BA19: downloaded CSV and JSON templates for all three subjects retain Unicode, correct answers and source metadata',async({page})=>{
  await creator(page);await panel(page).getByLabel('Nhận cả các dòng minh họa ở lần đọc tiếp theo',{exact:true}).check();
  for(const [subject,kind,format] of [['math','quiz','CSV'],['vietnamese','pairs','JSON'],['english','sentences','CSV']]){
    await panel(page).getByLabel('Bộ đích',{exact:true}).selectOption('');await panel(page).getByLabel('Môn của mẫu',{exact:true}).selectOption(subject);await panel(page).getByLabel('Dạng của mẫu',{exact:true}).selectOption(kind);await panel(page).getByLabel('Chủ đề / mã bài',{exact:true}).fill(`chu-de-${subject}`);
    const file=await downloaded(page,panel(page).getByRole('button',{name:`Tải mẫu ${format}`,exact:true}));if(format==='CSV')expect([...file.bytes.subarray(0,3)]).toEqual([0xef,0xbb,0xbf]);
    await panel(page).getByLabel('Tệp câu hỏi theo mẫu',{exact:true}).setInputFiles({name:file.name,mimeType:format==='JSON'?'application/json':'text/csv',buffer:file.bytes});await expect(preview(page)).toContainText('hợp lệ 2 · lỗi 0');await expect(publish(page)).toBeEnabled();
    await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v1: 2 câu');const saved=(await stored(page,`mau-${kind}`))[0];expect(saved.subject).toBe(subject);expect(saved.items).toHaveLength(2);expect(saved.items.every(item=>item.metadata?.source==='Tự biên soạn'&&item.metadata?.topicId===`chu-de-${subject}`)).toBe(true);
    if(saved.kind==='quiz')expect(saved.items.map(item=>item.correctIndex)).toEqual([1,2]);if(saved.kind==='pairs')expect(saved.items.map(item=>item.right)).toEqual(['hẹp','thấp']);if(saved.kind==='sentences')expect(saved.items[0].words).toEqual(['My','name','is','An','.']);
  }
});

test('BA19: publishing ten plus five produces a 15-question v2, preserves v1 bytes and reimport creates no empty v3',async({page})=>{
  await creator(page);const id='ba19-them-nam';await saveCsv(page,matrix(10,0,id),'v1: 10 câu');const original=(await stored(page,id))[0];
  await upload(page,serializeQuestionCsv(matrix(5,10,id)));await expect(preview(page)).toContainText('Trước 10 câu → sau 15 câu · mới 5');await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v2: 15 câu');
  const saved=await stored(page,id);expect(saved).toHaveLength(2);expect(saved[0]).toEqual(original);expect(saved[1].items.slice(0,10)).toEqual(original.items);expect(new Set(saved[1].items.map(item=>item.id)).size).toBe(15);
  await upload(page,serializeQuestionCsv(matrix(5,10,id)));await expect(preview(page)).toContainText('Trước 15 câu → sau 15 câu · mới 0 · đã có / bỏ qua 5');await expect(publish(page)).toBeDisabled();expect(await stored(page,id)).toEqual(saved);
});

test('BA19: physical row four with invalid answer stays out until valid-only opt-in, and error CSV names the real row and column',async({page})=>{
  await creator(page);const data=matrix(3,0,'ba19-dong-loi');data[3][col('answer')]='Z';await upload(page,serializeQuestionCsv(data));
  await expect(preview(page)).toContainText('Đọc 3 dòng · hợp lệ 2 · lỗi 1');await expect(preview(page)).toContainText('Dòng 4, cột answer');await expect(publish(page)).toBeDisabled();expect(await stored(page,'ba19-dong-loi')).toEqual([]);
  const file=await downloaded(page,panel(page).getByRole('button',{name:'Tải danh sách dòng lỗi',exact:true}));expect(file.bytes.toString('utf8')).toContain('"4","answer"');expect([...file.bytes.subarray(0,3)]).toEqual([0xef,0xbb,0xbf]);
  await panel(page).getByLabel('Tôi chỉ nhận các dòng hợp lệ đã chọn',{exact:true}).check();await expect(publish(page)).toBeEnabled();await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v1: 2 câu');const pack=(await stored(page,'ba19-dong-loi'))[0];expect(pack.items.map(item=>item.id)).toEqual(['qa-item-0','qa-item-1']);
});

test('BA19: same-ID edits require an explicit revision or deliberate new-ID decision and keep earlier published versions',async({page})=>{
  await creator(page);const id='ba19-xung-dot';await saveCsv(page,matrix(2,0,id),'v1: 2 câu');const original=(await stored(page,id))[0],changed=matrix(2,0,id);changed[1][col('prompt')]='Sửa có chủ ý: 20 + 1 bằng bao nhiêu?';changed[1][col('optionA')]='20';changed[1][col('optionB')]='21';changed[1][col('optionC')]='22';changed[1][col('optionD')]='23';
  await upload(page,serializeQuestionCsv(changed));await expect(publish(page)).toBeDisabled();await panel(page).getByLabel('Xử lý xung đột qa-item-0',{exact:true}).selectOption('revision');await expect(publish(page)).toBeEnabled();await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v2: 2 câu');
  const revised=(await stored(page,id))[1];expect(revised.items[0].id).toBe(original.items[0].id);expect((revised.items[0] as any).prompt).toBe(changed[1][col('prompt')]);
  changed[1][col('prompt')]='Một cách hỏi khác có chủ ý: cộng 20 với 1.';await upload(page,serializeQuestionCsv(changed));await expect(publish(page)).toBeDisabled();await panel(page).getByLabel('Xử lý xung đột qa-item-0',{exact:true}).selectOption('new-id');await expect(preview(page)).toContainText('sau 3 câu');await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v3: 3 câu');
  const saved=await stored(page,id);expect(saved[0]).toEqual(original);expect(saved[1]).toEqual(revised);expect(saved[2].items.slice(0,2)).toEqual(revised.items);expect(saved[2].items[2].id).not.toBe('qa-item-0');
});

test('BA19: a 33-question file is previewed without truncation and cannot publish beyond the 30-question limit',async({page})=>{
  await creator(page);const before=(await rows(page)).packs;await upload(page,serializeQuestionCsv(matrix(33,0,'ba19-qua-gioi-han')));await expect(preview(page)).toContainText('Đọc 33 dòng · hợp lệ 33');await expect(preview(page).locator('.question-preview-row')).toHaveCount(33);await expect(preview(page)).toContainText('2 đến 30');await expect(publish(page)).toBeDisabled();expect((await rows(page)).packs).toEqual(before);
});

test('BA19: cancel terminates the actual pending worker and does not publish a late preview or change saved questions',async({page,context})=>{
  await page.addInitScript(()=>{const NativeWorker=window.Worker;(window as any).__questionWorkerStats={started:0,terminated:0};window.Worker=class extends NativeWorker{constructor(scriptURL:string|URL,options?:WorkerOptions){super(scriptURL,options);(window as any).__questionWorkerStats.started++;}terminate(){(window as any).__questionWorkerStats.terminated++;super.terminate();}};});
  let release!:()=>void,requested=false;const gate=new Promise<void>(resolve=>{release=resolve;});const pattern=/\/assets\/question-import\.worker-[^/]+\.js$/;
  await context.route(pattern,async route=>{requested=true;await gate;await route.continue().catch(()=>{});});
  try{await creator(page);const before=(await rows(page)).packs;await panel(page).getByLabel('Tệp câu hỏi theo mẫu',{exact:true}).setInputFiles({name:'bao-an-huy.csv',mimeType:'text/csv',buffer:Buffer.from(serializeQuestionCsv(matrix(30,0,'ba19-huy-worker')))});
    await expect.poll(()=>requested).toBe(true);await panel(page).getByRole('button',{name:'Hủy đọc tệp',exact:true}).click();release();await expect(panel(page).getByRole('status')).toContainText('Đã hủy đọc tệp');await expect(preview(page)).toHaveCount(0);
    expect(await page.evaluate(()=>(window as any).__questionWorkerStats)).toMatchObject({started:1,terminated:1});expect((await rows(page)).packs).toEqual(before);
  }finally{release();await context.unroute(pattern);}
});

test('BA19: real offline release downloads Excel and runs the cached parser worker to publish two questions without network',async({browser},testInfo)=>{
  test.setTimeout(90_000);const release=await createReleaseServer(testInfo.outputPath('question-offline')),context=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});
  try{const page=await context.newPage();await page.goto(release.origin);await expect(page.getByRole('status',{name:'Trạng thái ngoại tuyến'})).toContainText('Sẵn sàng học ngoại tuyến');
    const cached=await page.evaluate(async()=>{const urls:string[]=[];for(const key of await caches.keys())if(key.startsWith('bao-an-learning-build-'))for(const request of await(await caches.open(key)).keys())urls.push(new URL(request.url).pathname);return urls;});
    expect(cached.filter(url=>url.startsWith('/question-templates/BA_')&&url.endsWith('.xlsx'))).toHaveLength(16);expect(cached).toContain('/question-templates/online-week.xlsx');expect(cached).toContain('/question-templates/online-week.docx');expect(cached.some(url=>/question-import\.worker-.*\.js$/.test(url))).toBe(true);
    await context.setOffline(true);await page.getByRole('button',{name:/Xưởng học liệu/}).click();await expect(panel(page)).toBeVisible();await panel(page).getByLabel('Nhận cả các dòng minh họa ở lần đọc tiếp theo',{exact:true}).check();
    const file=await downloaded(page,panel(page).getByRole('button',{name:'Tải mẫu XLSX',exact:true}));await panel(page).getByLabel('Tệp câu hỏi theo mẫu',{exact:true}).setInputFiles({name:file.name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file.bytes});
    await expect(preview(page)).toContainText('hợp lệ 2 · lỗi 0');await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v1: 2 câu');expect((await stored(page,'mau-quiz'))[0].items).toHaveLength(2);
  }finally{await context.close();await release.close();}
});

test('BA19: all nine subject and legacy-kind Excel combinations import tailored examples with the selected subject and topic',async({page})=>{
  test.setTimeout(60_000);await creator(page);await panel(page).getByLabel('Nhận cả các dòng minh họa ở lần đọc tiếp theo',{exact:true}).check();
  const expected:Record<string,string>={'math-quiz':'7 × 6 = ?','math-pairs':'6 × 7','math-sentences':'Sắp xếp câu mô tả bài toán.','vietnamese-quiz':'Từ trái nghĩa với rộng là gì?','vietnamese-pairs':'rộng','vietnamese-sentences':'Sắp xếp câu nói về trường.','english-quiz':'Choose the English word for mẹ.','english-pairs':'mother','english-sentences':'Sắp xếp lời giới thiệu.'};
  for(const subject of ['math','vietnamese','english'])for(const kind of ['quiz','pairs','sentences']){
    await panel(page).getByLabel('Bộ đích',{exact:true}).selectOption('');await panel(page).getByLabel('Môn của mẫu',{exact:true}).selectOption(subject);await panel(page).getByLabel('Dạng của mẫu',{exact:true}).selectOption(kind);const topic=`${subject}-${kind}-lop3`;await panel(page).getByLabel('Chủ đề / mã bài',{exact:true}).fill(topic);
    const file=await downloaded(page,panel(page).getByRole('button',{name:'Tải mẫu XLSX',exact:true}));await panel(page).getByLabel('Tệp câu hỏi theo mẫu',{exact:true}).setInputFiles({name:file.name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file.bytes});await expect(preview(page)).toContainText('hợp lệ 2 · lỗi 0');await expect(publish(page)).toBeEnabled();
    const exported=await downloaded(page,panel(page).getByRole('button',{name:'Xuất JSON để rà soát',exact:true})),pack=parseContentImport(exported.bytes.toString('utf8'))[0];expect(pack.subject).toBe(subject);expect(pack.kind).toBe(kind);expect(pack.templateInfo?.topicId).toBe(topic);expect(pack.items.every(item=>item.metadata?.topicId===topic&&item.metadata?.source==='Tự biên soạn')).toBe(true);
    const first=pack.items[0];expect('left' in first?first.left:first.prompt).toBe(expected[`${subject}-${kind}`]);if(subject==='vietnamese'&&pack.kind==='quiz')expect(pack.items[0].options[pack.items[0].correctIndex]).toBe('hẹp');if(subject==='english'&&pack.kind==='pairs')expect(pack.items[0].right).toBe('mẹ');if(subject==='math'&&pack.kind==='sentences')expect(pack.items[0].words.join(' ')).toBe('Có ba hộp bút .');
  }
});

test('BA19: exported content JSON selects individual rows and trial answers do not create events, results or stars',async({page})=>{
  await creator(page);await upload(page,serializeQuestionCsv(matrix(3,0,'ba19-json-chon-rieng')));const exported=await downloaded(page,panel(page).getByRole('button',{name:'Xuất JSON để rà soát',exact:true}));
  await upload(page,exported.bytes.toString('utf8'),'bao-an-noi-dung.json');await expect(preview(page)).toContainText('hợp lệ 3 · lỗi 0');const before=await rows(page);
  const first=preview(page).locator('.question-preview-row').nth(0);await first.locator('summary').click();const trial=first.getByRole('group',{name:'Thử câu qa-item-0',exact:true});await trial.getByRole('button',{name:'1',exact:true}).click();await trial.getByRole('button',{name:'Kiểm tra câu thử',exact:true}).click();await expect(trial.getByRole('status')).toContainText('Khớp đáp án của bộ.');
  await preview(page).getByRole('checkbox',{name:/Dòng 3 · qa-item-1/}).uncheck();await expect(preview(page).getByRole('checkbox',{name:/Dòng 2 · qa-item-0/})).toBeChecked();await expect(preview(page).getByRole('checkbox',{name:/Dòng 4 · qa-item-2/})).toBeChecked();await expect(publish(page)).toBeEnabled();
  const selected=await downloaded(page,panel(page).getByRole('button',{name:'Xuất JSON để rà soát',exact:true}));expect(parseContentImport(selected.bytes.toString('utf8'))[0].items.map(item=>item.id)).toEqual(['qa-item-0','qa-item-2']);expect(await rows(page)).toEqual(before);
});

test('BA19: quota failure after a pack add aborts publication completely and retry creates only v1',async({page})=>{
  await creator(page);const id='ba19-quota-thu-lai';await upload(page,serializeQuestionCsv(matrix(2,0,id)));await expect(publish(page)).toBeEnabled();const before=await rows(page);
  await page.evaluate(()=>{const native=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,key){const request=native.call(this,value,key);if(this.name==='packs'){IDBObjectStore.prototype.add=native;request.addEventListener('success',()=>{Object.defineProperty(request,'error',{value:new DOMException('QA question import quota','QuotaExceededError')});request.dispatchEvent(new Event('error'));this.transaction.abort();});}return request;};});
  await publish(page).click();await expect(panel(page).getByRole('alert')).toBeVisible();expect(await rows(page)).toEqual(before);await expect(publish(page)).toBeEnabled();
  await publish(page).click();await expect(panel(page).getByRole('status')).toContainText('v1: 2 câu');const saved=await stored(page,id);expect(saved).toHaveLength(1);expect(saved[0].version).toBe(1);expect(saved[0].items.map(item=>item.id)).toEqual(['qa-item-0','qa-item-1']);
});

test('BA19: direct game entry cannot replace a reserved lesson pack before self-study installs its immutable library',async({page})=>{
  const id='math-multiply-form-1';await creator(page,'/?advanced=1&view=games&controls=1');expect(await stored(page,id)).toEqual([]);await panel(page).getByLabel('Bộ đích',{exact:true}).selectOption('');
  await upload(page,serializeQuestionCsv(matrix(2,0,id)));await expect(publish(page)).toBeEnabled();const before=await rows(page);await publish(page).click();await expect(panel(page).getByRole('alert')).toContainText('Mã bộ đã có dữ liệu khác');expect(await rows(page)).toEqual(before);
  await page.getByRole('button',{name:'Tự học',exact:true}).click();const card=page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia',exact:true});await expect(card.getByRole('button',{name:'Học bài này',exact:true})).toBeEnabled();
  const reserved=LIBRARY_PACKS.find(pack=>pack.id===id)!;expect((await stored(page,id)).find(pack=>pack.version===reserved.version)).toEqual(reserved);await card.getByRole('button',{name:'Học bài này',exact:true}).click();await expect(page.getByRole('article',{name:'Thẻ kiến thức',exact:true})).toBeVisible();
});

for(const format of ['CSV','JSON','XLSX'] as const)test(`BA19: ${format} downloaded from a reviewed target creates draft questions and keeps the reviewed source immutable`,async({page})=>{
  await creator(page);const id=`ba19-review-draft-${format.toLowerCase()}`,data=matrix(2,0,id);for(const row of data.slice(1))row[col('reviewStatus')]='reviewed';await saveCsv(page,data,'v1: 2 câu');const source=(await stored(page,id))[0];expect(source.templateInfo?.reviewStatus).toBe('reviewed');expect(source.items.every(item=>item.metadata?.reviewStatus==='reviewed')).toBe(true);
  await panel(page).getByLabel('Bộ đích',{exact:true}).selectOption(`${id}@1`);const file=await downloaded(page,panel(page).getByRole('button',{name:`Tải mẫu ${format}`,exact:true})),parsed=parseQuestionDocument(new Uint8Array(file.bytes),format.toLowerCase(),{includeExamples:true});
  expect(parsed.errors).toEqual([]);expect(parsed.validCount).toBe(2);expect(parsed.pack?.templateInfo?.reviewStatus).toBe('draft');expect(parsed.pack?.items.every(item=>item.metadata?.reviewStatus==='draft'&&item.metadata?.contentRole==='unassigned')).toBe(true);expect(await stored(page,id)).toEqual([source]);
});
