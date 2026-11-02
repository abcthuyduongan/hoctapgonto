type Entry={scope:string;key:string;controller:AbortController;promise:Promise<string>;refs:number;bytes:number;url?:string;usedAt:number};
/** A small, session-scoped RAM cache. No authenticated bytes enter persistent browser caches. */
export function createQuestionImageLoader({fetchImage=fetch,createURL=(blob:Blob)=>URL.createObjectURL(blob),revokeURL=(url:string)=>URL.revokeObjectURL(url),maxBytes=16*1024*1024,ttlMs=60_000,now=Date.now}={}){
  const entries=new Map<string,Entry>(),queue:Array<()=>Promise<void>>=[];
  let active=0,totalBytes=0;
  const abortError=()=>new DOMException('Đã dừng tải hình.','AbortError');
  function remove(entry:Entry){
    if(entries.get(entry.key)!==entry)return;
    entries.delete(entry.key);entry.controller.abort();totalBytes-=entry.bytes;
    if(entry.url)revokeURL(entry.url);
  }
  function prune(){
    for(const entry of entries.values())if(entry.refs===0&&entry.url&&now()-entry.usedAt>ttlMs)remove(entry);
    const unused=[...entries.values()].filter(entry=>entry.refs===0&&entry.url).sort((a,b)=>a.usedAt-b.usedAt);
    for(const entry of unused){if(totalBytes<=maxBytes&&entries.size<=24)break;remove(entry);}
  }
  function pump(){
    while(active<2&&queue.length){active++;const run=queue.shift()!;void run().finally(()=>{active--;pump();});}
  }
  function acquire(scope:string,path:string){
    prune();const key=JSON.stringify([scope,path]);let entry=entries.get(key);
    if(!entry){
      const controller=new AbortController();let resolve!:(value:string)=>void,reject!:(reason:unknown)=>void;
      const promise=new Promise<string>((yes,no)=>{resolve=yes;reject=no;});
      entry={scope,key,controller,promise,refs:0,bytes:0,usedAt:now()};entries.set(key,entry);
      const current=entry;
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15_000)]);
      // Reject immediately on logout, even when the network request is still queued.
      controller.signal.addEventListener('abort',()=>reject(abortError()),{once:true});
      queue.push(async()=>{
        try{
          signal.throwIfAborted();
          const response=await fetchImage(path,{credentials:'include',cache:'no-store',signal});
          if(!response.ok)throw new Error(`Chưa tải được hình (${response.status}).`);
          if(!/^image\/(png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type')??''))throw new Error('Tệp nhận được không phải hình hợp lệ.');
          if(Number(response.headers.get('content-length')??0)>8*1024*1024)throw new Error('Hình vượt giới hạn tải.');
          const blob=await response.blob();signal.throwIfAborted();
          if(blob.size>8*1024*1024)throw new Error('Hình vượt giới hạn tải.');
          current.bytes=blob.size;current.url=createURL(blob);totalBytes+=blob.size;resolve(current.url);prune();
        }catch(error){reject(error);remove(current);}
      });pump();
    }
    const current=entry;current.refs++;current.usedAt=now();let released=false;
    return{promise:current.promise,release(){if(released)return;released=true;current.refs--;current.usedAt=now();if(current.refs===0&&!current.url)remove(current);prune();}};
  }
  return{acquire,clear(scope?:string){for(const entry of [...entries.values()])if(scope===undefined||entry.scope===scope)remove(entry);},stats:()=>({entries:entries.size,bytes:totalBytes,active,queued:queue.length})};
}

export const questionImageLoader=createQuestionImageLoader();
