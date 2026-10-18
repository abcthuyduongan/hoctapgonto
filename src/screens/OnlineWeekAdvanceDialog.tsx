import {useEffect,useRef,useState} from 'react';
import type {OnlineStudentSummary} from '../core/online-contracts';

export default function OnlineWeekAdvanceDialog({week,onClose,onConfirm}:{week:NonNullable<OnlineStudentSummary['currentWeekSummary']>;onClose:()=>void;onConfirm:()=>Promise<void>}){
  const dialog=useRef<HTMLDialogElement>(null),working=useRef(false);const[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};},[]);
  async function confirm(){if(working.current)return;working.current=true;setBusy(true);setError('');try{await onConfirm();}catch(error){setError(error instanceof Error?error.message:'Chưa chuyển được tuần. Hãy thử lại.');}finally{working.current=false;setBusy(false);}}
  return <dialog className="online-dialog online-week-confirm" ref={dialog} aria-labelledby="week-advance-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <h2 id="week-advance-title">Sang {week.nextWeekTitle??'tuần tiếp theo'}?</h2>
    <p>{week.title} có {week.total} câu đã đạt yêu cầu: <strong>{week.two} câu 2 sao</strong> và {week.three} câu 3 sao.</p>
    <p>Sau khi sang tuần mới, <strong>{week.title} sẽ khóa</strong>. Con không thể quay lại tuần này để học hoặc kiếm thêm sao.</p>
    {week.two>0&&<p>Con có thể ở lại ôn {week.two} câu 2 sao để nâng lên 3 sao trước khi chuyển.</p>}
    {error&&<p role="alert" className="online-notice online-error">{error}</p>}
    <div className="online-actions"><button type="button" disabled={busy} onClick={onClose}>Ở lại ôn thêm</button><button type="button" className="online-primary" disabled={busy||!week.hasNext} onClick={()=>void confirm()}>{busy?'Đang chuyển tuần…':'Xác nhận sang tuần mới'}</button></div>
  </dialog>;
}
