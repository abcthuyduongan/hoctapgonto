import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {zipSync,unzipSync} from 'fflate';
import {ONLINE_DOCUMENT_HEADERS,ONLINE_DOCUMENT_KINDS,parseOnlineDocument} from '../src/core/online-document-import.ts';
import {parseQuestionWorkbookBytes} from '../src/core/excel-import.ts';
import {questionExportWorkbook,packExportRows} from '../src/core/question-export.ts';
import {exportQuestionStats} from '../server/admin-data.mjs';

const context={idPrefix:'export-week',grade:3,title:'Tuần xuất thử'};
const media=[
  {id:'image-asset',name:'hình ảnh.png',mime:'image/png',kind:'image',size:200,sha256:'a'.repeat(64)},
  {id:'audio-asset',name:'bài nghe.mp3',mime:'audio/mpeg',kind:'audio',size:500,sha256:'b'.repeat(64)},
];
const encode=value=>new TextEncoder().encode(value),decode=value=>new TextDecoder().decode(value);
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const column=index=>index<26?String.fromCharCode(65+index):'A'+String.fromCharCode(65+index-26);
const emptyXlsx=await fs.readFile(new URL('../public/question-templates/online-week.xlsx',import.meta.url));
function rows(){return ONLINE_DOCUMENT_KINDS.flatMap(kind=>[1,2].map(n=>{
  const common={subjectLabel:kind.startsWith('listening')?'Tiếng Anh':kind==='numeric-answer'||kind==='quiz'||kind==='compare'||kind==='categorize'?'Toán':'Tiếng Việt',kind,title:`Bộ ${kind}`,topic:`Chủ đề ${kind}`,competition:'Violympic',level:'Lớp 3',
    itemId:`exp.${kind}.${n}`,objectiveId:'EXP.OBJ',source:'Người soạn',rights:'Tự sở hữu',difficulty:n===1?'easy':'hard',...(kind==='pairs'?{allowedGameIds:'memory-match|word-connect'}:{})};
  const prompt=`Câu ${kind} số ${n} có dấu "ngoặc" & <ký tự>`;
  if(kind==='quiz')return {...common,prompt,A:'mây',B:'gió',C:'nắng',D:'mưa',answer:'C',explanation:'Vì trời nắng.',imageFile:'hình ảnh.png',imageAlt:'Đám mây'};
  if(kind==='pairs')return {...common,left:`Trước ${n}`,right:`Sau ${n}`};
  if(kind==='sentences')return {...common,prompt,words:n===1?'Em|chăm|học.':'Bé|đọc|sách|hay.',hint:'Bắt đầu bằng chữ hoa.'};
  if(kind==='numeric-answer')return {...common,prompt,answer:n===1?'0':'12,5',unit:'cm',hint:'Đếm kỹ.',explanation:'Tính từng bước.'};
  if(kind==='fill-blank')return {...common,prompt,acceptedAnswers:'từ một|từ hai',caseSensitive:n===1?'false':'true'};
  if(kind==='reading-choice')return {...common,prompt,A:'một',B:'hai',C:'ba',D:'bốn',answer:'B',passageTitle:'Đoạn tự soạn',passage:'Đây là đoạn văn\ncó hai dòng.'};
  if(kind==='listening-choice')return {...common,prompt,A:'one',B:'two',C:'three',D:'four',answer:'A',audioFile:'bài nghe.mp3',audioTranscript:'Number one.'};
  if(kind==='compare')return {...common,prompt,left:`${n*5} + 3`,right:`${n*10}`,operator:'<',answer:'<',explanation:`${n*5 + 3} < ${n*10}`};
  if(kind==='categorize')return {...common,prompt,categories:'Hoa quả|Động vật',elements:'Táo:Hoa quả|Chó:Động vật|Mèo:Động vật|Cam:Hoa quả',explanation:'Phân loại hoa quả và động vật.'};
  return {...common,prompt,acceptedAnswers:'cat',audioFile:'bài nghe.mp3',audioTranscript:'Number one.'};
}));}
function authoredXlsx(questionRows){
  const files=unzipSync(emptyXlsx),workbook=decode(files['xl/workbook.xml']).replace(/(<\/?)[A-Za-z_][\w.-]*:/g,'$1'),rels=decode(files['xl/_rels/workbook.xml.rels']);
  const tag=[...workbook.matchAll(/<sheet\b[^>]*\/>/g)].find(match=>/name="Câu hỏi"/.test(match[0]))[0],id=/r:id="([^"]+)"/.exec(tag)[1];
  const target=/Target="([^"]+)"/.exec([...rels.matchAll(/<Relationship\b[^>]*\/>/g)].find(match=>match[0].includes(`Id="${id}"`))[0])[1],file=target.startsWith('/xl/')?target.slice(1):`xl/${target}`;
  const matrix=[['baoan-online-week','1'],[...ONLINE_DOCUMENT_HEADERS],...questionRows.map(row=>ONLINE_DOCUMENT_HEADERS.map(key=>row[key]??''))];
  files[file]=encode('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+matrix.map((row,index)=>`<row r="${index+1}">`+row.map((cell,i)=>`<c r="${column(i)}${index+1}" t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>');
  return zipSync(files);
}
const comparable=week=>week.sets.map(set=>({subjectLabel:set.subjectLabel,title:set.pack.title,kind:set.pack.kind,items:set.pack.items,passages:set.pack.passages,media:set.pack.media,...(set.pack.discovery?{discovery:set.pack.discovery}:{})})).sort((a,b)=>(a.subjectLabel+a.title).localeCompare(b.subjectLabel+b.title));

