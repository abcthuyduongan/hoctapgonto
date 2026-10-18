import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {zipSync,unzipSync} from 'fflate';
import {onlineGameCompatibility} from '../src/core/game-compatibility.ts';
import {gameRestrictionError} from '../src/core/game-policy.ts';
import {onlinePresentation} from '../src/core/online-exercises.ts';
import {gamePresentation} from '../src/core/game-presentation.ts';
import {validatePack} from '../src/core/validation.ts';
import {parseOnlineQuestions} from '../src/core/online-content.ts';
import {ONLINE_DOCUMENT_HEADERS,parseOnlineDocument,inspectOnlineDocument} from '../src/core/online-document-import.ts';
import {onlineGeneratedItemId,onlineImmutablePackIdentity,onlineSemanticPackIdentity} from '../src/core/online-import-identity.ts';
import {OnlineStore} from '../server/online-store.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';

const metadata=()=>({knowledgeId:'AUTHOR.TEST',difficulty:'medium',contentRole:'unassigned',source:'Tự soạn',rights:'Cho phép sử dụng',reviewStatus:'draft'});
function quiz(){return{id:'game-policy-source',version:1,title:'Bộ có giới hạn trò',kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-15T00:00:00.000Z',items:[
  {id:'author-01',kind:'multiple-choice',objectiveId:'AUTHOR.TEST',metadata:metadata(),prompt:'Câu hỏi một?',options:['Mây','Gió','Nắng','Mưa'],correctIndex:2,explanation:'Đáp án một.'},
  {id:'author-02',kind:'multiple-choice',objectiveId:'AUTHOR.TEST',metadata:metadata(),prompt:'Câu hỏi hai?',options:['Hoa','Lá','Cành','Rễ'],correctIndex:1,explanation:'Đáp án hai.'},
]};}
const allowed=result=>result.games.filter(game=>game.allowed).map(game=>game.id);

test('Question two can limit the whole source to two games without dropping or changing items',()=>{
  const pack=quiz();pack.items[1].metadata.allowedGameIds=['memory-match','word-connect'];const before=structuredClone(pack);
  const result=onlineGameCompatibility(pack);
  assert.deepEqual(validatePack(pack),[]);assert.deepEqual(allowed(result),['memory-match','word-connect']);
  assert.deepEqual(allowed(result.items[0]),['math-quest','memory-match','word-connect']);assert.deepEqual(allowed(result.items[1]),['memory-match','word-connect']);
  assert.match(result.games.find(game=>game.id==='math-quest').reason,/Câu 2.*Người soạn/);
  assert.equal(onlinePresentation('math-quest',pack),undefined);assert.equal(gamePresentation('math-quest',pack),undefined);
  for(const gameId of allowed(result)){const view=onlinePresentation(gameId,pack);assert.equal(view.items.length,pack.items.length);assert.deepEqual(view.items.map(item=>item.id),pack.items.map(item=>item.id));}
  assert.deepEqual(pack,before);
});

test('Compatibility explains matching limits and ambiguous faces in the actual group',()=>{
  const pack=quiz();pack.items[1].prompt='x'.repeat(120);assert.deepEqual(allowed(onlineGameCompatibility(pack)),['math-quest','memory-match','word-connect']);
  pack.items[1].prompt+='x';let result=onlineGameCompatibility(pack);assert.deepEqual(allowed(result),['math-quest']);
  assert.equal(result.items[0].games.find(game=>game.id==='memory-match').allowed,true);assert.match(result.items[1].games.find(game=>game.id==='memory-match').reason,/120 ký tự/);
  pack.items[1].prompt='Câu hỏi hai?';pack.items[1].options[1]=' NẮNG ';result=onlineGameCompatibility(pack);
  assert.deepEqual(allowed(result),['math-quest']);assert.match(result.items[0].games.find(game=>game.id==='word-connect').reason,/trùng câu 2/);assert.match(result.items[1].games.find(game=>game.id==='word-connect').reason,/trùng câu 1/);
});

