export interface ParentControls {
  workspaceId: string;
  studentId: string;
  hasPin: boolean;
  pinLocked: boolean;
  maxMinutesPerDay: number;
  allowedStartHour: number;
  allowedEndHour: number;
  updatedAt: string;
}

export interface ParentSettingsInput {
  maxMinutesPerDay?: number;
  allowedStartHour?: number;
  allowedEndHour?: number;
}

export interface DayStudyStats {
  date: string;
  dayLabel: string;
  minutes: number;
  questionsCount: number;
}

export interface SubjectStudyStats {
  subject: string;
  subjectLabel: string;
  questionsCount: number;
  firstTryCorrectCount: number;
  firstTryRate: number; // 0 - 100
}

export interface TopWrongQuestion {
  itemId: string;
  prompt: string;
  subjectLabel: string;
  wrongCount: number;
  commonWrongAnswer?: string;
  correctAnswer?: string;
}

export interface ParentWeeklyReport {
  weekTitle: string;
  studentName: string;
  className: string;
  startDate: string;
  endDate: string;
  totalStudyMinutes: number;
  totalQuestionsCompleted: number;
  overallFirstTryRate: number;
  dailyStats: DayStudyStats[];
  subjectStats: SubjectStudyStats[];
  topWrongQuestions: TopWrongQuestion[];
  newBadges: Array<{ id: string; title: string; icon: string; unlockedAt: string }>;
  redeemedGifts: Array<{ id: string; title: string; costStars: number; status: string; requestedAt: string }>;
}

export const MAX_PIN_FAILURES = 5;
export const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/** Returns the current Vietnam date (YYYY-MM-DD) and hour (0-23) in Asia/Ho_Chi_Minh */
export function getVietnamTimeParts(date = new Date()): { dateStr: string; hour: number; minutes: number } {
  const vnDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
  const vnTimeStr = date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }); // HH:MM:SS
  const [hour, minutes] = vnTimeStr.split(':').map(Number);
  return { dateStr: vnDateStr, hour, minutes };
}

/** Checks whether the current time is within allowed study hours */
export function checkCurfewHours(startHour: number, endHour: number, now = new Date()): { allowed: boolean; reason?: string } {
  // 0 start and 24 end means 24/7 allowed
  if (startHour <= 0 && endHour >= 24) {
    return { allowed: true };
  }
  const { hour } = getVietnamTimeParts(now);
  if (hour < startHour || hour >= endHour) {
    return {
      allowed: false,
      reason: `Đã ngoài khung giờ học được phép. Khung giờ quy định là từ ${startHour}h đến ${endHour}h.`,
    };
  }
  return { allowed: true };
}

/** Checks whether today's study minutes exceed the daily limit */
export function checkDailyScreenTime(todayMinutes: number, maxMinutes: number): { allowed: boolean; reason?: string } {
  if (maxMinutes <= 0) {
    return { allowed: true };
  }
  if (todayMinutes >= maxMinutes) {
    return {
      allowed: false,
      reason: `Hôm nay con đã học đủ thời lượng ${maxMinutes} phút do phụ huynh đặt ra. Con hãy nghỉ ngơi và thư giãn nhé!`,
    };
  }
  return { allowed: true };
}

/** Formats elapsed milliseconds into rounded minutes */
export function msToMinutes(ms: number): number {
  if (!ms || ms <= 0) return 0;
  return Math.round((ms / 60000) * 10) / 10;
}
