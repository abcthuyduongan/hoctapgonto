import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOnlineQuestions,parseOnlineWeek,onlineGameChoices,onlineQuestionTemplate,onlineWeekTemplate} from '../src/core/online-content.ts';
import {validatePack} from '../src/core/validation.ts';

const context={id:'author-set',version:1,title:'Tác giả tự chọn nội dung',grade:6};
const weekContext={idPrefix:'weekly-author',grade:6,title:'Tuần do tác giả đặt',subjectLabel:'Nhãn tự chọn'};
const quizItems=()=>[
  {prompt:'Câu hỏi do tác giả tự soạn?',options:['Mây','Gió','Nắng','Mưa'],correctIndex:2},
  {prompt:'Một câu hỏi khác?',A:'Hoa',B:'Lá',C:'Cành',D:'Rễ',answer:'B'},
];
const pairItems=()=>[
  {left:'Mặt trước 1',right:'Mặt sau 1'},
  {question:'Mặt trước 2',answer:'Mặt sau 2'},
];
const sentenceItems=()=>[
  {prompt:'Đặt theo thứ tự được tác giả chỉ định',words:['Bước','một','trước']},
  {prompt:'Một thứ tự khác',answer:'Bước hai sau'},
];
const parse=(kind,items,ctx=context)=>parseOnlineQuestions(JSON.stringify({kind,items}),'upload.json',ctx);
const ids=pack=>onlineGameChoices(pack).map(choice=>choice.id);
const weekly=sets=>JSON.stringify({schema:'baoan-online-week',formatVersion:1,title:'Tuần mang tên riêng',sets});
const set=(subjectLabel,kind,items,title='Bộ câu hỏi riêng')=>({subjectLabel,kind,items,title});

test('Generic JSON is deterministic, subject-neutral and keeps valid author identifiers',()=>{
  const input=quizItems();input[0].id='author.Q1';input[0].objectiveId='AUTHOR.OWN.TOPIC';
  const first=parse('quiz',input),again=parse('quiz',input);
  assert.deepEqual(first,again);assert.deepEqual(validatePack(first),[]);
  assert.equal(first.subject,'thinking');assert.equal(first.grade,6);assert.equal(first.source,'local');
  assert.equal(first.items[0].id,'author.Q1');assert.equal(first.items[0].objectiveId,'AUTHOR.OWN.TOPIC');
  assert.equal(first.items[1].objectiveId,'CUSTOM.QUESTION');assert.match(first.items[1].id,/^online-/);
  assert.equal(first.items[0].explanation,'Đáp án: Nắng');assert.equal(first.items[1].correctIndex,1);
  assert.deepEqual(input,JSON.parse(JSON.stringify(input)));
});

test('Quiz answers and representations must be complete and unambiguous',()=>{
  for(const mutate of [
    row=>delete row.correctIndex,
    row=>row.correctIndex='2',
    row=>row.correctIndex=4,
    row=>row.answer='A',
    row=>row.answer='Nắng',
    row=>row.options[1]=' MÂY ',
    row=>row.options.pop(),
    row=>row.options[0]=7,
    row=>row.options[0]='',
    row=>row.options[0]='a'.repeat(121),
    row=>row.A='Phương án khác',
  ]) {
    const input=quizItems();mutate(input[0]);assert.throws(()=>parse('quiz',input));
  }
  const input=quizItems();input[0].answer='c';assert.equal(parse('multiple-choice',input).items[0].correctIndex,2);
  const withColumns=quizItems();withColumns[0].optionA='Mây';withColumns[0].optionB='Gió';withColumns[0].optionC='Nắng';withColumns[0].optionD='Mưa';
  assert.equal(parse('quiz',withColumns).items[0].options.length,4);
});

test('Pairs accept question/answer aliases but reject duplicate faces and conflicting aliases',()=>{
  const pack=parse('pair',pairItems());assert.equal(pack.items[1].left,'Mặt trước 2');assert.deepEqual(validatePack(pack),[]);
  const ambiguous=pairItems();ambiguous[1].answer=' MẶT SAU 1 ';assert.throws(()=>parse('pairs',ambiguous),/trùng/);
  const conflicting=pairItems();conflicting[0].question='Nội dung khác';assert.throws(()=>parse('pairs',conflicting),/mâu thuẫn/);
  const missing=pairItems();delete missing[1].answer;assert.throws(()=>parse('pairs',missing));
});

