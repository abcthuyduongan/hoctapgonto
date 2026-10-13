import { lazy } from 'react';
import type { ComponentType } from 'react';
import type { GameHostProps, ModuleId } from '../core/contracts';

/** SDK V1 runtime registration. Adding a game needs a manifest + a lazy loader, never an App switch. */
export const GAME_COMPONENTS: Record<ModuleId, ReturnType<typeof lazy<ComponentType<GameHostProps>>>> = {
  'math-quest': lazy(() => import('./MathQuest')),
  'memory-match': lazy(() => import('./MemoryMatch')),
  'sentence-builder': lazy(() => import('./SentenceBuilder'))
};
