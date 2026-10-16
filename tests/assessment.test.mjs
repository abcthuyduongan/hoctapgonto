import test from 'node:test';
import assert from 'node:assert/strict';
import { learningStorageFixture } from './visual/helpers/learning-storage-fixture.ts';
import { buildLessonSession } from '../src/core/lesson-host.ts';
import { makeLessonSubmission,makeSessionResult } from '../src/core/learning-runtime.ts';
import { captureExposureSources,independentFormIsAvailable,itemRefKey,rebuildLessonProgress,validateSessionExposureSources } from '../src/core/curriculum.ts';
import { parseLearningBackup,serializeLearningBackup } from '../src/core/backup-io.ts';

test('Host keeps 79.5% below pass, accepts exactly 80%, and validates 200 distinct answers across packs',()=>{
  const f=learningStorageFixture('threshold'),form=f.curriculum.lessons[0].forms[1],packs=[f.pack];
  form.itemRefs=[];
  for(let start=0;start<200;start+=30){const items=Array.from({length:Math.min(30,200-start)},(_,n)=>({...f.pack.items[0],id:`large-${start+n}`,prompt:`${start+n+50} + 3 = ?`,
    options:[String(start+n+53),String(start+n+54),String(start+n+55),String(start+n+52)],explanation:`Cộng thêm 3 được ${start+n+53}.`}));
    const pack={...f.pack,id:`large-pack-${start}`,items};packs.push(pack);form.itemRefs.push(...items.map(item=>({packId:pack.id,contentVersion:1,itemId:item.id})));}
  const context={curricula:[f.curriculum],packs,sessions:[f.session],events:f.events,results:[f.result],profiles:[f.profile]};
  for(const correctCount of [159,160]){
    let session=buildLessonSession(f.profile.profileId,f.curriculum,f.curriculum.lessons[0],form,context,'owner',`threshold-${correctCount}`,'2026-10-12T11:00:00.000Z');
    const events=[];
    for(const [index,itemRef] of session.checkpoint.itemOrder.entries()){
      const submitted=makeLessonSubmission(session,events,{attemptKey:`answer-${index}`,itemRef,response:{version:1,kind:'choice',selectedIndex:index<correctCount?0:1},hintsUsed:0,elapsedMs:10_000},new Date(Date.parse(session.startedAt)+index+1).toISOString(),context);
      session=submitted.session;events.push(submitted.event);
    }
    const result=makeSessionResult(session,events,'2026-10-12T11:01:00.000Z',{...context,sessions:[f.session,session],events:[...f.events,...events]});
    assert.equal(result.firstAttemptCorrect,correctCount);assert.equal(result.passed,correctCount===160);assert.equal(result.starTier,correctCount===160?2:0);
  }
});
test('Legacy game answers are captured as exposure, reject independent reuse and survive backup without awarding legacy stars',()=>{
  const f=learningStorageFixture('legacy-exposure'),form=f.curriculum.lessons[0].forms[1],ref=form.itemRefs[0];
  const legacy={sessionId:'legacy-game',profileId:f.profile.profileId,packId:ref.packId,contentVersion:ref.contentVersion,moduleId:'math-quest',moduleVersion:'1.0.0',
    startedAt:'2026-10-12T10:10:00.000Z',endedAt:'2026-10-12T10:11:00.000Z',status:'completed'};
  const event={eventId:'legacy-game:answer',sessionId:legacy.sessionId,profileId:f.profile.profileId,packId:ref.packId,contentVersion:ref.contentVersion,moduleId:'math-quest',moduleVersion:'1.0.0',
    itemId:ref.itemId,objectiveId:f.pack.items[0].objectiveId,correct:false,hintsUsed:0,elapsedMs:8000,occurredAt:'2026-10-12T10:10:30.000Z'};
  const context={curricula:[f.curriculum],packs:[f.pack],profiles:[f.profile],sessions:[f.session,legacy],events:[...f.events,event],results:[f.result]};
  const assessment=buildLessonSession(f.profile.profileId,f.curriculum,f.curriculum.lessons[0],form,context,'owner','new-assessment','2026-10-12T11:00:00.000Z');
  assessment.exposureSources=captureExposureSources(assessment,context);
  assert.deepEqual(assessment.exposureSources.legacyEventIds,[event.eventId]);assert.ok(assessment.exposureSources.itemKeys.includes(itemRefKey(ref)));
  assert.equal(independentFormIsAvailable(assessment,context),false);assert.deepEqual(validateSessionExposureSources(assessment,context),[]);
  assert.ok(validateSessionExposureSources(assessment,{...context,events:f.events}).length);
  assert.ok(validateSessionExposureSources(assessment,{...context,events:[...f.events,{...event,profileId:'other'}]}).length);
  // Guided use of an exposed form remains valid and keeps the published result from the old practice.
  assessment.mode='lesson-practice';assessment.guidedFrom='lesson-assessment';assessment.status='paused';delete assessment.ownerTabId;
  const backup={packs:context.packs,curricula:context.curricula,profiles:context.profiles,sessions:[...context.sessions,assessment],events:context.events,
    sessionResults:[f.result],lessonProgress:[],reviews:[]};
  // Use the same derived cache as storage, then check the full exported graph.
  backup.lessonProgress=rebuildLessonProgress(backup.sessionResults,backup.curricula);
  const restored=parseLearningBackup(serializeLearningBackup(backup,'2026-10-14T12:00:00.000Z'));
  assert.deepEqual(restored.sessions.find(row=>row.sessionId===assessment.sessionId).exposureSources,assessment.exposureSources);
  assert.equal(restored.sessionResults.length,1);assert.equal(restored.lessonProgress[0].bestStars,1);
});
