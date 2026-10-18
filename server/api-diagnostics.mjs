import {randomUUID} from 'node:crypto';
export const ONLINE_RUNTIME_VERSION='3.8.0-rc.11';
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
