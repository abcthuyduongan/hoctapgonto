import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,unzipSync} from 'fflate';
import {parseQuestionWorkbookBytes} from '../src/core/excel-import.ts';
import {QUESTION_HEADERS,templateDefinitions,templateMatrix,questionTemplateMetadata,questionMetadataMatrix,serializeQuestionCsv,serializeQuestionTemplate,parseQuestionMatrix,parseQuestionDocument,mergeQuestionPreview} from '../src/core/question-import.ts';
import {parseQuestionBytesInWorker} from '../src/core/question-import-client.ts';
import {RICH_PACKS} from '../src/core/lesson-seed.ts';
import {validatePack} from '../src/core/validation.ts';
import {serializeContentExport,parseContentImport} from '../src/core/content-io.ts';
const now='2026-10-16T01:00:00.000Z';
const mediaCatalog=RICH_PACKS.flatMap(pack=>pack.kind==='learning'?pack.media:[]);
const options={includeExamples:true,now,mediaCatalog};
const encode=value=>new TextEncoder().encode(value);
const column=key=>QUESTION_HEADERS.indexOf(key);
const xml=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const letter=index=>index<26?String.fromCharCode(65+index):`A${String.fromCharCode(65+index-26)}`;
function worksheet(rows,numbers){return '<worksheet><sheetData>'+rows.map((row,index)=>{const n=numbers?.[index]??index+1;return `<row r="${n}">`+row.map((cell,column)=>`<c r="${letter(column)}${n}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`).join('')+'</row>';}).join('')+'</sheetData></worksheet>';}
function workbook(kind='quiz',{rows=templateMatrix(kind),metadata=questionTemplateMetadata(kind),missingQuestions=false,rowNumbers}={}){
  const names=['Hướng dẫn','Thông tin bộ',...missingQuestions?[]:['Câu hỏi']];
  const files={
    'xl/workbook.xml':`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,index)=>`<sheet name="${name}" sheetId="${index+1}" r:id="ref${index+1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships>${names.map((_name,index)=>`<Relationship Id="ref${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/custom-${index+5}.xml"/>`).join('')}</Relationships>`,
    'xl/worksheets/custom-5.xml':worksheet([['ĐÂY LÀ HƯỚNG DẪN, KHÔNG PHẢI CÂU HỎI']]),
    'xl/worksheets/custom-6.xml':worksheet(questionMetadataMatrix(metadata)),
    ...!missingQuestions?{'xl/worksheets/custom-7.xml':worksheet(rows,rowNumbers)}:{},
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name,body])=>[name,encode(body)])));
}
function generated(count,start=0,metadata={}){
  const matrix=templateMatrix('quiz');matrix.splice(1);
  for(let i=start;i<start+count;i++){
    const row=templateMatrix('quiz')[1];row[column('itemId')]=`item-${i}`;row[column('prompt')]=`Bài tự biên soạn ${i}: ${i}+1 = ?`;
    row[column('optionA')]=String(i);row[column('optionB')]=String(i+1);row[column('optionC')]=String(i+2);row[column('optionD')]=String(i+3);row[column('answer')]='B';
    row[column('isExample')]='false';for(const [key,value] of Object.entries(metadata))row[column(key)]=value;matrix.push(row);
  }
  return parseQuestionMatrix(matrix,options);
}

