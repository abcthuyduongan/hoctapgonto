import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {zipSync,unzipSync} from 'fflate';
import {ONLINE_DOCUMENT_HEADERS,ONLINE_DOCUMENT_KINDS,parseOnlineDocument,inspectOnlineDocument,onlineDocumentGameChoices} from '../src/core/online-document-import.ts';
import {parseQuestionWorkbookBytes} from '../src/core/excel-import.ts';
import {validatePack} from '../src/core/validation.ts';
import {onlinePresentation,onlineScoreResponse} from '../src/core/online-exercises.ts';
import {onlineDocumentSourceId} from '../src/core/online-document-import.ts';

const context={idPrefix:'author-week',grade:5,title:'Tuần do tác giả soạn'};
const media=[
  {id:'image-asset',name:'hình ảnh.png',mime:'image/png',kind:'image',size:200,sha256:'a'.repeat(64)},
  {id:'audio-asset',name:'bài nghe.mp3',mime:'audio/mpeg',kind:'audio',size:500,sha256:'b'.repeat(64)},
];
const encode=value=>new TextEncoder().encode(value);
const decode=value=>new TextDecoder().decode(value);
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const column=index=>index<26?String.fromCharCode(65+index):'A'+String.fromCharCode(65+index-26);
const emptyDocx=await fs.readFile(new URL('../public/question-templates/online-week.docx',import.meta.url));
const emptyXlsx=await fs.readFile(new URL('../public/question-templates/online-week.xlsx',import.meta.url));
function rows(){return ONLINE_DOCUMENT_KINDS.flatMap(kind=>[1,2].map(n=>{
  const common={subjectLabel:`Nhãn tác giả ${kind}`,kind,title:`Bộ ${kind}`,topic:'Chủ đề tự đặt',competition:'Tên cuộc thi tự đặt',level:'Mức riêng',
    itemId:`author.${kind}.${n}`,objectiveId:'AUTHOR.OBJECTIVE',source:'Người biên soạn',rights:'Tự sở hữu'};
  const prompt=`Yêu cầu ${kind} số ${n}`;
  if(kind==='quiz')return {...common,prompt,A:'mây',B:'gió',C:'nắng',D:'mưa',answer:'C',imageFile:'hình ảnh.png',imageAlt:'Đám mây trên bầu trời'};
  if(kind==='pairs')return {...common,left:`Trước ${n}`,right:`Sau ${n}`};
  if(kind==='sentences')return {...common,prompt,answer:n===1?'một hai ba':'bốn năm sáu'};
  if(kind==='numeric-answer')return {...common,prompt,answer:n===1?'0':'-12,5',unit:'đơn vị'};
  if(kind==='fill-blank')return {...common,prompt,acceptedAnswers:'từ một|từ hai',caseSensitive:'false'};
  if(kind==='reading-choice')return {...common,prompt,A:'một',B:'hai',C:'ba',D:'bốn',answer:'B',passageTitle:'Đoạn tự soạn',passage:'Đây là đoạn văn do người soạn cung cấp.'};
  if(kind==='listening-choice')return {...common,prompt,A:'một',B:'hai',C:'ba',D:'bốn',answer:'A',audioFile:'bài nghe.mp3',audioTranscript:'Nội dung âm thanh do tác giả soạn.'};
  return {...common,prompt,acceptedAnswers:'nội dung',audioFile:'bài nghe.mp3',audioTranscript:'Nội dung âm thanh do tác giả soạn.'};
}));}
function worksheet(matrix){return '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+matrix.map((row,index)=>`<row r="${index+1}">`+row.map((cell,i)=>`<c r="${column(i)}${index+1}" t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>';}
function populatedXlsx(questionRows=rows(),mutate){
  const files=unzipSync(emptyXlsx),workbook=decode(files['xl/workbook.xml']).replace(/(<\/?)[A-Za-z_][\w.-]*:/g,'$1'),rels=decode(files['xl/_rels/workbook.xml.rels']);
  const tag=[...workbook.matchAll(/<sheet\b[^>]*\/>/g)].find(match=>/name="Câu hỏi"/.test(match[0]))[0];
  const id=/r:id="([^"]+)"/.exec(tag)[1],relation=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].find(match=>match[0].includes(`Id="${id}"`))[0];
  const target=/Target="([^"]+)"/.exec(relation)[1],file=target.startsWith('/xl/')?target.slice(1):`xl/${target}`;
  const matrix=[['baoan-online-week','1'],[...ONLINE_DOCUMENT_HEADERS],...questionRows.map(row=>ONLINE_DOCUMENT_HEADERS.map(key=>row[key]??''))];
  files[file]=encode(worksheet(matrix));if(mutate)mutate(files,file);return zipSync(files);
}
function recordTable(row){return '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>field</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>value</w:t></w:r></w:p></w:tc></w:tr>'+Object.entries(row).map(([key,value])=>`<w:tr><w:tc><w:p><w:r><w:t>${xml(key)}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${xml(value)}</w:t></w:r></w:p></w:tc></w:tr>`).join('')+'</w:tbl>';}
function populatedDocx(questionRows=rows(),mutate){
  const files=unzipSync(emptyDocx),original=decode(files['word/document.xml']);
  const marker='<w:tbl><w:tr><w:tc><w:p><w:r><w:t>schema</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>baoan-online-week</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>formatVersion</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
  files['word/document.xml']=encode(original.replace(/<w:body>.*?<\/w:body>/s,`<w:body>${marker}${recordTable({kind:'quiz'})}${questionRows.map(recordTable).join('')}<w:sectPr/></w:body>`));
  if(mutate)mutate(files);return zipSync(files);
}
const importFile=(bytes,name='week.xlsx',assets=media)=>parseOnlineDocument(bytes,name,context,assets);