test('a week exported to Excel re-imports to identical questions, answers, media and metadata for all eight kinds',async()=>{
  const original=await parseOnlineDocument(authoredXlsx(rows()),'week.xlsx',context,media);
  assert.equal(original.sets.reduce((n,set)=>n+set.pack.items.length,0),16);
  const data={exportedAt:'2026-11-04T00:00:00.000Z',week:{id:'w1',title:'Tuần xuất thử',position:1,classId:'c1',className:'Lớp 3A'},sets:original.sets.map(set=>({subjectLabel:set.subjectLabel,pack:set.pack})),media,classStudents:2,statsTruncated:false,stats:{}};
  const {bytes,fileName,questions}=questionExportWorkbook(data);assert.equal(questions,16);assert.equal(fileName,'Lớp 3A - Tuần xuất thử - cau hoi va dap an.xlsx');
  const reimported=await parseOnlineDocument(bytes,'export.xlsx',context,media);
  assert.deepEqual(comparable(reimported),comparable(original));
  const workbook=parseQuestionWorkbookBytes(bytes);assert.deepEqual(Object.keys(workbook.sheets),['Thông tin bộ','Câu hỏi','Thống kê','Gợi ý bộ sau','Hướng dẫn']);
  assert.deepEqual(workbook.sheets['Câu hỏi'][1],[...ONLINE_DOCUMENT_HEADERS]);
});

