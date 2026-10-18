import {useEffect,useState} from 'react';
import type {ModuleId} from '../core/contracts';
import type {OnlineSummarySet} from '../core/online-contracts';

export default function OnlineQuestionStars({set,disabled,reviewEpoch,onChooseGames,onPlay}:{set:OnlineSummarySet;disabled:boolean;reviewEpoch:number;onChooseGames:()=>Promise<void>;onPlay:(game:ModuleId,ids?:string[])=>void}){
  const [open,setOpen]=useState(false),[selectedGame,setSelectedGame]=useState<ModuleId|''>(''),progress=set.questionProgress;
  const game=set.games.find(game=>game.id===selectedGame)??set.games[0];
  const unfinished=progress.questions.filter(question=>question.tier<2).map(question=>question.itemId);
  useEffect(()=>{if(reviewEpoch&&progress.two>0)setOpen(true);},[reviewEpoch,progress.two]);
  return <details className="online-question-stars" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{progress.total} câu · {progress.two} câu 2 sao · {progress.three} câu 3 sao · xem từng câu</summary>
    {open&&<div className="online-question-stars-body">
      {!game?<button type="button" disabled={disabled} onClick={()=>void onChooseGames()}>Chọn trò để học hoặc ôn lại</button>:<><label>Trò để học và ôn · {set.pack.title}<select disabled={disabled} value={game.id} onChange={event=>setSelectedGame(event.target.value as ModuleId)}>{set.games.map(game=><option key={game.id} value={game.id}>{game.label}</option>)}</select></label><div className="online-actions"><button type="button" disabled={disabled} onClick={()=>onPlay(game.id)}>Học bộ này · {game.label}</button>{progress.two>0&&<button type="button" disabled={disabled} onClick={()=>onPlay(game.id,progress.questions.filter(q=>q.tier===2).map(q=>q.itemId))}>Ôn {progress.two} câu 2 sao · {game.label}</button>}</div></>}
      {!!unfinished.length&&game&&<button type="button" className="online-primary" disabled={disabled} onClick={()=>onPlay(game.id,unfinished)}>Tiếp tục {unfinished.length} câu chưa đạt 2 sao</button>}
      <ol>{progress.questions.map((question,index)=><li key={question.itemId}><strong>Câu {index+1}</strong><span aria-label={`${question.tier} trên 3 sao`}>{question.tier}/3 sao</span>{question.tier<3&&game&&<button type="button" disabled={disabled} aria-label={`Học lại câu ${index+1} · ${game.label}`} onClick={()=>onPlay(game.id,[question.itemId])}>Học lại câu này</button>}</li>)}</ol>
      <p className="online-muted">Mỗi câu tối đa 3 sao dùng chung giữa các trò. Trò ghép cặp có thể thêm một câu đối chiếu để ôn; câu đã đủ sao không cộng lại.</p>
    </div>}
  </details>;
}
