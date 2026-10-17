import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import type {QuestionMedia as Media} from '../core/contracts';

const assetUrl=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?`/api/online/media/${encodeURIComponent(id)}`:undefined;
const ImageRecovery=createContext<{retry:number;reportFailure:(id:string)=>void}|null>(null);
/** Keep recovery controls outside the answer buttons that contain card images. */
export function QuestionImageRecovery({children}:{children:ReactNode}){
  const [failed,setFailed]=useState<Set<string>>(()=>new Set()),[retry,setRetry]=useState(0);
  const reportFailure=useCallback((id:string)=>setFailed(previous=>previous.has(id)?previous:new Set([...previous,id])),[]);
  return <ImageRecovery.Provider value={{retry,reportFailure}}>{children}{failed.size>0&&<div className="question-image-recovery" role="status"><span>Một số hình chưa tải được. Con có thể tải lại hình.</span><button type="button" onClick={()=>{setFailed(new Set());setRetry(value=>value+1);}}>Tải lại hình</button></div>}</ImageRecovery.Provider>;
}
/** Uploaded, authenticated media only. Audio controls belong outside answer buttons. */
export default function QuestionMedia({media,imageOnly=false,audioOnly=false,showTranscript=false,onAudioEnded}:{media?:Media;imageOnly?:boolean;audioOnly?:boolean;showTranscript?:boolean;onAudioEnded?:()=>void}){
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0),recovery=useContext(ImageRecovery);
  const imageRetry=imageOnly?recovery?.retry??0:retry;
  useEffect(()=>setFailed(false),[media?.imageId,media?.audioId,retry,imageRetry]);
  if(!media)return null;
  const image=media.imageId&&!audioOnly?assetUrl(media.imageId):undefined,audio=media.audioId&&!imageOnly?assetUrl(media.audioId):undefined;
  if(!image&&!audio)return null;
  return <span className={`question-media ${imageOnly?'question-media-image-only':''}`}>
    {image&&(!imageOnly||!failed)&&<img key={`${media.imageId}-${imageRetry}`} src={`${image}${imageRetry?`?retry=${imageRetry}`:''}`} alt={media.imageAlt??''} loading="lazy" decoding="async" onError={()=>{setFailed(true);if(imageOnly)recovery?.reportFailure(media.imageId!);}}/>}
    {audio&&<span className="question-audio"><audio key={`${media.audioId}-${retry}`} controls preload="none" src={`${audio}${retry?`?retry=${retry}`:''}`} aria-label="Âm thanh của câu hỏi" onEnded={onAudioEnded} onError={()=>setFailed(true)}/>{showTranscript&&media.audioTranscript&&<span className="question-transcript">{media.audioTranscript}</span>}</span>}
    {failed&&!imageOnly&&<span className="question-media-error" role="status">Chưa tải được hình hoặc âm thanh. <button type="button" onClick={()=>{setFailed(false);setRetry(value=>value+1);}}>Tải lại</button></span>}
    {failed&&imageOnly&&<span className="question-media-error">Hình chưa tải được.</span>}
  </span>;
}
