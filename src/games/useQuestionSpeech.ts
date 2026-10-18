import {useEffect,useState} from 'react';
import {speakText,stopSpeaking} from '../core/speech';
export function useQuestionSpeech(subject:string,key:string){
  const [notice,setNotice]=useState('');
  useEffect(()=>{setNotice('');return stopSpeaking;},[key]);
  function read(text:string){setNotice('');speakText(text,{lang:subject==='english'?'en-US':'vi-VN',onError:error=>setNotice(error instanceof Error?error.message:'Chưa đọc được câu. Con thử lại nhé.')});}
  return{read,notice};
}