test('Large workspace media catalogs do not block text or referenced media imports',async()=>{
  for(const count of [300,301,1000]){
    const catalog=Array.from({length:count},(_,i)=>({...media[0],id:`unrelated-${i}`,name:`unrelated-${i}.png`}));
    for(const [name,create] of [['week.docx',populatedDocx],['week.xlsx',populatedXlsx]]){
      const textRows=rows().filter(row=>row.kind==='pairs');
      assert.equal((await importFile(create(textRows),name,catalog)).sets.length,1);
      const audioRows=rows().filter(row=>row.kind==='listening-choice');
      const result=await importFile(create(audioRows),name,[...catalog,...media]);
      assert.equal(result.sets[0].pack.items[0].audioId,'audio-asset');
      const imageRows=rows().filter(row=>row.kind==='quiz');
      assert.equal((await importFile(create(imageRows),name,[...catalog,...media])).sets[0].pack.items[0].media.imageId,'image-asset');
      await assert.rejects(importFile(create(imageRows),name,[...catalog,...media,{...media[0],id:'duplicate-image'}]),/đúng một tệp/);
      await assert.rejects(importFile(create(imageRows),name,[...catalog,{...media[0],sha256:'bad'}]),/catalog không hợp lệ/);
    }
  }
});

test('Imported pairs preserve every correct answer when presented as quizzes for all supported sizes',async()=>{
  for(let count=4;count<=30;count++){
    const input=Array.from({length:count},(_,i)=>({kind:'pairs',subjectLabel:'Nối cặp',title:'Bộ kiểm tra',left:`Trái ${i}`,right:`Phải ${i}`}));
    const source=(await importFile(populatedXlsx(input))).sets[0].pack;
    const view=onlinePresentation('math-quest',source);assert.deepEqual(validatePack(view),[]);
    for(let i=0;i<count;i++){
      const item=view.items[i];assert.equal(item.id,source.items[i].id);
      assert.equal(item.options[item.correctIndex],source.items[i].right);assert.equal(new Set(item.options).size,4);
      for(let choiceIndex=0;choiceIndex<4;choiceIndex++)assert.equal(
        onlineScoreResponse(source,'math-quest',item.id,{kind:'choice',choiceIndex}).correct,choiceIndex===item.correctIndex);
    }
  }
});

