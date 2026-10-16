import type { ContentPack,LearningPack,ReadingPassage,RichLearningItem } from './contracts.ts';
import type { LearningMedia,LearningSession,PackItemRef } from './learning-contracts.ts';

export function normalizedNumber(value:string):string|undefined {
  const text=value.normalize('NFC').trim();if(text.length>40||!/^[-+]?\d+(?:[.,]\d+)?$/.test(text))return;
  const negative=text.startsWith('-'),unsigned=text.replace(/^[-+]/,'').replace(',','.'),[whole,fraction='']=unsigned.split('.');
  const integer=whole.replace(/^0+(?=\d)/,''),decimal=fraction.replace(/0+$/,'');
  return `${negative&&(integer!=='0'||decimal)?'-':''}${integer}${decimal?'.'+decimal:''}`;
}
export const normalizedWord=(value:string,caseSensitive:boolean):string=>{
  const text=value.normalize('NFC').trim().replace(/\s+/g,' ');return caseSensitive?text:text.toLocaleLowerCase('vi');
};
export const isAudioItem=(item:unknown):item is Extract<RichLearningItem,{audioId:string}>=>!!item&&typeof item==='object'&&'kind' in item&&(item.kind==='listening-choice'||item.kind==='listening-gap');
export function richItemPack(ref:PackItemRef,packs:ContentPack[]):LearningPack|undefined {
  return packs.find((pack):pack is LearningPack=>pack.kind==='learning'&&pack.id===ref.packId&&pack.version===ref.contentVersion);
}
export const passageForItem=(ref:PackItemRef,packs:ContentPack[]):ReadingPassage|undefined=>{
  const pack=richItemPack(ref,packs),item=pack?.items.find(row=>row.id===ref.itemId);return item?.kind==='reading-choice'?pack?.passages.find(row=>row.passageId===item.passageId):undefined;
};
export const audioForItem=(ref:PackItemRef,packs:ContentPack[]):LearningMedia|undefined=>{
  const pack=richItemPack(ref,packs),item=pack?.items.find(row=>row.id===ref.itemId);return isAudioItem(item)?pack?.media.find(row=>row.mediaId===item.audioId&&row.kind==='audio'):undefined;
};
export function richContextFingerprint(ref:PackItemRef,packs:ContentPack[]):string|undefined {
  const contextText=(value:string)=>normalizedWord(value.replace(/\p{P}/gu,' '),false);
  const passage=passageForItem(ref,packs);if(passage)return JSON.stringify(['passage',contextText(passage.body)]);
  const audio=audioForItem(ref,packs);if(audio)return JSON.stringify(['audio',contextText(audio.transcript??'')]);
}
export function playedAudioItemRefs(session:LearningSession,packs:ContentPack[],before:string):PackItemRef[]{
  const checkpoint=session.checkpoint;if(!checkpoint||!Array.isArray(checkpoint.itemOrder)||!Array.isArray(checkpoint.mediaPlayback))return [];
  return checkpoint.itemOrder.filter(ref=>{
    if(!ref||typeof ref.packId!=='string'||typeof ref.itemId!=='string'||!Number.isSafeInteger(ref.contentVersion))return false;
    const media=audioForItem(ref,packs);return !!media&&checkpoint.mediaPlayback!.some(row=>row&&typeof row.completedAt==='string'&&row.mediaId===media.mediaId&&row.sha256===media.sha256&&Date.parse(row.completedAt)<=Date.parse(before));
  });
}

