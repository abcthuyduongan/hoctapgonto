import {onlineApi} from './online-client';
import {questionExportWorkbook,zipSync,type ExportMedia,type QuestionExport} from './question-export';

const XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function save(fileName:string,bytes:Uint8Array,type:string){
  const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type})),link=document.createElement('a');
  link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
const safe=(value:string)=>value.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/\s+/g,' ').trim().slice(0,60)||'tep';
async function mediaBytes(asset:ExportMedia,signal?:AbortSignal):Promise<Uint8Array>{
  const response=await fetch(`/api/online/media/${encodeURIComponent(asset.id)}`,{credentials:'include',signal});
  if(!response.ok)throw new Error(`Chưa tải được tệp “${asset.name}” (${response.status}).`);return new Uint8Array(await response.arrayBuffer());
}
/** One week: an Excel file, or a ZIP with the Excel file plus every image and audio file it names. */
export async function downloadWeekExport(weekId:string,{withMedia=false,signal,onProgress}:{withMedia?:boolean;signal?:AbortSignal;onProgress?:(text:string)=>void}={}):Promise<string>{
  onProgress?.('Đang lấy câu hỏi và thống kê…');const data=await onlineApi.adminExport(weekId,signal),book=questionExportWorkbook(data);
  if(!withMedia||!data.media.length){save(book.fileName,book.bytes,XLSX);return `Đã xuất ${book.questions} câu hỏi kèm đáp án và thống kê ra “${book.fileName}”.`;}
  const files:Record<string,Uint8Array>={[book.fileName]:book.bytes};await addMedia(files,data.media,signal,onProgress);
  const zipName=book.fileName.replace(/\.xlsx$/,'.zip');save(zipName,zipSync(files,{level:0}),'application/zip');
  return `Đã xuất ${book.questions} câu hỏi và ${data.media.length} tệp hình/âm thanh ra “${zipName}”. Giải nén rồi chọn file Excel cùng các tệp trong thư mục Tep_da_phuong_tien để nhập lại.`;
}
/** Every week of a class in one ZIP: one importable workbook per week and one shared media folder. */
export async function downloadClassExport(className:string,weekIds:string[],{withMedia=false,signal,onProgress}:{withMedia?:boolean;signal?:AbortSignal;onProgress?:(text:string)=>void}={}):Promise<string>{
  const files:Record<string,Uint8Array>={},media=new Map<string,ExportMedia>();let questions=0;
  for(const [index,weekId] of weekIds.entries()){signal?.throwIfAborted();onProgress?.(`Đang xuất tuần ${index+1}/${weekIds.length}…`);
    const data:QuestionExport=await onlineApi.adminExport(weekId,signal),book=questionExportWorkbook(data);questions+=book.questions;
    files[`${String(index+1).padStart(2,'0')} - ${book.fileName}`]=book.bytes;data.media.forEach(asset=>media.set(asset.id,asset));}
  if(withMedia)await addMedia(files,[...media.values()],signal,onProgress);
  const zipName=`${safe(className)} - tat ca tuan - cau hoi va dap an.zip`;save(zipName,zipSync(files,{level:withMedia?0:6}),'application/zip');
  return `Đã xuất ${weekIds.length} tuần, ${questions} câu hỏi${withMedia?` và ${media.size} tệp hình/âm thanh`:''} ra “${zipName}”. Mỗi tuần là một file Excel nhập lại được.`;
}
async function addMedia(files:Record<string,Uint8Array>,assets:ExportMedia[],signal?:AbortSignal,onProgress?:(text:string)=>void){
  const used=new Set<string>();let done=0,total=0;
  for(const asset of assets){signal?.throwIfAborted();onProgress?.(`Đang tải tư liệu ${++done}/${assets.length}…`);
    total+=asset.size;if(total>200*1024*1024)throw new Error('Tổng hình và âm thanh vượt 200 MB. Hãy xuất từng tuần.');
    // Two library files may share a name; keep both and make the second one distinct.
    let name=asset.name;if(used.has(name.toLocaleLowerCase('vi')))name=`${asset.id.slice(0,8)}-${asset.name}`;used.add(name.toLocaleLowerCase('vi'));
    files[`Tep_da_phuong_tien/${name}`]=await mediaBytes(asset,signal);}
}
