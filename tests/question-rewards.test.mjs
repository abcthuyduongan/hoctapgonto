import test from 'node:test';
import assert from 'node:assert/strict';
import {questionRewardCandidates,questionRewardThresholds,questionRewardSourceKey,initializeQuestionRewardLedger,applyQuestionRewardCandidates,questionRewardProgress,earnedQuestionRewardStars,v2QuestionCompletionErrors} from '../src/core/question-rewards.ts';
import {onlinePresentation,onlineScoreResponse} from '../src/core/online-exercises.ts';
import {validatePack} from '../src/core/validation.ts';

const startedAt='2026-10-17T01:00:00.000Z';
const base={id:'question-star-source',version:1,title:'Sao cho từng câu',subject:'thinking',grade:3,source:'local',publishedAt:startedAt};
function quiz(){return{...base,kind:'quiz',items:[1,2,3,4].map(i=>({id:`q${i}`,kind:'multiple-choice',objectiveId:'QUESTION.STARS',prompt:`Đề câu ${i}`,options:[`Đúng ${i}`,`Sai A ${i}`,`Sai B ${i}`,`Sai C ${i}`],correctIndex:0,explanation:'Đáp án đầu tiên.'}))};}
function pairs(){return{...base,kind:'pairs',items:[1,2,3,4].map(i=>({id:`q${i}`,kind:'pair',objectiveId:'QUESTION.STARS',left:`Vế trái ${i}`,right:`Vế phải ${i}`}))};}
function sentences(){return{...base,kind:'sentences',items:[1,2].map(i=>({id:`q${i}`,kind:'sentence',objectiveId:'QUESTION.STARS',prompt:`Sắp xếp câu ${i}`,words:['Con','đọc',`sách${i}`],hint:'Đọc lại câu.'}))};}
function rich(){
  const common={objectiveId:'QUESTION.STARS',explanation:'Lời giải thử nghiệm.',hint:'Gợi ý thử nghiệm.'};
  return{...base,kind:'learning',contentFormatVersion:2,passages:[{passageId:'passage',title:'Khu vườn',body:'Khu vườn có cây xanh.',source:'Tự viết',rights:'Cho phép sử dụng',approvedAt:startedAt}],media:[{mediaId:'audio',kind:'audio',url:'/audio/stars.wav',sha256:'a'.repeat(64),transcript:'Hello Lucy.',source:'Tự thu',rights:'Cho phép sử dụng',approvedAt:startedAt}],items:[
    {...common,id:'numeric',kind:'numeric-answer',prompt:'Viết số một.',answer:'1'},
    {...common,id:'fill',kind:'fill-blank',prompt:'Điền màu lá cây.',acceptedAnswers:['xanh'],caseSensitive:false},
    {...common,id:'reading',kind:'reading-choice',prompt:'Trong vườn có gì?',passageId:'passage',options:['Cây xanh','Cá voi','Tàu hỏa','Máy bay'],correctIndex:0},
    {...common,id:'listening',kind:'listening-choice',prompt:'Nghe và chọn tên bạn.',audioId:'audio',options:['Lucy','Mai','Lan','Nam'],correctIndex:0},
    {...common,id:'gap',kind:'listening-gap',prompt:'Nghe và điền tên.',audioId:'audio',acceptedAnswers:['Lucy'],caseSensitive:true},
  ]};
}
let fixtureId=0;
function fixture(pack=quiz(),moduleId='math-quest'){
  assert.deepEqual(validatePack(pack),[]);
  const session={sessionId:`question-session-${++fixtureId}`,profileId:'question-child',packId:pack.id,contentVersion:pack.version,moduleId,moduleVersion:'0.2.7',startedAt,status:'active',rewardPolicyVersion:2,presentationVersion:1};
  const presentation=onlinePresentation(moduleId,pack);assert.ok(presentation);
  const events=[];
  function add(itemId,response,{elapsedMs=1000,hintsUsed=0}={}){
    const item=pack.items.find(row=>row.id===itemId),gameSequence=events.length+1;
    const event={eventId:`${session.sessionId}:answer-${gameSequence}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:pack.version,moduleId,moduleVersion:session.moduleVersion,itemId,objectiveId:item.objectiveId,response,correct:onlineScoreResponse(pack,moduleId,itemId,response).correct,hintsUsed,elapsedMs,occurredAt:new Date(Date.parse(startedAt)+gameSequence*600_000).toISOString(),gameSequence};
    events.push(event);return event;
  }
  function answer(itemId,correct=true,options){const item=presentation.items.find(row=>row.id===itemId);let response;
    if(item.kind==='multiple-choice'||item.kind==='reading-choice'||item.kind==='listening-choice')response={kind:'choice',choiceIndex:correct?item.correctIndex:(item.correctIndex+1)%4};
    else if(item.kind==='sentence')response={kind:'order',indices:correct?[0,1,2]:[2,1,0]};
    else response={kind:'text',value:correct?item.kind==='numeric-answer'?item.answer:item.acceptedAnswers[0]:'999'};
    return add(itemId,response,options);
  }
  function pair(first,second,options){return add(moduleId==='memory-match'?second:first,{kind:'pair',first:{itemId:first,side:'left'},second:{itemId:second,side:'right'}},options);}
  return{pack,session,events,add,answer,pair,candidates:()=>questionRewardCandidates(session,events,pack)};
}
const commit=(ledger,f)=>applyQuestionRewardCandidates(ledger,f.candidates());

test('policy v2 immediately rewards a first correct question without requiring pack completion',()=>{
  const f=fixture();f.answer('q1',false);assert.deepEqual(f.candidates(),[]);assert.ok(v2QuestionCompletionErrors(f.session,f.events,f.pack).length);
  f.answer('q1',true,{elapsedMs:1000});assert.equal(f.candidates().length,1);assert.equal(f.candidates()[0].starTier,3);
  assert.equal(f.candidates()[0].mistakes,1);assert.equal(f.candidates()[0].effectiveElapsedMs,16_000);
  assert.ok(v2QuestionCompletionErrors(f.session,f.events,f.pack).length,'Other source questions are still required for completion');
  for(const id of ['q2','q3','q4'])f.answer(id);assert.deepEqual(v2QuestionCompletionErrors(f.session,f.events,f.pack),[]);
  for(const rewardPolicyVersion of [undefined,1])assert.deepEqual(questionRewardCandidates({...f.session,rewardPolicyVersion},f.events,f.pack),[]);
  assert.deepEqual(questionRewardCandidates({...f.session,status:'abandoned'},f.events,f.pack),[]);
  assert.ok(v2QuestionCompletionErrors({...f.session,status:'abandoned'},f.events,f.pack).length);
  const completed={...f.session,status:'completed',endedAt:new Date(Date.parse(f.events.at(-1).occurredAt)+1000).toISOString()};
  assert.equal(questionRewardCandidates(completed,f.events,f.pack).length,4);
});

test('standard speed thresholds are inclusive and add wrong-answer and cumulative hint penalties',()=>{
  for(const [elapsedMs,expected]of [[30_000,3],[30_001,2],[60_000,2],[60_001,1]]){
    const f=fixture();f.answer('q1',true,{elapsedMs});assert.equal(f.candidates()[0].starTier,expected);
  }
  const f=fixture();f.answer('q1',false,{hintsUsed:1});f.answer('q1',false,{hintsUsed:1});f.answer('q1',true,{elapsedMs:1000,hintsUsed:0});
  const row=f.candidates()[0];assert.equal(row.mistakes,2);assert.equal(row.hintsUsed,1);assert.equal(row.effectiveElapsedMs,61_000);assert.equal(row.starTier,1);
});

test('rich question budgets distinguish numeric, filling, reading and post-audio listening',()=>{
  const pack=rich();assert.deepEqual(validatePack(pack),[]);
  for(const [id,fast,slow,audio]of [['numeric',45_000,90_000,false],['fill',45_000,90_000,false],['reading',90_000,180_000,false],['listening',30_000,60_000,true],['gap',30_000,60_000,true]]){
    assert.deepEqual(questionRewardThresholds(pack.items.find(item=>item.id===id)),{threeStarMs:fast,twoStarMs:slow,clockStartsAfterAudio:audio});
    for(const [elapsedMs,tier]of [[fast,3],[fast+1,2],[slow,2],[slow+1,1]]){
      const f=fixture(pack);f.answer(id,true,{elapsedMs});assert.equal(f.candidates()[0].starTier,tier,`${id} at ${elapsedMs} ms`);
    }
  }
});

for(const moduleId of ['memory-match','word-connect'])test(`${moduleId} charges a mismatch to both distinct source questions before their first match`,()=>{
  const f=fixture(pairs(),moduleId);f.pair('q1','q2');f.pair('q1','q3');f.pair('q1','q1');f.pair('q2','q2');f.pair('q3','q3');f.pair('q4','q4');
  assert.deepEqual(f.candidates().map(row=>[row.itemId,row.mistakes,row.starTier]),[['q1',2,1],['q2',1,2],['q3',1,2],['q4',0,3]]);
  assert.deepEqual(v2QuestionCompletionErrors(f.session,f.events,f.pack),[]);
  f.pair('q1','q2');f.pair('q1','q1');assert.equal(f.candidates().length,4);assert.equal(f.candidates()[0].starTier,1,'Later events cannot replace the first correct result');
  const untouched=fixture(pairs(),moduleId);assert.deepEqual(untouched.candidates(),[],'A single card flip is not a committed pair event');untouched.pair('q1','q1');assert.equal(untouched.candidates()[0].starTier,3);
});

for(const moduleId of ['sentence-builder','sequence-trail'])test(`${moduleId} counts incorrect orders and hints independently of speed`,()=>{
  const f=fixture(sentences(),moduleId);f.answer('q1',false,{hintsUsed:1});f.answer('q1',true,{hintsUsed:1,elapsedMs:1});f.answer('q2',true,{elapsedMs:200_000});
  assert.deepEqual(f.candidates().map(row=>[row.itemId,row.mistakes,row.hintsUsed,row.starTier]),[['q1',1,1,1],['q2',0,0,3]]);
});

test('the source-question cap survives another game, replay, content version and duplicate application',()=>{
  const source=pairs(),slow=fixture(source);slow.answer('q1',true,{elapsedMs:61_000});
  const empty=initializeQuestionRewardLedger(source.id),first=commit(empty,slow);assert.equal(first.gained,1);assert.equal(first.ledger.questionTiers.q1,1);assert.deepEqual(empty.questionTiers,{});
  const match=fixture(source,'memory-match');match.pair('q1','q1');const next=commit(first.ledger,match);assert.equal(next.gained,2);assert.equal(next.ledger.earnedStars,3);
  const retry=commit(next.ledger,match);assert.equal(retry.gained,0);assert.equal(retry.ledger.earnedStars,3);
  const revision=fixture({...source,version:2},'word-connect');revision.pair('q1','q1');const again=commit(retry.ledger,revision);assert.equal(again.gained,0);assert.equal(again.ledger.questionTiers.q1,3);
  assert.equal(slow.candidates()[0].sourceKey,match.candidates()[0].sourceKey);assert.equal(match.candidates()[0].sourceKey,revision.candidates()[0].sourceKey);
  const slower=commit(again.ledger,slow);assert.equal(slower.gained,0);assert.equal(slower.ledger.questionTiers.q1,3);
  assert.notEqual(questionRewardSourceKey('pack:a','b'),questionRewardSourceKey('pack','a:b'));
});

test('legacy wallet stars are a preserved pool and do not fabricate question mastery',()=>{
  const f=fixture(),old=initializeQuestionRewardLedger(f.pack.id,3);assert.equal(old.earnedStars,3);assert.deepEqual(old.questionTiers,{});assert.equal(questionRewardProgress(f.pack,old).done,false);
  f.answer('q1',true,{elapsedMs:61_000});let result=commit(old,f);assert.equal(result.gained,0);assert.equal(result.ledger.earnedStars,3);
  f.answer('q2',true,{elapsedMs:1});result=commit(result.ledger,f);assert.equal(result.gained,1);assert.equal(result.ledger.earnedStars,4);
  const unchanged=applyQuestionRewardCandidates(result.ledger,[],1);assert.equal(unchanged.gained,0);assert.equal(unchanged.ledger.legacyStars,3);assert.equal(unchanged.ledger.earnedStars,4);
  assert.equal(earnedQuestionRewardStars([{starTier:2},{starTier:1,questionLedger:unchanged.ledger}]),6);
  assert.equal(earnedQuestionRewardStars([{starTier:1,questionLedger:{...old,earnedStars:999}}]),3,'Derived ledger totals are canonicalized rather than trusting a stale cached sum');
  const one=initializeQuestionRewardLedger(f.pack.id,1),raised=applyQuestionRewardCandidates(one,[],3);assert.equal(raised.gained,2);assert.equal(raised.ledger.earnedStars,3);
});

test('week progress requires every source question to have at least two stars',()=>{
  const pack=quiz(),ledger={...initializeQuestionRewardLedger(pack.id),questionTiers:{q1:0,q2:1,q3:2,q4:3}};
  let progress=questionRewardProgress(pack,ledger);assert.deepEqual([progress.total,progress.zero,progress.one,progress.two,progress.three,progress.bestTier,progress.done],[4,1,1,1,1,0,false]);assert.equal(progress.earnedStars,6);
  const f=fixture(pack);f.answer('q1',true,{elapsedMs:40_000});f.answer('q2',true,{elapsedMs:40_000});const result=commit(ledger,f);
  progress=questionRewardProgress(pack,result.ledger);assert.deepEqual([progress.zero,progress.one,progress.two,progress.three,progress.bestTier,progress.done],[0,0,3,1,2,true]);assert.deepEqual(progress.questions,[{itemId:'q1',tier:2},{itemId:'q2',tier:2},{itemId:'q3',tier:2},{itemId:'q4',tier:3}]);
  const revised={...pack,items:pack.items.slice(1)};const changed=questionRewardProgress(revised,result.ledger);assert.equal(changed.earnedStars,result.ledger.earnedStars,'A revision does not erase already-earned historical source credit');
});

test('a review can require one known question while preserving the complete immutable source',()=>{
  const f=fixture();f.session.requiredItemIds=['q2'];f.answer('q2',false);assert.ok(v2QuestionCompletionErrors(f.session,f.events,f.pack).length);assert.deepEqual(f.candidates(),[]);
  f.answer('q2',true);assert.deepEqual(v2QuestionCompletionErrors(f.session,f.events,f.pack),[]);assert.deepEqual(f.candidates().map(row=>row.itemId),['q2']);assert.equal(f.pack.items.length,4);
  for(const requiredItemIds of [[],['missing'],['q2','q2'],Array(31).fill('q2'),'q2']){
    const session={...f.session,requiredItemIds};assert.ok(v2QuestionCompletionErrors(session,f.events,f.pack).length);assert.deepEqual(questionRewardCandidates(session,f.events,f.pack),[]);
  }
  const outside=fixture();outside.session.requiredItemIds=['q2'];outside.answer('q1');assert.ok(v2QuestionCompletionErrors(outside.session,outside.events,outside.pack).length);assert.deepEqual(outside.candidates(),[]);
  const mixed=fixture(pairs(),'memory-match');mixed.session.requiredItemIds=['q1'];mixed.pair('q1','q2');assert.ok(v2QuestionCompletionErrors(mixed.session,mixed.events,mixed.pack).length);assert.deepEqual(mixed.candidates(),[]);
});

test('forged outcomes, identity, timing, sequence and raw evidence never produce question rewards',()=>{
  for(const mutate of [
    event=>{event.correct=false;},event=>{event.response.choiceIndex=3;},event=>{event.profileId='someone-else';},event=>{event.packId='other-pack';},event=>{event.contentVersion=2;},event=>{event.objectiveId='OTHER';},event=>{event.gameSequence=2;},event=>{event.eventId='not-this-session';},event=>{event.elapsedMs=-1;},event=>{event.elapsedMs=Infinity;},event=>{event.hintsUsed=0.5;},event=>{delete event.response;},
  ]){const f=fixture();f.answer('q1');mutate(f.events[0]);assert.deepEqual(f.candidates(),[]);assert.ok(v2QuestionCompletionErrors(f.session,f.events,f.pack).length);}
  const duplicate=fixture();duplicate.answer('q1');duplicate.events.push(structuredClone(duplicate.events[0]));assert.deepEqual(duplicate.candidates(),[]);
  const invalidSource=fixture();invalidSource.answer('q1');invalidSource.pack.items[1].id=invalidSource.pack.items[0].id;assert.deepEqual(invalidSource.candidates(),[]);
});

test('ledger updates are immutable, reject foreign candidates and safely handle author IDs as data',()=>{
  const f=fixture();f.answer('q1');const candidate=f.candidates()[0],ledger=initializeQuestionRewardLedger(f.pack.id);
  for(const change of [{packId:'foreign-source'},{sourceKey:'wrong-key'},{starTier:0},{starTier:4},{policyVersion:1}])assert.throws(()=>applyQuestionRewardCandidates(ledger,[{...candidate,...change}]));
  assert.deepEqual(ledger.questionTiers,{});assert.throws(()=>initializeQuestionRewardLedger(f.pack.id,4));assert.throws(()=>applyQuestionRewardCandidates({...ledger,questionTiers:{q1:-1}},[]));
  const source=quiz();source.items[0].id='__proto__';const special=fixture(source);special.answer('__proto__');const result=commit(initializeQuestionRewardLedger(source.id),special);assert.equal(result.gained,3);assert.equal(Object.hasOwn(result.ledger.questionTiers,'__proto__'),true);assert.equal(Object.getPrototypeOf(result.ledger.questionTiers),Object.prototype);assert.equal(questionRewardProgress(source,result.ledger).three,1);
});
