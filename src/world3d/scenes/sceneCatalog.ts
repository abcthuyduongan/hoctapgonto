import type { ModuleId } from '../../core/contracts.ts';
import type { WorldId } from '../engine.ts';

export type SceneId = WorldId;

export interface SceneMeta {
  id: SceneId;
  name: string;
  theme: {
    world: string;
    symbol: string;
    num: string;
    description: string;
  };
  supportedModules: ModuleId[];
}

export const SCENE_CATALOG: readonly SceneMeta[] = [
  {
    id: 'math-quest',
    name: 'Đảo Toán Học',
    theme: {
      world: 'Đảo Toán Học',
      symbol: '∑',
      num: '01',
      description: 'Từng phép tính, một khám phá mới'
    },
    supportedModules: ['math-quest']
  },
  {
    id: 'memory-match',
    name: 'Khu Rừng Trí Nhớ',
    theme: {
      world: 'Khu Rừng Trí Nhớ',
      symbol: '◇',
      num: '02',
      description: 'Quan sát tinh mắt, ghi nhớ thật lâu'
    },
    supportedModules: ['memory-match']
  },
  {
    id: 'sentence-builder',
    name: 'Xưởng Ghép Câu',
    theme: {
      world: 'Xưởng Ghép Câu',
      symbol: 'Aa',
      num: '03',
      description: 'Ghép những từ nhỏ thành câu hay'
    },
    supportedModules: ['sentence-builder']
  },
  {
    id: 'word-connect',
    name: 'Đảo Nối Từ',
    theme: {
      world: 'Đảo Nối Từ',
      symbol: '🔗',
      num: '04',
      description: 'Nối từ vựng và tri thức tương ứng'
    },
    supportedModules: ['word-connect']
  },
  {
    id: 'sequence-trail',
    name: 'Bậc Thang Quy Luật',
    theme: {
      world: 'Bậc Thang Quy Luật',
      symbol: '📶',
      num: '05',
      description: 'Xếp các thẻ theo đúng trật tự quy luật logic'
    },
    supportedModules: ['sequence-trail']
  }
];

export function getSceneForModule(moduleId: ModuleId): SceneId {
  const found = SCENE_CATALOG.find(scene => scene.supportedModules.includes(moduleId));
  return found?.id ?? 'math-quest';
}

export function getSceneTheme(sceneId: SceneId) {
  const found = SCENE_CATALOG.find(scene => scene.id === sceneId);
  return found?.theme ?? SCENE_CATALOG[0].theme;
}
