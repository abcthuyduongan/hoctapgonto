import {useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import '../styles/question-layout.css';

type QuestionLayoutKind='quiz'|'pairs'|'sentences'|'memory-match'|'word-connect'|'sentence-builder'|'sequence-trail'|'numeric-answer'|'fill-blank'|'reading-choice'|'listening-choice'|'listening-gap';
type QuestionLayoutOptions={kind:QuestionLayoutKind;questionKey:string|number;textLength?:number;hasImage?:boolean;itemCount?:number};
type LayoutStyle=CSSProperties&Record<`--question-${string}`,string>;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Fit readable content to the game stage, including embedded and resized games.
 * Long content retains its natural height and scrolls instead of being clipped. */
export function useQuestionLayout({kind,questionKey,textLength=0,hasImage=false,itemCount=1}:QuestionLayoutOptions){
  const ref=useRef<HTMLElement|null>(null);
  const [size,setSize]=useState({width:0,height:0});
  useLayoutEffect(()=>{
    const stage=ref.current;if(!stage)return;
    const measure=()=>{const box=stage.getBoundingClientRect();const width=Math.round(box.width),height=Math.round(box.height);setSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});};
    measure();const observer=new ResizeObserver(measure);observer.observe(stage);return()=>observer.disconnect();
  },[]);
  useLayoutEffect(()=>{
    const stage=ref.current;if(!stage)return;
    stage.scrollTop=0;
    for(const scroll of stage.querySelectorAll<HTMLElement>('.quest-scroll,.online-reading p'))scroll.scrollTop=0;
  },[questionKey]);
  const layoutProps=useMemo(()=>{
    const width=size.width||640,height=size.height||600;
    const compact=height<650||width<700;
    const cardWidth=width>1000?width*.72:width-48;
    const promptSize=clamp(Math.min(width/28,height/24,textLength>160?24:32),20,32);
    const answerSize=clamp(Math.min(width/58,height/31),16,22);
    const cardSize=clamp(Math.min(width/65,height/36,textLength>95?17:20),14,20);
    const imageHeight=clamp(height*(width<600?.18:.23)-(textLength>120?25:0),84,180);
    const gap=clamp(height/70,6,12);
    const style:LayoutStyle={
      '--question-font-size':`${Math.round(promptSize)}px`,
      '--question-answer-font-size':`${Math.round(answerSize)}px`,
      '--question-card-font-size':`${Math.round(cardSize)}px`,
      '--question-image-height':`${Math.round(imageHeight)}px`,
      '--question-gap':`${Math.round(gap)}px`,
      '--question-stage-padding':`${Math.round(clamp(height/65,8,16))}px`,
      '--question-card-padding':`${Math.round(clamp(height/50,10,20))}px`,
      '--question-answer-height':`${Math.round(clamp(height/12,44,60))}px`,
      '--question-content-width':`${Math.round(clamp(cardWidth,240,960))}px`,
    };
    return {'data-question-layout':kind,'data-layout-density':compact?'compact':'comfortable','data-layout-image':hasImage?'true':'false','data-layout-items':itemCount,style};
  },[kind,size,textLength,hasImage,itemCount]);
  return {ref,layoutProps};
}