test('Cổng C2: a week with discovery cards exported to Excel re-imports round-trip without shifting any row or dropping metadata',async()=>{
  const original=await parseOnlineDocument(authoredXlsx(rows()),'week.xlsx',context,media);
  // Attach distinct discovery card to sets
  original.sets.forEach((set, idx) => {
    set.pack.discovery = {
      title: `Khám phá chặng ${idx + 1} môn ${set.subjectLabel}`,
      text: `Chào mừng con đến với ${set.subjectLabel} tuần học này! Cùng tìm hiểu điều thú vị nhé.`,
      imageFile: 'hình ảnh.png',
      imageId: 'image-asset',
    };
  });
  const data={exportedAt:'2026-11-04T00:00:00.000Z',week:{id:'w1',title:'Tuần xuất thử có thẻ',position:1,classId:'c1',className:'Lớp 3A'},sets:original.sets.map(set=>({subjectLabel:set.subjectLabel,pack:set.pack})),media,classStudents:2,statsTruncated:false,stats:{}};
  const {bytes,questions}=questionExportWorkbook(data);
  assert.equal(questions,16);
  const reimported=await parseOnlineDocument(bytes,'export-with-discovery.xlsx',context,media);
  assert.deepEqual(comparable(reimported),comparable(original));
  const workbook=parseQuestionWorkbookBytes(bytes);
  const infoSheet=workbook.sheets['Thông tin bộ'];
  // Verify sheet Thông tin bộ has discovery columns and rows
  const headerRow=infoSheet.find(row=>row.includes('discoveryTitle'));
  assert.ok(headerRow,'Sheet Thông tin bộ must contain discoveryTitle column');
  assert.deepEqual(headerRow,['subjectLabel','title','discoveryTitle','discoveryText','discoveryImageFile']);
  // Verify discovery cards on each re-imported set
  reimported.sets.forEach((set, idx) => {
    assert.ok(set.pack.discovery, `Set ${set.subjectLabel} - ${set.pack.title} must have discovery card`);
    assert.equal(set.pack.discovery.title, `Khám phá chặng ${idx + 1} môn ${set.subjectLabel}`);
    assert.equal(set.pack.discovery.imageFile, 'hình ảnh.png');
    assert.equal(set.pack.discovery.imageId, 'image-asset');
  });
});
test('statistics count first-try accuracy, wrong answers and class stars without student names',()=>{
  const pack={id:'p1',items:[{id:'q1'},{id:'q2'}]},sets=[{pack}];
  const at=minute=>`2026-11-04T00:0${minute}:00.000Z`;
  const events=[
    {studentId:'s1',event:{packId:'p1',itemId:'q1',correct:false,elapsedMs:9000,occurredAt:at(1),response:{kind:'choice',choiceIndex:1}}},
    {studentId:'s1',event:{packId:'p1',itemId:'q1',correct:true,elapsedMs:12000,occurredAt:at(2),response:{kind:'choice',choiceIndex:2}}},
    {studentId:'s2',event:{packId:'p1',itemId:'q1',correct:true,elapsedMs:4000,occurredAt:at(1),response:{kind:'choice',choiceIndex:2}}},
    {studentId:'s3',event:{packId:'p1',itemId:'q1',correct:false,elapsedMs:4000,occurredAt:at(1),response:{kind:'choice',choiceIndex:1}}},
    {studentId:'s3',event:{packId:'other',itemId:'q1',correct:true,elapsedMs:1,occurredAt:at(1)}},
  ];
  const awards=[{pack_id:'p1',json:JSON.stringify({questionLedger:{questionTiers:{q1:3}}})},{pack_id:'p1',json:{questionLedger:{questionTiers:{q1:1,q2:2}}}}];
  const stats=exportQuestionStats(sets,events,awards,4);
  assert.deepEqual(stats.p1.q1,{students:3,firstTryCorrect:1,attempts:4,wrong:2,medianCorrectMs:8000,tiers:[2,1,0,1],commonWrong:{answer:'B',count:2}});
  assert.deepEqual(stats.p1.q2,{students:0,firstTryCorrect:0,attempts:0,wrong:0,medianCorrectMs:null,tiers:[3,0,1,0],commonWrong:null});
});
test('a question whose media file is missing from the library is reported instead of exported half-empty',()=>{
  const pack={id:'p',title:'Bộ',kind:'quiz',items:[{id:'q',kind:'multiple-choice',objectiveId:'O',prompt:'?',options:['a','b','c','d'],correctIndex:0,explanation:'x',media:{imageId:'gone',imageAlt:'ảnh'}}]};
  assert.throws(()=>packExportRows(pack,{subjectLabel:'Toán',weekTitle:'T',mediaName:()=>undefined}),/gone/);
});

