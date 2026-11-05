export interface AnimalNeighborDef {
  id: string;
  species: string;
  defaultName: string;
  icon: string;
  requiredWeeks: number;
  description: string;
}

export interface TownAnimalRecord {
  animalId: string;
  species: string;
  name: string;
  arrivedAtWeek: number;
  createdAt: string;
}

export const ANIMAL_CATALOG: AnimalNeighborDef[] = [
  {
    id: 'rabbit',
    species: 'Thỏ Trắng',
    defaultName: 'Thỏ Ngọc',
    icon: '🐰',
    requiredWeeks: 4,
    description: 'Bạn Thỏ Trắng thông thái, rất thích đọc sách và giải đố toán học.',
  },
  {
    id: 'fox',
    species: 'Cáo Nhỏ',
    defaultName: 'Cáo Cam',
    icon: '🦊',
    requiredWeeks: 8,
    description: 'Bạn Cáo Tinh Anh, đầu bếp tài ba của căn bếp quy luật.',
  },
  {
    id: 'bear',
    species: 'Gấu Nâu',
    defaultName: 'Bác Gấu',
    icon: '🐻',
    requiredWeeks: 12,
    description: 'Bạn Gấu Nâu tốt bụng, luôn sẵn sàng giúp đỡ bạn bè xây nhà.',
  },
  {
    id: 'cat',
    species: 'Mèo Con',
    defaultName: 'Mèo Miu',
    icon: '🐱',
    requiredWeeks: 16,
    description: 'Bạn Mèo Con nhanh nhẹn, thích câu cá bên bến tàu.',
  },
  {
    id: 'deer',
    species: 'Hươu Sao',
    defaultName: 'Hươu Vàng',
    icon: '🦌',
    requiredWeeks: 20,
    description: 'Bạn Hươu Sao chăm chỉ, người bảo vệ khu vườn hoa bốn mùa.',
  },
  {
    id: 'squirrel',
    species: 'Sóc Nâu',
    defaultName: 'Sóc Nhí',
    icon: '🐿️',
    requiredWeeks: 24,
    description: 'Bạn Sóc Nâu tinh nghịch, thích leo trèo cối xay gió.',
  },
  {
    id: 'penguin',
    species: 'Cánh Cụt',
    defaultName: 'Cánh Cụt Bo',
    icon: '🐧',
    requiredWeeks: 28,
    description: 'Bạn Cánh Cụt đáng yêu từ miền biển lạnh ghé thăm thị trấn.',
  },
  {
    id: 'panda',
    species: 'Gấu Trúc',
    defaultName: 'Panda Tròn',
    icon: '🐼',
    requiredWeeks: 32,
    description: 'Bạn Gấu Trúc hiền hòa, thích ngồi thư viện đọc truyện tranh.',
  },
];

export const ANIMAL_MAP = new Map<string, AnimalNeighborDef>(
  ANIMAL_CATALOG.map((animal) => [animal.id, animal])
);

/**
 * Get all animals that should have arrived given the number of completed weeks.
 * 1 animal neighbor arrives every 4 completed weeks.
 */
export function getUnlockedAnimals(completedWeeksCount: number): AnimalNeighborDef[] {
  return ANIMAL_CATALOG.filter((animal) => completedWeeksCount >= animal.requiredWeeks);
}

// Inappropriate words list (Vietnamese & English vulgarities / insults)
const BLOCKED_WORDS = [
  'buoi', 'cac', 'cc', 'cl', 'clgt', 'cut', 'dcm', 'dit', 'dkm', 'dm', 'đm', 'địt',
  'cặc', 'lồn', 'đéo', 'đĩ', 'chó', 'ngu', 'cút', 'vcl', 'vl', 'đậu má', 'đụ',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'bastard', 'whore', 'slut'
];

/**
 * Remove Vietnamese accents and special characters for normalized profanity matching.
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

/**
 * Validates the child-provided name for an animal neighbor.
 * Ensures the name is between 2 and 20 characters, contains only valid characters,
 * and passes the profanity filter.
 */
export function validateAnimalName(rawName: string): {
  valid: boolean;
  cleanName?: string;
  error?: string;
} {
  if (typeof rawName !== 'string') {
    return { valid: false, error: 'Tên bạn nhỏ không hợp lệ.' };
  }

  const trimmed = rawName.trim().replace(/\s+/g, ' ');

  if (trimmed.length < 2) {
    return { valid: false, error: 'Tên bạn nhỏ cần có ít nhất 2 ký tự.' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Tên bạn nhỏ không được vượt quá 20 ký tự.' };
  }

  // Reject HTML tags, script attempts, control characters
  if (/[<>{}[\]\\/`^~|]/.test(trimmed)) {
    return { valid: false, error: 'Tên chứa ký tự không được hỗ trợ.' };
  }

  // Profanity check
  const normalized = normalizeText(trimmed);
  const words = normalized.split(/\s+/);

  for (const blocked of BLOCKED_WORDS) {
    // Check if whole word matches or words contains blocked pattern
    if (words.includes(blocked) || normalized === blocked) {
      return { valid: false, error: 'Tên chứa từ ngữ chưa phù hợp với lứa tuổi học sinh.' };
    }
  }

  return { valid: true, cleanName: trimmed };
}