test('Ordering content takes only the supplied answer order and uses engine token limits',()=>{
  const input=sentenceItems();input[0].correctOrder=[...input[0].words];
  const pack=parse('order',input);assert.deepEqual(pack.items[1].words,['Bước','hai','sau']);assert.ok(pack.items[0].hint);
  for(const answer of ['hai từ',Array(16).fill('từ').join(' '),'a'.repeat(46)+' hai ba']) {
    const bad=sentenceItems();bad[1].answer=answer;assert.throws(()=>parse('sentences',bad));
  }
  const bad=sentenceItems();bad[0].correctOrder=['thứ','tự','khác'];assert.throws(()=>parse('sentences',bad),/không khớp/);
  const spaced=sentenceItems();spaced[0].words=['hai từ','thứ','ba'];assert.throws(()=>parse('sentences',spaced));
});

test('Strict shape checks reject wrong types, mixed kinds, unknown fields and duplicate IDs',()=>{
  const badValues=[null,[],{},true,'abc'];
  for(const value of badValues)assert.throws(()=>parseOnlineQuestions(JSON.stringify(value),'x.json',context));
  const mutations=[
    row=>row.kind='pair',row=>row.prompt={},row=>row.id=null,row=>row.objectiveId=[],
    row=>row.secret='ignored?',row=>row.metadata={knowledgeId:[]},row=>row.hint='wrong-kind-field',
  ];
  for(const mutate of mutations){const input=quizItems();mutate(input[0]);assert.throws(()=>parse('quiz',input));}
  const duplicate=quizItems();duplicate[0].id='same';duplicate[1].id='same';assert.throws(()=>parse('quiz',duplicate),/trùng/);
  const invalidId=quizItems();invalidId[0].id='../unsafe';assert.throws(()=>parse('quiz',invalidId));
  assert.throws(()=>parseOnlineQuestions('{"kind":"pairs","kind":"quiz","items":[]}','x.json',context),/trùng/);
  assert.throws(()=>parseOnlineQuestions('{"kind":"pairs","\\u006bind":"quiz","items":[]}','x.json',context),/trùng/);
  assert.throws(()=>parseOnlineQuestions('{broken','x.json',context),/JSON/);
  assert.throws(()=>parseOnlineQuestions('[]','x.json',context));
});

test('The entire file is bounded and each pack contains exactly 2–30 questions',()=>{
  assert.throws(()=>parse('pairs',[pairItems()[0]]),/2–30/);
  const many=Array.from({length:30},(_,index)=>({left:`Q ${index}`,right:`A ${index}`}));
  assert.equal(parse('pairs',many).items.length,30);
  assert.throws(()=>parse('pairs',[...many,{left:'extra Q',right:'extra A'}]),/2–30/);
  assert.throws(()=>parse('pairs',pairItems(),{...context,id:'A bad id'}));
  assert.throws(()=>parse('pairs',pairItems(),{...context,grade:0}));
  assert.throws(()=>parse('pairs',pairItems(),{...context,version:Infinity}));
  assert.throws(()=>parseOnlineQuestions('a'.repeat(1024*1024+1),'x.csv',context),/1 MB/);
  assert.throws(()=>parseOnlineQuestions('a','x.xlsx',context),/JSON, CSV/);
  assert.throws(()=>parseOnlineQuestions(' ','x.csv',context),/trống/);
});

test('UTF-8 CSV and TSV map headers independently of order and preserve quoted data',()=>{
  const csv='\uFEFFanswer,D,prompt,A,C,B\r\nC,Mưa,"Câu hỏi, có dấu và ""ngoặc kép""?",Mây,Nắng,Gió\r\nB,Rễ,"Câu hỏi\ntrên hai dòng?",Hoa,Cành,Lá\r\n';
  const pack=parseOnlineQuestions(csv,'Tác giả.CSV',context);
  assert.equal(pack.items[0].prompt,'Câu hỏi, có dấu và "ngoặc kép"?');assert.equal(pack.items[0].correctIndex,2);
  assert.equal(pack.items[1].prompt,'Câu hỏi\ntrên hai dòng?');
  const tsv='question\tanswer\nCâu một\tĐáp một\nCâu hai\tĐáp hai\n';
  assert.equal(parseOnlineQuestions(tsv,'x.tsv',context).kind,'pairs');
  assert.equal(parseOnlineQuestions('prompt;answer\nYêu cầu 1;một hai ba\nYêu cầu 2;bốn năm sáu','x.csv',context).kind,'sentences');
  const arrayCsv='kind,prompt,words\nsentences,Q1,"[""một"",""hai"",""ba""]"\nsentences,Q2,"[""bốn"",""năm"",""sáu""]"';
  assert.deepEqual(parseOnlineQuestions(arrayCsv,'x.csv',context).items[0].words,['một','hai','ba']);
});

