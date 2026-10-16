import {useState} from 'react';
import type {QuestionMedia as Media} from '../core/contracts';

const assetUrl=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?`/api/online/media/${encodeURIComponent(id)}`:undefined;
/** Uploaded, authenticated media only. Audio controls belong outside answer buttons. */
export default function QuestionMedia({media,imageOnly=false,audioOnly=false,showTranscript=false,onAudioEnded}:{media?:Media;imageOnly?:boolean;audioOnly?:boolean;showTranscript?:boolean;onAudioEnded?:()=>void}){
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  if(!media)return null;
  const image=media.imageId&&!audioOnly?assetUrl(media.imageId):undefined,audio=media.audioId&&!imageOnly?assetUrl(media.audioId):undefined;
  if(!image&&!audio)return null;
  return <span className={`question-media ${imageOnly?'question-media-image-only':''}`}>
    {image&&<img src={`${image}${retry?`?retry=${retry}`:''}`} alt={media.imageAlt??''} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>}
    {audio&&<span className="question-audio"><audio key={`${media.audioId}-${retry}`} controls preload="none" src={`${audio}${retry?`?retry=${retry}`:''}`} aria-label="Âm thanh của câu hỏi" onEnded={onAudioEnded} onError={()=>setFailed(true)}/>{showTranscript&&media.audioTranscript&&<span className="question-transcript">{media.audioTranscript}</span>}</span>}
    {failed&&!imageOnly&&<span className="question-media-error" role="status">Chưa tải được hình hoặc âm thanh. <button type="button" onClick={()=>{setFailed(false);setRetry(value=>value+1);}}>Tải lại</button></span>}
  </span>;
}
