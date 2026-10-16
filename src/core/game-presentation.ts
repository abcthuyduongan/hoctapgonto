import type { ContentPack, ModuleId, PairsPack, QuizPack } from './contracts.ts';

const nativeKinds: Record<ModuleId, ContentPack['kind']> = {
  'math-quest':'quiz', 'memory-match':'pairs', 'word-connect':'pairs',
  'sentence-builder':'sentences', 'sequence-trail':'sentences'
};
const normalize = (text:string) => text.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');

/** Deterministic view of an immutable source pack. IDs and item objectives never change.
 * Version 1 only converts explicit question/answer pairs; it never invents word order,
 * missing answers, audio or reading context. Persist the source, never this view. */
export function gamePresentation(moduleId:ModuleId, source:ContentPack):ContentPack|undefined {
  const kind=nativeKinds[moduleId];
  if (!kind) return;
  if (source.kind===kind) return source;
  if (source.kind==='pairs' && kind==='quiz' && source.items.length>=4) {
    const answers=source.items.map(item=>normalize(item.right));
    if (new Set(answers).size!==answers.length) return;
    const pack:QuizPack={...source,kind:'quiz',items:source.items.map((item,index)=>({
      kind:'multiple-choice',id:item.id,objectiveId:item.objectiveId,...(item.metadata?{metadata:item.metadata}:{}),...(item.media?{media:item.media}:{}),
      prompt:`${source.title}: ${item.left} → ?`,
      options:Array.from({length:4},(_,offset)=>source.items[(index+(offset-index%4+4)%4)%source.items.length].right) as [string,string,string,string],
      correctIndex:(index%4) as 0|1|2|3,explanation:`${item.left} → ${item.right}`
    }))};
    if(pack.items.some(item=>item.prompt.length>320))return;
    return pack;
  }
  if (source.kind==='quiz' && kind==='pairs') {
    const items=source.items.map(item=>({kind:'pair' as const,id:item.id,objectiveId:item.objectiveId,
      ...(item.metadata?{metadata:item.metadata}:{}),...(item.media?{media:item.media}:{}),left:item.prompt,right:item.options[item.correctIndex]}));
    const faces=items.flatMap(item=>[item.left,item.right]);
    // Repeated answers make matching ambiguous, even if the question IDs differ.
    if(faces.some(face=>face.length>120)||new Set(faces.map(normalize)).size!==faces.length)return;
    const pack:PairsPack={...source,kind:'pairs',items};return pack;
  }
}

export const canPresentGame=(moduleId:ModuleId,source:ContentPack)=>!!gamePresentation(moduleId,source);
export function sessionGamePack(session:{moduleId:ModuleId;presentationVersion?:1},source:ContentPack):ContentPack|undefined {
  return session.presentationVersion===1?gamePresentation(session.moduleId,source)
    :nativeKinds[session.moduleId]===source.kind?source:undefined;
}
