import {stopQuestionAudio} from './question-audio.ts';
export type SpeechLanguage='vi-VN'|'en-US';
export interface SpeechOptions{lang?:SpeechLanguage;rate?:number;pitch?:number;onStart?:()=>void;onEnd?:()=>void;onError?:(error:unknown)=>void}
let generation=0,clearPending:(()=>void)|undefined;
export function isSpeechSupported():boolean{return typeof window!=='undefined'&&'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;}
export function speechLanguageForText(text:string,preferred:SpeechLanguage='vi-VN'):SpeechLanguage{
  return /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/iu.test(text.normalize('NFC'))?'vi-VN':preferred;
}
export function selectSpeechVoice(voices:readonly SpeechSynthesisVoice[],lang:SpeechLanguage):SpeechSynthesisVoice|undefined{
  const normalized=(value:string)=>value.toLowerCase().replaceAll('_','-'),target=normalized(lang),language=target.split('-')[0];
  return voices.find(voice=>normalized(voice.lang)===target&&voice.localService)??voices.find(voice=>normalized(voice.lang)===target)??voices.find(voice=>normalized(voice.lang).split('-')[0]===language);
}
export function stopSpeaking():void{++generation;clearPending?.();clearPending=undefined;if(isSpeechSupported())try{window.speechSynthesis.cancel();}catch{/* Browser shutdown. */}}
/** Never delegate a missing Vietnamese voice to the browser's foreign default. */
export function speakText(text:string,options:SpeechOptions={}):boolean{
  if(!text?.trim())return false;
  if(!isSpeechSupported()){options.onError?.(new Error('Trình duyệt chưa hỗ trợ đọc câu. Con có thể đọc chữ hoặc nghe tệp âm thanh của câu hỏi.'));return false;}
  stopSpeaking();stopQuestionAudio();const own=generation,synth=window.speechSynthesis,lang=speechLanguageForText(text,options.lang),fail=()=>options.onError?.(new Error(lang==='vi-VN'?'Thiết bị chưa có giọng đọc tiếng Việt. Hãy thêm giọng tiếng Việt trong cài đặt giọng nói của thiết bị hoặc nghe tệp âm thanh của câu hỏi.':'Thiết bị chưa có giọng đọc tiếng Anh. Con có thể nghe tệp âm thanh của câu hỏi.'));
  const speak=(voice:SpeechSynthesisVoice)=>{if(own!==generation)return;try{const utterance=new window.SpeechSynthesisUtterance(text.trim());utterance.lang=lang;utterance.voice=voice;utterance.rate=options.rate??0.85;utterance.pitch=options.pitch??1;
    utterance.onstart=()=>{if(own===generation)options.onStart?.();};utterance.onend=()=>{if(own===generation)options.onEnd?.();};utterance.onerror=()=>{if(own===generation)options.onError?.(new Error('Chưa đọc được câu. Con thử lại hoặc dùng tệp âm thanh của câu hỏi.'));};synth.speak(utterance);
  }catch(error){if(own===generation)options.onError?.(error);}};
  try{const voice=selectSpeechVoice(synth.getVoices(),lang);if(voice){speak(voice);return true;}
    let timer:ReturnType<typeof setTimeout>;const cleanup=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',changed);if(clearPending===cleanup)clearPending=undefined;};
    const changed=()=>{if(own!==generation){cleanup();return;}const voice=selectSpeechVoice(synth.getVoices(),lang);if(voice){cleanup();speak(voice);}};
    clearPending=cleanup;synth.addEventListener('voiceschanged',changed);timer=setTimeout(()=>{cleanup();if(own===generation)fail();},1500);return true;
  }catch(error){options.onError?.(error);return false;}
}
