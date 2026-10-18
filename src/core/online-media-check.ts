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
