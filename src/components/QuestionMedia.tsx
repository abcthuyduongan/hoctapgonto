import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {QuestionMedia as Media} from '../core/contracts';
import {activateQuestionAudio,forgetQuestionAudio,releaseQuestionAudio} from '../core/question-audio';
import {stopSpeaking} from '../core/speech';

const assetUrl=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?`/api/online/media/${encodeURIComponent(id)}`:undefined;
const ImageRecovery=createContext<{retry:number;reportFailure:(id:string)=>void}|null>(null);
/** Keep recovery controls outside the answer buttons that contain card images. */
export function QuestionImageRecovery({children}:{children:ReactNode}){
  const [failed,setFailed]=useState<Set<string>>(()=>new Set()),[retry,setRetry]=useState(0);
  const reportFailure=useCallback((id:string)=>setFailed(previous=>previous.has(id)?previous:new Set([...previous,id])),[]);
  return <ImageRecovery.Provider value={{retry,reportFailure}}>{children}{failed.size>0&&<div className="question-image-recovery" role="status"><span>Một số hình chưa tải được. Con có thể tải lại hình.</span><button type="button" onClick={()=>{setFailed(new Set());setRetry(value=>value+1);}}>Tải lại hình</button></div>}</ImageRecovery.Provider>;
}
/** Uploaded, authenticated media only. Audio controls belong outside answer buttons. */
export default function QuestionMedia({media,imageOnly=false,audioOnly=false,showTranscript=false,onAudioEnded,onImageReady,audioContext}:{media?:Media;imageOnly?:boolean;audioOnly?:boolean;showTranscript?:boolean;onAudioEnded?:()=>void;onImageReady?:()=>void;audioContext?:{playId:string;itemId:string}}){
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0),recovery=useContext(ImageRecovery);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const imageRetry=imageOnly?recovery?.retry??0:retry;
  useEffect(()=>setFailed(false),[media?.imageId,media?.audioId,retry,imageRetry]);
  const image=media?.imageId&&!audioOnly?assetUrl(media.imageId):undefined,audio=media?.audioId&&!imageOnly?assetUrl(media.audioId):undefined;
  const audioQuery=new URLSearchParams({...audioContext,...(retry?{retry:String(retry)}:{})}).toString();
  const audioSource=audio?`${audio}${audioQuery?'?'+audioQuery:''}`:undefined;
  useEffect(()=>{
    const element=audioRef.current;if(!element||!audioSource)return;
    // StrictMode runs cleanup and setup twice; restore the source after cleanup.
    if(element.getAttribute('src')!==audioSource)element.setAttribute('src',audioSource);
    return()=>releaseQuestionAudio(element);
  },[audioSource]);
  if(!media)return null;
  if(!image&&!audio)return null;
  return <span className={`question-media ${imageOnly?'question-media-image-only':''}`}>
    {image&&(!imageOnly||!failed)&&<img key={`${media.imageId}-${imageRetry}`} src={`${image}${imageRetry?`?retry=${imageRetry}`:''}`} alt={media.imageAlt??''} loading={onImageReady?'eager':'lazy'} decoding="async" onLoad={()=>onImageReady?.()} onError={()=>{setFailed(true);if(imageOnly)recovery?.reportFailure(media.imageId!);}}/>}
    {audio&&<span className="question-audio"><audio ref={audioRef} key={`${media.audioId}-${retry}`} controls preload="none" src={audioSource} aria-label="Âm thanh của câu hỏi" onPlay={event=>{stopSpeaking();activateQuestionAudio(event.currentTarget);}} onPause={event=>forgetQuestionAudio(event.currentTarget)} onEnded={event=>{forgetQuestionAudio(event.currentTarget);onAudioEnded?.();}} onError={()=>setFailed(true)}/>{showTranscript&&media.audioTranscript&&<span className="question-transcript">{media.audioTranscript}</span>}</span>}
    {failed&&!imageOnly&&<span className="question-media-error" role="status">Chưa tải được hình hoặc âm thanh. <button type="button" onClick={()=>{setFailed(false);setRetry(value=>value+1);}}>Tải lại</button></span>}
    {failed&&imageOnly&&<span className="question-media-error">Hình chưa tải được.</span>}
  </span>;
}
