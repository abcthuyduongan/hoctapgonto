import { GAME_SDK_VERSION } from './contracts.ts';
import type { GameManifest, ModuleId } from './contracts.ts';

/** Manifests are data-only, so tools and tests can inspect the catalog without React/Phaser. */
export const GAME_REGISTRY: GameManifest[] = [
  {id:'math-quest',label:'Math Quest',description:'Vượt các trạm toán học và thu thập ngôi sao.',runtime:'react',contentKind:'quiz',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'✦',color:'violet'},
  {id:'memory-match',label:'Memory Match',description:'Lật thẻ, ghi nhớ và tìm đúng các cặp kiến thức.',runtime:'react',contentKind:'pairs',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'◈',color:'mint'},
  {id:'sentence-builder',label:'Sentence Builder',description:'Ghép từ thành câu đúng thứ tự với gợi ý khi cần.',runtime:'react',contentKind:'sentences',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'✎',color:'sky'}
];
export const getGame = (id: ModuleId): GameManifest => {
  const manifest = GAME_REGISTRY.find(g => g.id === id);
  if (!manifest) throw new Error(`Module chưa đăng ký: ${id}`);
  return manifest;
};
