import type {ContentPack,LearnerProfile,LearningEvent,ModuleId,PlaySession} from './contracts.ts';
import type {GameReward} from './game-rewards.ts';
import type {RewardRequest} from './learning-contracts.ts';

export interface OnlineUser{id:string;workspaceId:string;username:string;role:'admin'|'student';studentId?:string}
export interface OnlineMediaAsset{id:string;name:string;mime:string;kind:'image'|'audio';size:number;sha256:string}
export interface OnlineIdentity{user:OnlineUser;workspace:{id:string;name:string};csrfToken:string}
export interface OnlineClass{id:string;name:string;grade:number;createdAt:string}
export interface OnlineBalance{earned:number;available:number;pending:number;redeemed:number}
export interface OnlineStudent{id:string;classId:string;name:string;username:string;active:boolean;createdAt:string;balance:OnlineBalance;currentWeek?:string}
export interface OnlinePackRecord{pack:ContentPack;subjectLabel:string;games:{id:ModuleId;label:string}[]}
export interface OnlineWeek{id:string;classId:string;title:string;position:number;createdAt:string;sets:OnlinePackRecord[]}
export interface OnlineRedemption extends RewardRequest{studentId:string;studentName:string;classId:string}
export interface OnlineDashboard{classes:OnlineClass[];students:OnlineStudent[];weeks:OnlineWeek[];redemptions:OnlineRedemption[];wallet:{enabled:boolean;rateVnd:number};stats:{students:number;classes:number;questions:number;pendingRequests:number}}
export interface OnlineStudentState{
  student:OnlineStudent;profile:LearnerProfile;className:string;weeks:(Omit<OnlineWeek,'sets'>&{unlocked:boolean;done:boolean;sets:(OnlinePackRecord&{stars:number;done:boolean})[]})[];
  current:{weekId:string;weekTitle:string;subjectLabel:string;pack:ContentPack;games:{id:ModuleId;label:string}[]}|null;
  rewards:GameReward[];balance:OnlineBalance;wallet:{enabled:boolean;rateVnd:number};requests:RewardRequest[];
}
export interface OnlinePlay{session:PlaySession;pack:ContentPack;presentation:ContentPack}
export interface OnlineAttemptReceipt{event:LearningEvent;duplicate:boolean}
export interface OnlineRecoveryCapability{supported:boolean;maxUploadBytes?:number;reason?:string}
export interface OnlineRestorePreview{restoreToken:string;sha256:string;bytes:number;expiresAt:string;schemaVersion:number;counts:Record<string,number>;workspaceNames:string[];activePlays:number;sessionsToRevoke:number}
