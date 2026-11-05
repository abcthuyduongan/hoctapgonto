// src/core/badges.ts
// Hệ thống huy hiệu, chuỗi ngày và nhiệm vụ ngày cho Bảo An Learning (Tuần 4 - Cổng C4)

export type BadgeCategory = 'streak' | 'accuracy' | 'persistence' | 'subject' | 'discovery';
export type BadgeDifficulty = 'easy' | 'medium' | 'hard';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  difficulty: BadgeDifficulty;
  category: BadgeCategory;
  icon: string;
  targetCount: number;
  conditionDescription: string;
}

export interface StudentBadgeStatus extends BadgeDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
  currentProgress: number;
  percent: number;
  missingRequirement: string;
}

export interface StudentStreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezeUsedWeek: string | null;
  todayCorrectCount: number;
  todayQualified: boolean;
  canUseFreezeThisWeek: boolean;
  statusMessage: string;
}

export type DailyMissionType = 'new_lesson' | 'review_error' | 'daily_riddle';

export interface DailyMission {
  id: string;
  date: string;
  type: DailyMissionType;
  title: string;
  description: string;
  targetCount: number;
  progressCount: number;
  completed: boolean;
  completedAt: string | null;
}

export interface DailyRiddleQuestion {
  packId: string;
  packTitle: string;
  itemId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  alreadySolved: boolean;
}

// 12 Huy hiệu khởi đầu theo kế hoạch Tuần 4
export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: 'streak_7',
    title: 'Chăm chỉ',
    description: 'Học tập chăm chỉ 7 ngày liên tiếp (mỗi ngày trả lời đúng ít nhất 5 câu).',
    difficulty: 'medium',
    category: 'streak',
    icon: 'flame',
    targetCount: 7,
    conditionDescription: 'Đạt chuỗi học tập liên tục 7 ngày.',
  },
  {
    id: 'fix_10_errors',
    title: 'Sửa sai giỏi',
    description: 'Làm đúng lại 10 câu hỏi mà con từng trả lời sai.',
    difficulty: 'easy',
    category: 'persistence',
    icon: 'refresh-cw',
    targetCount: 10,
    conditionDescription: 'Làm đúng lại 10 câu từng trả lời sai.',
  },
  {
    id: 'perfect_memory',
    title: 'Trí nhớ siêu đẳng',
    description: 'Hoàn thành một bàn Trí Nhớ mà không lật sai lần nào.',
    difficulty: 'medium',
    category: 'accuracy',
    icon: 'sparkles',
    targetCount: 1,
    conditionDescription: 'Hoàn thành 1 bài Trí Nhớ với số lần lật bằng đúng số cặp thẻ.',
  },
  {
    id: 'perfect_week',
    title: 'Tuần hoàn hảo',
    description: 'Hoàn thành trọn vẹn một tuần học đạt 100% 3 sao ở tất cả các bài.',
    difficulty: 'hard',
    category: 'accuracy',
    icon: 'crown',
    targetCount: 1,
    conditionDescription: 'Đạt 3 sao cho tất cả các bài tập trong 1 tuần học.',
  },
  {
    id: 'explorer_all_games',
    title: 'Nhà thám hiểm',
    description: 'Chơi thử ít nhất 3 thể loại trò chơi học tập khác nhau.',
    difficulty: 'easy',
    category: 'discovery',
    icon: 'compass',
    targetCount: 3,
    conditionDescription: 'Trải nghiệm 3 trò chơi học tập khác nhau.',
  },
  {
    id: 'speedy_10_perfect',
    title: 'Thần tốc',
    description: 'Trả lời đúng ngay lần đầu 10 câu hỏi liên tiếp.',
    difficulty: 'medium',
    category: 'accuracy',
    icon: 'zap',
    targetCount: 10,
    conditionDescription: 'Đạt chuỗi 10 câu trả lời đúng lần đầu liên tiếp.',
  },
  {
    id: 'first_lesson',
    title: 'Khởi đầu tuyệt vời',
    description: 'Hoàn thành bài tập đầu tiên trên hành trình học tập.',
    difficulty: 'easy',
    category: 'discovery',
    icon: 'rocket',
    targetCount: 1,
    conditionDescription: 'Hoàn thành 1 bài tập bất kỳ.',
  },
  {
    id: 'persistent_50_questions',
    title: 'Bền bỉ vượt khó',
    description: 'Trả lời tích lũy 50 câu hỏi trên hệ thống.',
    difficulty: 'easy',
    category: 'persistence',
    icon: 'target',
    targetCount: 50,
    conditionDescription: 'Trả lời tổng cộng 50 câu hỏi.',
  },
  {
    id: 'math_genius_5',
    title: 'Thần đồng Toán học',
    description: 'Đạt trọn vẹn 3 sao ở 5 bài tập môn Toán.',
    difficulty: 'medium',
    category: 'subject',
    icon: 'calculator',
    targetCount: 5,
    conditionDescription: 'Đạt 3 sao ở 5 bài tập Toán.',
  },
  {
    id: 'vietnamese_master_5',
    title: 'Bậc thầy Tiếng Việt',
    description: 'Đạt trọn vẹn 3 sao ở 5 bài tập môn Tiếng Việt.',
    difficulty: 'medium',
    category: 'subject',
    icon: 'book-open',
    targetCount: 5,
    conditionDescription: 'Đạt 3 sao ở 5 bài tập Tiếng Việt.',
  },
  {
    id: 'english_star_5',
    title: 'Ngôi sao Tiếng Anh',
    description: 'Đạt trọn vẹn 3 sao ở 5 bài tập môn Tiếng Anh.',
    difficulty: 'medium',
    category: 'subject',
    icon: 'globe',
    targetCount: 5,
    conditionDescription: 'Đạt 3 sao ở 5 bài tập Tiếng Anh.',
  },
  {
    id: 'streak_14',
    title: 'Chiến binh kiên cường',
    description: 'Duy trì chuỗi học tập liên tục suốt 14 ngày.',
    difficulty: 'hard',
    category: 'streak',
    icon: 'shield',
    targetCount: 14,
    conditionDescription: 'Đạt chuỗi học tập liên tục 14 ngày.',
  },
];