test('The actual exported blank Word and Excel templates contain all eight kinds and import no sample questions',async()=>{
  assert.ok(emptyDocx.byteLength>1000);assert.ok(emptyXlsx.byteLength>1000);
  const workbook=parseQuestionWorkbookBytes(emptyXlsx),questions=workbook.sheets['Câu hỏi'];
  assert.deepEqual(questions[1],ONLINE_DOCUMENT_HEADERS);
  assert.deepEqual([...new Set(questions.slice(2).map(row=>row[1]))],ONLINE_DOCUMENT_KINDS);
  const docXml=decode(unzipSync(emptyDocx)['word/document.xml']);for(const kind of ONLINE_DOCUMENT_KINDS)assert.ok(docXml.includes(kind));
  await assert.rejects(importFile(emptyXlsx),/Mẫu chưa có câu hỏi/);
  await assert.rejects(importFile(emptyDocx,'week.docx'),/Mẫu chưa có câu hỏi/);
});

test('Actual XLSX package populated with eight types retains author labels, metadata, answers and media',async()=>{
  const result=await importFile(populatedXlsx());assert.equal(result.title,context.title);assert.equal(result.sets.length,8);
  for(const [index,{subjectLabel,pack}] of result.sets.entries()){
    assert.equal(subjectLabel,`Nhãn tác giả ${ONLINE_DOCUMENT_KINDS[index]}`);assert.deepEqual(validatePack(pack),[]);assert.equal(pack.items.length,2);
    assert.equal(pack.subject,'thinking');assert.equal(pack.source,'local');assert.equal(pack.grade,5);
    assert.equal(pack.items[0].metadata.topicId,'Chủ đề tự đặt');assert.equal(pack.items[0].metadata.formId,'Tên cuộc thi tự đặt');assert.equal(pack.items[0].metadata.level,'Mức riêng');
    assert.equal(pack.items[0].metadata.reviewStatus,'draft');assert.equal(pack.items[0].objectiveId,'AUTHOR.OBJECTIVE');
  }
  assert.equal(result.sets[0].pack.items[0].media.imageId,'image-asset');assert.equal(result.sets[0].pack.items[0].media.imageAlt,'Đám mây trên bầu trời');
  assert.equal(result.sets[3].pack.items[0].answer,'0');assert.equal(result.sets[3].pack.items[1].answer,'-12,5');
  assert.deepEqual(result.sets[4].pack.items[0].acceptedAnswers,['từ một','từ hai']);
  assert.equal(result.sets[5].pack.passages.length,1);assert.match(result.sets[5].pack.items[0].passageId,/^passage-/);
  for(const entry of result.sets.slice(6)){
    assert.equal(entry.pack.items[0].audioId,'audio-asset');assert.equal(entry.pack.items[0].media.audioId,'audio-asset');
    assert.equal(entry.pack.media.length,1);assert.equal(entry.pack.media[0].url,'/audio/audio-asset.mp3');assert.equal(entry.pack.media[0].sha256,'b'.repeat(64));
    assert.equal(entry.pack.media[0].source,'Người biên soạn');assert.deepEqual(onlineDocumentGameChoices(entry.pack),[{id:'math-quest',label:'Math Quest'}]);
  }
  assert.deepEqual(await importFile(populatedXlsx()),result);
});

test('Actual Word package with repeated field/value tables imports the same eight types and skips blank blocks',async()=>{
  const word=await importFile(populatedDocx(),'Nội dung.DOCX'),excel=await importFile(populatedXlsx());
  assert.deepEqual(word,excel);
});

test('Missing answers, malformed fields and ambiguous author rows reject the entire document',async()=>{
  for(const [kind,mutate] of [
    ['quiz',row=>delete row.answer],['quiz',row=>row.answer='Z'],['quiz',row=>row.B=row.A],
    ['pairs',row=>delete row.right],['sentences',row=>row.answer='hai từ'],['numeric-answer',row=>row.answer='NaN'],
    ['fill-blank',row=>row.acceptedAnswers='same|SAME'],['reading-choice',row=>delete row.passage],
    ['listening-choice',row=>delete row.audioFile],['listening-gap',row=>delete row.audioTranscript],
    ['fill-blank',row=>row.caseSensitive='yes'],['pairs',row=>row.A='wrong type field'],
    ['sentences',row=>row.words='thứ|tự|khác'],['fill-blank',row=>row.answer='đáp án khác'],['quiz',row=>row.hint='Trường không được hỗ trợ'],
  ]){const input=rows().filter(row=>row.kind===kind);mutate(input[0]);await assert.rejects(importFile(populatedXlsx(input)),undefined,kind);}
  const one=rows().filter(row=>row.kind==='quiz').slice(0,1);await assert.rejects(importFile(populatedDocx(one),'week.docx'),/2–30/);
  const different=rows().filter(row=>row.kind==='quiz');different[1].title='Khác tên';await assert.rejects(importFile(populatedXlsx(different)),/cùng title/);
  const weeks=rows().filter(row=>row.kind==='quiz');weeks[0].week='Tuần A';weeks[1].week='Tuần B';await assert.rejects(importFile(populatedXlsx(weeks)),/một tuần/);
});