test('Eight supported templates round-trip UTF-8 CSV and JSON with per-question metadata and stable generated IDs',()=>{
  for(const definition of templateDefinitions){
    const matrix=templateMatrix(definition.kind);matrix[2][column('objectiveId')]='khac-muc-tieu';matrix[2][column('knowledgeId')]='khac-kien-thuc';matrix[2][column('difficulty')]='hard';matrix[2][column('formId')]='form-khac';
    const csv=serializeQuestionCsv(matrix);assert.equal(csv[0],'\uFEFF');
    const first=parseQuestionDocument(encode(csv),'CSV',options),again=parseQuestionDocument(encode(csv),'csv',options);
    assert.equal(first.readCount,2,definition.kind);assert.equal(first.validCount,2,definition.kind);assert.deepEqual(first.errors,[],definition.kind);assert.deepEqual(first.pack.items,again.pack.items);
    assert.equal(first.pack.items[1].objectiveId,'khac-muc-tieu');assert.equal(first.pack.items[1].metadata.knowledgeId,'khac-kien-thuc');assert.equal(first.pack.items[1].metadata.difficulty,'hard');assert.equal(first.pack.items[1].metadata.formId,'form-khac');
    const text=serializeQuestionTemplate(definition.kind,first.pack),json=parseQuestionDocument(encode(text),'json',options);
    assert.deepEqual(json.pack.items,first.pack.items,definition.kind);
    assert.deepEqual(validatePack(json.pack),[],definition.kind);
  }
});
test('CSV header mapping is independent of order, preserves accents, and examples are explicitly excluded by default',()=>{
  const original=templateMatrix('fill-blank'),reversed=original.map(row=>[...row].reverse());
  const preview=parseQuestionDocument(encode(serializeQuestionCsv(reversed)),'csv',options);assert.deepEqual(preview.errors,[]);assert.equal(preview.pack.items[0].acceptedAnswers[0],'hẹp');
  const excluded=parseQuestionDocument(encode(serializeQuestionCsv(reversed)),'csv',{now});assert.equal(excluded.readCount,2);assert.equal(excluded.exampleCount,2);assert.equal(excluded.validCount,0);assert.equal(excluded.pack,undefined);
  const blank=parseQuestionMatrix(templateMatrix('quiz',undefined,false),options);assert.equal(blank.readCount,0);assert.equal(blank.validCount,0);
});
test('CSV row errors retain physical lines through blank rows and quoted multiline content',()=>{
  const matrix=templateMatrix('quiz');matrix[1][column('prompt')]='Câu hỏi\ncó hai dòng';matrix[2][column('answer')]='';
  const text=serializeQuestionCsv(matrix).replace('\r\n','\r\n\r\n'),preview=parseQuestionDocument(encode(text),'csv',options);
  assert.ok(preview.errors.some(error=>error.row===5&&error.column==='answer'));
});
test('XLSX locates Câu hỏi through workbook relationship and reads metadata from separate second sheet',()=>{
  const rows=templateMatrix('quiz');for(const row of rows.slice(1))for(const key of ['packId','packTitle','subject','grade','kind','topicId','source','rights','reviewStatus'])row[column(key)]='';
  const metadata={...questionTemplateMetadata('quiz'),packTitle:'Tiếng Việt giữ dấu',subject:'vietnamese',packId:'tieng-viet-rieng'};
  const bytes=workbook('quiz',{rows,metadata}),result=parseQuestionDocument(bytes,'xlsx',options);
  assert.equal(result.pack.title,metadata.packTitle);assert.equal(result.pack.subject,'vietnamese');assert.equal(result.validCount,2);assert.deepEqual(result.errors,[]);
  assert.equal(parseQuestionWorkbookBytes(bytes).sheets['Câu hỏi'][0][0],'templateVersion');
  assert.throws(()=>parseQuestionDocument(workbook('quiz',{missingQuestions:true}),'xlsx',options),/thiếu sheet “Câu hỏi”/);
  assert.throws(()=>parseQuestionDocument(workbook('quiz',{metadata:{...metadata,templateVersion:'999'}}),'xlsx',options),/templateVersion 1/);
});
test('XLSX errors retain physical sparse row numbers and reject formulas instead of cached answers',()=>{
  const rows=templateMatrix('quiz');rows[1][column('answer')]='';
  const result=parseQuestionDocument(workbook('quiz',{rows,rowNumbers:[1,27,79]}),'xlsx',options);
  assert.ok(result.errors.some(error=>error.row===27&&error.column==='answer'));assert.equal(result.rows[0].row,79);
  const bytes=workbook('quiz'),files=unzipSync(bytes);
  // A cached value in a formula cell is still forbidden.
  files['xl/worksheets/custom-7.xml']=encode('<worksheet><sheetData><row r="1"><c r="A1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>');
  assert.throws(()=>parseQuestionDocument(zipSync(files),'xlsx',options),/A1.*công thức/);
});
test('Bad answers, metadata, duplicate headers and future format are explicit row/column errors',()=>{
  const bad=templateMatrix('quiz');bad[1][column('answer')]='Z';bad[2][column('knowledgeId')]='';
  const result=parseQuestionMatrix(bad,options);assert.equal(result.validCount,0);assert.ok(result.errors.some(error=>error.row===2&&error.column==='answer'));assert.ok(result.errors.some(error=>error.row===3&&error.column==='knowledgeId'));
  const duplicate=templateMatrix('quiz');duplicate[0][1]=duplicate[0][0];assert.ok(parseQuestionMatrix(duplicate,options).errors.some(error=>error.row===1&&error.message.includes('trùng')));
  const future=JSON.parse(serializeQuestionTemplate('quiz'));future.templateVersion=2;assert.throws(()=>parseQuestionDocument(encode(JSON.stringify(future)),'json',options),/phiên bản 1/);
});
test('Partial question rows are counted and rejected, and unsupported CSV versions are reported even when examples are excluded',()=>{
  const partial=templateMatrix('quiz',undefined,false);partial[1][column('optionB')]='Chưa có đề bài';
  const preview=parseQuestionMatrix(partial,options);assert.equal(preview.readCount,1);assert.equal(preview.validCount,0);assert.ok(preview.errors.some(error=>error.row===2&&error.column==='prompt'));
  const future=templateMatrix('quiz');future[1][column('templateVersion')]='99';
  assert.ok(parseQuestionMatrix(future,{now}).errors.some(error=>error.row===2&&error.column==='templateVersion'));
});
test('Listening templates accept only pinned known audio and matching transcript',()=>{
  const rows=templateMatrix('listening-choice');rows[1][column('audioTranscript')]='Nội dung khác';
  const result=parseQuestionMatrix(rows,options);assert.equal(result.validCount,1);assert.ok(result.errors.some(error=>error.row===2&&error.column==='audioTranscript'));
  rows[1][column('audioId')]='https://example.com/private.wav';assert.ok(parseQuestionMatrix(rows,options).errors.some(error=>error.column==='audioId'));
});
test('Append 5 questions to published 10 produces immutable 15-question version; reimport does not add duplicate IDs',()=>{
  const target=generated(10).pack,before=structuredClone(target),incoming=generated(5,10),merged=mergeQuestionPreview(target,incoming,{now});
  assert.deepEqual(merged.errors,[]);assert.equal(merged.beforeCount,10);assert.equal(merged.afterCount,15);assert.equal(merged.addedCount,5);assert.equal(merged.pack.version,2);assert.deepEqual(target,before);assert.deepEqual(merged.pack.items.slice(0,10),before.items);
  const replay=mergeQuestionPreview(merged.pack,incoming,{now});assert.equal(replay.addedCount,0);assert.equal(replay.duplicateCount,5);assert.equal(replay.afterCount,15);
});
test('Stable generated IDs survive repeated imports and same ID changes require explicit revision or new-ID choice',()=>{
  const target=parseQuestionMatrix(templateMatrix('quiz'),options).pack,incoming=parseQuestionMatrix(templateMatrix('quiz'),options);
  const replay=mergeQuestionPreview(target,incoming,{now});assert.equal(replay.duplicateCount,2);assert.equal(replay.addedCount,0);
  incoming.rows[0].item.explanation='Giải thích đã sửa có chủ ý.';incoming.pack.items[0]=incoming.rows[0].item;
  const unresolved=mergeQuestionPreview(target,incoming,{now});assert.equal(unresolved.pack,undefined);assert.equal(unresolved.conflictCount,1);
  const itemId=incoming.rows[0].item.id,revision=mergeQuestionPreview(target,incoming,{now,conflicts:{[itemId]:'revision'}});
  assert.equal(revision.pack.version,2);assert.equal(revision.pack.items.length,2);assert.equal(revision.pack.items[0].explanation,incoming.rows[0].item.explanation);assert.notEqual(target.items[0].explanation,incoming.rows[0].item.explanation);
  // Keeping another ID for the identical question is visible and subject to the pack's duplicate-content validator.
  const extra=mergeQuestionPreview(target,incoming,{now,conflicts:{[itemId]:'new-id'}});assert.equal(extra.pack,undefined);assert.ok(extra.errors.length>0);
});
test('Same content under another ID is reported; over 30 questions is never truncated',()=>{
  const target=generated(10).pack,duplicate=generated(2,0);duplicate.rows[0].item.id='different-id';duplicate.rows[1].item.id='different-id-2';
  const preview=mergeQuestionPreview(target,duplicate,{now});assert.equal(preview.conflictCount,2);assert.ok(preview.conflicts.every(row=>row.type==='same-content-different-id'));assert.equal(preview.pack,undefined);
  const overflow=mergeQuestionPreview(generated(28).pack,generated(5,30),{now});assert.equal(overflow.afterCount,33);assert.equal(overflow.pack,undefined);assert.match(overflow.errors.at(-1).message,/33.*30/);
  const tooMany=generated(31);assert.equal(tooMany.validCount,31);assert.equal(tooMany.pack.items.length,31);assert.ok(tooMany.errors.some(error=>error.row===0&&/30/.test(error.message)));
});
test('JSON content format v1 remains readable and new metadata is preserved in content-only format v2',()=>{
  const target=generated(2).pack,serialized=serializeContentExport([target]),parsed=parseQuestionDocument(encode(serialized),'json',options);
  assert.equal(parsed.packs.length,1);assert.deepEqual(parsed.pack.items,target.items);assert.deepEqual(parseContentImport(serialized)[0].templateInfo,target.templateInfo);
  const raw=JSON.parse(serialized);raw.formatVersion=1;assert.equal(parseQuestionDocument(encode(JSON.stringify(raw)),'json',options).validCount,2);
});
test('Worker cancellation terminates parsing immediately and a completed parse releases its worker',async()=>{
  const original=globalThis.Worker,instances=[];
  class FakeWorker {constructor(){instances.push(this);}postMessage(value){this.value=value;}terminate(){this.terminated=true;}}
  globalThis.Worker=FakeWorker;
  try{
    const controller=new AbortController(),promise=parseQuestionBytesInWorker(encode('payload'),'csv',{signal:controller.signal});controller.abort();
    await assert.rejects(promise,error=>error.name==='AbortError');assert.equal(instances[0].terminated,true);assert.equal(instances[0].onmessage,null);
    const success=parseQuestionBytesInWorker(encode('next'),'csv'),expected=generated(2);instances[1].onmessage({data:{ok:true,preview:expected}});assert.deepEqual(await success,expected);assert.equal(instances[1].terminated,true);
    const alreadyAborted=new AbortController();alreadyAborted.abort();await assert.rejects(parseQuestionBytesInWorker(encode('x'),'csv',{signal:alreadyAborted.signal}),error=>error.name==='AbortError');assert.equal(instances.length,2);
  }finally{globalThis.Worker=original;}
});