export function validateRichPack(pack:LearningPack):string[]{
  const errors:string[]=[];const text=(value:unknown,max=500)=>typeof value==='string'&&!!value.trim()&&value.length<=max;
  const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value&&Date.parse(value)<=Date.parse(pack.publishedAt);
  if(pack.contentFormatVersion!==2)errors.push('Học liệu mở rộng cần contentFormatVersion 2.');
  if(!Array.isArray(pack.passages)||pack.passages.length>30||!Array.isArray(pack.media)||pack.media.length>30)return ['Catalog đoạn đọc/âm thanh không hợp lệ.'];
  const ids=new Set<string>();
  for(const passage of pack.passages){if(!passage||!text(passage.passageId,120)||!text(passage.title,160)||!text(passage.body,8000)||!text(passage.source,1000)||!text(passage.rights,1000)||!timestamp(passage.approvedAt))errors.push('Đoạn đọc thiếu nội dung, nguồn hoặc thời điểm duyệt.');
    if(ids.has(passage?.passageId))errors.push('Trùng mã đoạn đọc.');ids.add(passage?.passageId);}
  ids.clear();
  for(const media of pack.media){if(!media||media.kind!=='audio'||!text(media.mediaId,120)||!text(media.url,500)||!/^\/audio\/[a-zA-Z0-9._-]+\.(wav|mp3|ogg)$/.test(media.url)||!text(media.transcript,8000)||!text(media.source,1000)||!text(media.rights,1000)||!/^[a-f0-9]{64}$/.test(media.sha256)||!timestamp(media.approvedAt))errors.push('Âm thanh cần catalog nội bộ, hash, transcript, nguồn và thời điểm duyệt.');
    if(ids.has(media?.mediaId))errors.push('Trùng mã âm thanh.');ids.add(media?.mediaId);}
  const content=new Set<string>();
  for(const [index,item] of pack.items.entries()){
    const label=`Câu ${index+1}`;if(!item||!text(item.prompt,320)||!text(item.explanation)||!text(item.hint,500)){errors.push(`${label}: thiếu đề, gợi ý hoặc lời giải.`);continue;}
    if(!['numeric-answer','fill-blank','reading-choice','listening-choice','listening-gap'].includes(item.kind)){errors.push(`${label}: dạng câu chưa hỗ trợ.`);continue;}
    if(item.kind==='numeric-answer'){if(!text(item.answer,40)||normalizedNumber(item.answer)===undefined)errors.push(`${label}: đáp án số không hợp lệ.`);if(item.unit!==undefined&&!text(item.unit,40))errors.push(`${label}: đơn vị không hợp lệ.`);}
    if(item.kind==='fill-blank'||item.kind==='listening-gap'){
      if(!Array.isArray(item.acceptedAnswers)||item.acceptedAnswers.length<1||item.acceptedAnswers.length>10||item.acceptedAnswers.some(answer=>!text(answer,120))||typeof item.caseSensitive!=='boolean')errors.push(`${label}: cần đáp án từ và quy tắc chữ hoa/thường.`);
      else if(new Set(item.acceptedAnswers.map(answer=>normalizedWord(answer,item.caseSensitive))).size!==item.acceptedAnswers.length)errors.push(`${label}: đáp án từ trùng nhau.`);
    }
    if(item.kind==='reading-choice'||item.kind==='listening-choice'){
      if(!Array.isArray(item.options)||item.options.length!==4||item.options.some(option=>!text(option,120))||new Set(item.options.map(option=>typeof option==='string'?normalizedWord(option,false):option)).size!==4||!Number.isInteger(item.correctIndex)||item.correctIndex<0||item.correctIndex>3)errors.push(`${label}: cần bốn phương án khác nhau và một đáp án đúng.`);
    }
    if(item.kind==='reading-choice'&&!pack.passages.some(passage=>passage?.passageId===item.passageId))errors.push(`${label}: thiếu đoạn đọc được tham chiếu.`);
    if(isAudioItem(item)&&!pack.media.some(media=>media?.mediaId===item.audioId))errors.push(`${label}: thiếu âm thanh được tham chiếu.`);
    const context=item.kind==='reading-choice'?pack.passages.find(passage=>passage?.passageId===item.passageId)?.body:isAudioItem(item)?pack.media.find(media=>media?.mediaId===item.audioId)?.sha256:'';
    const key=JSON.stringify([normalizedWord(item.prompt,false),context]);if(content.has(key))errors.push(`${label}: trùng câu hỏi trong cùng ngữ liệu.`);content.add(key);
  }
  return errors;
}
