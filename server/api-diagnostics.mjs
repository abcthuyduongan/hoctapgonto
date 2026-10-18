import {randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
export const ONLINE_RUNTIME_VERSION='3.8.0-rc.12';
const timingContext=new AsyncLocalStorage();
const timingFields=new Set(['sql','lockingSql','pool','password','storage','serialize']);
const finiteMs=value=>Number.isFinite(value)?Math.max(0,Math.round(value*10)/10):0;
/** Aggregate numbers only. No SQL, arguments, request objects or authored data enter a trace. */
export async function measureApiSpan(name,action){
 const trace=timingContext.getStore();if(!trace||!timingFields.has(name))return action();
 const started=performance.now();try{return await action();}finally{trace[name+'Ms']+=finiteMs(performance.now()-started);if(name==='sql')trace.sqlCount++;}
}
export function measureApiSerialization(action){
 const trace=timingContext.getStore();if(!trace)return action();const started=performance.now();try{return action();}finally{trace.serializeMs+=finiteMs(performance.now()-started);}
}
/** Opt-in, at most 30 records/minute/instance, with every tenth request sampled by default.
 * lockingSqlMs includes execution/network time: it is NOT a measurement of lock wait. */
export function createPerformanceReporter({enabled=process.env.BAO_AN_PERFORMANCE_LOGS==='1',logger=value=>console.info(value),now=Date.now,limit=30,sampleEvery=10}={}){
 let windowStart=now(),count=0,seen=0;
 const budget=Math.max(0,Math.min(30,Number.isFinite(limit)?Math.floor(limit):30)),sample=Math.max(1,Number.isFinite(sampleEvery)?Math.floor(sampleEvery):10);
 return async(path,method,action)=>{
  if(!enabled)return action();const at=now();if(at-windowStart>=60000){windowStart=at;count=0;seen=0;}
  if(++seen%sample!==0||count>=budget)return action();count++;
  const group=String(path).split('?')[0].split('/')[3],routeGroup=['play','media','student','students','admin','account','setup','login','logout','me','wallet','redemptions','status'].includes(group)?group:'other';
  const trace={sqlMs:0,lockingSqlMs:0,poolMs:0,passwordMs:0,storageMs:0,serializeMs:0,sqlCount:0};
  return timingContext.run(trace,async()=>{const started=performance.now();let status=500;try{const response=await action();status=response.status;return response;}finally{
   try{logger(JSON.stringify({event:'api.performance',version:ONLINE_RUNTIME_VERSION,requestId:'BT-'+randomUUID().replaceAll('-','').slice(0,12),at:new Date(at).toISOString(),routeGroup,method:['GET','POST','PATCH','HEAD'].includes(method)?method:'OTHER',status,elapsedMs:finiteMs(performance.now()-started),...Object.fromEntries(Object.entries(trace).map(([key,value])=>[key,finiteMs(value)]))}));}catch{/* Observability must not break a request. */}
  }});
 };
}
/** Log only server failures, with fixed labels and a bounded per-instance budget.
 * Never accept an error object, body, cookie, account ID or authored text. */
export function createFailureReporter({logger=value=>console.error(value),now=Date.now,limit=30}={}){
 let windowStart=now(),count=0;
 return(path,method,status,elapsedMs)=>{
  if(status<500)return;
  const at=now();if(at-windowStart>=60000){windowStart=at;count=0;}if(count>=limit)return;count++;
  const group=String(path).split('?')[0].split('/')[3],routeGroup=['play','media','student','students','admin','account','setup','login','restore','backup','wallet','redemptions','status'].includes(group)?group:'other';
  const supportId='BA-'+randomUUID().replaceAll('-','').slice(0,12);
  try{logger(JSON.stringify({event:'api.failure',version:ONLINE_RUNTIME_VERSION,supportId,at:new Date(at).toISOString(),routeGroup,method:['GET','POST','PATCH','HEAD','OPTIONS'].includes(method)?method:'OTHER',status,elapsedMs:Math.max(0,Math.round(elapsedMs))}));}catch{return;}
  return supportId;
 };
}
