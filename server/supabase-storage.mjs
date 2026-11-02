import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {fail} from './online-errors.mjs';

export function createPrivateStorage({url,key,bucket='bao-an-media',cacheMaxBytes=16*1024*1024,cacheTtlMs=30000,now=Date.now}){
  const endpoint=new URL(url);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.origin!==url.replace(/\/$/,''))throw new Error('SUPABASE_URL cần là origin HTTPS.');
  if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket))throw new Error('Tên bucket không hợp lệ.');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}}),files=client.storage.from(bucket);
  let checked;
  const cache=new Map(),pending=new Map();let cacheBytes=0;
  const budget=Number.isFinite(cacheMaxBytes)?Math.max(0,Math.min(cacheMaxBytes,16*1024*1024)):0;
  function drop(key){const entry=cache.get(key);if(entry){cacheBytes-=entry.bytes.length;cache.delete(key);}}
  function prune(){for(const[key,entry]of cache)if(now()-entry.at>=cacheTtlMs)drop(key);while(cacheBytes>budget||cache.size>16)drop(cache.keys().next().value);}
  async function download(path,expectedHash){
    await ensurePrivate();
    const{data,error}=await files.download(path);if(error||!data||data.size>2*1024*1024)fail(502,'Chưa đọc được tư liệu từ kho riêng tư.');
    const bytes=Buffer.from(await data.arrayBuffer());
    if(expectedHash&&createHash('sha256').update(bytes).digest('hex')!==expectedHash)fail(502,'Tệp tư liệu không khớp dữ liệu đã duyệt.');
    return bytes;
  }
  async function ensurePrivate(){if(!checked)checked=(async()=>{const{data,error}=await client.storage.getBucket(bucket);if(error||!data||data.public)fail(502,'Kho tư liệu cần là bucket riêng tư của ứng dụng.');})().catch(error=>{checked=undefined;throw error;});await checked;}
  return{
    async upload(path,bytes,mime){await ensurePrivate();const{error}=await files.upload(path,bytes,{contentType:mime,cacheControl:'0',upsert:false});if(error)fail(502,'Chưa lưu được tư liệu. Kiểm tra bucket riêng tư trong Supabase.');},
    async download(path,expectedHash){
      // The API must still authorize every request before reaching this cache.
      // Only immutable bytes verified against the DB's hash are reusable.
      if(expectedHash===undefined||budget===0)return download(path,expectedHash);
      if(!/^[a-f0-9]{64}$/.test(expectedHash))fail(502,'Mã kiểm tra tư liệu không hợp lệ.');
      prune();const key=JSON.stringify([path,expectedHash]),hit=cache.get(key);
      if(hit){cache.delete(key);cache.set(key,hit);return Buffer.from(hit.bytes);}
      let work=pending.get(key);
      if(!work){
        work=download(path,expectedHash).then(bytes=>{
          if(bytes.length<=budget){drop(key);cache.set(key,{path,bytes,at:now()});cacheBytes+=bytes.length;prune();}return bytes;
        }).finally(()=>{if(pending.get(key)===work)pending.delete(key);});
        if(pending.size<32)pending.set(key,work);
      }
      return Buffer.from(await work);
    },
    async remove(path){for(const[key,entry]of cache)if(entry.path===path)drop(key);const{error}=await files.remove([path]);if(error)fail(502,'Chưa dọn được bản tải lên chưa hoàn tất.');}
  };
}
