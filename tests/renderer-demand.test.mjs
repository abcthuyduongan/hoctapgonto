import test from 'node:test';
import assert from 'node:assert/strict';
import {SelectedAsset} from '../src/world3d/renderer/selectedAsset.ts';
import {RenderSchedule} from '../src/world3d/renderer/renderSchedule.ts';

const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const drain=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
test('rapid selection starts only latest queued decode and releases stale result without attaching',async()=>{
 const started=[],attached=[],released=[],pending=new Map();let active=0,peak=0;
 const owner=new SelectedAsset({load:async(id,signal)=>{started.push(id);active++;peak=Math.max(peak,active);const work=deferred();pending.set(id,{...work,signal});try{return await work.promise;}finally{active--; }},attach:(id,asset)=>attached.push([id,asset]),release:asset=>released.push(asset),failed:()=>assert.fail('cancel is not failure')});
 owner.select('first');await drain();owner.select('skipped');const done=owner.select('latest');await drain();assert.deepEqual(started,['first']);assert.equal(pending.get('first').signal.aborted,true);
 pending.get('first').resolve({name:'first'});await drain();assert.deepEqual(started,['first','latest']);assert.deepEqual(released,[{name:'first'}]);
 pending.get('latest').resolve({name:'latest'});await done;assert.equal(peak,1);assert.deepEqual(attached,[['latest',{name:'latest'}]]);assert.equal(owner.activeId,'latest');owner.dispose();assert.deepEqual(released,[{name:'first'},{name:'latest'}]);owner.dispose();assert.equal(released.length,2);
});
test('closing a scene disposes a late completed decoder exactly once',async()=>{
 const work=deferred(),released=[],attached=[];const owner=new SelectedAsset({load:()=>work.promise,attach:asset=>attached.push(asset),release:asset=>released.push(asset),failed:()=>assert.fail()});
 const done=owner.select('pending');await drain();owner.dispose();work.resolve({late:true});await done;assert.deepEqual(attached,[]);assert.deepEqual(released,[{late:true}]);assert.equal(owner.activeId,undefined);
});
test('active scene is released before another decode and a failed destination can retry',async()=>{
 const events=[];let failed=true;const owner=new SelectedAsset({load:async(id)=>{events.push('load '+id);if(id==='second'&&failed)throw new Error('network');return id;},attach:id=>events.push('attach '+id),release:id=>events.push('release '+id),failed:id=>events.push('failed '+id)});
 await owner.select('first');await owner.select('first');await owner.select('second');assert.deepEqual(events,['load first','attach first','release first','load second','failed second']);failed=false;await owner.select('second');assert.equal(owner.activeId,'second');await owner.select(null);assert.equal(owner.activeId,undefined);assert.equal(events.at(-1),'release second');
});
test('low quality draws at most 30 fps while reaction is bounded and idle never needs another frame',()=>{
 const schedule=new RenderSchedule();schedule.react(0,2400);let frames=0;
 for(let now=0;now<2400;now+=1000/60)if(schedule.shouldDraw(now,'low'))frames++;
 assert.ok(frames<=73&&frames>=70,frames);assert.equal(schedule.moving(2399,false,true),true);assert.equal(schedule.moving(2400,false,true),false);assert.equal(schedule.moving(4000,true,true),true);assert.equal(schedule.moving(4000,true,false),false);schedule.stop();assert.equal(schedule.moving(4001,false,true),false);
});
