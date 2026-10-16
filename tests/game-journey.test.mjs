import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_PACKS} from '../src/core/seed.ts';
import {gamePresentation,sessionGamePack} from '../src/core/game-presentation.ts';
import {sampleGameJourney,validateGameJourney,journeyProgress,JOURNEY_SUBJECTS} from '../src/core/game-journey.ts';
import {gameSessionEvidenceErrors,bestGameRewards,scoreGameResponse} from '../src/core/game-rewards.ts';
import {validatePack} from '../src/core/validation.ts';
import {parseLearningBackup,serializeLearningBackup} from '../src/core/backup-io.ts';

const pack=BUILTIN_PACKS.find(p=>p.id==='math3-equations');
const start='2026-10-15T01:00:00.000Z',end='2026-10-15T01:01:00.000Z',exported='2026-10-15T02:00:00.000Z';
function complete(source,moduleId,id,version=1){
  const presentation=gamePresentation(moduleId,source);
  const session={sessionId:id,profileId:'journey-child',packId:source.id,contentVersion:source.version,moduleId,moduleVersion:'1.0.0',startedAt:start,endedAt:end,status:'completed',rewardPolicyVersion:1,...(version?{presentationVersion:version}:{})};
  const events=presentation.items.map((item,i)=>({eventId:`${id}:answer-${i}`,sessionId:id,profileId:session.profileId,packId:source.id,contentVersion:source.version,moduleId,moduleVersion:session.moduleVersion,itemId:item.id,objectiveId:item.objectiveId,correct:true,hintsUsed:0,elapsedMs:100,occurredAt:end,gameSequence:i+1,
    response:presentation.kind==='quiz'?{kind:'choice',choiceIndex:item.correctIndex}:{kind:'pair',first:{itemId:item.id,side:'left'},second:{itemId:item.id,side:'right'}}}));
  return {session,events};
}
test('one immutable pair pack becomes three games without changing source IDs, objectives or answers',()=>{
  const original=structuredClone(pack);
  for(const id of ['math-quest','memory-match','word-connect']){
    const presentation=gamePresentation(id,pack);assert.deepEqual(validatePack(presentation),[]);
    assert.deepEqual(presentation.items.map(i=>[i.id,i.objectiveId]),pack.items.map(i=>[i.id,i.objectiveId]));
    if(presentation.kind==='quiz')for(const [index,item]of presentation.items.entries())assert.equal(item.options[item.correctIndex],pack.items[index].right);
  }
  assert.deepEqual(pack,original);assert.equal(gamePresentation('sentence-builder',pack),undefined);
  assert.equal(sessionGamePack({moduleId:'math-quest'},pack),undefined);
});
test('ambiguous duplicate answers, long cards and missing context cannot become matching questions',()=>{
  const quiz=gamePresentation('math-quest',pack);
  assert.ok(gamePresentation('memory-match',quiz));
  const duplicate=structuredClone(quiz);duplicate.items[1].options[duplicate.items[1].correctIndex]=duplicate.items[0].options[0];
  assert.equal(gamePresentation('memory-match',duplicate),undefined);
  const long=structuredClone(quiz);long.items[0].prompt='a'.repeat(121);assert.equal(gamePresentation('word-connect',long),undefined);
  assert.equal(gamePresentation('math-quest',BUILTIN_PACKS.find(p=>p.kind==='sentences')),undefined);
  assert.equal(gamePresentation('math-quest',{...pack,items:pack.items.slice(0,3)}),undefined);
});
test('host grades original source responses; alternate completions require explicit presentation version and every item',()=>{
  const {session,events}=complete(pack,'math-quest','alt-quiz');
  assert.deepEqual(gameSessionEvidenceErrors(session,events,pack,true),[]);
  assert.ok(gameSessionEvidenceErrors({...session,presentationVersion:undefined},events,pack,true).length);
  assert.ok(gameSessionEvidenceErrors(session,events.slice(1),pack,true).length);
  assert.equal(scoreGameResponse(pack,'math-quest',events[0].itemId,events[0].response,1).correct,true);
  assert.equal(scoreGameResponse(pack,'math-quest',events[0].itemId,{kind:'choice',choiceIndex:1},1).correct,false);
  assert.throws(()=>scoreGameResponse(pack,'math-quest',events[0].itemId,events[0].response));
});
test('same original pack across games, retries and revisions earns at most the highest three stars',()=>{
  const a=complete(pack,'math-quest','first'),b=complete(pack,'word-connect','second');
  const revision={...structuredClone(pack),version:2},c=complete(revision,'memory-match','revision');
  const best=bestGameRewards({packs:[pack,revision],sessions:[a.session,b.session,c.session],events:[...a.events,...b.events,...c.events]},'journey-child');
  assert.equal(best.length,1);assert.equal(best[0].starTier,3);
  assert.deepEqual(bestGameRewards({packs:[pack],sessions:[a.session],events:a.events},'other-child'),[]);
});
test('weekly gates require two stars in all three subjects and all basics before advanced; spent stars do not affect gates',()=>{
  const journey=sampleGameJourney();assert.deepEqual(validateGameJourney(journey),[]);
  for(const stage of journey.stages)for(const subject of JOURNEY_SUBJECTS){const p=BUILTIN_PACKS.find(p=>p.id===stage.packs[subject].packId);assert.equal(p.subject,subject);assert.deepEqual(validatePack(p),[]);}
  let rewards=[{packId:journey.stages[0].packs.math.packId,starTier:3},{packId:journey.stages[0].packs.vietnamese.packId,starTier:1}];
  assert.deepEqual(journeyProgress(journey,rewards,BUILTIN_PACKS).stages.map(s=>s.unlocked),[true,false,false]);
  for(const stage of journey.stages.slice(0,2)){
    for(const subject of JOURNEY_SUBJECTS)rewards.push({packId:stage.packs[subject].packId,starTier:2});
    const progress=journeyProgress(journey,rewards,BUILTIN_PACKS);assert.equal(progress.current.stageId,journey.stages[journey.stages.indexOf(stage)+1].id);
  }
  assert.deepEqual(journeyProgress(journey,rewards,BUILTIN_PACKS).stages.map(s=>s.unlocked),[true,true,true]);
  const locked={...sampleGameJourney(),selectedPack:journey.stages[2].packs.math};
  assert.equal(journeyProgress(locked,[],BUILTIN_PACKS).current.stageId,'week-01');
  assert.equal(journeyProgress(journey,[],[]).current.pack,undefined);
});
test('journey parser rejects incomplete subjects, reordered levels, duplicate source revisions, unknown fields and accessors',()=>{
  for(const mutate of [j=>delete j.stages[0].packs.math,j=>j.stages.reverse(),j=>j.stages[1].packs.math={...j.stages[0].packs.math,contentVersion:2},j=>j.unexpected=true,j=>j.selectedPack={packId:'outside',contentVersion:1}]){
    const journey=sampleGameJourney();mutate(journey);assert.ok(validateGameJourney(journey).length);
  }
  let called=false;const hostile=sampleGameJourney();Object.defineProperty(hostile,'stages',{get(){called=true;throw Error('getter');}});assert.ok(validateGameJourney(hostile).length);assert.equal(called,false);
});
test('backup round-trip preserves the weekly plan and original alternate-game evidence, and rejects missing source snapshots',()=>{
  const a=complete(pack,'math-quest','backup-alt'),profile={profileId:'journey-child',name:'Bảo An',avatar:'fox',grade:3,colorTheme:'teal',createdAt:start,updatedAt:end,
    learningSettings:{schemaVersion:1,enrollments:[],preferredSubjects:['math','vietnamese','english'],gameJourney:sampleGameJourney()}};
  const data={profiles:[profile],packs:BUILTIN_PACKS,sessions:[a.session],events:a.events,reviews:[],curricula:[],sessionResults:[],lessonProgress:[]};
  const parsed=parseLearningBackup(serializeLearningBackup(data,exported));assert.deepEqual(parsed.profiles[0].learningSettings.gameJourney,profile.learningSettings.gameJourney);
  assert.equal(parsed.sessions[0].presentationVersion,1);assert.equal(bestGameRewards(parsed,'journey-child')[0].starTier,3);
  const missing=structuredClone(parsed);missing.packs=missing.packs.filter(p=>p.id!=='english3-family');assert.throws(()=>parseLearningBackup(JSON.stringify(missing)),/thiếu đúng bộ ôn/);
  const forged=structuredClone(parsed);forged.sessions[0].presentationVersion=2;assert.throws(()=>parseLearningBackup(JSON.stringify(forged)),/phiên bản cách chơi/);
});
