import {fail} from './online-errors.mjs';
/** Bounded input, no retained buffers and no client-supplied duration. */
export async function audioDurationMs(bytes,mime,maxBytes=2*1024*1024){
 if(!Number.isInteger(maxBytes)||maxBytes<12||maxBytes>8*1024*1024||bytes.length>maxBytes)fail(422,'Âm thanh vượt giới hạn xác minh.');
 try{const{parseBuffer}=await import('music-metadata');const result=await parseBuffer(bytes,{mimeType:mime,size:bytes.length},{duration:true,skipCovers:true,maxBufferSize:maxBytes});const ms=Math.ceil(result.format.duration*1000);if(Number.isFinite(ms)&&ms>0&&ms<=600000)return ms;}catch{}
 fail(422,'Không xác minh được thời lượng âm thanh. Hãy nhờ giáo viên xuất lại WAV, MP3 hoặc OGG.');
}
/** The SQLite upload store is synchronous. Validate audio before calling it,
 * while leaving its existing shape, size and MIME errors authoritative. */
export async function validateUploadedAudio(input,maxBytes=2*1024*1024){
 const encoded=input?.base64;
 if(typeof encoded!=='string'||encoded.length>Math.ceil(maxBytes/3)*4||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return;
 const bytes=Buffer.from(encoded,'base64');
 const mime=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE'?'audio/wav':bytes.toString('ascii',0,4)==='OggS'?'audio/ogg':bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&0xe0)===0xe0?'audio/mpeg':undefined;
 if(mime)await audioDurationMs(bytes,mime,maxBytes);
}
