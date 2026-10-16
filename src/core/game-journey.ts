import type { ContentPack } from './contracts.ts';
import type { GameAssignment,GameJourney,LearningSubject } from './learning-contracts.ts';
import { canPresentGame } from './game-presentation.ts';

export const JOURNEY_SUBJECTS:LearningSubject[]=['math','vietnamese','english'];
export const JOURNEY_SUBJECT_NAMES:Record<LearningSubject,string>={math:'Toán',vietnamese:'Tiếng Việt',english:'Tiếng Anh'};
const key=(ref:GameAssignment)=>`${ref.packId}@${ref.contentVersion}`;
const object=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
  &&[Object.prototype,null].includes(Object.getPrototypeOf(value))
  &&Reflect.ownKeys(value).every(k=>typeof k==='string'&&keys.includes(k)&&'value'in Object.getOwnPropertyDescriptor(value,k)!);
export function validateGameJourney(input:unknown):string[]{
  if(!object(input,['schemaVersion','enabled','stages','selectedPack'])||input.schemaVersion!==1||typeof input.enabled!=='boolean'
    ||!Array.isArray(input.stages)||input.stages.length<1||input.stages.length>42)return ['Lộ trình game cần từ 1–42 chặng và đúng định dạng.'];
  const errors:string[]=[],ids=new Set<string>(),packs=new Set<string>();let advanced=false,basic=0;
  const ref=(value:unknown):value is GameAssignment=>object(value,['packId','contentVersion'])&&typeof value.packId==='string'
    &&/^[a-z0-9-]{3,80}$/.test(value.packId)&&Number.isSafeInteger(value.contentVersion)&&Number(value.contentVersion)>0;
  const subjectPacks=(value:unknown):value is Record<LearningSubject,GameAssignment>=>object(value,JOURNEY_SUBJECTS)&&JOURNEY_SUBJECTS.every(subject=>ref(value[subject]));
  for(const stage of input.stages){
    if(!object(stage,['id','title','level','packs'])||typeof stage.id!=='string'||!/^[a-z0-9-]{3,80}$/.test(stage.id)||ids.has(stage.id)
      ||typeof stage.title!=='string'||!stage.title.trim()||stage.title.length>80||stage.level!=='basic'&&stage.level!=='advanced'
      ||!subjectPacks(stage.packs)){errors.push('Mỗi chặng cần mã riêng, tên và đủ bộ Toán, Tiếng Việt, Tiếng Anh.');continue;}
    ids.add(stage.id);
    if(stage.level==='basic'){basic++;if(advanced)errors.push('Các tuần cơ bản phải đứng trước phần nâng cao.');}else advanced=true;
    for(const assignment of Object.values(stage.packs) as GameAssignment[]){
      // A revision of the same pack must not count as a fresh week or new reward.
      if(packs.has(assignment.packId))errors.push('Mỗi bộ câu hỏi gốc chỉ được dùng ở một chặng của lộ trình.');
      packs.add(assignment.packId);
    }
  }
  if(!basic)errors.push('Lộ trình cần ít nhất một tuần cơ bản.');
  if(input.selectedPack!==undefined&&(!ref(input.selectedPack)||!input.stages.some(stage=>object(stage,['id','title','level','packs'])&&object(stage.packs,JOURNEY_SUBJECTS)
    &&Object.values(stage.packs).some(value=>ref(value)&&key(value)===key(input.selectedPack as GameAssignment)))))errors.push('Bộ ôn được chọn phải thuộc đúng phiên bản trong lộ trình.');
  return errors;
}
export function journeyPackChoices(packs:ContentPack[],subject:LearningSubject,grade:number){
  return packs.filter(pack=>pack.subject===subject&&pack.grade===grade&&['math-quest','memory-match','sentence-builder','word-connect','sequence-trail'].some(id=>canPresentGame(id as import('./contracts.ts').ModuleId,pack)));
}
export function journeyProgress(journey:GameJourney,rewards:{packId:string;starTier:number}[],packs:ContentPack[]){
  const best=new Map<string,number>();for(const row of rewards)best.set(row.packId,Math.max(best.get(row.packId)??0,row.starTier));
  let previousDone=true;
  const stages=journey.stages.map(stage=>{
    const entries=JOURNEY_SUBJECTS.map(subject=>{
      const assignment=stage.packs[subject],pack=packs.find(pack=>pack.id===assignment.packId&&pack.version===assignment.contentVersion);
      const stars=best.get(assignment.packId)??0;
      return {subject,assignment,pack,stars,done:stars>=2};
    });
    const unlocked=previousDone,done=entries.every(entry=>entry.done);
    previousDone=previousDone&&done;
    return {...stage,entries,unlocked,done};
  });
  const available=stages.filter(stage=>stage.unlocked).flatMap(stage=>stage.entries.map(entry=>({...entry,stageId:stage.id,stageTitle:stage.title})));
  const selected=journey.selectedPack&&available.find(entry=>key(entry.assignment)===key(journey.selectedPack!));
  return {stages,current:selected??available.find(entry=>!entry.done),complete:stages.every(stage=>stage.done)};
}

export function sampleGameJourney():GameJourney{
  const refs=(math:string,vietnamese:string,english:string)=>Object.fromEntries(JOURNEY_SUBJECTS.map((subject,i)=>[subject,{packId:[math,vietnamese,english][i],contentVersion:1}])) as Record<LearningSubject,GameAssignment>;
  return {schemaVersion:1,enabled:true,stages:[
    {id:'week-01',title:'Tuần 1 · Khởi động',level:'basic',packs:refs('math3-equations','vietnamese3-vocab','english3-family')},
    {id:'week-02',title:'Tuần 2 · Vững cơ bản',level:'basic',packs:refs('logic3-sequence','journey3-vietnamese-sentences','english3-sentences')},
    {id:'advanced-01',title:'Nâng cao · Thử thách mới',level:'advanced',packs:refs('journey3-math-advanced','journey3-vietnamese-advanced','journey3-english-advanced')}
  ]};
}
