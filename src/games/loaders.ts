import { lazy } from 'react';
import type { ComponentType } from 'react';
import type { GameHostProps, ModuleId } from '../core/contracts';

const importers = {
  'math-quest': () => import('./MathQuest'),
  'memory-match': () => import('./MemoryMatch'),
  'sentence-builder': () => import('./SentenceBuilder'),
  'word-connect': () => import('./WordConnect'),
  'sequence-trail': () => import('./SequenceTrail')
};
type GameModule = {default:ComponentType<GameHostProps>};
const pending = new Map<ModuleId,Promise<GameModule>>();

/** Begin the small game chunk while the server opens its authoritative session. */
export function preloadGameComponent(id:ModuleId):Promise<GameModule> {
  const existing = pending.get(id);
  if (existing) return existing;
  const work = importers[id]().catch(error => { pending.delete(id); throw error; });
  pending.set(id,work);
  return work;
}

/** SDK V1 runtime registration. Adding a game needs a manifest + a lazy loader, never an App switch. */
export const GAME_COMPONENTS = Object.fromEntries(
  Object.keys(importers).map(id=>[id,lazy(()=>preloadGameComponent(id as ModuleId))])
) as Record<ModuleId, ReturnType<typeof lazy<ComponentType<GameHostProps>>>>;
