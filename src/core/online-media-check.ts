export const MAX_IMPORT_MEDIA_FILES=100;
export const MAX_IMPORT_MEDIA_BYTES=32*1024*1024;

/** Inspect metadata only, before any selected file is decoded or read. */
export function assertQuestionMediaSelectionBudget(files:readonly Pick<File,'size'>[]):void{
  let total=0;
  for(const file of files){
    if(!Number.isSafeInteger(file.size)||file.size<0)throw new Error('Kích thước tư liệu không hợp lệ. Hãy chọn lại tệp.');
    total+=file.size;
    if(total>MAX_IMPORT_MEDIA_BYTES)break;
  }
  if(files.length>MAX_IMPORT_MEDIA_FILES||total>MAX_IMPORT_MEDIA_BYTES)
    throw new Error('Chưa nhận lượt chọn này: tối đa 100 hình / âm thanh, tổng 32 MB mỗi lần. Hãy chia nhỏ bộ tư liệu rồi chọn lại; các tệp đã chọn trước đó vẫn được giữ.');
}

/** Decode authored media before uploading; MIME signatures alone do not prove it can be used. */
export async function validateQuestionMediaFile(file:File,signal?:AbortSignal):Promise<void>{
  signal?.throwIfAborted();
  if(!file.size)throw new Error(`Tệp “${file.name}” đang trống.`);
  const extension=file.name.split('.').at(-1)?.toLowerCase();
  if(['png','jpg','jpeg','webp'].includes(extension??'')){
    let bitmap:ImageBitmap;
    try{bitmap=await createImageBitmap(file);}catch{throw new Error(`Không giải mã được hình “${file.name}”. Hãy xuất lại thành PNG, JPEG hoặc WebP.`);}
    try{signal?.throwIfAborted();if(bitmap.width<1||bitmap.height<1||bitmap.width*bitmap.height>20_000_000||Math.max(bitmap.width,bitmap.height)>8192)throw new Error(`Hình “${file.name}” quá lớn. Giảm xuống tối đa 20 triệu điểm ảnh và 8192 điểm mỗi chiều.`);}finally{bitmap.close();}
    return;
  }
  if(!['mp3','wav','ogg'].includes(extension??''))throw new Error('Chọn hình PNG/JPEG/WebP hoặc âm thanh MP3/WAV/OGG.');
  const url=URL.createObjectURL(file),audio=new Audio();audio.preload='auto';
  try{await new Promise<void>((resolve,reject)=>{
    const timer=window.setTimeout(()=>finish(new Error(`Chưa đọc được âm thanh “${file.name}”. Hãy kiểm tra hoặc xuất lại tệp.`)),15000);
    let settled=false;
    const abort=()=>finish(new DOMException('Đã hủy kiểm tra tư liệu.','AbortError'));
    function finish(error?:Error){if(settled)return;settled=true;window.clearTimeout(timer);signal?.removeEventListener('abort',abort);audio.onloadeddata=null;audio.onerror=null;error?reject(error):resolve();}
    signal?.addEventListener('abort',abort,{once:true});
    audio.onloadeddata=()=>finish(!Number.isFinite(audio.duration)||audio.duration<=0||audio.duration>600?new Error(`Âm thanh “${file.name}” cần có thời lượng từ hơn 0 đến 600 giây. Hãy chia thành các đoạn ngắn.`):undefined);
    audio.onerror=()=>finish(new Error(`Không phát được âm thanh “${file.name}”. Hãy xuất lại MP3, WAV hoặc OGG.`));audio.src=url;audio.load();
  });}finally{audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);}
}

export const IMAGE_OPTIMIZE_MAX_SIDE=1024;
export const IMAGE_OPTIMIZE_MIN_BYTES=250*1024;
type ImageEncoder=(bitmap:ImageBitmap,width:number,height:number,type:string,quality:number)=>Promise<Blob|null>;
const canvasEncoder:ImageEncoder=async(bitmap,width,height,type,quality)=>{
  if(typeof OffscreenCanvas!=='undefined'){const canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d');if(!context)return null;context.drawImage(bitmap,0,0,width,height);return canvas.convertToBlob({type,quality});}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)return null;context.drawImage(bitmap,0,0,width,height);
  return new Promise(resolve=>canvas.toBlob(blob=>resolve(blob),type,quality));
};
/**
 * Shrink a large photo before it is uploaded so students do not download megabytes per question.
 * Small images (already ≤ 1024 px and ≤ 250 KB, such as files exported back out of the app) are kept byte for byte,
 * so re-importing them never changes their hash. Returns null when the original should be used.
 */
export async function optimizeQuestionImage(file:Blob&{name:string},{maxSide=IMAGE_OPTIMIZE_MAX_SIDE,minBytes=IMAGE_OPTIMIZE_MIN_BYTES,quality=0.82,decode=(blob:Blob)=>createImageBitmap(blob),encode=canvasEncoder}:{maxSide?:number;minBytes?:number;quality?:number;decode?:(blob:Blob)=>Promise<ImageBitmap>;encode?:ImageEncoder}={}):Promise<Blob|null>{
  if(!/\.(png|jpe?g|webp)$/i.test(file.name))return null;
  let bitmap:ImageBitmap;try{bitmap=await decode(file);}catch{return null;}
  try{
    const side=Math.max(bitmap.width,bitmap.height);if(side<1||side<=maxSide&&file.size<=minBytes)return null;
    const scale=Math.min(1,maxSide/side),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    // WebP keeps transparency; browsers that cannot encode it fall back to PNG, which we reject below.
    const encoded=await encode(bitmap,width,height,'image/webp',quality).catch(()=>null);
    if(!encoded||encoded.type!=='image/webp'||encoded.size<12||encoded.size>=file.size)return null;
    return encoded;
  }finally{bitmap.close?.();}
}
