import { useState } from 'react';

/** Shared mascot with a subtle state-dependent reaction and resilient fallback. */
export default function GameMascot({ alt, className = '', mood = 'idle' }: {
  alt: string;
  className?: string;
  mood?: 'idle'|'happy'|'encourage';
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`mascot-fallback game-mascot-${mood} ${className}`} role="img" aria-label={alt}>🦊</span>;
  return <img className={`game-mascot-${mood} ${className}`} src="/art/fox-scene-free.webp" alt={alt} loading="eager" decoding="async" onError={() => setFailed(true)}/>;
}
