import {useEffect,useRef,useState} from 'react';
import {onlineApi} from '../core/online-client';
import type {OnlineRecoveryCapability,OnlineRestorePreview} from '../core/online-contracts';

const countNames:Record<string,string>={classes:'Lớp học',students:'Học sinh',weeks:'Tuần học',packs:'Phiên bản bộ câu',questions:'Câu hỏi',plays:'Lượt chơi',attempts:'Lượt trả lời',awards:'Thành tích bộ',redemptions:'Yêu cầu đổi sao',media:'Tệp hình/âm thanh'};
function message(error:unknown){return error instanceof Error?error.message:'Chưa thực hiện được thao tác.';}
export default function OnlineRecoveryPanel({onRestored}:{onRestored:()=>void}){
  const [capability,setCapability]=useState<OnlineRecoveryCapability|null>(null),[preview,setPreview]=useState<OnlineRestorePreview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmed,setConfirmed]=useState(false);const operating=useRef(false);
  useEffect(()=>{void onlineApi.recovery().then(setCapability).catch(error=>setError(message(error)));},[]);
  async function run(action:()=>Promise<void>){if(operating.current)return;operating.current=true;setBusy(true);setError('');setNotice('');try{await action();}catch(error){setError(message(error));}finally{operating.current=false;setBusy(false);}}
  return <section className="online-card" aria-label="Sao lưu và khôi phục dữ liệu"><h2>Sao lưu & khôi phục</h2>
    <p>Bản sao lưu chứa tài khoản, lớp, câu hỏi, tư liệu, tiến độ và sổ sao. Cất tệp ở nơi riêng; chỉ quản trị viên được sử dụng.</p>
    {error&&<p className="online-notice online-error" role="alert">{error}</p>}{notice&&<p className="online-notice" role="status">{notice}</p>}
    {!capability?<p>Đang kiểm tra khả năng sao lưu…</p>:!capability.supported?<p>{capability.reason??'Môi trường này dùng công cụ sao lưu và phục hồi PostgreSQL/Storage của máy chủ. Xem hướng dẫn triển khai.'}</p>:<>
      <button className="online-primary" disabled={busy} onClick={()=>void run(async()=>{const blob=await onlineApi.backup(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`bao-an-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Đã tải bản sao lưu nhất quán. Hãy giữ tệp ở nơi riêng.');})}>Tải bản sao lưu</button>
      <hr/><h3>Khôi phục từ bản sao lưu</h3><p>Chọn tệp để kiểm tra trước. Chỉ bước xác nhận bên dưới mới thay dữ liệu hiện tại. Máy chủ tạo bản dự phòng trước khi khôi phục.</p>
      <label>Chọn tệp sao lưu SQLite<input type="file" accept=".sqlite,.db" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';setPreview(null);setConfirmed(false);if(file)void run(async()=>{if(file.size>(capability.maxUploadBytes??33554432))throw new Error('Bản sao lưu vượt giới hạn tải qua giao diện. Dùng công cụ khôi phục trên máy chủ theo hướng dẫn.');const bytes=new Uint8Array(await file.arrayBuffer()),parts:string[]=[];for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));setPreview(await onlineApi.restorePreview(btoa(parts.join(''))));setNotice('Đã kiểm tra tệp. Dữ liệu hiện tại chưa thay đổi.');});}}/></label>
      {preview&&<section className="online-recovery-preview" aria-label="Xem trước dữ liệu khôi phục"><h3>Bản sao sẽ khôi phục</h3><p>{preview.workspaceNames.join(', ')} · {(preview.bytes/1024/1024).toFixed(2)} MB</p><dl>{Object.entries(preview.counts).map(([name,count])=><div style={{display:'contents'}} key={name}><dt>{countNames[name]??name}</dt><dd>{count}</dd></div>)}</dl><p>Mã kiểm tra: <code>{preview.sha256}</code></p><p>Các phiên đăng nhập sẽ hết hiệu lực. Lượt chơi đang dở sẽ kết thúc; hãy cho học sinh thoát bài trước khi xác nhận.</p>
        <label className="online-recovery-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/>Tôi đã kiểm tra đúng bản sao và đồng ý thay dữ liệu hiện tại bằng dữ liệu trên.</label>
        <button className="online-primary" disabled={busy||!confirmed} onClick={()=>void run(async()=>{await onlineApi.restoreCommit({restoreToken:preview.restoreToken,sha256:preview.sha256,confirm:true});onRestored();})}>Xác nhận khôi phục dữ liệu</button>
      </section>}
    </>}
  </section>;
}
