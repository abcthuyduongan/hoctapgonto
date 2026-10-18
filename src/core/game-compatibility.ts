import type {ContentPack,ModuleId} from './contracts.ts';
import {itemAllowsGame} from './game-policy.ts';
import {onlinePresentation} from './online-exercises.ts';
import {GAME_REGISTRY} from './registry.ts';
import {validatePack} from './validation.ts';

const gameLabels:Record<ModuleId,string>={'math-quest':'Đảo Câu Hỏi','memory-match':'Trí Nhớ','word-connect':'Nối Từ','sentence-builder':'Ghép Câu','sequence-trail':'Bậc Thang Quy Luật'};
const normalized=(value:string)=>value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
export type GameCompatibility={id:ModuleId;label:string;allowed:boolean;reason?:string};
export type QuestionCompatibility={itemId:string;index:number;games:GameCompatibility[]};
export type PackGameCompatibility={games:GameCompatibility[];items:QuestionCompatibility[]};

/** Explain each source item in its actual group. No questions are copied or omitted. */
export function onlineGameCompatibility(pack:ContentPack):PackGameCompatibility {
  const faces=pack.items.flatMap((item,index)=>item.kind==='pair'?[{text:item.left,index},{text:item.right,index}]
    :item.kind==='multiple-choice'?[{text:item.prompt,index},{text:item.options[item.correctIndex],index}]:[]);
  const duplicateAt=(text:string,index:number)=>faces.filter(face=>normalized(face.text)===normalized(text)&&face.index!==index).map(face=>face.index+1);
  const answerCounts=pack.kind==='pairs'?new Map(pack.items.map(item=>[normalized(item.right),pack.items.filter(other=>normalized(other.right)===normalized(item.right)).length])):new Map<string,number>();
  const items:QuestionCompatibility[]=pack.items.map((item,index)=>({itemId:item.id,index,games:GAME_REGISTRY.map(game=>{
    let reason:string|undefined;
    if(pack.kind==='learning'){
      if(game.id!=='math-quest')reason='Câu đọc, nghe hoặc nhập đáp án cần dùng Đảo Câu Hỏi để giữ đủ ngữ cảnh và cách chấm.';
    }else if(pack.kind==='sentences'){
      if(game.id!=='sentence-builder'&&game.id!=='sequence-trail')reason='Câu xếp thứ tự chỉ dùng Ghép Câu hoặc Bậc Thang Quy Luật; không tự tạo đáp án khác.';
    }else if(game.id==='sentence-builder'||game.id==='sequence-trail')reason='Câu này chưa có thứ tự từ do tác giả cung cấp.';
    else if(pack.kind==='pairs'&&item.kind==='pair'&&game.id==='math-quest'){
      if(pack.items.length<4)reason='Cả bộ cần ít nhất 4 cặp để tạo đủ 4 phương án trắc nghiệm.';
      else if((answerCounts.get(normalized(item.right))??0)>1)reason='Đáp án bên phải trùng câu khác; chưa thể tạo trắc nghiệm có một đáp án rõ ràng.';
      else if(`${pack.title}: ${item.left} → ?`.length>320)reason='Đề trắc nghiệm sau chuyển dạng vượt 320 ký tự.';
    }else if(game.id==='memory-match'||game.id==='word-connect'){
      const cardFaces=item.kind==='pair'?[item.left,item.right]:item.kind==='multiple-choice'?[item.prompt,item.options[item.correctIndex]]:[];
      if(cardFaces.some(face=>face.length>120))reason='Đề hoặc đáp án đúng dài hơn giới hạn 120 ký tự trên một mặt thẻ.';
      else if(cardFaces.length===2&&normalized(cardFaces[0])===normalized(cardFaces[1]))reason='Hai mặt của câu giống nhau; ghép thẻ có thể mơ hồ.';
      else{const duplicates=[...new Set(cardFaces.flatMap(face=>duplicateAt(face,index)))];if(duplicates.length)reason=`Mặt thẻ trùng câu ${duplicates.join(', ')}; cần nội dung mặt thẻ khác nhau trong cả bộ.`;}
    }
    if(!reason&&!itemAllowsGame(item,game.id))reason='Người soạn đã giới hạn câu này, không cho dùng trò này.';
    return{id:game.id,label:gameLabels[game.id],allowed:!reason,...(reason?{reason}:{})};
  })}));
  const games:GameCompatibility[]=GAME_REGISTRY.map(game=>{
    const blocked=items.filter(item=>!item.games.find(row=>row.id===game.id)!.allowed);
    const presentation=blocked.length?undefined:onlinePresentation(game.id,pack);
    const errors=presentation?validatePack(presentation):[];
    const allowed=!!presentation&&!errors.length;
    const reason=allowed?undefined:blocked.length?`Câu ${blocked.map(item=>item.index+1).join(', ')} chưa phù hợp. ${blocked[0].games.find(row=>row.id===game.id)!.reason}`
      :errors[0]??'Cấu trúc của bộ chưa chuyển được sang trò này.';
    return{id:game.id,label:gameLabels[game.id],allowed,...(reason?{reason}:{})};
  });
  return{games,items};
}