test('Pair conversion explains the group minimum and author restrictions cannot force unsupported games',()=>{
  const pack={...quiz(),kind:'pairs',items:[1,2,3].map(i=>({kind:'pair',id:`pair-${i}`,objectiveId:'AUTHOR.TEST',left:`Trước ${i}`,right:`Sau ${i}`,metadata:metadata()}))};
  let result=onlineGameCompatibility(pack);assert.deepEqual(allowed(result),['memory-match','word-connect']);assert.match(result.items[1].games.find(game=>game.id==='math-quest').reason,/ít nhất 4 cặp/);
  pack.items.push({kind:'pair',id:'pair-4',objectiveId:'AUTHOR.TEST',left:'Trước 4',right:'Sau 4',metadata:metadata()});assert.deepEqual(allowed(onlineGameCompatibility(pack)),['math-quest','memory-match','word-connect']);
  pack.items[1].metadata.allowedGameIds=['sentence-builder'];result=onlineGameCompatibility(pack);assert.deepEqual(allowed(result),[]);assert.equal(onlinePresentation('sentence-builder',pack),undefined);
});

test('Rich contexts and sentence order respect the same author intersection without inventing missing structure',()=>{
  const rich={...quiz(),kind:'learning',contentFormatVersion:2,passages:[],media:[],items:[1,2].map(i=>({kind:'numeric-answer',id:`number-${i}`,objectiveId:'AUTHOR.TEST',metadata:metadata(),prompt:`Nhập số ${i}`,answer:String(i),hint:'Dùng chữ số.',explanation:`Đáp án ${i}.`}))};
  assert.deepEqual(validatePack(rich),[]);assert.deepEqual(allowed(onlineGameCompatibility(rich)),['math-quest']);
  rich.items[1].metadata.allowedGameIds=['memory-match','word-connect'];assert.deepEqual(allowed(onlineGameCompatibility(rich)),[]);assert.equal(onlinePresentation('math-quest',rich),undefined);assert.equal(onlinePresentation('memory-match',rich),undefined);
  const sentences={...quiz(),kind:'sentences',items:[{kind:'sentence',id:'order-1',objectiveId:'AUTHOR.TEST',metadata:{...metadata(),allowedGameIds:['sentence-builder']},prompt:'Sắp xếp câu thứ nhất.',words:['Em','yêu','cây.'],hint:'Bắt đầu bằng Em.'},
    {kind:'sentence',id:'order-2',objectiveId:'AUTHOR.TEST',metadata:metadata(),prompt:'Sắp xếp câu thứ hai.',words:['Em','đọc','sách.'],hint:'Bắt đầu bằng Em.'}]};
  assert.deepEqual(validatePack(sentences),[]);assert.deepEqual(allowed(onlineGameCompatibility(sentences)),['sentence-builder']);
  sentences.items[1].metadata.allowedGameIds=['sequence-trail'];assert.deepEqual(allowed(onlineGameCompatibility(sentences)),[]);
});

test('Policy validation rejects empty, duplicate, unknown and malformed game lists',()=>{
  for(const value of[[],['math-quest','math-quest'],['unknown'],'math-quest',null,[1]]){
    assert.ok(gameRestrictionError(value));const pack=quiz();pack.items[0].metadata.allowedGameIds=value;assert.ok(validatePack(pack).some(error=>error.includes('allowedGameIds')));
    assert.equal(onlinePresentation('math-quest',pack),undefined);
    assert.throws(()=>parseOnlineQuestions(JSON.stringify({kind:'quiz',items:pack.items}),'questions.json',{id:pack.id,version:1,title:pack.title,grade:3}),/allowedGameIds/);
  }
});