import {randomUUID} from 'node:crypto';
import {OnlineStore} from '../server/online-store.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import {adminExport} from '../server/admin-data.mjs';
const meta=()=>({knowledgeId:'EXPORT.TEST',difficulty:'medium',contentRole:'unassigned',source:'Tự soạn',rights:'Cho phép sử dụng',reviewStatus:'draft',topicId:'Phép nhân'});
const quizPack=()=>({id:'export-api-source',version:1,title:'Bảng nhân',kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-15T00:00:00.000Z',items:[
  {id:'mul-01',kind:'multiple-choice',objectiveId:'EXPORT.TEST',metadata:meta(),prompt:'3 × 4 = ?',options:['7','12','34','9'],correctIndex:1,explanation:'3 nhóm 4.'},
  {id:'mul-02',kind:'multiple-choice',objectiveId:'EXPORT.TEST',metadata:meta(),prompt:'6 × 7 = ?',options:['42','36','48','13'],correctIndex:0,explanation:'6 × 7 = 42.'},
]});
async function sqliteFixture(t){
  const store=new OnlineStore(':memory:'),workspaceId=randomUUID(),userId=randomUUID(),at=new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Đơn vị SQLite',at);
  store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(userId,workspaceId,'manager','salt:manager',at);
  t.after(()=>store.close());return{store,admin:{id:userId,workspaceId,username:'manager',role:'admin'}};
}
for(const[name,fixture] of[['SQLite',sqliteFixture],['PostgreSQL',createPostgresFixture]])test(`${name}: admin export returns answers and class statistics, and students cannot use it`,async t=>{
  const {store,admin}=await fixture(t),classroom=await store.createClass(admin,{name:'Lớp 3A',grade:3});
  const student=await store.createStudent(admin,{name:'An',classId:classroom.id,username:'export-learner'},'salt:student','export-learner');
  const user=name==='SQLite'?store.db.prepare("SELECT * FROM users WHERE username='export-learner'").get():await store.findUserByUsername('export-learner');
  const auth={id:user.id,workspaceId:admin.workspaceId,username:user.username,role:'student',studentId:student.id};
  const source=quizPack(),week=await seedLegacyWeek(store,admin,{requestId:'export-week',classId:classroom.id,title:'Tuần 5',sets:[{subjectLabel:'Toán',pack:source}]});
  const play=await store.startPlay(auth,{requestId:'export-play',packId:source.id,contentVersion:1,moduleId:'math-quest'});
  await store.attempt(auth,play.session.sessionId,{attemptKey:'wrong',itemId:'mul-01',response:{kind:'choice',choiceIndex:0},hintsUsed:0,elapsedMs:100});
  for(const item of source.items)await store.attempt(auth,play.session.sessionId,{attemptKey:item.id,itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100});
  await store.finishPlay(auth,play.session.sessionId);
  const data=await adminExport(store,admin,week.id);
  assert.equal(data.week.className,'Lớp 3A');assert.equal(data.week.title,'Tuần 5');assert.equal(data.classStudents,1);
  assert.equal(data.sets[0].pack.items[1].correctIndex,0,'the export carries the answer key');
  assert.equal(data.stats[source.id]['mul-01'].firstTryCorrect,0);assert.equal(data.stats[source.id]['mul-01'].wrong,1);assert.deepEqual(data.stats[source.id]['mul-01'].commonWrong,{answer:'A',count:1});
  assert.equal(data.stats[source.id]['mul-02'].firstTryCorrect,1);assert.equal(data.stats[source.id]['mul-01'].tiers.reduce((a,b)=>a+b,0),1);
  assert.doesNotMatch(JSON.stringify(data),/export-learner|"An"/);
  const workbook=parseQuestionWorkbookBytes(questionExportWorkbook(data).bytes);assert.equal(workbook.sheets['Câu hỏi'].length,4);
  await assert.rejects(Promise.resolve().then(()=>adminExport(store,auth,week.id)),error=>error.status===403);
});