test('Malformed CSV and incomplete or ambiguous headers are rejected without partial imports',()=>{
  const invalid=[
    'left,right\nA,B\nC',
    'left,right\nA,B,extra\nC,D',
    'left,right\n"A,B\nC,D',
    'left,right\nA"bad",B\nC,D',
    'left,right\n"A"bad,B\nC,D',
    'left,right,right\nA,B,C\nD,E,F',
    'left,right,unknown\nA,B,C\nD,E,F',
    'prompt,A,B,C,D,answer\nQ1,A,B,C,D,1\nQ2,E,F,G,H,A',
    'left,right\nA,B',
    'kind,left,right,prompt,answer\npairs,A,B,,\nsentences,,,Q,một hai ba',
  ];
  for(const csv of invalid)assert.throws(()=>parseOnlineQuestions(csv,'x.csv',context));
});

test('Existing single-pack envelopes preserve validated source data and mark local ownership',()=>{
  const pack=parse('quiz',quizItems());pack.subject='english';pack.source='builtin';pack.version=7;
  pack.publishedAt='2026-10-01T12:00:00.000Z';pack.items[0].prompt='  Nội dung gốc có khoảng trắng  ';
  pack.items[0].metadata={knowledgeId:'OWN.TOPIC',difficulty:'medium',contentRole:'unassigned',source:'Tác giả',rights:'Sở hữu riêng',reviewStatus:'draft'};
  pack.templateInfo={schema:'baoan-question-template',templateVersion:1,contentFormatVersion:2,topicId:'tự-chọn',source:'Tác giả',rights:'Sở hữu riêng',reviewStatus:'draft'};
  const envelope={schema:'baoan-learning-content',formatVersion:2,exportedAt:'2026-10-02T00:00:00Z',packs:[pack]};
  const imported=parseOnlineQuestions(JSON.stringify(envelope),'content.json',{...context,id:'new-context'});
  assert.deepEqual(imported,{...pack,source:'local'});assert.equal(pack.source,'builtin');
  for(const mutate of [
    value=>value.packs.push(pack),value=>value.formatVersion=99,
    value=>delete value.packs[0].items[0].id,value=>delete value.packs[0].items[0].explanation,
    value=>value.packs[0].publishedAt='invalid-date',value=>value.packs[0].items[0].metadata.rights={},
    value=>value.packs[0].items[0].metadata.unknown=true,value=>value.packs[0].extra='unexpected',
  ]){const bad=structuredClone(envelope);mutate(bad);assert.throws(()=>parseOnlineQuestions(JSON.stringify(bad),'x.json',context));}
});

test('Available games follow concrete shape and matching-answer ambiguity, without subject routing',()=>{
  const quiz=parse('quiz',quizItems());
  assert.deepEqual(ids(quiz),['math-quest','memory-match','word-connect']);
  quiz.subject='vietnamese';assert.deepEqual(ids(quiz),['math-quest','memory-match','word-connect']);
  quiz.items[1].options[1]='Nắng';assert.deepEqual(ids(quiz),['math-quest']);
  assert.deepEqual(ids(parse('pairs',pairItems())),['memory-match','word-connect']);
  const four=Array.from({length:4},(_,i)=>({left:`Q${i}`,right:`A${i}`}));
  assert.deepEqual(ids(parse('pairs',four)),['math-quest','memory-match','word-connect']);
  assert.deepEqual(ids(parse('sentences',sentenceItems())),['sentence-builder','sequence-trail']);
  quiz.items[0].correctIndex=99;assert.deepEqual(onlineGameChoices(quiz),[]);
});

