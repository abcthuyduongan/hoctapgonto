import {memo,useMemo,useState} from 'react';
import type {ContentPack} from '../core/contracts';
import {normalizedWord} from '../core/rich-content';
import {onlineScoreResponse} from '../core/online-exercises';
import {onlineGameCompatibility} from '../core/game-compatibility';
import type {QuestionCompatibility} from '../core/game-compatibility';
import QuestionMedia from '../components/QuestionMedia';

const labels:Record<string,string>={quiz:'Trắc nghiệm','multiple-choice':'Trắc nghiệm',pair:'Nối cặp',sentence:'Xếp thứ tự câu','numeric-answer':'Nhập số','fill-blank':'Điền từ','reading-choice':'Đọc & chọn đáp án','listening-choice':'Nghe & chọn đáp án','listening-gap':'Nghe & điền từ'};
export function onlinePackKindLabel(pack:ContentPack){return [...new Set(pack.items.map(item=>labels[item.kind]??item.kind))].join(', ');}
function ReviewItem({pack,index,compatibility}:{pack:ContentPack;index:number;compatibility:QuestionCompatibility}){
  const item=pack.items[index],[value,setValue]=useState(''),[choice,setChoice]=useState<number|null>(null),[result,setResult]=useState(''),[open,setOpen]=useState(false);
  const passage=pack.kind==='learning'&&'passageId' in item?pack.passages.find(row=>row.passageId===item.passageId):undefined;
  const catalog=pack.kind==='learning'&&'audioId'in item?pack.media.find(row=>row.mediaId===item.audioId):undefined;
  const media={...item.media,...(catalog?{audioId:catalog.mediaId,audioTranscript:catalog.transcript}:{})};
  const options='options'in item?item.options:null;
  function check(){try{
    const correct=item.kind==='pair'?normalizedWord(value,false)===normalizedWord(item.right,false):item.kind==='sentence'?normalizedWord(value,false)===normalizedWord(item.words.join(' '),false):onlineScoreResponse(pack,'math-quest',item.id,options?{kind:'choice',choiceIndex:choice}:{kind:'text',value}).correct;
    setResult(correct?'Khớp đáp án của bộ. Lượt thử không ghi sao.':'Chưa khớp đáp án. Lượt thử không ghi sao.');
  }catch(error){setResult(error instanceof Error?error.message:'Chưa kiểm tra được câu thử.');}}
  return <details className="online-review-item" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Câu {index+1} · {labels[item.kind]} · {item.kind==='pair'?item.left:item.prompt}<small>Trò dùng được với câu này: {compatibility.games.filter(game=>game.allowed).map(game=>game.label).join(', ')||'Chưa có trò phù hợp'}</small></summary>{open&&<>
    <section aria-label={`Trò phù hợp với câu ${index+1}`}><p><strong>Kiểm tra trò cho câu {index+1}</strong></p><ul>{compatibility.games.map(game=><li key={game.id}><strong>{game.label}: {game.allowed?'Dùng được':'Chưa dùng được'}</strong>{game.reason&&<span> · {game.reason}</span>}</li>)}</ul></section>
    {passage&&<article className="online-reading"><h4>{passage.title}</h4><p>{passage.body}</p></article>}
    <QuestionMedia media={media} showTranscript/>
    {options&&<ol type="A">{options.map((option,i)=><li key={i}>{option}{'correctIndex'in item&&item.correctIndex===i?' ✓ Đáp án đúng':''}</li>)}</ol>}
    {item.kind==='pair'&&<p><strong>Đáp án nối:</strong> {item.right}</p>}
    {item.kind==='sentence'&&<p><strong>Thứ tự đúng:</strong> {item.words.join(' → ')}</p>}
    {'answer'in item&&<p><strong>Đáp án:</strong> {String(item.answer)}{'unit'in item&&item.unit?` ${item.unit}`:''}</p>}
    {'acceptedAnswers'in item&&<p><strong>Các đáp án được nhận:</strong> {item.acceptedAnswers.join(' · ')} · {'caseSensitive'in item&&item.caseSensitive?'Phân biệt chữ hoa/thường':'Không phân biệt chữ hoa/thường'}</p>}
    {'explanation'in item&&item.explanation&&<p><strong>Giải thích:</strong> {item.explanation}</p>}
    <small>Mã câu: {item.id} · Mục tiêu: {item.objectiveId}</small>
    <div className="online-question-try" role="group" aria-label={`Thử câu ${index+1}`}><p><strong>Thử làm câu này</strong></p>
      {options?<div className="online-actions">{options.map((option,i)=><button type="button" aria-pressed={choice===i} key={i} onClick={()=>{setChoice(i);setResult('');}}>{String.fromCharCode(65+i)}. {option}</button>)}</div>:<label>Câu trả lời thử<input value={value} maxLength={500} onChange={event=>{setValue(event.target.value);setResult('');}}/></label>}
      <button type="button" disabled={options?choice===null:!value.trim()} onClick={check}>Kiểm tra câu thử</button>{result&&<p role="status">{result}</p>}
    </div></>}
  </details>;
}
const OnlineQuestionReview=memo(function OnlineQuestionReview({pack}:{pack:ContentPack}){
  const compatibility=useMemo(()=>onlineGameCompatibility(pack),[pack]);
  const common=compatibility.games.filter(game=>game.allowed);
  return <div className="online-question-review" aria-label={`Duyệt mọi câu trong ${pack.title}`}><p>{pack.items.length} câu · mở từng câu để xem đáp án, tư liệu, trò phù hợp và thử làm.</p>
    <p><strong>Trò chung cho toàn bộ {pack.items.length} câu:</strong> {common.map(game=>game.label).join(', ')||'Chưa có'}. Bộ chỉ mở trò dùng được với tất cả câu.</p>
    {!common.length&&<p className="online-notice online-error">Chưa có trò chung. Sửa các câu bị chặn hoặc tách bộ trước khi giao. Ứng dụng không tự bỏ câu để mở trò.</p>}
    <details><summary>Xem điều kiện của 5 trò cho cả bộ</summary><ul>{compatibility.games.map(game=><li key={game.id}><strong>{game.label}: {game.allowed?'Dùng cả bộ':'Chưa dùng cả bộ'}</strong>{game.reason&&<span> · {game.reason}</span>}</li>)}</ul></details>
    {pack.items.map((item,index)=><ReviewItem key={item.id} pack={pack} index={index} compatibility={compatibility.items[index]}/>)}</div>;
});
export const OnlineQuestionDisclosure=memo(function OnlineQuestionDisclosure({pack,label}:{pack:ContentPack;label:string}){
  const[open,setOpen]=useState(false);
  return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>{label}</summary>{open&&<OnlineQuestionReview pack={pack}/>}</details>;
});
export default OnlineQuestionReview;
