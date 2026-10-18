import {useEffect,useRef,useState} from 'react';
import type {GameHostProps} from '../core/contracts';

type ClockReceipt=Awaited<ReturnType<NonNullable<GameHostProps['onQuestionOpen']>>>;
type OpenQuestion=GameHostProps['onQuestionOpen'];
type ClockState={key:string;receipt:ClockReceipt;receivedAt:number;elapsedAtReceipt:number};

/** This clock is a display estimate; only the server decides the earned stars. */
export function useQuestionClock({enabled,itemId,canOpen=true,finished=false,onQuestionOpen,requireItem=false}:{enabled:boolean;itemId:string;canOpen?:boolean;finished?:boolean;onQuestionOpen:OpenQuestion;requireItem?:boolean}){
  const opener=useRef(onQuestionOpen);
  opener.current=onQuestionOpen;
  const [clock,setClock]=useState<ClockState|null>(null),[failure,setFailure]=useState<{key:string;message:string}|null>(null),[retryKey,setRetryKey]=useState(0),[tick,setTick]=useState(0);
  useEffect(()=>{
    if(!enabled||!canOpen)return;
    let cancelled=false;
    setFailure(null);
    void (async()=>{
      try{
        if(!opener.current)throw new Error('Chưa kết nối được đồng hồ câu hỏi.');
        const receipt=await opener.current(itemId);
        if(requireItem&&receipt.item?.id!==itemId)throw new Error('Máy chủ chưa mở được nội dung câu hỏi của bản mới. Hãy tải lại trang.');
        const elapsedAtReceipt=Math.max(0,Date.parse(receipt.serverNow)-Date.parse(receipt.openedAt));
        if(!Number.isFinite(elapsedAtReceipt)||!Number.isFinite(receipt.threeStarMs)||!Number.isFinite(receipt.twoStarMs)||receipt.threeStarMs<=0||receipt.twoStarMs<receipt.threeStarMs)throw new Error('Chưa nhận được đồng hồ câu hỏi hợp lệ.');
        if(!cancelled)setClock({key:itemId,receipt,receivedAt:performance.now(),elapsedAtReceipt});
      }catch(error){if(!cancelled)setFailure({key:itemId,message:error instanceof Error?error.message:'Chưa mở được đồng hồ câu hỏi.'});}
    })();
    return()=>{cancelled=true;};
  },[enabled,itemId,canOpen,retryKey,requireItem]);
  const current=clock?.key===itemId?clock:null;
  useEffect(()=>{
    if(!enabled||!current||finished)return;
    const interval=window.setInterval(()=>setTick(value=>value+1),1000);
    return()=>window.clearInterval(interval);
  },[enabled,current,finished]);
  // Reading tick makes the display refresh without using the client's value for scoring.
  void tick;
  return {
    ready:!enabled||!!current,
    item:current?.receipt.item,
    passage:current?.receipt.passage,
    elapsedMs:current?Math.max(0,current.elapsedAtReceipt+performance.now()-current.receivedAt):0,
    threeStarMs:current?.receipt.threeStarMs??0,
    twoStarMs:current?.receipt.twoStarMs??0,
    error:failure?.key===itemId?failure.message:'',
    retry:()=>setRetryKey(value=>value+1),
  };
}

export function questionClockText(clock:{elapsedMs:number;threeStarMs:number;twoStarMs:number}){
  return `Đã dùng khoảng ${Math.floor(clock.elapsedMs/1000)} giây · 3 sao: trong ${Math.round(clock.threeStarMs/1000)} giây · 2 sao: trong ${Math.round(clock.twoStarMs/1000)} giây. Đáp án đúng mới được sao.`;
}
