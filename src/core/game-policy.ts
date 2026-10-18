import type {ContentPack,ModuleId} from './contracts.ts';

export const AUTHOR_GAME_IDS:readonly ModuleId[]=['math-quest','memory-match','sentence-builder','word-connect','sequence-trail'];

export function gameRestrictionError(value:unknown):string|undefined {
  if(value===undefined)return;
  if(!Array.isArray(value)||value.length<1||value.length>AUTHOR_GAME_IDS.length||new Set(value).size!==value.length
    ||value.some(id=>typeof id!=='string'||!AUTHOR_GAME_IDS.includes(id as ModuleId)))
    return 'allowedGameIds: cần 1–5 mã trò khác nhau: '+AUTHOR_GAME_IDS.join(', ')+'.';
}

/** A restriction can remove a technical capability, never add one. */
export function itemAllowsGame(item:ContentPack['items'][number],moduleId:ModuleId):boolean {
  const ids=item.metadata?.allowedGameIds;
  return ids===undefined||!gameRestrictionError(ids)&&ids.includes(moduleId);
}
export const gameAllowedByAuthor=(moduleId:ModuleId,pack:ContentPack):boolean=>pack.items.every(item=>itemAllowsGame(item,moduleId));
