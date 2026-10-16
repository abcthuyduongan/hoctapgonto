import {createClient} from '@supabase/supabase-js';
import {fail} from './online-errors.mjs';

export function createPrivateStorage({url,key,bucket='bao-an-media'}){
  const endpoint=new URL(url);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.origin!==url.replace(/\/$/,''))throw new Error('SUPABASE_URL cần là origin HTTPS.');
  if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket))throw new Error('Tên bucket không hợp lệ.');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}}),files=client.storage.from(bucket);
  let checked;
  async function ensurePrivate(){if(!checked)checked=(async()=>{const{data,error}=await client.storage.getBucket(bucket);if(error||!data||data.public)fail(502,'Kho tư liệu cần là bucket riêng tư của ứng dụng.');})().catch(error=>{checked=undefined;throw error;});await checked;}
  return{
    async upload(path,bytes,mime){await ensurePrivate();const{error}=await files.upload(path,bytes,{contentType:mime,cacheControl:'0',upsert:false});if(error)fail(502,'Chưa lưu được tư liệu. Kiểm tra bucket riêng tư trong Supabase.');},
    async download(path){await ensurePrivate();const{data,error}=await files.download(path);if(error||!data||data.size>2*1024*1024)fail(502,'Chưa đọc được tư liệu từ kho riêng tư.');return Buffer.from(await data.arrayBuffer());},
    async remove(path){const{error}=await files.remove([path]);if(error)fail(502,'Chưa dọn được bản tải lên chưa hoàn tất.');}
  };
}
