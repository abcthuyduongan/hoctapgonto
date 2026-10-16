import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,readdirSync,unlinkSync,rmdirSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {planReviewedCatalog,writeReviewedCatalogAtomic,REVIEWED_CATALOG_PATH} from '../tools/review_content_catalog.mjs';
import {templateMatrix,parseQuestionMatrix} from '../src/core/question-import.ts';
import {serializeContentExport} from '../src/core/content-io.ts';
import {LIBRARY_PACKS,LIBRARY_CURRICULA,RICH_CURRICULA} from '../src/core/lesson-seed.ts';
import {BUILTIN_PACKS} from '../src/core/seed.ts';

const empty=()=>({schemaVersion:1,packs:[],curricula:[]});
function reviewedPack(id='bo-da-ra-soat'){
  const matrix=templateMatrix('quiz');for(const row of matrix.slice(1))row[matrix[0].indexOf('reviewStatus')]='reviewed';
  const result=parseQuestionMatrix(matrix,{includeExamples:true});assert.deepEqual(result.errors,[]);result.pack.id=id;return result.pack;
}
const plan=(options)=>planReviewedCatalog({catalog:empty(),...options});
test('Release catalog also reserves every legacy built-in pack/version before optional self-study installation',()=>{
  const pack=reviewedPack(BUILTIN_PACKS[0].id);pack.version=BUILTIN_PACKS[0].version;
  const report=plan({inputPacks:[pack]});assert.equal(report.ok,false);assert.ok(report.conflicts.some(row=>row.key===`${pack.id}@${pack.version}`));assert.equal(report.nextCatalog,undefined);
});
function temporary(){const parent=join(cwd,'test-results');mkdirSync(parent,{recursive:true});const folder=mkdtempSync(join(parent,'bao-an-catalog-'));return {folder,clean(){for(const name of readdirSync(folder))unlinkSync(join(folder,name));rmdirSync(folder);}};}
const tool=fileURLToPath(new URL('../tools/review_content_catalog.mjs',import.meta.url));
const cwd=fileURLToPath(new URL('../',import.meta.url));
function cli(args){return spawnSync(process.execPath,['--experimental-strip-types',tool,...args],{cwd,encoding:'utf8',timeout:15000});}

