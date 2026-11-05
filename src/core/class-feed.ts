export type ClassFeedEventType =
  | 'badge_unlock'
  | 'week_complete'
  | 'building_built'
  | 'cheer_received';

export interface ClassFeedEvent {
  id: string;
  classId: string;
  studentId: string;
  studentName: string; // Only public display name, NEVER username
  eventType: ClassFeedEventType;
  details: {
    badgeId?: string;
    badgeTitle?: string;
    badgeIcon?: string;
    weekPosition?: number;
    weekTitle?: string;
    buildingId?: string;
    buildingName?: string;
    buildingIcon?: string;
    cheerCount?: number;
  };
  createdAt: string;
}

export interface ClassFeedResponse {
  enabled: boolean;
  events: ClassFeedEvent[];
}

export interface ClassmateTownSummary {
  studentId: string;
  name: string; // display name only
  buildingsCount: number;
  cheersCount: number;
  animalsCount: number;
}

/**
 * Sanitizes any raw event before broadcasting to class bulletin feed.
 * Strips any sensitive fields: username, balances, stars, question answers, grades.
 */
export function sanitizeClassFeedEvent(raw: any): ClassFeedEvent {
  const allowedDetails: ClassFeedEvent['details'] = {};

  if (raw.details?.badgeId) allowedDetails.badgeId = String(raw.details.badgeId);
  if (raw.details?.badgeTitle) allowedDetails.badgeTitle = String(raw.details.badgeTitle);
  if (raw.details?.badgeIcon) allowedDetails.badgeIcon = String(raw.details.badgeIcon);
  if (typeof raw.details?.weekPosition === 'number') allowedDetails.weekPosition = raw.details.weekPosition;
  if (raw.details?.weekTitle) allowedDetails.weekTitle = String(raw.details.weekTitle);
  if (raw.details?.buildingId) allowedDetails.buildingId = String(raw.details.buildingId);
  if (raw.details?.buildingName) allowedDetails.buildingName = String(raw.details.buildingName);
  if (raw.details?.buildingIcon) allowedDetails.buildingIcon = String(raw.details.buildingIcon);
  if (typeof raw.details?.cheerCount === 'number') allowedDetails.cheerCount = raw.details.cheerCount;

  return {
    id: String(raw.id),
    classId: String(raw.classId || raw.class_id),
    studentId: String(raw.studentId || raw.student_id),
    studentName: String(raw.studentName || raw.student_name || 'Bạn học'),
    eventType: raw.eventType || raw.event_type,
    details: allowedDetails,
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
  };
}

/**
 * Verifies that a feed event adheres strictly to the child privacy rules:
 * - NO username
 * - NO wallet stars balance or material counts
 * - NO question answers or scores
 */
export function verifyPrivacyCompliance(event: ClassFeedEvent): boolean {
  const serialized = JSON.stringify(event).toLowerCase();
  const forbiddenPatterns = [
    'username',
    'balance',
    'password',
    'walletstars',
    'answers',
    'attempt',
    'questionid',
    'correctanswer',
    'rawscore',
  ];

  for (const forbidden of forbiddenPatterns) {
    if (serialized.includes(`"${forbidden}"`)) {
      return false;
    }
  }

  return true;
}
