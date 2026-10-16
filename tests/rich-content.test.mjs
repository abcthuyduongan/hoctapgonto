import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RICH_CURRICULA,RICH_PACKS,PILOT_PACKS } from '../src/core/lesson-seed.ts';
import { normalizedNumber,richContextFingerprint } from '../src/core/rich-content.ts';
import { scoreLearningResponse,validateCurriculum } from '../src/core/curriculum.ts';
import { validatePack } from '../src/core/validation.ts';
import { parseContentImport,serializeContentExport } from '../src/core/content-io.ts';
import { parseLearningBackup,serializeLearningBackup } from '../src/core/backup-io.ts';
import { buildLessonSession } from '../src/core/lesson-host.ts';
import { makeLessonSubmission } from '../src/core/learning-runtime.ts';
const ref=(pack,item=pack.items[0])=>({packId:pack.id,contentVersion:pack.version,itemId:item.id});
test('Rich library keeps published v2 bytes and validates all new forms and media refs',()=>{
  for(const old of PILOT_PACKS)assert.deepEqual(RICH_PACKS.find(pack=>pack.id===old.id&&pack.version===old.version),old);
  assert.equal(RICH_PACKS.filter(pack=>pack.kind==='learning').length,8);
  for(const pack of RICH_PACKS)assert.deepEqual(validatePack(pack),[],pack.id);
  for(const curriculum of RICH_CURRICULA)assert.deepEqual(validateCurriculum(curriculum,RICH_PACKS),[]);
});
test('Number policy compares decimal text exactly without float rounding, supports comma and rejects invalid syntax',()=>{
  for(const [input,expected] of [['0006,00','6'],['+0.50','0.5'],['-0','0'],['-01,200','-1.2'],['9007199254740993','9007199254740993']])assert.equal(normalizedNumber(input),expected);
  for(const input of ['NaN','Infinity','6e0','1.2.3','1 2','', '9'.repeat(41)])assert.equal(normalizedNumber(input),undefined);
  const pack=RICH_PACKS.find(pack=>pack.id==='math-multiply-nhap-so');assert.equal(scoreLearningResponse(ref(pack),{version:1,kind:'text',value:'0006,00'},RICH_PACKS),true);
  assert.equal(scoreLearningResponse(ref(pack),{version:1,kind:'text',value:'6.000000000000000001'},RICH_PACKS),false);
});
test('Word policy preserves Vietnamese accents, normalizes NFC and follows explicit case sensitivity',()=>{
  const pack=RICH_PACKS.find(pack=>pack.id==='vi-opposites-dien-tu');assert.equal(scoreLearningResponse(ref(pack),{version:1,kind:'text',value:'  HẸP '.normalize('NFD')},RICH_PACKS),true);
  assert.equal(scoreLearningResponse(ref(pack),{version:1,kind:'text',value:'hep'},RICH_PACKS),false);
  const strict=structuredClone(pack);strict.items[0].caseSensitive=true;assert.equal(scoreLearningResponse(ref(strict),{version:1,kind:'text',value:'HẸP'},[strict]),false);
});
test('Format 2 round-trips rich data and v1 remains readable; unsupported types and missing catalogs are rejected',()=>{
  const pack=RICH_PACKS.find(pack=>pack.kind==='learning');const serialized=serializeContentExport([pack]);assert.equal(JSON.parse(serialized).formatVersion,2);
  assert.deepEqual(parseContentImport(serialized)[0].items,pack.items);
  const old=JSON.parse(serializeContentExport([PILOT_PACKS[0]]));assert.equal(old.formatVersion,1);assert.equal(parseContentImport(JSON.stringify(old)).length,1);
  const wrong=JSON.parse(serialized);wrong.formatVersion=1;assert.throws(()=>parseContentImport(JSON.stringify(wrong)),/phiên bản 2/);
  const audio=structuredClone(RICH_PACKS.find(pack=>pack.id==='en-family-nghe-chon'));audio.media[0].url='https://example.com/audio.wav';assert.ok(validatePack(audio).length);
  audio.media=[];assert.ok(validatePack(audio).some(error=>error.includes('thiếu âm thanh')));
  const reading=structuredClone(RICH_PACKS.find(pack=>pack.id==='vi-reading-doc-doan'));reading.passages=[];assert.ok(validatePack(reading).some(error=>error.includes('thiếu đoạn đọc')));
});
test('Every packaged clip is a real PCM WAV with positive duration, exact SHA and a matching authored transcript',()=>{
  const media=RICH_CURRICULA.flatMap(row=>row.media);assert.equal(media.length,10);
  for(const clip of media){const bytes=readFileSync(`public${clip.url}`);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),clip.sha256);let rate=0,size=0;
    for(let offset=12;offset+8<=bytes.length;){const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4);if(kind==='fmt '){assert.equal(bytes.readUInt16LE(offset+8),1);rate=bytes.readUInt32LE(offset+16);}if(kind==='data')size=length;offset+=8+length+(length%2);}
    assert.ok(size/rate>1&&size/rate<20,clip.mediaId);
  }
  const family=RICH_PACKS.find(pack=>pack.id==='en-family-nghe-chon');for(const item of family.items)assert.equal(family.media.find(clip=>clip.mediaId===item.audioId).transcript,`This is my ${item.options[item.correctIndex]}.`);
});
test('Re-encoding a known narration or relabelling the same passage never creates independent context',()=>{
  const audio=RICH_PACKS.find(pack=>pack.id==='en-family-nghe-chon'),copy=structuredClone(audio);copy.id='audio-reencoded';copy.media[0].sha256='f'.repeat(64);copy.media[0].transcript=copy.media[0].transcript.toUpperCase().replace('.','!');
  assert.equal(richContextFingerprint(ref(audio),[audio]),richContextFingerprint(ref(copy),[copy]));
  const reading=RICH_PACKS.find(pack=>pack.id==='vi-reading-doc-doan'),second=structuredClone(reading);second.id='reading-relabelled';second.passages[0].body=second.passages[0].body.toUpperCase();second.items.forEach((item,index)=>{item.id=`other-${index}`;item.prompt+=' Chọn đúng.';});
  const curriculum=structuredClone(RICH_CURRICULA.find(row=>row.subject==='vietnamese')),lesson=curriculum.lessons.find(row=>row.lessonId==='vi-reading'),form=structuredClone(lesson.forms.find(form=>form.formId===reading.id));
  form.formId='other-reading-form';form.role='assessment';form.activityId='lesson-assessment';form.itemRefs=second.items.map(item=>ref(second,item));lesson.forms.push(form);
  assert.ok(validateCurriculum(curriculum,[...RICH_PACKS,second]).some(error=>error.includes('ngữ liệu/âm thanh')));
});
test('Host rejects a listening answer before a pinned playback receipt, then validates its real media hash',()=>{
  const curriculum=RICH_CURRICULA.find(row=>row.subject==='english'),lesson=curriculum.lessons[0],pack=RICH_PACKS.find(pack=>pack.id==='en-family-nghe-chon'),form=lesson.forms.find(form=>form.formId===pack.id);
  const context={curricula:RICH_CURRICULA,packs:RICH_PACKS,sessions:[],events:[],results:[]},start='2026-10-16T01:00:00.000Z';
  const session=buildLessonSession('audio-learner',curriculum,lesson,form,context,'owner','audio-unit-session',start),input={attemptKey:'audio-answer',itemRef:form.itemRefs[0],response:{version:1,kind:'choice',selectedIndex:pack.items[0].correctIndex},hintsUsed:0,elapsedMs:5000};
  assert.throws(()=>makeLessonSubmission(session,[],input,'2026-10-16T01:00:10.000Z',context),/nghe clip/);
  session.checkpoint.mediaPlayback=[{mediaId:pack.media[0].mediaId,sha256:pack.media[0].sha256,completedAt:'2026-10-16T01:00:05.000Z'}];session.checkpoint.updatedAt='2026-10-16T01:00:05.000Z';
  assert.equal(makeLessonSubmission(session,[],input,'2026-10-16T01:00:10.000Z',context).event.correct,true);
});
test('Backup preserves standalone rich packs and all referenced passage/audio metadata without claiming results',()=>{
  const source={packs:RICH_PACKS,sessions:[],events:[],profiles:[],reviews:[],curricula:RICH_CURRICULA,sessionResults:[],lessonProgress:[]};
  const restored=parseLearningBackup(serializeLearningBackup(source,'2026-10-16T01:00:00.000Z'));
  assert.deepEqual(restored.packs,RICH_PACKS);assert.deepEqual(restored.curricula,RICH_CURRICULA);assert.deepEqual(restored.sessionResults,[]);
});
