import { useEffect, useState } from 'react';
import { useGameScene } from '../world3d/GameSceneContext';

/** A render of the shared 3D guide, shown only when its live scene is unavailable. */
export default function GameMascot({ alt, className = '', mood = 'idle', reactionKey }: {
  alt: string;
  className?: string;
  mood?: 'idle'|'happy'|'encourage';
  reactionKey?: string | number;
}) {
  const [failed, setFailed] = useState(false);
  const { setMood } = useGameScene();
  useEffect(() => { setMood(mood); return () => setMood('idle'); }, [mood, reactionKey, setMood]);
  return <span className="ba37-mascot-window" data-mood={mood}>
    {failed?<span className={`mascot-fallback game-mascot-${mood} ${className}`} role="img" aria-label={alt}>🦊</span>
      :<img className={`ba37-mascot-fallback game-mascot-${mood} ${className}`} src="/art/fox-guide-common.webp" alt={alt} loading="eager" decoding="async" onError={() => setFailed(true)}/>}
  </span>;
}
