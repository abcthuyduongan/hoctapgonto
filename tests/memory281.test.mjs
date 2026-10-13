import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../src/games/MemoryMatch.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/memory281.css',import.meta.url),'utf8');

function setupFakeHooks(){
  const slots=[];
  const effects=[];
  let cursor=0;
  const depsSame=(a,b)=>a && b && a.length===b.length && a.every((x,i)=>Object.is(x,b[i]));
  const hooks={
    useState(value){const i=cursor++;if(!slots[i])slots[i]={value};return [slots[i].value,(next)=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},
    useRef(value){const i=cursor++;if(!slots[i])slots[i]={current:value};return slots[i];},
    useMemo(fn,deps){const i=cursor++;if(!slots[i] || !depsSame(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
    useCallback(fn){cursor++;return fn;},
    useEffect(fn){const i=cursor++;if(!slots[i]){slots[i]={};effects.push({setup:fn,cleanup:null});}}
  };
  return {hooks,effects,begin(){cursor=0;}, strictReplay(){for(const eff of effects){eff.cleanup=eff.setup();eff.cleanup?.();eff.cleanup=eff.setup();}},cleanup(){for(const eff of effects)eff.cleanup?.();}};
}
async function loadMemory(hooks){
  const globals=`const {useState,useMemo,useCallback,useEffect,useRef}=globalThis.__memoryHooks;\nconst React=globalThis.__fakeReact;\nconst GameMascot=()=>null;const FeedbackEffects=()=>null;const GameCompletion=()=>null;\nconst shuffle=(arr)=>arr;const playFeedbackTone=()=>{};\n`;
  const noImports=source.replace(/^import .*?;\s*$/gm,'');
  let compiled=ts.transpileModule(noImports,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}}).outputText;
  globalThis.__memoryHooks=hooks.hooks;
  globalThis.__fakeReact={createElement:(type,props,...children)=>({type,props:{...props,children}})};
  return (await import('data:text/javascript;base64,'+Buffer.from(globals+compiled).toString('base64'))).default;
}
function findAll(tree,predicate,result=[]){
  if(!tree||typeof tree!=='object')return result;
  if(predicate(tree))result.push(tree);
  for(const child of tree.props?.children??[]) {if(Array.isArray(child)){for(const sub of child)findAll(sub,predicate,result);} else findAll(child,predicate,result);}
  return result;
}
const tick=ms=>new Promise(r=>setTimeout(r,ms));

test('Memory Match: StrictMode effect replay does not freeze the board after two cards',async()=>{
  const runtime=setupFakeHooks();
  const Component=await loadMemory(runtime);
  const events=[];let completed=0;
  const props={pack:{kind:'pairs',id:'p',version:1,items:[
    {id:'mother',left:'mẹ',right:'mother',objectiveId:'o1'},
    {id:'father',left:'bố',right:'father',objectiveId:'o2'}
  ]},onAttempt:async v=>{events.push(v)},onComplete:async()=>{completed++},onExit:()=>{}};
  let effectsRun=false;
  function render(){runtime.begin();const dom=Component(props);if(!effectsRun){runtime.strictReplay();effectsRun=true;}return dom;}
  function cards(){return findAll(render(),n=>n.type==='button'&&String(n.props.className).includes('memory-card'));}
  function click(i){const c=cards()[i];assert.ok(c);assert.equal(c.props.disabled,false,'card clickable');c.props.onClick();}
  click(0);click(2);await tick(30);
  assert.equal(events.length,1,'recorded first pair');
  assert.equal(cards().filter(c=>!c.props.disabled).length,0,'wrong pair stays visible briefly before unlock');
  // Here pair 0-L and 2-L are different pair IDs, hence wait for mismatch timer.
  await tick(770);
  assert.equal(cards().filter(c=>!c.props.disabled).length,4,'board unlocked after mismatch');
  click(0);click(1);await tick(30);
  assert.equal(events.length,2);assert.equal(cards().filter(c=>!c.props.disabled).length,2,'two matched cards are locked, other pair is interactive');
  click(2);click(3);await tick(30);
  assert.equal(completed,1,'completes when all pairs are found');
  runtime.cleanup();
  delete globalThis.__memoryHooks;delete globalThis.__fakeReact;
});

test('Memory Match: visual quality rules and stable feedback area are present',()=>{
  assert.match(css,/\.memory-grid/);
  assert.match(css,/\.memory-card/);
  assert.match(css,/\.memory-feedback-slot/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(source,/closed\.current = false/);
  assert.match(source,/setSaving\(false\)/);
});
