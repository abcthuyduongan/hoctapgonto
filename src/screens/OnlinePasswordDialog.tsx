import {useEffect,useRef,useState} from 'react';
import {onlineApi} from '../core/online-client';

export default function OnlinePasswordDialog({onClose,onChanged}:{onClose:()=>void;onChanged:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),operating=useRef(false),loginButton=useRef<HTMLButtonElement>(null);
  const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[changed,setChanged]=useState(false);
  useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};},[]);
  useEffect(()=>{if(changed)loginButton.current?.focus();},[changed]);
  async function submit(){
    if(operating.current||changed)return;setError('');
    if([currentPassword,newPassword].some(value=>value.length<10||value.length>128)){setError('Mật khẩu cần từ 10–128 ký tự, kể cả khoảng trắng.');return;}
    if(newPassword===currentPassword){setError('Mật khẩu mới cần khác mật khẩu hiện tại.');return;}
    if(newPassword!==confirmation){setError('Hai lần nhập mật khẩu mới chưa khớp.');return;}
    operating.current=true;setBusy(true);
    try{await onlineApi.changePassword({currentPassword,newPassword});setCurrentPassword('');setNewPassword('');setConfirmation('');setChanged(true);}
    catch(error){setError(error instanceof Error?error.message:'Chưa đổi được mật khẩu. Hãy thử lại.');}
    finally{operating.current=false;setBusy(false);}
  }
  return <dialog className="online-dialog online-password" ref={dialog} aria-labelledby="online-password-title" onCancel={event=>{event.preventDefault();if(!busy)(changed?onChanged:onClose)();}}>
    <div className="online-section-head" style={{marginBottom:20}}><h2 id="online-password-title">Đổi mật khẩu</h2>{!changed&&<button type="button" onClick={onClose} disabled={busy}>Đóng ✕</button>}</div>
    {changed?<div className="online-form"><p className="online-notice" role="status">Đã đổi mật khẩu thành công. Con hãy đăng nhập lại bằng mật khẩu mới. Tiến độ và sao đã được giữ nguyên.</p><button type="button" className="online-primary" ref={loginButton} onClick={onChanged}>Đăng nhập lại</button></div>:<form className="online-form" aria-busy={busy} onSubmit={event=>{event.preventDefault();void submit();}}>
      <p className="online-muted">Mật khẩu cần từ 10–128 ký tự. Sau khi đổi, các thiết bị sẽ cần đăng nhập lại.</p>
      {error&&<p className="online-notice online-error" role="alert">{error}</p>}
      <label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" required minLength={10} maxLength={128} value={currentPassword} disabled={busy} onChange={event=>setCurrentPassword(event.target.value)}/></label>
      <label>Mật khẩu mới<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={newPassword} disabled={busy} onChange={event=>setNewPassword(event.target.value)}/></label>
      <label>Nhập lại mật khẩu mới<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></label>
      <button type="submit" className="online-primary" disabled={busy}>{busy?'Đang đổi mật khẩu…':'Lưu mật khẩu mới'}</button>
    </form>}
  </dialog>;
}
