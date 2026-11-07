import type { MapRegionId } from './world-map-contracts';

export interface RegionMetadata {
  id: MapRegionId;
  label: string;
  shortLabel: string;
  themeColor: string;
  accentColor: string;
  landmarkKeys: [string, string, string];
}

export const REGION_METADATA: Record<MapRegionId, RegionMetadata> = {
  math: {
    id: 'math',
    label: 'Toán học — Đảo Số',
    shortLabel: 'Toán',
    themeColor: '#A9C88F',
    accentColor: '#DDE9C7',
    landmarkKeys: [
      'place-math-number-house',
      'place-math-garden',
      'place-math-market',
    ],
  },
  vietnamese: {
    id: 'vietnamese',
    label: 'Tiếng Việt — Rừng Chữ',
    shortLabel: 'Tiếng Việt',
    themeColor: '#7FA77B',
    accentColor: '#E8C5A1',
    landmarkKeys: [
      'place-vietnamese-library',
      'place-vietnamese-word-tree',
      'place-vietnamese-story-house',
    ],
  },
  english: {
    id: 'english',
    label: 'Tiếng Anh — Cảng English',
    shortLabel: 'Tiếng Anh',
    themeColor: '#8FC5D5',
    accentColor: '#E9D6A8',
    landmarkKeys: [
      'place-english-harbor',
      'place-english-lighthouse',
      'place-english-cafe',
    ],
  },
  computing: {
    id: 'computing',
    label: 'Tin học — Phố Robot',
    shortLabel: 'Tin học',
    themeColor: '#B9B0D3',
    accentColor: '#D8E4DE',
    landmarkKeys: [
      'place-computing-workshop',
      'place-computing-keyboard-garden',
      'place-computing-info-station',
    ],
  },
  discovery: {
    id: 'discovery',
    label: 'Vùng Khám Phá',
    shortLabel: 'Khám Phá',
    themeColor: '#D7AA50',
    accentColor: '#F7F3E6',
    landmarkKeys: [
      'place-math-number-house',
      'place-vietnamese-library',
      'place-computing-workshop',
    ],
  },
};

export const WORLD_REGION_ORDER: MapRegionId[] = [
  'math',
  'vietnamese',
  'english',
  'computing',
];

export const REGION_ALIASES: Record<Exclude<MapRegionId, 'discovery'>, string[]> = {
  math: [
    'toan',
    'toan hoc',
    'math',
    'mathematics',
    'toan bang tieng anh',
    'toan tieng anh',
  ],
  vietnamese: [
    'tieng viet',
    'vietnamese',
  ],
  english: [
    'tieng anh',
    'english',
  ],
  computing: [
    'tin hoc',
    'computer science',
    'informatics',
  ],
};

export function normalizeSubjectLabel(label: string | null | undefined): string {
  if (!label) return '';
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveRegionId(subjectLabel: string | null | undefined): MapRegionId {
  const normalized = normalizeSubjectLabel(subjectLabel);
  if (!normalized) return 'discovery';

  for (const [regionId, aliases] of Object.entries(REGION_ALIASES) as [Exclude<MapRegionId, 'discovery'>, string[]][]) {
    if (aliases.includes(normalized)) {
      return regionId;
    }
  }

  return 'discovery';
}