test('Images and audio resolve only unambiguous uploaded filenames and require descriptive text',async()=>{
  const quiz=()=>rows().filter(row=>row.kind==='quiz');
  for(const assets of [[],[...media,{...media[0],id:'another-image'}],[{...media[0],sha256:'bad'}]])await assert.rejects(importFile(populatedXlsx(quiz()),'week.xlsx',assets));
  for(const modify of [row=>delete row.imageAlt,row=>row.imageFile='../hình ảnh.png',row=>row.imageFile='https://example.com/image.png']){
    const input=quiz();modify(input[0]);await assert.rejects(importFile(populatedDocx(input),'week.docx'));
  }
  const listening=rows().filter(row=>row.kind==='listening-choice');listening[1].audioTranscript='Lời thoại khác';await assert.rejects(importFile(populatedXlsx(listening)),/không nhất quán/);
  const invalidMime=[media[0],{...media[1],mime:'audio/mp4'}];await assert.rejects(importFile(populatedXlsx(rows()),'week.xlsx',invalidMime),/MP3/);
});

test('Document-only boundary rejects malformed packages, formulas, embedded media and XML entities',async()=>{
  await assert.rejects(importFile(new Uint8Array(30),'bad.xlsx'));
  await assert.rejects(importFile(emptyXlsx,'file.csv'),/Word .docx/);
  await assert.rejects(importFile(new Uint8Array(1024*1024+1),'big.docx'),/1 MB/);
  await assert.rejects(importFile(populatedXlsx(rows(),(files,file)=>{files[file]=encode(decode(files[file]).replace('<t xml:space="preserve">subjectLabel</t>','<t xml:space="preserve">unknown</t>'));})),/Tiêu đề/);
  await assert.rejects(importFile(populatedXlsx(rows(),(files,file)=>{files[file]=encode(decode(files[file]).replace('<is>','<f>1+1</f><is>'));})),/công thức/);
  for(const insertion of ['<!DOCTYPE doc [<!ENTITY x "bad">]>','<w:drawing/>','<w:instrText>MERGEFIELD name</w:instrText>','<w:p></w:wrong>']){
    const bytes=populatedDocx(rows(),files=>{files['word/document.xml']=encode(decode(files['word/document.xml']).replace('<w:body>','<w:body>'+insertion));});
    await assert.rejects(importFile(bytes,'bad.docx'));
  }
  const missing=unzipSync(emptyDocx);delete missing['word/document.xml'];await assert.rejects(importFile(zipSync(missing),'missing.docx'),/thiếu/);
});

test('DOCX ZIP budget checks bound declared expansion and XML size before interpretation',async()=>{
  const tooLarge=zipSync({'word/document.xml':encode('<document>'+'a'.repeat(2*1024*1024)+'</document>')});
  assert.ok(tooLarge.byteLength<1024*1024);await assert.rejects(importFile(tooLarge,'large.docx'),/XML/);
  const expanded=zipSync({'word/document.xml':encode('<document/>'),'padding.bin':new Uint8Array(8*1024*1024+1)});
  await assert.rejects(importFile(expanded,'bomb.docx'),/8 MB/);
  const entries=Object.fromEntries(Array.from({length:129},(_,index)=>[`part${index}`,encode('x')]));
  await assert.rejects(importFile(zipSync(entries),'many.docx'),/nhiều mục/);
});