test('Release additions require explicit reviewed source/rights metadata on every question and its pack',()=>{
  const draft=reviewedPack();draft.templateInfo.reviewStatus='draft';draft.items[1].metadata.reviewStatus='draft';
  const report=plan({inputPacks:[draft]});assert.equal(report.ok,false);assert.equal(report.nextCatalog,undefined);assert.equal(report.requiredMissing.length,2);assert.ok(report.requiredMissing.some(row=>row.path.includes('items[1]')));
  const legacy=reviewedPack();delete legacy.templateInfo;delete legacy.items[0].metadata;const missing=plan({inputPacks:[legacy]});assert.equal(missing.ok,false);assert.ok(missing.requiredMissing.length>=2);
});
test('Reviewed pack additions retain IDs/metadata, normalize release origin, and leave old catalog bytes untouched',()=>{
  const pack=reviewedPack(),catalog=empty(),before=JSON.stringify(catalog),report=planReviewedCatalog({catalog,inputPacks:[pack]});
  assert.equal(report.ok,true);assert.deepEqual(report.additions,{packs:1,curricula:0});assert.equal(JSON.stringify(catalog),before);assert.equal(pack.source,'local');
  assert.equal(report.nextCatalog.packs[0].source,'builtin');assert.deepEqual(report.nextCatalog.packs[0].items,pack.items);
  const again=planReviewedCatalog({catalog:report.nextCatalog,inputPacks:[pack]});assert.equal(again.ok,true);assert.equal(again.duplicates.packs,1);assert.equal(again.additions.packs,0);
});
test('Same published pack/version with changed content conflicts; a new version preserves all previous versions',()=>{
  const pack=reviewedPack(),catalog=plan({inputPacks:[pack]}).nextCatalog,changed=structuredClone(pack);changed.items[0].explanation='Lời giải được sửa sau khi rà soát.';
  const conflict=planReviewedCatalog({catalog,inputPacks:[changed]});assert.equal(conflict.ok,false);assert.equal(conflict.conflicts[0].key,`${pack.id}@1`);assert.equal(conflict.nextCatalog,undefined);
  changed.version=2;const added=planReviewedCatalog({catalog,inputPacks:[changed]});assert.equal(added.ok,true);assert.deepEqual(added.nextCatalog.packs[0],catalog.packs[0]);assert.equal(added.nextCatalog.packs[1].version,2);
  const older=structuredClone(pack);older.version=1;older.id='bo-cao-nhat';const high=structuredClone(older);high.version=3;
  const gap=plan({catalog:{schemaVersion:1,packs:[high],curricula:[]},inputPacks:[older]});assert.equal(gap.ok,false);assert.ok(gap.conflicts[0].message.includes('cao nhất'));
});
test('New full curriculum revisions validate pinned pack/item refs; unchanged snapshots deduplicate and changed old revisions conflict',()=>{
  const original=RICH_CURRICULA.find(row=>row.subject==='math'),snapshot=structuredClone(original);snapshot.revision=original.revision+1;snapshot.title+=' · Đã rà soát';
  const added=plan({incomingCurricula:[snapshot]});assert.equal(added.ok,true);assert.equal(added.additions.curricula,1);assert.deepEqual(added.nextCatalog.curricula[0],snapshot);
  const same=plan({incomingCurricula:[original]});assert.equal(same.ok,true);assert.equal(same.duplicates.curricula,1);
  const changed=structuredClone(original);changed.title+=' · sửa';const conflict=plan({incomingCurricula:[changed]});assert.equal(conflict.ok,false);assert.equal(conflict.conflicts[0].type,'curriculum');
  const missing=structuredClone(snapshot);missing.lessons[0].forms[0].itemRefs[0].packId='bo-chua-co';const bad=plan({incomingCurricula:[missing]});assert.equal(bad.ok,false);assert.ok(bad.errors.some(error=>error.includes('thiếu câu')));
  assert.equal(LIBRARY_CURRICULA.find(row=>row.curriculumId===original.curriculumId&&row.revision===original.revision).title,original.title);assert.ok(LIBRARY_PACKS.length>0);
});
test('Malformed existing catalog or question input fails without returning a writable plan',()=>{
  assert.equal(plan({catalog:{schemaVersion:1,packs:[],curricula:[null]}}).ok,false);
  assert.equal(plan({inputPacks:[{id:'untrusted',items:[null]}]}).ok,false);
  const catalog={schemaVersion:1,packs:[reviewedPack()],curricula:[]};catalog.packs[0].publishedAt='not-time';assert.equal(plan({catalog}).ok,false);
});
test('Atomic writer replaces the entire reviewed catalog and refuses stale previews or a concurrent lock',()=>{
  const temp=temporary();try{
    const file=join(temp.folder,'reviewed-additions.json'),raw=JSON.stringify(empty()),next=plan({inputPacks:[reviewedPack()]}).nextCatalog;writeFileSync(file,raw);
    writeReviewedCatalogAtomic(file,raw,next);assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),next);assert.deepEqual(readdirSync(temp.folder),['reviewed-additions.json']);
    assert.throws(()=>writeReviewedCatalogAtomic(file,raw,empty()),/đã thay đổi/);assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),next);
    writeFileSync(`${file}.lock`,'other process');assert.throws(()=>writeReviewedCatalogAtomic(file,readFileSync(file,'utf8'),empty()),/khóa/);assert.equal(readFileSync(`${file}.lock`,'utf8'),'other process');assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),next);
  }finally{temp.clean();}
});
test('CLI defaults to check, reports additions, and never writes a real release catalog during review',()=>{
  const temp=temporary(),before=readFileSync(REVIEWED_CATALOG_PATH,'utf8');try{
    const input=join(temp.folder,'reviewed.json');writeFileSync(input,serializeContentExport([reviewedPack('cli-reviewed-catalog')]));
    const result=cli(['--input',input]);assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);assert.equal(report.status,'PASS');assert.equal(report.mode,'check');assert.equal(report.written,false);assert.equal(resolve(report.output),resolve(REVIEWED_CATALOG_PATH));assert.equal(report.additions.packs,1);assert.equal(readFileSync(REVIEWED_CATALOG_PATH,'utf8'),before);
  }finally{temp.clean();}
});
test('CLI rejects unreviewed input, missing refs and custom output paths without modifying release source',()=>{
  const temp=temporary(),before=readFileSync(REVIEWED_CATALOG_PATH,'utf8');try{
    const input=join(temp.folder,'draft.json'),pack=reviewedPack();pack.items[0].metadata.reviewStatus='draft';writeFileSync(input,serializeContentExport([pack]));
    const draft=cli(['--input',input,'--write']);assert.equal(draft.status,1,draft.stderr);assert.equal(JSON.parse(draft.stdout).written,false);assert.ok(JSON.parse(draft.stdout).requiredMissing.length>0);
    const prohibited=join(temp.folder,'outside.json'),output=cli(['--input',input,'--write','--output',prohibited]);assert.equal(output.status,1);assert.equal(existsSync(prohibited),false);
    pack.items[0].metadata.reviewStatus='reviewed';writeFileSync(input,serializeContentExport([pack]));const snapshot=structuredClone(RICH_CURRICULA[0]);snapshot.revision=99;snapshot.lessons[0].forms[0].itemRefs[0].itemId='khong-ton-tai';
    const curriculum=join(temp.folder,'snapshot.json');writeFileSync(curriculum,JSON.stringify(snapshot));const bad=cli(['--input',input,'--curriculum',curriculum,'--check']);assert.equal(bad.status,1);assert.ok(JSON.parse(bad.stdout).errors.some(error=>error.includes('thiếu câu')));assert.equal(readFileSync(REVIEWED_CATALOG_PATH,'utf8'),before);
  }finally{temp.clean();}
});
