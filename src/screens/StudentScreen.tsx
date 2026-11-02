import type {ModuleId} from '../core/contracts';
import type {OnlinePackSummary} from '../core/online-contracts';
import '../styles/student-assigned-games.css';

interface Props {
  availableStars:number;
  practiceContext:{title:string;detail:string;pack:OnlinePackSummary|null;games:{id:ModuleId;label:string}[];complete:boolean};
  onPlay:(id:ModuleId,pack:OnlinePackSummary)=>Promise<void>;
  starting:boolean;
  onOpenWallet:()=>void;
}
const themes:Record<ModuleId,{symbol:string;intro:string}>={
  'math-quest':{symbol:'∑',intro:'Vượt từng câu hỏi bằng cách chọn đáp án đúng.'},
  'memory-match':{symbol:'◇',intro:'Lật thẻ, nhớ vị trí và tìm hai nội dung đi cùng nhau.'},
  'sentence-builder':{symbol:'Aa',intro:'Xếp những từ bị đảo vị trí thành câu hoàn chỉnh.'},
  'word-connect':{symbol:'🔗',intro:'Quan sát hai cột rồi nối câu hỏi với câu trả lời phù hợp.'},
  'sequence-trail':{symbol:'▥',intro:'Đặt các thẻ theo đúng thứ tự của câu hoặc dãy số.'},
};
/** The online hub has one presentation mode; saved preferences from older 3D builds are ignored. */
export default function StudentScreen({availableStars,practiceContext,onPlay,starting,onOpenWallet}:Props){
  const currentPack=practiceContext.pack;
  return <section id="home" className="game-hub student-light-hub" data-hub-mode="light" aria-label="Chọn trò chơi phù hợp">
    <div className="student-light-heading">
      <img className="student-light-guide" src="/art/fox-guide-common.webp" alt="Cáo nhỏ đồng hành" width="88" height="112" decoding="async"/>
      <div><p className="online-eyebrow">HÀNH TRÌNH CỦA CON</p><h1>{practiceContext.title}</h1><p>{practiceContext.detail}</p></div>
      <button type="button" className="game-wallet-button" aria-label="Ví đổi sao" onClick={onOpenWallet} disabled={starting}>⭐ {availableStars} sao · Đổi thưởng →</button>
    </div>
    <section className="assigned-game-fallback student-light-games" aria-label="Trò chơi phù hợp bộ được giao">
      <strong>{currentPack?'Chọn trò để vào bộ được giao':practiceContext.complete?'Con đã hoàn thành học liệu được giao':'Đang chờ học liệu từ lớp'}</strong>
      {currentPack&&<p>{currentPack.title} · {currentPack.itemCount} câu</p>}
      <div>{practiceContext.games.map(game=><button key={game.id} type="button" disabled={starting} aria-label={`Chơi ${game.label} bằng bộ được giao`} onClick={()=>currentPack&&void onPlay(game.id,currentPack)}>
        <span aria-hidden="true">{themes[game.id].symbol}</span><span><strong>{game.label}</strong><small>{themes[game.id].intro}</small></span><span aria-hidden="true">→</span>
      </button>)}</div>
      {!currentPack&&<p>{practiceContext.detail}</p>}
    </section>
  </section>;
}
