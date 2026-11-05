export type MaterialType = 'stone' | 'wood' | 'fish' | 'component';

export interface MaterialCost {
  stone?: number;
  wood?: number;
  fish?: number;
  component?: number;
}

export interface MaterialBalances {
  stone: number;
  wood: number;
  fish: number;
  component: number;
}

export interface PlacedBuilding {
  id: string;
  buildingId: string;
  x: number;
  y: number;
  placedAt: string;
}

export interface TownState {
  gridWidth: number;
  gridHeight: number;
  revision: number;
  buildings: PlacedBuilding[];
  updatedAt: string;
}

export interface BuildingCatalogItem {
  id: string;
  name: string;
  category: 'residential' | 'nature' | 'civic' | 'commercial' | 'landmark';
  description: string;
  cost: MaterialCost;
  image: string;
  isLarge?: boolean;
}

export const SUBJECT_MATERIAL_MAP: Record<string, MaterialType> = Object.freeze({
  math: 'stone',
  vietnamese: 'wood',
  english: 'fish',
  computing: 'component',
});

export const MATERIAL_LABELS: Record<MaterialType, string> = Object.freeze({
  stone: 'Đá',
  wood: 'Gỗ',
  fish: 'Cá',
  component: 'Linh kiện',
});

export const MATERIAL_ICONS: Record<MaterialType, string> = Object.freeze({
  stone: '🪨',
  wood: '🪵',
  fish: '🐟',
  component: '⚙️',
});

export const TOWN_BUILDING_CATALOG: readonly BuildingCatalogItem[] = Object.freeze([
  {
    id: 'cottage',
    name: 'Nhà nhỏ',
    category: 'residential',
    description: 'Ngôi nhà ngói đỏ nhỏ ấm áp cho cư dân thị trấn',
    cost: { wood: 3 },
    image: '/art/town/building-cottage.webp',
  },
  {
    id: 'log_cabin',
    name: 'Nhà gỗ',
    category: 'residential',
    description: 'Nhà gỗ mộc mạc dựng bằng thân cây thông',
    cost: { wood: 5 },
    image: '/art/town/building-log-cabin.webp',
  },
  {
    id: 'ancient_tree',
    name: 'Cây cổ thụ',
    category: 'nature',
    description: 'Cây xanh đại thụ tỏa bóng mát xanh rợp quanh năm',
    cost: { wood: 2 },
    image: '/art/town/building-ancient-tree.webp',
  },
  {
    id: 'water_well',
    name: 'Giếng nước',
    category: 'civic',
    description: 'Giếng đá mát lành ở trung tâm thị trấn',
    cost: { stone: 3 },
    image: '/art/town/building-water-well.webp',
  },
  {
    id: 'flower_garden',
    name: 'Vườn hoa',
    category: 'nature',
    description: 'Bồn hoa khoe sắc tươi tắn rực rỡ',
    cost: { wood: 2, stone: 1 },
    image: '/art/town/building-flower-garden.webp',
  },
  {
    id: 'wooden_bridge',
    name: 'Cầu gỗ',
    category: 'civic',
    description: 'Cầu gỗ hình vòm bắc qua dòng nước trong vắt',
    cost: { wood: 4, stone: 2 },
    image: '/art/town/building-wooden-bridge.webp',
  },
  {
    id: 'mini_library',
    name: 'Thư viện mini',
    category: 'civic',
    isLarge: true,
    description: 'Thư viện chứa đầy sách truyện và tri thức bổ ích (3 môn)',
    cost: { wood: 5, stone: 4, component: 3 },
    image: '/art/town/building-mini-library.webp',
  },
  {
    id: 'village_market',
    name: 'Chợ quê',
    category: 'commercial',
    isLarge: true,
    description: 'Khu chợ nhộn nhịp trao đổi hoa quả nông sản và cá tươi (3 môn)',
    cost: { wood: 4, stone: 3, fish: 3 },
    image: '/art/town/building-village-market.webp',
  },
  {
    id: 'windmill',
    name: 'Cối xay gió',
    category: 'landmark',
    isLarge: true,
    description: 'Cối xay gió thân đá đón những ngọn gió mát lành (3 môn)',
    cost: { wood: 4, stone: 3, component: 2 },
    image: '/art/town/building-windmill.webp',
  },
  {
    id: 'bell_tower',
    name: 'Tháp chuông',
    category: 'landmark',
    isLarge: true,
    description: 'Tháp chuông đá cao vút ngân vang rộn rã mỗi sớm (3 môn)',
    cost: { stone: 6, wood: 3, component: 2 },
    image: '/art/town/building-bell-tower.webp',
  },
  {
    id: 'street_lamp',
    name: 'Đèn đường',
    category: 'civic',
    description: 'Cột đèn đường thắp sáng lung linh lối đi ban đêm (2 môn)',
    cost: { stone: 2, component: 1 },
    image: '/art/town/building-street-lamp.webp',
  },
  {
    id: 'fishing_dock',
    name: 'Bến cá',
    category: 'commercial',
    isLarge: true,
    description: 'Cầu tàu sàn gỗ đón những mẻ cá tươi mới về cảng (2 môn)',
    cost: { wood: 4, fish: 4 },
    image: '/art/town/building-fishing-dock.webp',
  },
]);

export const TOWN_BUILDING_MAP: Map<string, BuildingCatalogItem> = new Map(
  TOWN_BUILDING_CATALOG.map((b) => [b.id, b])
);