test('Automatic source and item identities survive row/group reorder and fresh preview UUIDs across all eight kinds',async()=>{
  const input=rows().map(({itemId,...row})=>row),author={...context,sourceId:'author-week-code',version:1};
  const original=await parseOnlineDocument(populatedXlsx(input),'week.xlsx',author,media);
  const reordered=await parseOnlineDocument(populatedXlsx([...input].reverse()),'week.xlsx',{...author,idPrefix:'different-random-preview'},media);
  const view=week=>Object.fromEntries(week.sets.map(({pack})=>[pack.id,{version:pack.version,ids:pack.items.map(item=>item.id).sort()}]));
  assert.deepEqual(view(reordered),view(original));
  for(const {pack} of original.sets){assert.equal(onlineDocumentSourceId(pack),'author-week-code');assert.ok(pack.id.length<=80);}
  const changed=structuredClone(input);changed[0].prompt='Tác giả sửa một câu';
  const revised=await parseOnlineDocument(populatedXlsx(changed),'week.xlsx',{...author,version:2,title:'Đổi tên hiển thị tuần'},media);
  assert.deepEqual(revised.sets.map(set=>set.pack.id),original.sets.map(set=>set.pack.id));assert.ok(revised.sets.every(set=>set.pack.version===2));
  assert.notEqual(revised.sets[0].pack.items[0].id,original.sets[0].pack.items[0].id);
  const legacy=await parseOnlineDocument(populatedXlsx(input.slice(0,2)),'week.xlsx',{...author,packIds:{[JSON.stringify([input[0].subjectLabel,'quiz'])]:'old-random-pack-identity'}},media);
  assert.equal(legacy.sets[0].pack.id,'old-random-pack-identity');
});