test('Weekly JSON keeps arbitrary author labels and separates author-supplied question kinds',()=>{
  const input=weekly([set('Âm nhạc theo tác giả','quiz',quizItems(),'Bộ A'),set('Lịch sử địa phương riêng','pairs',pairItems(),'Bộ B'),set('Hoạt động theo lớp','sentences',sentenceItems(),'Bộ C')]);
  const result=parseOnlineWeek(input,'week.json',weekContext);
  assert.equal(result.title,'Tuần mang tên riêng');assert.equal(result.sets.length,3);
  assert.deepEqual(result.sets.map(entry=>entry.subjectLabel),['Âm nhạc theo tác giả','Lịch sử địa phương riêng','Hoạt động theo lớp']);
  assert.deepEqual(result.sets.map(entry=>entry.pack.id),['weekly-author-1','weekly-author-2','weekly-author-3']);
  assert.deepEqual(result.sets.map(entry=>entry.pack.title),['Bộ A','Bộ B','Bộ C']);
  for(const {pack} of result.sets){assert.equal(pack.subject,'thinking');assert.equal(pack.grade,6);assert.deepEqual(validatePack(pack),[]);}
  assert.deepEqual(parseOnlineWeek(input,'week.json',weekContext),result);
});

test('Weekly JSON rejects invalid or oversized bundles as a whole',()=>{
  for(const sets of [[],Array.from({length:31},()=>set('Tự chọn','quiz',quizItems())),[set('','quiz',quizItems())],[set('Tự chọn','quiz',[quizItems()[0]])]])
    assert.throws(()=>parseOnlineWeek(weekly(sets),'week.json',weekContext));
  const bad=JSON.parse(weekly([set('Tự chọn','pairs',pairItems())]));bad.formatVersion=2;
  assert.throws(()=>parseOnlineWeek(JSON.stringify(bad),'week.json',weekContext),/formatVersion/);
  assert.throws(()=>parseOnlineWeek(weekly([set('Tự chọn','pairs',pairItems())]),'week.json',{...weekContext,idPrefix:'../bad'}));
  const max=Array.from({length:30},(_,i)=>set(`Nhãn ${i}`,'pairs',pairItems()));
  assert.equal(parseOnlineWeek(weekly(max),'week.json',weekContext).sets.length,30);
});

test('Weekly CSV groups exact author labels and kinds; single imports never split mixed files',()=>{
  const csv='subject,kind,left,right,prompt,answer\nNội dung A,pairs,Q1,A1,,\nNội dung B,sentences,,,P1,một hai ba\nNội dung A,pairs,Q2,A2,,\nNội dung B,sentences,,,P2,bốn năm sáu\nNội dung A,sentences,,,P3,bảy tám chín\nNội dung A,sentences,,,P4,mười một hai\n';
  const result=parseOnlineWeek(csv,'week.csv',weekContext);
  assert.deepEqual(result.sets.map(entry=>[entry.subjectLabel,entry.pack.kind,entry.pack.items.length]),[
    ['Nội dung A','pairs',2],['Nội dung B','sentences',2],['Nội dung A','sentences',2],
  ]);
  assert.throws(()=>parseOnlineQuestions(csv,'week.csv',context),/nhiều bộ/);
  assert.throws(()=>parseOnlineWeek('subject,left,right\nA,Q1,A1\nB,Q2,A2','week.csv',weekContext),/2–30/);
});

test('Single files become one weekly set and templates contain no generated curriculum',()=>{
  const csv='left,right\nQ1,A1\nQ2,A2\n';
  const result=parseOnlineWeek(csv,'single.csv',weekContext);
  assert.equal(result.sets[0].subjectLabel,'Nhãn tự chọn');assert.equal(result.sets[0].pack.id,'weekly-author-1');
  const fallback=parseOnlineWeek(JSON.stringify({kind:'pairs',items:pairItems()}),'single.json',{...weekContext,subjectLabel:undefined});
  assert.equal(fallback.sets[0].subjectLabel,'Nội dung tự biên soạn');
  for(const [kind,headers] of [['quiz','prompt,A,B,C,D,answer'],['pairs','left,right'],['sentences','prompt,answer']]){
    assert.equal(onlineQuestionTemplate(kind),'\uFEFF'+headers+'\r\n');
    assert.throws(()=>parseOnlineQuestions(onlineQuestionTemplate(kind),'empty.csv',context));
  }
  const template=JSON.parse(onlineWeekTemplate());assert.deepEqual(template.sets[0].items,[]);assert.equal(template.title,'');assert.equal(template.sets[0].subjectLabel,'');
});
