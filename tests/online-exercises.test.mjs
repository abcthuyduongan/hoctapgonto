import test from 'node:test';
import assert from 'node:assert/strict';
import {onlinePresentation,onlineScoreResponse,onlineEvidenceErrors,onlineAward} from '../src/core/online-exercises.ts';
import {gamePresentation} from '../src/core/game-presentation.ts';
import {gameRewardAwards,gameSessionEvidenceErrors,scoreGameResponse} from '../src/core/game-rewards.ts';
import {validatePack} from '../src/core/validation.ts';

const startedAt='2026-10-15T09:00:00.000Z',endedAt='2026-10-15T09:02:00.000Z';
function richPack(){
  const common={objectiveId:'RICH3.PRACTICE',explanation:'Đối chiếu nội dung đã học.',hint:'Hãy đọc hoặc nghe lại đề.'};
  return{id:'online-rich-exercises',version:1,title:'Bộ bài mở rộng',subject:'thinking',grade:3,source:'local',publishedAt:startedAt,kind:'learning',contentFormatVersion:2,
    passages:[{passageId:'reading-01',title:'Vườn nhỏ',body:'Trong vườn có cây xanh và một chú chim.',source:'Tự biên soạn',rights:'Gia đình cho phép sử dụng',approvedAt:startedAt}],
    media:[{mediaId:'audio-01',kind:'audio',url:'/audio/online-sample.mp3',sha256:'a'.repeat(64),transcript:'Hello Lucy.',source:'Tự thu âm',rights:'Gia đình cho phép sử dụng',approvedAt:startedAt}],
    items:[
      {...common,id:'numeric-01',kind:'numeric-answer',prompt:'Viết số một phẩy năm.',answer:'1,500',unit:'m'},
      {...common,id:'fill-01',kind:'fill-blank',prompt:'Điền hai từ: Vườn có ___.',acceptedAnswers:['cây xanh','cây cối'],caseSensitive:false},
      {...common,id:'reading-01',kind:'reading-choice',prompt:'Trong vườn có gì?',passageId:'reading-01',options:['Cá voi','Tàu biển','Cây xanh','Núi tuyết'],correctIndex:2},
      {...common,id:'listening-01',kind:'listening-choice',prompt:'Nghe và chọn tên bạn.',audioId:'audio-01',options:['Mai','Lucy','Nam','Peter'],correctIndex:1},
      {...common,id:'gap-01',kind:'listening-gap',prompt:'Nghe và điền lời chào.',audioId:'audio-01',acceptedAnswers:['Hello Lucy'],caseSensitive:true},
    ]};
}
const rightAnswers=[{kind:'text',value:'+001.5000'},{kind:'text',value:' CÂY  XANH '},{kind:'choice',choiceIndex:2},{kind:'choice',choiceIndex:1},{kind:'text',value:'Hello Lucy'}];
const wrongAnswers=[{kind:'text',value:'2'},{kind:'text',value:'cay xanh'},{kind:'choice',choiceIndex:0},{kind:'choice',choiceIndex:0},{kind:'text',value:'hello lucy'}];
function fixture({correct=5,hint=-1}={}){
  const pack=richPack(),session={sessionId:'rich-session',profileId:'rich-student',packId:pack.id,contentVersion:pack.version,moduleId:'math-quest',moduleVersion:'0.2.7',startedAt,endedAt,status:'completed',rewardPolicyVersion:1,presentationVersion:1};
  const events=pack.items.map((item,index)=>({eventId:`${session.sessionId}:attempt-${index+1}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:pack.version,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId:item.id,objectiveId:item.objectiveId,correct:index<correct,hintsUsed:index===hint?1:0,elapsedMs:500,occurredAt:`2026-10-15T09:00:${String(10+index).padStart(2,'0')}.000Z`,response:structuredClone(index<correct?rightAnswers[index]:wrongAnswers[index]),gameSequence:index+1}));
  return{pack,session,events};
}

test('online rich exercises use only the question island and retain their immutable source',()=>{
  const pack=richPack(),before=structuredClone(pack);assert.deepEqual(validatePack(pack),[]);
  assert.equal(onlinePresentation('math-quest',pack),pack);
  for(const moduleId of['memory-match','word-connect','sentence-builder','sequence-trail'])assert.equal(onlinePresentation(moduleId,pack),undefined);
  assert.deepEqual(pack,before);
});

test('online numeric grading normalizes signs, decimal commas and zeroes without evaluating expressions',()=>{
  const pack=richPack();
  for(const value of['1.5','001,500','+1.5000'])assert.equal(onlineScoreResponse(pack,'math-quest','numeric-01',{kind:'text',value}).correct,true);
  assert.equal(onlineScoreResponse(pack,'math-quest','numeric-01',{kind:'text',value:'15'}).correct,false);
  for(const value of['1e3','1 + 0.5','1.5m','NaN','Infinity','1,5.0','1 500'])assert.throws(()=>onlineScoreResponse(pack,'math-quest','numeric-01',{kind:'text',value}));
  pack.items[0].answer='0';
  assert.equal(onlineScoreResponse(pack,'math-quest','numeric-01',{kind:'text',value:'-000,000'}).correct,true);
});

test('online fill and listening text preserve Vietnamese accents, Unicode normalization and authored case rules',()=>{
  const pack=richPack();
  for(const value of['CÂY   XANH','ca\u0302y xanh',' cây\nxanh '])assert.equal(onlineScoreResponse(pack,'math-quest','fill-01',{kind:'text',value}).correct,true);
  assert.equal(onlineScoreResponse(pack,'math-quest','fill-01',{kind:'text',value:'cay xanh'}).correct,false);
  assert.equal(onlineScoreResponse(pack,'math-quest','fill-01',{kind:'text',value:'CÂY CỐI'}).correct,true);
  assert.equal(onlineScoreResponse(pack,'math-quest','gap-01',{kind:'text',value:'Hello Lucy'}).correct,true);
  assert.equal(onlineScoreResponse(pack,'math-quest','gap-01',{kind:'text',value:'hello lucy'}).correct,false);
});

test('online reading and listening choice grade exact raw indices and reject wrong answer shapes',()=>{
  const pack=richPack();
  assert.deepEqual(onlineScoreResponse(pack,'math-quest','reading-01',{kind:'choice',choiceIndex:2}),{correct:true,touchedItemIds:['reading-01']});
  assert.equal(onlineScoreResponse(pack,'math-quest','listening-01',{kind:'choice',choiceIndex:0}).correct,false);
  for(const response of[true,{correct:true},{kind:'choice',choiceIndex:4},{kind:'choice',choiceIndex:NaN},{kind:'choice',choiceIndex:'2'},{kind:'text',value:'Cây xanh'}])assert.throws(()=>onlineScoreResponse(pack,'math-quest','reading-01',response));
  assert.throws(()=>onlineScoreResponse(pack,'math-quest','numeric-01',{kind:'choice',choiceIndex:0}));
  assert.throws(()=>onlineScoreResponse(pack,'memory-match','reading-01',{kind:'choice',choiceIndex:2}));
  assert.throws(()=>onlineScoreResponse(pack,'math-quest','unknown-item',{kind:'text',value:'1'}));
});

test('online rich answer boundary rejects hidden fields and accessors before reading them',()=>{
  const pack=richPack();let called=false;
  const accessor={kind:'text'};Object.defineProperty(accessor,'value',{enumerable:true,get(){called=true;throw new Error('Must not run');}});
  const hidden={kind:'text',value:'cây xanh'};Object.defineProperty(hidden,'extra',{value:true});
  for(const response of[null,[],accessor,hidden,{kind:'text',value:''},{kind:'text',value:'x'.repeat(121)},{kind:'text',value:'cây\u0000 xanh'},{kind:'text',value:'cây xanh',correct:true},{kind:'text',value:'cây xanh',[Symbol('hidden')]:true}])assert.throws(()=>onlineScoreResponse(pack,'math-quest','fill-01',response));
  assert.equal(called,false);
});

test('online rich completion requires raw evidence for every item; exact 80 percent earns two stars',()=>{
  for(const[correct,tier]of[[5,3],[4,2],[3,1],[0,1]]){
    const f=fixture({correct});assert.deepEqual(onlineEvidenceErrors(f.session,f.events,f.pack,true),[]);
    const award=onlineAward(f.session,f.events,f.pack);
    assert.equal(award.starTier,tier);assert.equal(award.firstTryCorrect,correct);assert.equal(award.totalItems,5);
    assert.equal(award.profileId,f.session.profileId);assert.equal(award.packId,f.pack.id);
  }
  const f=fixture(),partial=f.events.slice(0,4);
  assert.deepEqual(onlineEvidenceErrors(f.session,partial,f.pack),[]);
  assert.ok(onlineEvidenceErrors(f.session,partial,f.pack,true).length);
  assert.equal(onlineAward(f.session,partial,f.pack),undefined);
  const booleans=f.events.map(({response,...event})=>event);
  assert.ok(onlineEvidenceErrors(f.session,booleans,f.pack,true).length);
  assert.equal(onlineAward(f.session,booleans,f.pack),undefined);
});

test('online rich first response and hint use determine the tier; retries and storage order cannot improve it',()=>{
  const hinted=fixture({hint:0});assert.equal(onlineAward(hinted.session,hinted.events,hinted.pack).starTier,2);
  const f=fixture({correct:4}),last=f.events.at(-1);
  f.events.push({...last,eventId:`${f.session.sessionId}:retry`,response:rightAnswers[4],correct:true,gameSequence:6,occurredAt:'2026-10-15T09:01:00.000Z'});
  assert.deepEqual(onlineEvidenceErrors(f.session,f.events,f.pack,true),[]);
  assert.equal(onlineAward(f.session,f.events,f.pack).firstTryCorrect,4);
  assert.equal(onlineAward(f.session,[...f.events].reverse(),f.pack).starTier,2);
});

test('online rich evidence rejects forged identity, version, time, sequence and outcome',()=>{
  const mutations=[
    event=>{event.profileId='someone-else';},event=>{event.sessionId='another-session';},event=>{event.packId='another-pack';},
    event=>{event.contentVersion=2;},event=>{event.moduleId='memory-match';},event=>{event.moduleVersion='forged';},event=>{event.objectiveId='another-objective';},
    event=>{event.eventId='forged-event';},event=>{event.gameSequence=2;},event=>{event.hintsUsed=-1;},event=>{event.hintsUsed=0.5;},event=>{event.elapsedMs=Infinity;},
    event=>{event.occurredAt='2026-10-15T08:59:59.000Z';},event=>{event.occurredAt='2026-10-15T09:03:00.000Z';},
    event=>{event.correct=false;},event=>{delete event.response;},
  ];
  for(const mutate of mutations){const f=fixture();mutate(f.events[0]);assert.ok(onlineEvidenceErrors(f.session,f.events,f.pack,true).length);assert.equal(onlineAward(f.session,f.events,f.pack),undefined);}
  const duplicate=fixture();duplicate.events[1].eventId=duplicate.events[0].eventId;assert.equal(onlineAward(duplicate.session,duplicate.events,duplicate.pack),undefined);
  const reversedTime=fixture();reversedTime.events[1].occurredAt=startedAt;assert.equal(onlineAward(reversedTime.session,reversedTime.events,reversedTime.pack),undefined);
  const mismatched=fixture();mismatched.session.contentVersion=2;assert.equal(onlineAward(mismatched.session,mismatched.events,mismatched.pack),undefined);
});

test('online rich awards require a completed session under the current reward policy',()=>{
  for(const patch of[{rewardPolicyVersion:undefined},{status:'active'},{status:'abandoned'},{endedAt:undefined},{endedAt:'2026-10-15T08:59:00.000Z'}]){
    const f=fixture();assert.equal(onlineAward({...f.session,...patch},f.events,f.pack),undefined);
  }
});

test('online native pack presentation, grading, evidence and awards retain the existing game semantics',()=>{
  const f=fixture(),pack={id:'native-online-quiz',version:1,title:'Câu hỏi có sẵn',subject:'thinking',grade:3,source:'local',publishedAt:startedAt,kind:'quiz',items:Array.from({length:5},(_,index)=>({id:`native-${index}`,objectiveId:'NATIVE3.PRACTICE',kind:'multiple-choice',prompt:`Câu hỏi ${index}`,options:[`Đúng ${index}`,`Sai A ${index}`,`Sai B ${index}`,`Sai C ${index}`],correctIndex:0,explanation:'Đáp án đầu tiên.'}))};
  const session={...f.session,packId:pack.id};
  const events=pack.items.map((item,index)=>({...f.events[index],packId:pack.id,itemId:item.id,objectiveId:item.objectiveId,response:{kind:'choice',choiceIndex:0},correct:true}));
  assert.deepEqual(onlinePresentation('memory-match',pack),gamePresentation('memory-match',pack));
  assert.deepEqual(onlineScoreResponse(pack,'math-quest',pack.items[0].id,events[0].response),scoreGameResponse(pack,'math-quest',pack.items[0].id,events[0].response,1));
  assert.deepEqual(onlineEvidenceErrors(session,events,pack,true),gameSessionEvidenceErrors(session,events,pack,true));
  assert.deepEqual(onlineAward(session,events,pack),gameRewardAwards({sessions:[session],events,packs:[pack]},session.profileId)[0]);
});
