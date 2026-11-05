import {useEffect,useState} from 'react';
import type {ModuleId} from '../core/contracts';
import type {OnlinePackSummary,OnlineStudentSummary,OnlineSummarySet} from '../core/online-contracts';
import '../styles/student-assigned-games.css';

interface Props {
  studentName:string;
  availableStars:number;
  earnedStars:number;
  sets:OnlineSummarySet[];
  week:OnlineStudentSummary['currentWeekSummary'];
  practiceContext:{title:string;detail:string;pack:OnlinePackSummary|null;games:{id:ModuleId;label:string}[];complete:boolean};
  onPlay:(id:ModuleId,pack:OnlinePackSummary)=>Promise<void>;
  onChooseGames:(pack:OnlinePackSummary)=>Promise<void>;
  starting:boolean;
  onOpenWallet:()=>void;
  showCardBlock?:boolean;
}

export const GAME_CARD_IMAGES: Record<string, string> = {
  'math-quest': '/art/game-cards/game-card-question-island.webp',
  'memory-match': '/art/game-cards/game-card-memory-grove.webp',
  'sentence-builder': '/art/game-cards/game-card-sentence-house.webp',
  'word-connect': '/art/game-cards/game-card-word-bridge.webp',
  'sequence-trail': '/art/game-cards/game-card-sequence-trail.webp',
  'balance-scale': '/art/game-cards/game-card-question-island.webp',
  'basket-sort': '/art/game-cards/game-card-memory-grove.webp',
  'treasure-flip': '/art/game-cards/game-card-memory-grove.webp',
  'fox-kitchen': '/art/game-cards/game-card-sequence-trail.webp',
  'boat-race': '/art/game-cards/game-card-question-island.webp',
};
const themes:Record<ModuleId,{symbol:string;intro:string;action:string}>={
  'math-quest':{symbol:'?',intro:'Chọn đáp án, vượt từng câu hỏi và góp thêm sao.',action:'Vào đảo câu hỏi'},
  'memory-match':{symbol:'◇',intro:'Lật thẻ và tìm những cặp nội dung đi cùng nhau.',action:'Khám phá trí nhớ'},
  'sentence-builder':{symbol:'Aa',intro:'Ghép từng từ để tạo thành một câu hoàn chỉnh.',action:'Bắt đầu ghép câu'},
  'word-connect':{symbol:'↔',intro:'Tìm hai nội dung phù hợp rồi nối chúng với nhau.',action:'Nối đôi khám phá'},
  'sequence-trail':{symbol:'123',intro:'Tìm quy luật và đưa các thẻ về đúng thứ tự.',action:'Chinh phục thứ tự'},
  'balance-scale':{symbol:'⚖',intro:'So sánh hai vế toán học bằng chiếc cân đĩa kỳ diệu.',action:'Cân thăng bằng'},
  'basket-sort':{symbol:'🧺',intro:'Phân loại và gom các thẻ kiến thức vào đúng từng giỏ.',action:'Xếp vào giỏ'},
  'treasure-flip':{symbol:'💎',intro:'Mở rương kho báu vàng óng để ghép đúng cặp thẻ.',action:'Lật kho báu'},
  'fox-kitchen':{symbol:'🍲',intro:'Cùng Cáo xếp nguyên liệu vào nồi súp theo đúng quy luật.',action:'Vào bếp nấu súp'},
  'boat-race':{symbol:'⛵',intro:'Trả lời nhanh và chính xác để đưa thuyền rồng về đích.',action:'Đua thuyền lướt sóng'},
};
function regionTheme(label:string){
  const name=label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/toan|math/.test(name))return {name:'Đảo Số',symbol:'＋',tone:'mint'};
  if(/tieng viet|vietnamese|ngu van/.test(name))return {name:'Rừng Chữ',symbol:'Aa',tone:'peach'};
  if(/tieng anh|english/.test(name))return {name:'Cảng English',symbol:'abc',tone:'blue'};
  if(/tin hoc|computer|informatics/.test(name))return {name:'Phố Robot',symbol:'⌘',tone:'lilac'};
  return {name:label,symbol:'✦',tone:'sand'};
}
const packKey=(pack:OnlinePackSummary)=>`${pack.id}@${pack.version}`;
/** Lightweight HTML map. Progress and compatible games always come from the server. */
export default function StudentScreen({studentName,availableStars,earnedStars,sets,week,practiceContext,onPlay,onChooseGames,starting,onOpenWallet,showCardBlock=true}:Props){
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [knownGames,setKnownGames]=useState<Record<string,Props['practiceContext']['games']>>({});
  useEffect(()=>setSelectedKey(null),[week?.weekId]);
  useEffect(()=>{
    setKnownGames(previous=>{
      const next={...previous};let changed=false;
      const remember=(pack:OnlinePackSummary,games:Props['practiceContext']['games'])=>{
        if(!games.length)return;
        const key=packKey(pack),old=previous[key];
        if(old?.length===games.length&&old.every((game,index)=>game.id===games[index].id&&game.label===games[index].label))return;
        next[key]=games;changed=true;
      };
      sets.forEach(set=>remember(set.pack,set.games));
      if(practiceContext.pack)remember(practiceContext.pack,practiceContext.games);
      return changed?next:previous;
    });
  },[sets,practiceContext.pack,practiceContext.games]);
  const selected=sets.find(set=>packKey(set.pack)===selectedKey)
    ??sets.find(set=>practiceContext.pack&&packKey(set.pack)===packKey(practiceContext.pack))??sets[0];
  const currentPack=selected?.pack??practiceContext.pack;
  const latestGames=selected?.games.length?selected.games:currentPack&&practiceContext.pack&&packKey(currentPack)===packKey(practiceContext.pack)?practiceContext.games:[];
  const games=latestGames.length?latestGames:currentPack?knownGames[packKey(currentPack)]??[]:[];
  const regions=new Map<string,OnlineSummarySet[]>();
  sets.forEach(set=>regions.set(set.subjectLabel,[...(regions.get(set.subjectLabel)??[]),set]));
  const completed=week?week.two+week.three:0;
  return <section id="home" className={`game-hub student-light-hub ${!showCardBlock?'hub-compact':''}`} data-hub-mode="light" aria-label="Chọn trò chơi phù hợp">
    <div className="student-welcome">
      <div><p className="online-eyebrow">MỖI NGÀY MỘT CHUYẾN KHÁM PHÁ</p><h1>Chào {studentName} <span aria-hidden="true">✦</span></h1><p>Cùng đi một chút, học một điều hay!</p></div>
      <nav className="student-quick-nav" aria-label="Góc học tập của con"><a href="#explore-map" aria-current="location">⌖ Khám phá</a><a href="#online-week-journey">Hành trình tuần ↓</a></nav>
    </div>
    <div className="student-explorer-layout">
      <div className="student-explorer-main">
        {showCardBlock && (
          <section id="explore-map" className="student-map" aria-labelledby="student-map-title">
            <div className="student-map-heading"><div><span className="student-kicker">BẢN ĐỒ CỦA CON</span><h2 id="student-map-title">{week?.title??practiceContext.title}</h2></div><span className="student-map-stamp">{regions.size} vùng khám phá</span></div>
            <p className="student-map-guide">Chạm một địa điểm, chọn trò con thích và bắt đầu nhé.</p>
            <div className="student-region-grid">{[...regions].map(([label,regionSets])=>{
              const theme=regionTheme(label),active=regionSets.some(set=>currentPack&&packKey(set.pack)===packKey(currentPack));
              return <section key={label} className={`student-region region-${theme.tone}${active?' is-selected':''}`} aria-label={`Vùng ${label}`}>
                <div className="student-region-heading"><span className="student-region-symbol" aria-hidden="true">{theme.symbol}</span><div><span>{label}</span><h3>{theme.name}</h3></div></div>
                <ol className="student-map-stops">{regionSets.map((set,index)=>{
                  const chosen=!!currentPack&&packKey(set.pack)===packKey(currentPack),done=set.questionProgress.two+set.questionProgress.three;
                  return <li key={packKey(set.pack)}><button type="button" className="student-map-stop" aria-pressed={chosen} disabled={starting} aria-label={`Khám phá ${label} · ${set.pack.title}`} onClick={()=>{setSelectedKey(packKey(set.pack));if(!set.games.length&&!knownGames[packKey(set.pack)]?.length)void onChooseGames(set.pack);}}>
                    <span className={`student-stop-marker${set.done?' is-done':''}`} aria-hidden="true">{set.done?'✓':index+1}</span><span className="student-stop-copy"><strong>{set.pack.title}</strong><small>{done}/{set.questionProgress.total} câu đạt 2 sao</small></span><span aria-hidden="true">{chosen?'●':'→'}</span>
                  </button></li>;
                })}</ol>
              </section>;
            })}</div>
            {!regions.size&&<p className="student-map-empty">{practiceContext.detail}</p>}
            <p className="student-map-note"><span aria-hidden="true">✧</span> Mỗi địa điểm là một bộ câu hỏi thầy cô đã giao cho con.</p>
          </section>
        )}
        <section className="student-light-games" aria-label="Trò chơi phù hợp bộ được giao" aria-busy={starting}>
          <div className="student-games-heading"><div><span className="student-kicker">CHỌN CÁCH CON MUỐN CHƠI</span><h2 id="student-games-title">{currentPack?currentPack.title:practiceContext.complete?'Thật tuyệt, con đã hoàn thành!':'Chuyến khám phá đang được chuẩn bị'}</h2></div>{currentPack&&<span className="student-question-count">{currentPack.itemCount} câu hỏi</span>}</div>
          {currentPack&&<p className="student-games-guide">Cùng một bộ câu hỏi, con có thể thử những cách chơi này.</p>}
          <div className="student-game-grid">{games.map(game=><button key={game.id} type="button" className={`student-game-card game-card-${game.id}`} disabled={starting} aria-label={`Chơi ${game.label} bằng bộ được giao`} onClick={()=>currentPack&&void onPlay(game.id,currentPack)}>
            {GAME_CARD_IMAGES[game.id]&&<img src={GAME_CARD_IMAGES[game.id]} alt="" className="student-game-thumbnail" aria-hidden="true" loading="lazy"/>}
            <span className="student-game-symbol" aria-hidden="true">{themes[game.id].symbol}</span><span className="student-game-copy"><strong>{game.label}</strong><span>{themes[game.id].intro}</span><small>{themes[game.id].action} <span aria-hidden="true">→</span></small></span>
          </button>)}</div>
          {currentPack&&!games.length&&<button type="button" disabled={starting} onClick={()=>void onChooseGames(currentPack)}>{starting?'Đang tìm trò phù hợp…':'Xem trò chơi của địa điểm này'}</button>}
          {!currentPack&&<p>{practiceContext.detail}</p>}
        </section>
      </div>
      <aside className="student-travel-bag" aria-label="Hành trang khám phá">
        <div className="student-buddy"><span className="student-buddy-icon" aria-hidden="true">🦊</span><div><strong>Cáo nhỏ đồng hành</strong><p>Cứ bình tĩnh, mình cùng thử nhé!</p></div></div>
        <section className="student-week-card" aria-labelledby="student-week-card-title"><span className="student-kicker">TỪNG BƯỚC TIẾN BỘ</span><h2 id="student-week-card-title">Chuyến đi tuần này</h2>{week?<><div className="student-progress-count"><strong>{completed}<span> / {week.total}</span></strong><span>câu đạt yêu cầu</span></div><progress className="student-week-meter" value={completed} max={Math.max(1,week.total)} aria-label="Số câu đạt yêu cầu tuần này"/><p>{week.ready?'Con đã sẵn sàng hoàn thành tuần!':`Thêm ${week.zero+week.one} câu đạt 2 sao nữa nhé.`}</p><a className="student-text-link" href="#online-week-journey">Xem tiến độ từng câu <span aria-hidden="true">→</span></a></>:<p>{practiceContext.detail}</p>}</section>
        <section className="student-star-card" aria-labelledby="student-star-card-title"><span className="student-star-symbol" aria-hidden="true">★</span><span className="student-kicker">HŨ SAO CỦA CON</span><h2 id="student-star-card-title">{availableStars} <span>sao khả dụng</span></h2><p>{earnedStars} sao đã tích lũy qua các chuyến đi.</p><button type="button" className="game-wallet-button" aria-label="Ví đổi sao" onClick={onOpenWallet} disabled={starting}>Mở ví · {availableStars} sao <span aria-hidden="true">→</span></button></section>
        <p className="student-gentle-note">Mỗi câu tối đa 3 sao.<br/>Thử lại để tiến bộ từng chút một.</p>
      </aside>
    </div>
  </section>;
}
