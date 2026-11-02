import { useState } from 'react';

/** A lightweight illustration shared by all games. */
export default function GameMascot({ alt, className = '', mood = 'idle' }: {
  alt: string;
  className?: string;
  mood?: 'idle'|'happy'|'encourage';
  reactionKey?: string | number;
}) {
  const [failed, setFailed] = useState(false);
  return <span className="ba37-mascot-window" data-mood={mood}>
    {failed?<span className={`mascot-fallback game-mascot-${mood} ${className}`} role="img" aria-label={alt}>🦊</span>
      :<img className={`ba37-mascot-fallback game-mascot-${mood} ${className}`} src="/art/fox-guide-common.webp" alt={alt} loading="eager" decoding="async" onError={() => setFailed(true)}/>}
  </span>;
}
