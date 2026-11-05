import {fail} from './online-errors.mjs';
import {createHash} from 'node:crypto';
const parseAudio=async(bytes,mime,maxBytes)=>{
 const{parseBuffer}=await import('music-metadata');return parseBuffer(bytes,{mimeType:mime,size:bytes.length},{duration:true,skipCovers:true,maxBufferSize:maxBytes});
};
/** Cache verified durations, never media buffers or delivery receipts. Limits are checked on every call. */
export function createAudioDurationReader({parse=parseAudio,now=Date.now,maxEntries=64,ttlMs=300000}={}){
 const cache=new Map();
 return async(bytes,mime,maxBytes=2*1024*1024)=>{
  if(!Number.isInteger(maxBytes)||maxBytes<12||maxBytes>8*1024*1024||bytes.length>maxBytes)fail(422,'Âm thanh vượt giới hạn xác minh.');
  for(const[key,entry]of cache)if(now()-entry.at>ttlMs)cache.delete(key);
  const key=mime+':'+createHash('sha256').update(bytes).digest('hex'),existing=cache.get(key);if(existing)return existing.promise;
  const entry={at:now(),promise:undefined};
  entry.promise=(async()=>{
   try{const result=await parse(bytes,mime,maxBytes),ms=Math.ceil(result.format.duration*1000);if(Number.isFinite(ms)&&ms>0&&ms<=600000)return ms;}catch{}
   fail(422,'Không xác minh được thời lượng âm thanh. Hãy nhờ giáo viên xuất lại WAV, MP3 hoặc OGG.');
  })().catch(error=>{if(cache.get(key)===entry)cache.delete(key);throw error;});
  cache.set(key,entry);while(cache.size>maxEntries)cache.delete(cache.keys().next().value);return entry.promise;
 };
}
export const audioDurationMs=createAudioDurationReader();
/** The SQLite upload store is synchronous. Validate audio before calling it,
 * while leaving its existing shape, size and MIME errors authoritative. */
export async function validateUploadedAudio(input,maxBytes=2*1024*1024){
 const encoded=input?.base64;
 if(typeof encoded!=='string'||encoded.length>Math.ceil(maxBytes/3)*4||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return;
 const bytes=Buffer.from(encoded,'base64');
 const mime=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE'?'audio/wav':bytes.toString('ascii',0,4)==='OggS'?'audio/ogg':bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&0xe0)===0xe0?'audio/mpeg':undefined;
 if(mime)await audioDurationMs(bytes,mime,maxBytes);
}