test('A policy-only edit keeps generated item and reward identity but changes immutable source identity',()=>{
  const pack=quiz(),changed=structuredClone(pack);changed.items[1].metadata.allowedGameIds=['memory-match','word-connect'];
  assert.equal(onlineGeneratedItemId(pack.items[1]),onlineGeneratedItemId(changed.items[1]));assert.equal(onlineSemanticPackIdentity(pack),onlineSemanticPackIdentity(changed));
  assert.notEqual(onlineImmutablePackIdentity(pack),onlineImmutablePackIdentity(changed));
  const parsed=parseOnlineQuestions(JSON.stringify({kind:'quiz',items:changed.items}),'questions.json',{id:pack.id,version:2,title:pack.title,grade:3});
  assert.deepEqual(parsed.items[1].metadata.allowedGameIds,['memory-match','word-connect']);assert.equal(parsed.items[1].id,pack.items[1].id);
});

const encode=value=>new TextEncoder().encode(value),decode=value=>new TextDecoder().decode(value),xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function wordPolicyRows(rows){
  const marker='<w:tbl><w:tr><w:tc><w:p><w:r><w:t>schema</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>baoan-online-week</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>formatVersion</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
  const table=row=>'<w:tbl>'+[['field','value'],...Object.entries(row)].map(cells=>'<w:tr>'+cells.map(cell=>`<w:tc><w:p><w:r><w:t>${xml(cell)}</w:t></w:r></w:p></w:tc>`).join('')+'</w:tr>').join('')+'</w:tbl>';
  return zipSync({'word/document.xml':encode(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${marker}${rows.map(table).join('')}</w:body></w:document>`)});
}
async function excelPolicyRows(rows,headers=ONLINE_DOCUMENT_HEADERS){
  const files=unzipSync(await readFile(new URL('../public/question-templates/online-week.xlsx',import.meta.url)));
  const workbook=decode(files['xl/workbook.xml']),rels=decode(files['xl/_rels/workbook.xml.rels']);
  const tag=[...workbook.matchAll(/<(?:\w+:)?sheet\b[^>]*\/>/g)].find(match=>/name="Câu hỏi"/.test(match[0]))[0],id=/r:id="([^"]+)"/.exec(tag)[1];
  const relationship=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].find(match=>match[0].includes(`Id="${id}"`))[0],target=/Target="([^"]+)"/.exec(relationship)[1];
  const column=index=>index<26?String.fromCharCode(65+index):'A'+String.fromCharCode(65+index-26);
  const matrix=[['baoan-online-week','1'],[...headers],...rows.map(row=>headers.map(header=>row[header]??''))];
  files[target.startsWith('/')?target.slice(1):'xl/'+target]=encode('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+matrix.map((cells,index)=>`<row r="${index+1}">`+cells.map((cell,i)=>`<c r="${column(i)}${index+1}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>');return zipSync(files);
}
for(const [extension,builder] of[['docx',wordPolicyRows],['xlsx',excelPolicyRows]])test(`${extension}: optional author policy imports, diagnoses bad rows and preserves generated IDs`,async()=>{
  const rows=[1,2].map(i=>({subjectLabel:'Môn của tác giả',kind:'quiz',prompt:`Yêu cầu ${i}`,A:`Đúng ${i}`,B:`Sai ${i} B`,C:`Sai ${i} C`,D:`Sai ${i} D`,answer:'A'}));
  const context={idPrefix:'policy-template',title:'Tuần mẫu',grade:3};
  const original=await parseOnlineDocument(await builder(rows,ONLINE_DOCUMENT_HEADERS.filter(header=>header!=='allowedGameIds')),`questions.${extension}`,context,[]);rows[1].allowedGameIds='memory-match|word-connect';
  const changed=await parseOnlineDocument(await builder(rows),`questions.${extension}`,context,[]);
  assert.deepEqual(changed.sets[0].pack.items.map(item=>item.id),original.sets[0].pack.items.map(item=>item.id));assert.deepEqual(allowed(onlineGameCompatibility(changed.sets[0].pack)),['memory-match','word-connect']);
  rows.push({...rows[0],prompt:'Câu lỗi',allowedGameIds:'unknown'});const report=await inspectOnlineDocument(await builder(rows),`questions.${extension}`,context,[]);
  assert.equal(report.acceptedQuestions,2);assert.equal(report.issues.length,1);assert.match(report.issues[0].message,/allowedGameIds/);assert.match(report.issues[0].location,extension==='docx'?/bảng 4/:/dòng 5/);
});

async function sqliteFixture(t){
  const store=new OnlineStore(':memory:'),workspaceId=randomUUID(),userId=randomUUID(),at=new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Đơn vị SQLite',at);
  store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(userId,workspaceId,'manager','salt:manager',at);
  t.after(()=>store.close());return{store,admin:{id:userId,workspaceId,username:'manager',role:'admin'}};
}
for(const[name,fixture] of[['SQLite',sqliteFixture],['PostgreSQL',createPostgresFixture]])test(`${name}: policy revision rejects excluded games and keeps old evidence and the source star ceiling`,async t=>{
  const {store,admin}=await fixture(t),classroom=await store.createClass(admin,{name:'Lớp giới hạn trò',grade:3});
  const student=await store.createStudent(admin,{name:'An',classId:classroom.id,username:'policy-learner'},'salt:student','policy-learner');
  const user=name==='SQLite'?store.db.prepare("SELECT * FROM users WHERE username='policy-learner'").get():await store.findUserByUsername('policy-learner');
  const auth={id:user.id,workspaceId:admin.workspaceId,username:user.username,role:'student',studentId:student.id};
  const source=quiz(),input={requestId:'policy-original',classId:classroom.id,title:'Tuần giới hạn trò',sets:[{subjectLabel:'Môn tự soạn',pack:source}]},week=await seedLegacyWeek(store,admin,input);
  const play=await store.startPlay(auth,{requestId:'before-policy',packId:source.id,contentVersion:1,moduleId:'math-quest'});
  for(const item of source.items)await store.attempt(auth,play.session.sessionId,{attemptKey:item.id,itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100});
  assert.equal((await store.finishPlay(auth,play.session.sessionId)).gained,3);
  const changed=structuredClone(source);changed.version=2;changed.items[1].metadata.allowedGameIds=['memory-match','word-connect'];
  await store.publishWeek(admin,{...input,requestId:'policy-revision',replaceWeekId:week.id,sets:[{subjectLabel:'Môn tự soạn',pack:changed}]});
  await assert.rejects(Promise.resolve().then(()=>store.startPlay(auth,{requestId:'excluded-after-policy',packId:source.id,contentVersion:2,moduleId:'math-quest'})),error=>error.status===400);
  const next=await store.startPlay(auth,{requestId:'allowed-after-policy',packId:source.id,contentVersion:2,moduleId:'memory-match'});
  for(const item of next.presentation.items)await store.attempt(auth,next.session.sessionId,{attemptKey:item.id,itemId:item.id,response:{kind:'pair',first:{itemId:item.id,side:'left'},second:{itemId:item.id,side:'right'}},hintsUsed:0,elapsedMs:100});
  assert.equal((await store.finishPlay(auth,next.session.sessionId)).gained,0);assert.equal((await store.studentState(auth)).balance.earned,3);
  assert.equal((await store.play(auth,play.session.sessionId)).pack.version,1);
  const copied=structuredClone(changed);copied.id='policy-copy';copied.version=1;await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,{...input,requestId:'copy-policy',title:'Tuần sao chép',sets:[{subjectLabel:'Môn tự soạn',pack:copied}]})),error=>error.status===409);
  const incompatible=structuredClone(changed);incompatible.version=3;incompatible.items[0].metadata.allowedGameIds=['math-quest'];
  await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,{...input,requestId:'policy-no-common',replaceWeekId:week.id,sets:[{subjectLabel:'Môn tự soạn',pack:incompatible}]})),error=>error.status===400&&/trò chung/.test(error.message));
});
