import { useEffect, useRef } from 'react';
import { playCompletionFanfare } from '../core/experience';
import '../styles/games/completion.css';

type Props = {
  title: string;
  summary: string;
  onExit: () => void;
  onReplay?: () => void;
  questionMode?: boolean;
};

/** A celebratory layer over the existing game, never a page replacement. */
export default function GameCompletion({title,summary,onExit,onReplay,questionMode=false}:Props) {
  const exitButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { exitButton.current?.focus({preventScroll:true}); playCompletionFanfare(); }, []);
  // Per-question stars have already been awarded by the host's saved receipts.
  if(questionMode) {
    return (
      <div className="reward-curtain question-completion">
        <div className="reward-panel question-completion-panel" role="dialog" aria-modal="true" aria-labelledby="question-completion-title">
          <div className="reward-crest" aria-hidden="true"><span>✦</span></div>
          <h2 id="question-completion-title">{title}</h2>
          <p>{summary}</p>
          <div className="premium-reward-note">Mỗi lần luyện tập là một bước tiến 🌱</div>
          <div className="completion-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
            {onReplay && (
              <button type="button" className="button secondary" onClick={onReplay}>
                🔄 Chơi lại
              </button>
            )}
            <button type="button" className="button primary" ref={exitButton} onClick={onExit}>
              Trở về hành trình
            </button>
          </div>
        </div>
      </div>
    );
  }
  return <div className="reward-curtain ba37-reward-curtain" aria-label="Hoàn thành trò chơi">
    <div className="reward-scrim" aria-hidden="true"/>
    <div className="premium-reward-confetti" aria-hidden="true">
      {Array.from({length:12},(_,i)=><i key={i} className={`premium-confetti premium-confetti-${i+1}`}/>)}
    </div>
    <div className="reward-panel premium-reward-panel" role="dialog" aria-modal="true" aria-labelledby="reward-heading" aria-describedby="reward-summary">
      <span className="premium-reward-rays" aria-hidden="true"/>
      <div className="reward-crest" aria-hidden="true"><span>✦</span></div>
      <span className="reward-eyebrow">HÀNH TRÌNH HOÀN THÀNH</span>
      <h2 id="reward-heading">{title}</h2>
      <div className="premium-reward-stars" aria-hidden="true"><span>★</span><span>★</span><span>★</span></div>
      <p id="reward-summary">{summary}</p>
      <div className="premium-reward-note">Mỗi lần luyện tập là một bước tiến 🌱</div>
      <div className="completion-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        {onReplay && (
          <button type="button" className="button secondary" onClick={onReplay}>
            🔄 Chơi lại
          </button>
        )}
        <button type="button" className="button primary reward-home" ref={exitButton} onClick={onExit}>
          Trở về thế giới game <span aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
  </div>;
}
