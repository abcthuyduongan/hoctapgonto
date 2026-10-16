/** Decode authored media before uploading; MIME signatures alone do not prove it can be used. */
export async function validateQuestionMediaFile(file:File):Promise<void>{
  if(!file.size)throw new Error(`Tệp “${file.name}” đang trống.`);
  const extension=file.name.split('.').at(-1)?.toLowerCase();
  if(['png','jpg','jpeg','webp'].includes(extension??'')){
    let bitmap:ImageBitmap;
    try{bitmap=await createImageBitmap(file);}catch{throw new Error(`Không giải mã được hình “${file.name}”. Hãy xuất lại thành PNG, JPEG hoặc WebP.`);}
    try{if(bitmap.width<1||bitmap.height<1||bitmap.width*bitmap.height>20_000_000||Math.max(bitmap.width,bitmap.height)>8192)throw new Error(`Hình “${file.name}” quá lớn. Giảm xuống tối đa 20 triệu điểm ảnh và 8192 điểm mỗi chiều.`);}finally{bitmap.close();}
    return;
  }
  if(!['mp3','wav','ogg'].includes(extension??''))throw new Error('Chọn hình PNG/JPEG/WebP hoặc âm thanh MP3/WAV/OGG.');
  const url=URL.createObjectURL(file),audio=new Audio();audio.preload='auto';
  try{await new Promise<void>((resolve,reject)=>{
    const timer=window.setTimeout(()=>finish(new Error(`Chưa đọc được âm thanh “${file.name}”. Hãy kiểm tra hoặc xuất lại tệp.`)),15000);
    function finish(error?:Error){window.clearTimeout(timer);audio.onloadeddata=null;audio.onerror=null;error?reject(error):resolve();}
    audio.onloadeddata=()=>finish(!Number.isFinite(audio.duration)||audio.duration<=0||audio.duration>600?new Error(`Âm thanh “${file.name}” cần có thời lượng từ hơn 0 đến 600 giây. Hãy chia thành các đoạn ngắn.`):undefined);
    audio.onerror=()=>finish(new Error(`Không phát được âm thanh “${file.name}”. Hãy xuất lại MP3, WAV hoặc OGG.`));audio.src=url;audio.load();
  });}finally{audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);}
}
