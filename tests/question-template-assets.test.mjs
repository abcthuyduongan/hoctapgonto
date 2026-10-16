import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {parseQuestionWorkbookBytes} from '../src/core/excel-import.ts';
import {QUESTION_HEADERS,templateDefinitions,parseQuestionDocument} from '../src/core/question-import.ts';
import {LIBRARY_PACKS} from '../src/core/lesson-seed.ts';
import {validatePack} from '../src/core/validation.ts';

const base=new URL('../public/',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('question-templates/catalog.json',base),'utf8'));
const mediaCatalog=LIBRARY_PACKS.flatMap(pack=>pack.kind==='learning'?pack.media:[]);
const options={includeExamples:true,mediaCatalog,now:'2026-10-16T01:00:00.000Z'};

test('Download catalog contains exactly the eight supported types, each with blank and example variants and versioned local paths',()=>{
  assert.equal(catalog.length,16);const seen=new Set();
  for(const row of catalog){
    const definition=templateDefinitions.find(item=>item.kind===row.kind);assert.ok(definition,row.kind);assert.equal(row.id,definition.id);assert.equal(row.subject,definition.subject);
    assert.equal(row.templateVersion,1);assert.equal(row.contentFormatVersion,2);assert.equal(typeof row.examples,'boolean');
    assert.match(row.base,/^\/question-templates\/[A-Za-z0-9_-]+$/);assert.equal(seen.has(`${row.id}:${row.examples}`),false);seen.add(`${row.id}:${row.examples}`);
  }
});
test('All 48 real download files parse offline, with 2 valid examples or an empty editable draft and matching per-item data',()=>{
  for(const entry of catalog){
    let expected;
    for(const extension of ['csv','json','xlsx']){
      const bytes=readFileSync(new URL(`${entry.base.slice(1)}.${extension}`,base));assert.ok(bytes.length<1024*1024);
      if(extension==='csv')assert.deepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf],entry.id);
      if(extension==='xlsx'){
        assert.equal(bytes.toString('ascii',0,2),'PK');const zip=unzipSync(bytes);assert.ok(zip['[Content_Types].xml']);assert.ok(zip['xl/_rels/workbook.xml.rels']);
        const workbook=parseQuestionWorkbookBytes(bytes);assert.deepEqual(Object.keys(workbook.sheets),['Hướng dẫn','Thông tin bộ','Câu hỏi']);assert.deepEqual(workbook.sheets['Câu hỏi'][0],QUESTION_HEADERS);
      }
      const preview=parseQuestionDocument(bytes,extension,options);assert.deepEqual(preview.errors,[],`${entry.id}.${extension}`);
      assert.equal(preview.validCount,entry.examples?2:0,`${entry.id}.${extension}`);assert.equal(preview.readCount,entry.examples?2:0);
      if(entry.examples){
        assert.equal(preview.exampleCount,2);assert.deepEqual(validatePack(preview.pack),[]);assert.equal(preview.pack.subject,entry.subject);assert.equal(preview.pack.grade,3);
        for(const item of preview.pack.items){assert.match(item.id,/^[a-zA-Z0-9._:-]{1,80}$/);assert.ok(item.objectiveId);assert.ok(item.metadata.knowledgeId);assert.ok(item.metadata.source);assert.ok(item.metadata.rights);assert.equal(item.metadata.reviewStatus,'draft');}
        if(expected)assert.deepEqual(preview.pack.items,expected,`${entry.id}: ${extension} must retain IDs, objectives, answers and item metadata`);else expected=preview.pack.items;
      }else assert.equal(preview.pack,undefined);
    }
  }
});
test('Example files require the explicit include-examples choice and do not silently add their questions by default',()=>{
  for(const entry of catalog.filter(row=>row.examples))for(const extension of ['xlsx','csv','json']){
    const preview=parseQuestionDocument(readFileSync(new URL(`${entry.base.slice(1)}.${extension}`,base)),extension,{mediaCatalog});
    assert.equal(preview.readCount,2);assert.equal(preview.exampleCount,2);assert.equal(preview.validCount,0);assert.equal(preview.pack,undefined);
  }
});