test('Question errors identify the exact physical Excel row or Word table and missing field',async()=>{
  const input=rows().filter(row=>row.kind==='quiz');delete input[1].answer;
  const sparse=populatedXlsx(input,(files,file)=>{files[file]=encode(decode(files[file]).replace(/(r="(?:[A-Z]+)?)(3|4)"/g,(_match,prefix,number)=>prefix+(number==='3'?'27':'55')+'"'));});
  await assert.rejects(importFile(sparse),/Excel, sheet Câu hỏi, dòng 55: answer/);
  await assert.rejects(importFile(populatedDocx(input),'week.docx'),/Word, bảng 4: answer/);
  const repeated=rows().filter(row=>row.kind==='quiz');repeated[1].B=repeated[1].A;
  await assert.rejects(importFile(populatedXlsx(repeated)),/Excel, sheet Câu hỏi, dòng 4:.*A, B, C, D/);
  const sentence=rows().filter(row=>row.kind==='sentences');sentence[1].hint='a'.repeat(161);
  await assert.rejects(importFile(populatedDocx(sentence),'week.docx'),/Word, bảng 4: hint/);
  const malformed=populatedDocx(rows().filter(row=>row.kind==='quiz'),files=>{files['word/document.xml']=encode(decode(files['word/document.xml']).replace('<w:t>field</w:t>','<w:t>Đổi nhầm cột</w:t>'));});
  await assert.rejects(importFile(malformed,'week.docx'),/Word, bảng 2: tiêu đề/);
});

const threeQuestions=kind=>{const first=rows().filter(row=>row.kind===kind);return [...first,{...first[0],itemId:`author.${kind}.3`,
  ...(kind==='pairs'?{left:'Trước 3',right:'Sau 3'}:kind==='sentences'?{prompt:'Yêu cầu số 3',answer:'bảy tám chín'}:{prompt:`Yêu cầu ${kind} số 3`})}];};
const inspect=(bytes,name='week.xlsx',assets=media,options)=>inspectOnlineDocument(bytes,name,context,assets,options);

test('Partial preview excludes each malformed question and leaves only validated playable packs for all eight kinds',async()=>{
  const changes={quiz:row=>row.answer='Z',pairs:row=>delete row.right,sentences:row=>row.answer='hai từ',
    'numeric-answer':row=>row.answer='NaN','fill-blank':row=>row.caseSensitive='yes','reading-choice':row=>delete row.passage,
    'listening-choice':row=>delete row.audioFile,'listening-gap':row=>delete row.audioTranscript};
  for(const kind of ONLINE_DOCUMENT_KINDS){const input=threeQuestions(kind);changes[kind](input[1]);
    for(const [name,create,location] of [['week.xlsx',populatedXlsx,'Excel, sheet Câu hỏi, dòng 4'],['week.docx',populatedDocx,'Word, bảng 4']]){
      const bytes=create(input),result=await inspect(bytes,name);assert.equal(result.totalQuestions,3,kind);assert.equal(result.acceptedQuestions,2,kind);
      assert.equal(result.sets.length,1);assert.deepEqual(validatePack(result.sets[0].pack),[]);assert.equal(result.issues.length,1);
      assert.equal(result.issues[0].location,location);assert.equal(result.issues[0].itemId,input[1].itemId);
      assert.deepEqual(result.sets[0].pack.items.map(item=>item.id),[input[0].itemId,input[2].itemId]);await assert.rejects(importFile(bytes,name));
    }
  }
});

test('Partial preview keeps the first valid duplicate and identifies the later physical row',async()=>{
  for(const kind of ONLINE_DOCUMENT_KINDS){
    for(const duplicateId of [false,true]){const input=threeQuestions(kind);input[2]=duplicateId?{...input[2],itemId:input[0].itemId}:{...input[0],itemId:input[2].itemId};
      const result=await inspect(populatedXlsx(input));assert.equal(result.acceptedQuestions,2,`${kind}: ${duplicateId}`);
      assert.deepEqual(validatePack(result.sets[0].pack),[]);assert.equal(result.issues.length,1);assert.equal(result.issues[0].location,'Excel, sheet Câu hỏi, dòng 5');assert.match(result.issues[0].message,/trùng/);
    }
  }
  const pairs=threeQuestions('pairs');pairs[2].left=pairs[0].right;const result=await inspect(populatedXlsx(pairs));assert.equal(result.acceptedQuestions,2);assert.match(result.issues[0].message,/mặt thẻ bị trùng/);
});

test('Partial preview reports missing media, invalid grouping fields and literal null placeholders without changing supplied answers',async()=>{
  const input=[...threeQuestions('quiz'),...threeQuestions('fill-blank')];
  input[1].imageFile='chưa tải.png';input[4].A='null';
  const malformed=[{...input[0],itemId:'bad-kind',kind:'unknown'},{...input[0],itemId:'bad-subject',subjectLabel:' '},{...input[0],itemId:'bad-title',title:'x'.repeat(91)}];
  const result=await inspect(populatedXlsx([...input,...malformed]));assert.equal(result.totalQuestions,9);assert.equal(result.acceptedQuestions,4);assert.equal(result.issues.length,5);
  assert.match(result.issues[0].message,/chưa tải.png/);assert.match(result.issues[1].message,/trường A/);
  assert.match(result.issues[2].message,/kind/);assert.match(result.issues[3].message,/subjectLabel/);assert.match(result.issues[4].message,/title/);
  assert.equal(result.sets[0].pack.items[0].correctIndex,2);assert.deepEqual(result.sets[1].pack.items[0].acceptedAnswers,['từ một','từ hai']);
});

test('Partial preview diagnoses every all-invalid question and excludes otherwise valid singletons with an explicit playable-size reason',async()=>{
  for(const kind of ONLINE_DOCUMENT_KINDS){const input=threeQuestions(kind).slice(0,2);for(const row of input){if(kind==='pairs')delete row.right;else delete row.prompt;}
    const result=await inspect(populatedXlsx(input));assert.equal(result.acceptedQuestions,0);assert.equal(result.sets.length,0);assert.equal(result.issues.length,2);
    assert.ok(result.issues.every(issue=>!/chỉ còn 1 câu/.test(issue.message)),kind);
  }
  const input=threeQuestions('quiz').slice(0,2);input[1].answer='Z';const result=await inspect(populatedXlsx(input));assert.equal(result.acceptedQuestions,0);assert.equal(result.issues.length,2);
  assert.match(result.issues[0].message,/chỉ còn 1 câu.*ít nhất 2/);assert.match(result.issues[1].message,/answer/);
  const singleton=await inspect(populatedXlsx(threeQuestions('pairs').slice(0,1)));assert.match(singleton.issues[0].message,/ít nhất 2/);
});

test('Partial preview rejects oversized groups explicitly without truncating and still allows other valid groups',async()=>{
  const oversized=Array.from({length:31},(_,i)=>({kind:'pairs',subjectLabel:'Nối cặp',left:`Trái ${i}`,right:`Phải ${i}`}));
  const result=await inspect(populatedXlsx([...oversized,...threeQuestions('quiz')]));assert.equal(result.totalQuestions,34);assert.equal(result.acceptedQuestions,3);assert.equal(result.issues.length,31);
  assert.ok(result.issues.every(issue=>/có 31 câu.*chia bộ/.test(issue.message)));assert.equal(result.sets[0].pack.kind,'quiz');
});

test('Partial preview reports conflicting later titles but a malformed first row cannot determine the retained title',async()=>{
  const input=threeQuestions('quiz');input[2].title='Tên khác';let result=await inspect(populatedXlsx(input));assert.equal(result.acceptedQuestions,2);assert.match(result.issues[0].message,/cùng title/);
  input[0].answer='Z';input[0].title='Tên câu lỗi';input[1].title=input[2].title='Bộ câu đã đảm bảo';
  result=await inspect(populatedXlsx(input));assert.equal(result.acceptedQuestions,2);assert.equal(result.sets[0].pack.title,'Bộ câu đã đảm bảo');assert.equal(result.issues.length,1);assert.match(result.issues[0].message,/answer/);
});

test('Partial preview scheduling title does not remap source pack identities and file-level failures remain fatal',async()=>{
  const bytes=populatedXlsx(threeQuestions('quiz')),strict=await importFile(bytes),result=await inspect(bytes,'week.xlsx',media,{weekTitle:'Tuần 08'});
  assert.equal(result.title,'Tuần 08');assert.deepEqual(result.sets,strict.sets);assert.deepEqual(result.issues,[]);
  const multi=threeQuestions('quiz');multi[0].week='Tuần 01';multi[1].week='Tuần 02';await assert.rejects(inspect(populatedXlsx(multi),'week.xlsx',media,{weekTitle:'Tuần 08'}),/một tuần/);
  await assert.rejects(inspect(new Uint8Array(30)),undefined);await assert.rejects(inspect(bytes,'week.xlsx',media,{weekTitle:' '}),/Tên tuần/);
  await assert.rejects(inspect(populatedXlsx(rows(),(files,file)=>{files[file]=encode(decode(files[file]).replace('<t xml:space="preserve">subjectLabel</t>','<t xml:space="preserve">unknown</t>'));})),/Tiêu đề/);
});

test('Partial preview excludes malformed Word question tables and Excel overflow cells with source locations',async()=>{
  const input=threeQuestions('quiz'),duplicate='<w:tr><w:tc><w:p><w:r><w:t>kind</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>quiz</w:t></w:r></w:p></w:tc></w:tr>';
  const duplicateField=populatedDocx(input,files=>{files['word/document.xml']=encode(decode(files['word/document.xml']).replace(recordTable(input[1]),recordTable(input[1]).replace('</w:tbl>',duplicate+'</w:tbl>')));});
  let result=await inspect(duplicateField,'week.docx');assert.equal(result.acceptedQuestions,2);assert.equal(result.issues[0].location,'Word, bảng 4');assert.match(result.issues[0].message,/Trường kind/);
  const badHeader=populatedDocx(input,files=>{files['word/document.xml']=encode(decode(files['word/document.xml']).replace(recordTable(input[1]),recordTable(input[1]).replace('<w:t>field</w:t>','<w:t>nhầm cột</w:t>')));});
  result=await inspect(badHeader,'week.docx');assert.equal(result.acceptedQuestions,2);assert.equal(result.issues[0].location,'Word, bảng 4');assert.match(result.issues[0].message,/tiêu đề/);
  const overflow=populatedXlsx(input,(files,file)=>{files[file]=encode(decode(files[file]).replace(/(<row r="4">.*?)(<\/row>)/s,'$1<c r="AF4" t="inlineStr"><is><t>thừa ô</t></is></c>$2'));});
  result=await inspect(overflow);assert.equal(result.acceptedQuestions,2);assert.equal(result.issues[0].location,'Excel, sheet Câu hỏi, dòng 4');assert.match(result.issues[0].message,/ngoài mẫu/);
});
