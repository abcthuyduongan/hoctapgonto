/** A static system emoji: no character asset, model, sprite or animation. */
export default function GameMascot({ alt, className = '', mood = 'idle' }: {
  alt: string;
  className?: string;
  mood?: 'idle'|'happy'|'encourage';
  reactionKey?: string | number;
}) {
  return <span className="ba37-mascot-window" data-mood={mood}>
    <span className={`mascot-fallback game-mascot-${mood} ${className}`} role="img" aria-label={alt}>🦊</span>
  </span>;
}
