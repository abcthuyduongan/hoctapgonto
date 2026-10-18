import type {ContentPack} from './contracts.ts';
import {normalizedNumber,normalizedWord} from './rich-content.ts';

export const onlineIdentityText=(value:string)=>value.normalize('NFC').trim().replace(/\s+/g,' ');
export function onlineCanonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(onlineCanonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,entry])=>entry!==undefined).sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,entry])=>JSON.stringify(key)+':'+onlineCanonical(entry)).join(',')+'}';
  return JSON.stringify(typeof value==='string'?value.normalize('NFC'):value)??'null';
}
/** Portable synchronous SHA-256, so browser imports and both stores use the same IDs. */
export function onlineIdentityHash(value:string):string {
  const bytes=new TextEncoder().encode(value),length=Math.ceil((bytes.length+9)/64)*64,padded=new Uint8Array(length);padded.set(bytes);padded[bytes.length]=128;
  const data=new DataView(padded.buffer);data.setUint32(length-8,Math.floor(bytes.length/0x20000000));data.setUint32(length-4,(bytes.length*8)>>>0);
  const state=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const constants=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotate=(word:number,bits:number)=>(word>>>bits)|(word<<(32-bits)),words=new Uint32Array(64);
  for(let offset=0;offset<length;offset+=64){
    for(let i=0;i<16;i++)words[i]=data.getUint32(offset+i*4);
    for(let i=16;i<64;i++){const x=words[i-15],y=words[i-2];words[i]=(words[i-16]+(rotate(x,7)^rotate(x,18)^(x>>>3))+words[i-7]+(rotate(y,17)^rotate(y,19)^(y>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,h]=state;
    for(let i=0;i<64;i++){const first=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[i]+words[i])>>>0;
      const second=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g;g=f;f=e;e=(d+first)>>>0;d=c;c=b;b=a;a=(first+second)>>>0;}
    [a,b,c,d,e,f,g,h].forEach((word,index)=>{state[index]=(state[index]+word)>>>0;});
  }
  return state.map(word=>word.toString(16).padStart(8,'0')).join('');
}
export function onlineGeneratedItemId(item:unknown):string {
  const {id,...content}=item as Record<string,unknown>;void id;
  // A teaching policy changes the source version, not the question identity.
  if(content.metadata&&typeof content.metadata==='object'&&!Array.isArray(content.metadata)){
    const {allowedGameIds,...metadata}=content.metadata as Record<string,unknown>;void allowedGameIds;content.metadata=metadata;
  }
  return 'online-'+onlineIdentityHash(onlineCanonical(content)).slice(0,32);
}
export function onlineSourceCode(title:string,explicit?:string):string {
  if(explicit!==undefined){if(!/^[a-z0-9][a-z0-9-]{2,47}$/.test(explicit))throw new Error('sourceId: mã nguồn cần 3–48 chữ thường, số hoặc dấu gạch nối.');return explicit;}
  return 'week-'+onlineIdentityHash(onlineIdentityText(title)).slice(0,24);
}
export function onlineGeneratedPackId(sourceCode:string,subjectLabel:string,kind:string):string {
  return `online-${sourceCode}-${onlineIdentityHash(onlineCanonical([onlineIdentityText(subjectLabel),kind])).slice(0,24)}`;
}
export const onlinePackQuestionKind=(pack:ContentPack):string=>pack.kind==='learning'?[...new Set(pack.items.map(item=>item.kind))].sort().join('+'):pack.kind;
export function onlineDocumentSourceId(pack:Pick<ContentPack,'id'>):string|undefined {return /^online-([a-z0-9-]{3,48})-[a-f0-9]{24}$/.exec(pack.id)?.[1];}
type MediaHashes=Record<string,string>;
function replayContent(pack:ContentPack,hashes:MediaHashes):unknown {
  const passages=pack.kind==='learning'?new Map(pack.passages.map(row=>[row.passageId,row])):new Map();
  const media=pack.kind==='learning'?new Map(pack.media.map(row=>[row.mediaId,row])):new Map();
  const items=pack.items.map(item=>{
    const {id,...fields}=item;void id;const result:Record<string,unknown>={...fields};
    if('passageId'in item){const {passageId,approvedAt,...passage}=passages.get(item.passageId)!;void passageId;void approvedAt;delete result.passageId;result.passage=passage;}
    if('audioId'in item){const {mediaId,url,approvedAt,...audio}=media.get(item.audioId)!;void mediaId;void url;void approvedAt;delete result.audioId;result.audio=audio;}
    if(item.media)result.media={...item.media,...(item.media.imageId?{imageId:hashes[item.media.imageId]??item.media.imageId}:{}),
      ...(item.media.audioId?{audioId:hashes[item.media.audioId]??media.get(item.media.audioId)?.sha256??item.media.audioId}:{})};
    return onlineCanonical(result);
  }).sort();
  return {title:pack.title,kind:pack.kind,items};
}
/** Exact author content for replay; only transport IDs, publication dates and row order are ignored. */
export const onlineReplayPackIdentity=(pack:ContentPack,hashes:MediaHashes={})=>onlineCanonical(replayContent(pack,hashes));
/** Source-version equality keeps author identifiers, feedback and metadata immutable. */
export function onlineImmutablePackIdentity(pack:ContentPack):string {
  const {publishedAt,source,items,...fields}=pack;void publishedAt;void source;
  return onlineCanonical({...fields,items:items.map(row=>onlineCanonical(row)).sort(),
    ...(pack.kind==='learning'?{passages:pack.passages.map(row=>onlineCanonical(row)).sort(),media:pack.media.map(row=>onlineCanonical(row)).sort()}:{})});
}
/** Question meaning prevents a renamed/copied pack from minting another source reward. */
export function onlineSemanticPackIdentity(pack:ContentPack,hashes:MediaHashes={}):string {
  const text=(value:string)=>normalizedWord(value,false);
  const media=pack.kind==='learning'?new Map(pack.media.map(row=>[row.mediaId,row])):new Map();
  const items=pack.items.map(item=>{
    const row:Record<string,unknown>={kind:item.kind};
    if('prompt'in item)row.prompt=text(item.prompt);
    if(item.kind==='pair'){row.left=text(item.left);row.right=text(item.right);}
    if(item.kind==='sentence')row.words=item.words.map(text);
    if('options'in item){row.options=item.options.map(text).sort();row.answer=text(item.options[item.correctIndex]);}
    if(item.kind==='numeric-answer'){row.answer=normalizedNumber(item.answer);row.unit=item.unit?text(item.unit):'';}
    if('acceptedAnswers'in item){row.answers=item.acceptedAnswers.map(answer=>normalizedWord(answer,item.caseSensitive)).sort();row.caseSensitive=item.caseSensitive;}
    if(item.kind==='reading-choice'&&pack.kind==='learning')row.passage=text(pack.passages.find(passage=>passage.passageId===item.passageId)!.body);
    const audioId='audioId'in item?item.audioId:item.media?.audioId;
    if(audioId){row.audio=hashes[audioId]??media.get(audioId)?.sha256??audioId;row.transcript=text(item.media?.audioTranscript??media.get(audioId)?.transcript??'');}
    if(item.media?.imageId)row.image=hashes[item.media.imageId]??item.media.imageId;
    return onlineCanonical(row);
  }).sort();
  return onlineCanonical(items);
}
export function onlineWeekIdentity(week:{title:string;sets:{subjectLabel:string;pack:ContentPack}[]},hashes:MediaHashes={}):string {
  return onlineCanonical({title:onlineIdentityText(week.title),sets:week.sets.map(set=>onlineCanonical({label:onlineIdentityText(set.subjectLabel),content:onlineReplayPackIdentity(set.pack,hashes)})).sort()});
}
/** Reimported editorial changes must retain the original source question's reward key. */
export function onlinePreserveQuestionIds(current:ContentPack,incoming:ContentPack,hashes:MediaHashes={}):ContentPack {
  if(current.id!==incoming.id||current.kind!==incoming.kind)return incoming;
  const originalIds=new Set(current.items.map(item=>item.id)),used=new Set(incoming.items.filter(item=>originalIds.has(item.id)).map(item=>item.id));
  const meaning=(pack:ContentPack,item:ContentPack['items'][number])=>onlineSemanticPackIdentity({...pack,items:[item]} as ContentPack,hashes);
  const byMeaning=new Map<string,string[]>();
  for(const item of current.items){const key=meaning(current,item),ids=byMeaning.get(key)??[];ids.push(item.id);byMeaning.set(key,ids);}
  return {...incoming,items:incoming.items.map(item=>{
    if(originalIds.has(item.id)){
      const original=current.items.find(row=>row.id===item.id)!;
      if(meaning(current,original)!==meaning(incoming,item))throw new Error(`Mã câu ${item.id} đã công bố với nội dung chấm khác. Câu mới cần mã itemId mới; không dùng sao của câu cũ. Chỉnh lời giải hoặc trình bày vẫn giữ mã cũ.`);
      return item;
    }
    const id=byMeaning.get(meaning(incoming,item))?.find(candidate=>!used.has(candidate));
    if(!id)return item;used.add(id);return {...item,id};
  })} as ContentPack;
}
export function onlineRevisionOrder(current:{title:string;sets:{subjectLabel:string;pack:ContentPack}[]},incoming:{title:string;sets:{subjectLabel:string;pack:ContentPack}[]},hashes:MediaHashes={}) {
  if(current.sets.length!==incoming.sets.length)throw new Error('Cập nhật tuần phải giữ nguyên số nhóm môn và dạng câu. Hãy tạo tuần mới cho nhóm mới.');
  const sets=current.sets.map(old=>{
    const next=incoming.sets.find(set=>set.pack.id===old.pack.id);
    if(!next||onlineIdentityText(next.subjectLabel)!==onlineIdentityText(old.subjectLabel)||onlinePackQuestionKind(next.pack)!==onlinePackQuestionKind(old.pack))throw new Error(`Cập nhật phải giữ mã nguồn, tên môn và dạng của bộ ${old.pack.id}. Hãy dùng lại mã tuần gốc.`);
    return next;
  });
  const unchanged=sets.every((set,index)=>set.pack.version===current.sets[index].pack.version&&onlineImmutablePackIdentity(set.pack)===onlineImmutablePackIdentity(current.sets[index].pack))
    &&onlineWeekIdentity(current,hashes)===onlineWeekIdentity(incoming,hashes);
  if(!unchanged)sets.forEach((set,index)=>{const expected=current.sets[index].pack.version+1;
    if(set.pack.version!==expected)throw new Error(`Bộ ${set.pack.id}: hiện ở phiên bản ${expected-1}, cập nhật cần phiên bản ${expected}. Hãy tải lại tuần gốc; không trộn các phiên bản cũ.`);});
  return {sets,unchanged};
}
export function onlineRevisionComparison(current:{sets:{pack:ContentPack}[]},incoming:{sets:{pack:ContentPack}[]},hashes:MediaHashes={}){
  let retained=0,added=0,removed=0;
  for(const set of incoming.sets){const original=current.sets.find(row=>row.pack.id===set.pack.id)?.pack;if(!original){added+=set.pack.items.length;continue;}
    const normalized=onlinePreserveQuestionIds(original,set.pack,hashes),oldIds=new Set(original.items.map(item=>item.id)),nextIds=new Set(normalized.items.map(item=>item.id));
    retained+=normalized.items.filter(item=>oldIds.has(item.id)).length;added+=normalized.items.filter(item=>!oldIds.has(item.id)).length;removed+=original.items.filter(item=>!nextIds.has(item.id)).length;
  }return{retained,added,removed};
}