/**
 * Chuyển timestamp ISO hoặc Date sang ngày YYYY-MM-DD theo giờ Việt Nam (UTC+7, Asia/Ho_Chi_Minh).
 */
export function toVietnamDateString(dateInput: Date | string | number = new Date()): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Tính ngày Thứ Hai (bắt đầu tuần) của một ngày theo giờ Việt Nam.
 */
export function getVietnamWeekKey(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  const dayOfWeek = dt.getUTCDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(dt.getTime() - diffToMonday * 86400000);
  return monday.toISOString().slice(0, 10);
}

/**
 * Tính số ngày cách biệt giữa hai ngày định dạng YYYY-MM-DD (d2 - d1).
 */
export function dayDifference(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

export const DAILY_STREAK_TARGET_CORRECT = 5;

/**
 * Tính toán trạng thái chuỗi ngày (Streak) từ dữ liệu lưu trữ và thời điểm hiện tại.
 */
export function computeStreakState(
  record: {
    current_streak?: number;
    longest_streak?: number;
    last_active_date?: string | null;
    freeze_used_week?: string | null;
    today_correct_count?: number;
    today_date?: string;
  } | null,
  nowIso: string = new Date().toISOString()
): StudentStreakState {
  const today = toVietnamDateString(nowIso);
  const currentWeek = getVietnamWeekKey(today);

  const rawLastActive = record?.last_active_date ?? null;
  const rawCurrentStreak = record?.current_streak ?? 0;
  const rawLongestStreak = record?.longest_streak ?? 0;
  const freezeUsedWeek = record?.freeze_used_week ?? null;
  const recordedTodayDate = record?.today_date ?? null;

  // Nếu record lưu số câu đúng của hôm nay, kiểm tra xem có đúng là của ngày hôm nay không
  const todayCorrectCount = recordedTodayDate === today ? (record?.today_correct_count ?? 0) : 0;
  const todayQualified = todayCorrectCount >= DAILY_STREAK_TARGET_CORRECT;

  const canUseFreezeThisWeek = freezeUsedWeek !== currentWeek;

  // Kiểm tra chuỗi còn hiệu lực không
  let activeStreak = rawCurrentStreak;
  if (rawLastActive) {
    const diff = dayDifference(rawLastActive, today);
    if (diff === 0) {
      // Hôm nay đã active
      activeStreak = rawCurrentStreak;
    } else if (diff === 1) {
      // Hôm qua active, hôm nay chưa hoặc đang học -> chuỗi vẫn giữ nguyên chờ hôm nay
      activeStreak = rawCurrentStreak;
    } else if (diff === 2) {
      // Bỏ lỡ 1 ngày hôm qua
      if (!canUseFreezeThisWeek) {
        // Đã dùng freeze trong tuần -> chuỗi bị ngắt
        activeStreak = 0;
      }
      // Nếu chưa dùng freeze trong tuần, chuỗi được bảo lưu nhờ freeze
    } else if (diff > 2) {
      // Bỏ lỡ từ 2 ngày trở lên -> chuỗi bị ngắt
      activeStreak = 0;
    }
  }

  let statusMessage = '';
  if (todayQualified) {
    statusMessage = `Tuyệt vời! Con đã hoàn thành ${todayCorrectCount} câu đúng hôm nay để giữ chuỗi 🔥`;
  } else {
    const remaining = Math.max(0, DAILY_STREAK_TARGET_CORRECT - todayCorrectCount);
    statusMessage = `Làm đúng thêm ${remaining} câu hôm nay để giữ chuỗi 🔥`;
  }

  return {
    currentStreak: activeStreak,
    longestStreak: Math.max(rawLongestStreak, activeStreak),
    lastActiveDate: rawLastActive,
    freezeUsedWeek,
    todayCorrectCount,
    todayQualified,
    canUseFreezeThisWeek,
    statusMessage,
  };
}

/**
 * Xử lý khi học sinh trả lời 1 câu: cập nhật số câu đúng và chuỗi ngày.
 */
export function registerDailyCorrectAnswer(
  currentRecord: {
    current_streak?: number;
    longest_streak?: number;
    last_active_date?: string | null;
    freeze_used_week?: string | null;
    today_correct_count?: number;
    today_date?: string;
  } | null,
  wasCorrect: boolean,
  nowIso: string = new Date().toISOString()
): {
  newStreakRecord: {
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
    freeze_used_week: string | null;
    today_correct_count: number;
    today_date: string;
  };
  streakIncreased: boolean;
  qualifiedToday: boolean;
} {
  const today = toVietnamDateString(nowIso);
  const currentWeek = getVietnamWeekKey(today);

  let todayCorrect = (currentRecord?.today_date === today ? (currentRecord?.today_correct_count ?? 0) : 0);
  if (wasCorrect) {
    todayCorrect += 1;
  }

  let currentStreak = currentRecord?.current_streak ?? 0;
  let longestStreak = currentRecord?.longest_streak ?? 0;
  let lastActive = currentRecord?.last_active_date ?? null;
  let freezeUsedWeek = currentRecord?.freeze_used_week ?? null;
  let streakIncreased = false;

  const qualifiedToday = todayCorrect >= DAILY_STREAK_TARGET_CORRECT;

  // Nếu hôm nay vừa đủ điều kiện (hoặc đã đủ) và chưa được ghi nhận vào lastActive
  if (qualifiedToday && lastActive !== today) {
    if (!lastActive) {
      // Lần đầu tiên đạt streak
      currentStreak = 1;
      streakIncreased = true;
    } else {
      const diff = dayDifference(lastActive, today);
      if (diff === 1) {
        // Ngày liền kề
        currentStreak += 1;
        streakIncreased = true;
      } else if (diff === 2) {
        // Nghỉ đúng 1 ngày
        if (freezeUsedWeek !== currentWeek) {
          // Dùng quyền nghỉ phép 1 ngày trong tuần
          freezeUsedWeek = currentWeek;
          currentStreak += 1;
          streakIncreased = true;
        } else {
          // Hết quyền nghỉ phép -> bắt đầu lại
          currentStreak = 1;
        }
      } else {
        // Nghỉ >= 2 ngày -> bắt đầu lại
        currentStreak = 1;
      }
    }
    lastActive = today;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return {
    newStreakRecord: {
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_active_date: lastActive,
      freeze_used_week: freezeUsedWeek,
      today_correct_count: todayCorrect,
      today_date: today,
    },
    streakIncreased,
    qualifiedToday,
  };
}

/**
 * Tạo danh sách 3 nhiệm vụ ngày chuẩn theo ngày YYYY-MM-DD.
 */
export function buildDailyMissions(dateStr: string): DailyMission[] {
  return [
    {
      id: `${dateStr}:new_lesson`,
      date: dateStr,
      type: 'new_lesson',
      title: 'Bài tập mới',
      description: 'Hoàn thành 1 bài tập trong tuần học hiện tại.',
      targetCount: 1,
      progressCount: 0,
      completed: false,
      completedAt: null,
    },
    {
      id: `${dateStr}:review_error`,
      date: dateStr,
      type: 'review_error',
      title: 'Sửa sai ôn luyện',
      description: 'Làm đúng 1 câu hỏi con từng trả lời sai hoặc chỉ đạt 1 sao.',
      targetCount: 1,
      progressCount: 0,
      completed: false,
      completedAt: null,
    },
    {
      id: `${dateStr}:daily_riddle`,
      date: dateStr,
      type: 'daily_riddle',
      title: 'Câu đố hôm nay',
      description: 'Trả lời đúng câu đố nhanh của ngày hôm nay.',
      targetCount: 1,
      progressCount: 0,
      completed: false,
      completedAt: null,
    },
  ];
}

/**
 * Đánh giá tiến độ từng huy hiệu và tạo thông báo rõ ràng "còn thiếu gì để có huy hiệu kế tiếp".
 */
export function buildStudentBadgeStatuses(
  earnedBadges: { badgeId: string; unlockedAt: string; json?: string }[],
  metrics: {
    streak: StudentStreakState;
    retryFixedCount: number;
    perfectMemoryCount: number;
    perfectWeekCount: number;
    distinctGamesPlayed: number;
    consecutiveFirstTryCount: number;
    completedPacksCount: number;
    totalQuestionsAttempted: number;
    mathPacks3Star: number;
    vietnamesePacks3Star: number;
    englishPacks3Star: number;
  }
): StudentBadgeStatus[] {
  const earnedMap = new Map(earnedBadges.map((b) => [b.badgeId, b.unlockedAt]));

  return BADGE_CATALOG.map((def) => {
    const isUnlocked = earnedMap.has(def.id);
    const unlockedAt = earnedMap.get(def.id) ?? null;

    let currentProgress = 0;
    let missingRequirement = '';

    switch (def.id) {
      case 'streak_7': {
        currentProgress = metrics.streak.longestStreak;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Còn thiếu ${remain} ngày học liên tiếp nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'fix_10_errors': {
        currentProgress = metrics.retryFixedCount;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Cần sửa đúng thêm ${remain} câu từng sai nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'perfect_memory': {
        currentProgress = metrics.perfectMemoryCount;
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : 'Cần hoàn thành 1 bàn Trí Nhớ mà không lật sai lần nào.';
        break;
      }
      case 'perfect_week': {
        currentProgress = metrics.perfectWeekCount;
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : 'Cần hoàn thành 1 tuần học đạt 100% 3 sao tất cả các bài.';
        break;
      }
      case 'explorer_all_games': {
        currentProgress = metrics.distinctGamesPlayed;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Cần trải nghiệm thêm ${remain} trò chơi học tập nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'speedy_10_perfect': {
        currentProgress = metrics.consecutiveFirstTryCount;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Cần thêm ${remain} câu đúng lần đầu liên tiếp nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'first_lesson': {
        currentProgress = metrics.completedPacksCount;
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : 'Cần hoàn thành 1 bài tập đầu tiên.';
        break;
      }
      case 'persistent_50_questions': {
        currentProgress = metrics.totalQuestionsAttempted;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Cần trả lời thêm ${remain} câu hỏi nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'math_genius_5': {
        currentProgress = metrics.mathPacks3Star;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Cần thêm ${remain} bài Toán 3 sao nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'vietnamese_master_5': {
        currentProgress = metrics.vietnamesePacks3Star;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Cần thêm ${remain} bài Tiếng Việt 3 sao nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'english_star_5': {
        currentProgress = metrics.englishPacks3Star;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Cần thêm ${remain} bài Tiếng Anh 3 sao nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      case 'streak_14': {
        currentProgress = metrics.streak.longestStreak;
        const remain = Math.max(0, def.targetCount - currentProgress);
        missingRequirement = isUnlocked
          ? 'Đã mở khóa huy hiệu!'
          : `Còn thiếu ${remain} ngày học liên tiếp nữa (hiện đạt ${currentProgress}/${def.targetCount}).`;
        break;
      }
      default:
        missingRequirement = isUnlocked ? 'Đã đạt' : 'Chưa đạt';
    }

    const percent = Math.min(100, Math.floor((Math.min(currentProgress, def.targetCount) / def.targetCount) * 100));

    return {
      ...def,
      unlocked: isUnlocked,
      unlockedAt,
      currentProgress,
      percent,
      missingRequirement,
    };
  });
}
