import type {ContentPack,LearnerProfile,LearningEvent,ModuleId,PlaySession,StudentQuestionPack,AttemptFeedback} from './contracts.ts';
import type {GameReward} from './game-rewards.ts';
import type {RewardRequest} from './learning-contracts.ts';
import type {QuestionRewardProgress,QuestionStarTier} from './question-rewards.ts';
import type {WeeklyPlan} from './weekly-plan.ts';

export interface OnlineUser{id:string;workspaceId:string;username:string;role:'admin'|'student';studentId?:string}
export interface OnlineMediaAsset{id:string;name:string;mime:string;kind:'image'|'audio';size:number;sha256:string}
export interface OnlineIdentity{user:OnlineUser;workspace:{id:string;name:string};csrfToken:string}
export interface OnlineClass{id:string;name:string;grade:number;createdAt:string}
export interface OnlineBalance{earned:number;available:number;pending:number;redeemed:number}
export interface OnlineStudent{id:string;classId:string;name:string;username:string;active:boolean;createdAt:string;balance:OnlineBalance;currentWeek?:string}
export interface OnlinePackRecord{pack:ContentPack;subjectLabel:string;subjectId?:string;games:{id:ModuleId;label:string}[]}
export interface OnlineWeek{id:string;classId:string;title:string;position:number;createdAt:string;sets:OnlinePackRecord[];plan?:WeeklyPlan;closedStudents?:number}
export interface OnlineRedemption extends RewardRequest{studentId:string;studentName:string;classId:string}
export interface OnlineDashboard{classes:OnlineClass[];students:OnlineStudent[];weeks:OnlineWeek[];redemptions:OnlineRedemption[];wallet:{enabled:boolean;rateVnd:number};stats:{students:number;classes:number;questions:number;pendingRequests:number}}
export interface OnlineStudentState{
  student:OnlineStudent;profile:LearnerProfile;className:string;weeks:(Omit<OnlineWeek,'sets'>&{unlocked:boolean;done:boolean;sets:(OnlinePackRecord&{stars:number;done:boolean})[]})[];
  current:{weekId:string;weekTitle:string;subjectLabel:string;pack:ContentPack;games:{id:ModuleId;label:string}[]}|null;
  rewards:GameReward[];balance:OnlineBalance;wallet:{enabled:boolean;rateVnd:number};requests:RewardRequest[];
}
export interface OnlinePlay{session:PlaySession;pack:ContentPack;presentation:ContentPack|StudentQuestionPack}
export type OnlinePackSummary=Pick<ContentPack,'id'|'version'|'title'|'kind'|'subject'|'grade'>&{itemCount:number};
export type OnlineAdminSection='students'|'weeks'|'wallet'|'recovery';
export type OnlineAdminWeek=Omit<OnlineWeek,'sets'>&{sets:(Omit<OnlinePackRecord,'pack'>&{pack:OnlinePackSummary})[]};
export type OnlineAdminSummary=Omit<OnlineDashboard,'weeks'>&{weeks:OnlineAdminWeek[];classId:string;section:OnlineAdminSection;page:{offset:number;nextOffset:number|null;total:number;limit:20}};
export type OnlineWeekCheck={duplicateWeek?:{id:string;title:string};conflictWeek?:{id:string;title:string};revision?:{retained:number;added:number;removed:number};revisionError:string};
export interface OnlineSummarySet{pack:OnlinePackSummary;subjectLabel:string;games:{id:ModuleId;label:string}[];stars:number;done:boolean;questionProgress:QuestionRewardProgress}
export interface OnlineSummaryWeek extends Omit<OnlineWeek,'sets'>{unlocked:boolean;done:boolean;sets:OnlineSummarySet[];current:boolean;closed:boolean;ready:boolean}
export interface OnlineStudentSummary extends Omit<OnlineStudentState,'weeks'|'current'|'rewards'>{
  weeks:OnlineSummaryWeek[];current:(OnlineSummarySet&{weekId:string;weekTitle:string})|null;
  page:{cursor:string;nextCursor:string|null;totalSets:number;totalWeeks:number;limit:20};
  currentWeekSummary:{weekId:string;title:string;position:number;cursor:string;total:number;zero:number;one:number;two:number;three:number;ready:boolean;hasNext:boolean;nextWeekId?:string;nextWeekTitle?:string}|null;
  journey:{weekId:string;position:number}|null;
}
export interface OnlineCompactPlay extends Omit<OnlinePlay,'pack'>{pack:OnlinePackSummary}
export interface OnlineAttemptReceipt{event:LearningEvent;duplicate:boolean;feedback?:AttemptFeedback;questionRewards?:{gained:number;questions:{itemId:string;tier:QuestionStarTier}[];balance?:OnlineBalance}}
export interface OnlineRecoveryCapability{supported:boolean;maxUploadBytes?:number;reason?:string}
export interface OnlineRestorePreview{restoreToken:string;sha256:string;bytes:number;expiresAt:string;schemaVersion:number;counts:Record<string,number>;workspaceNames:string[];activePlays:number;sessionsToRevoke:number}
