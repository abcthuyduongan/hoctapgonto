import type {AttemptInput,ContentPack,ModuleId,QuestionOpenReceipt} from './contracts';
import type {OnlineAttemptReceipt,OnlineClass,OnlineDashboard,OnlineIdentity,OnlineMediaAsset,OnlineStudent,OnlineWeek,OnlineRecoveryCapability,OnlineRestorePreview,OnlineStudentSummary,OnlineCompactPlay} from './online-contracts';
import {OnlineRequestTimeoutError,withOnlineDeadline} from './online-request';
import type {OnlineAdminSummary,OnlineAdminSection,OnlineWeekCheck} from './online-contracts';

let csrfToken='';
let mediaMaxBytes=8*1024*1024;
export const getOnlineMediaMaxBytes=()=>mediaMaxBytes;
const expiredListeners=new Set<()=>void>();
export function subscribeOnlineSessionExpired(listener:()=>void){expiredListeners.add(listener);return()=>{expiredListeners.delete(listener);};}
export class OnlineError extends Error {
  readonly status:number;
  constructor(message:string,status:number){super(message);this.name='OnlineError';this.status=status;}
}
async function request<T>(path:string,method='GET',body?:unknown,externalSignal?:AbortSignal):Promise<T>{
  let response:Response,data:unknown;
  try{({response,data}=await withOnlineDeadline(async signal=>{
    const combined=externalSignal?AbortSignal.any([signal,externalSignal]):signal;
    const response=await fetch(`/api/online${path}`,{method,signal:combined,credentials:'include',cache:'no-store',headers:{Accept:'application/json','X-Bao-An-Question-Protocol':'1',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&csrfToken?{'X-CSRF-Token':csrfToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const data:unknown=await response.json().catch(error=>{if(combined.aborted)throw error;return null;});return {response,data};
  },path.startsWith('/restore/')?120_000:30_000));}
  catch(error){if(externalSignal?.aborted)throw new DOMException('Yêu cầu đã hủy.','AbortError');throw new OnlineError(error instanceof OnlineRequestTimeoutError?error.message:'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại; thành tích chỉ được ghi nhận khi máy chủ xác nhận.',0);}
  if(externalSignal?.aborted)throw new DOMException('Yêu cầu đã hủy.','AbortError');
  if(!response.ok){if(response.status===401&&!['/me','/login','/setup'].includes(path)){csrfToken='';expiredListeners.forEach(listener=>listener());}let message=data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:`Máy chủ chưa xử lý được yêu cầu (${response.status}). Hãy thử lại.`;if(response.status>=500&&data&&typeof data==='object'&&'supportId'in data&&typeof data.supportId==='string'&&/^BA-[a-f0-9]{12}$/.test(data.supportId))message+=` Mã hỗ trợ: ${data.supportId}.`;throw new OnlineError(message,response.status);}
  if(data===null)throw new OnlineError('Địa chỉ này chưa phục vụ API quản lý. Bản trên máy cần mở bằng máy chủ quản lý; bản Netlify cần cấu hình Functions và Supabase.',response.status);
  if(path.startsWith('/play')&&response.headers.get('x-bao-an-question-protocol')!=='1')throw new OnlineError('Giao diện và máy chủ chưa cùng phiên bản. Hãy tải lại trang; sao đã lưu vẫn được giữ.',409);
  return data as T;
}
async function identity(path:string,method='GET',body?:unknown){const result=await request<OnlineIdentity>(path,method,body);csrfToken=result.csrfToken;return result;}
async function backup(){
  try{return await withOnlineDeadline(async signal=>{
    const response=await fetch('/api/online/backup',{method:'POST',signal,credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:'{}'});
    if(!response.ok){const data=await response.json().catch(error=>{if(signal.aborted)throw error;return null;});if(response.status===401){csrfToken='';expiredListeners.forEach(listener=>listener());}throw new OnlineError(data?.error??'Chưa tạo được bản sao lưu.',response.status);}
    return response.blob();
  },120_000);}catch(error){if(error instanceof OnlineError)throw error;throw new OnlineError(error instanceof OnlineRequestTimeoutError?error.message:'Chưa kết nối được máy chủ để sao lưu. Hãy thử lại.',0);}
}
const segment=(value:string)=>encodeURIComponent(value);
export const onlineApi={
  status:async()=>{const result=await request<{available:true;configured:boolean;mediaMaxBytes?:number}>('/status');mediaMaxBytes=result.mediaMaxBytes&&result.mediaMaxBytes>0?Math.min(result.mediaMaxBytes,8*1024*1024):8*1024*1024;return result;},
  me:()=>identity('/me'),
  setup:(body:{token:string;name:string;username:string;password:string})=>identity('/setup','POST',body),
  login:(body:{username:string;password:string})=>identity('/login','POST',body),
  logout:async()=>{await request('/logout','POST',{});csrfToken='';},
  changePassword:async(body:{currentPassword:string;newPassword:string})=>{const result=await request<{changed:true;reauthenticate:true}>('/account/password','POST',body);csrfToken='';return result;},
  dashboard:()=>request<OnlineDashboard>('/dashboard'),
  adminSummary:(input:{classId?:string;section:OnlineAdminSection;offset:number;query?:string},signal?:AbortSignal)=>request<OnlineAdminSummary>('/admin/summary?'+new URLSearchParams(Object.fromEntries(Object.entries(input).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)]))).toString(),'GET',undefined,signal),
  adminWeek:(id:string,signal?:AbortSignal)=>request<OnlineWeek>(`/admin/weeks/${segment(id)}`,'GET',undefined,signal),
  adminWeekCheck:(input:{classId:string;title:string;sets:{subjectLabel:string;pack:ContentPack}[];replaceWeekId?:string},signal?:AbortSignal)=>request<OnlineWeekCheck>('/admin/week-check','POST',input,signal),
  adminMedia:(offset=0)=>request<{assets:OnlineMediaAsset[];page:{offset:number;nextOffset:number|null;total:number;limit:20}}>(`/admin/media?offset=${offset}`),
  mediaLookup:(names:string[],signal?:AbortSignal)=>request<OnlineMediaAsset[]>('/admin/media/lookup','POST',{names},signal),
  media:()=>request<OnlineMediaAsset[]>('/media'),
  recovery:()=>request<OnlineRecoveryCapability>('/recovery'),
  backup,
  restorePreview:(base64:string)=>request<OnlineRestorePreview>('/restore/preview','POST',{base64}),
  restoreCommit:async(body:{restoreToken:string;sha256:string;confirm:true})=>{const result=await request<{restored:true;reauthenticate:true;counts:Record<string,number>;preBackupCreated:boolean}>('/restore/commit','POST',body);csrfToken='';return result;},
  uploadMedia:(body:{name:string;mime:string;base64:string},signal?:AbortSignal)=>request<OnlineMediaAsset>('/media','POST',body,signal),
  uploadMediaBatch:(files:{name:string;mime:string;base64:string}[],signal?:AbortSignal)=>request<OnlineMediaAsset[]>('/media/batch','POST',{files},signal),
  createClass:(body:{name:string;grade:number})=>request<OnlineClass>('/classes','POST',body),
  createStudent:(body:{name:string;classId:string;username:string;password?:string})=>request<{student:OnlineStudent;credentials:{username:string;password:string}}>('/students','POST',body),
  updateStudent:(id:string,body:{active?:boolean;classId?:string;name?:string})=>request<OnlineStudent>(`/students/${segment(id)}`,'PATCH',body),
  resetPassword:(id:string)=>request<{username:string;password:string}>(`/students/${segment(id)}/reset-password`,'POST',{}),
  publishWeek:(body:{requestId:string;title:string;classId:string;sets:{subjectLabel:string;subjectId?:string;pack:ContentPack}[];replaceWeekId?:string})=>request<OnlineWeek>('/weeks','POST',body),
  configureWallet:(body:{enabled:boolean;rateVnd:number})=>request('/wallet','POST',body),
  transitionRedemption:(id:string,body:{status:'approved'|'rejected'|'fulfilled';note?:string})=>request(`/redemptions/${segment(id)}/transition`,'POST',body),
  student:()=>request<OnlineStudentSummary>('/student'),
  studentSummary:(cursor='0',signal?:AbortSignal)=>request<OnlineStudentSummary>(`/student/summary?cursor=${segment(cursor)}`,'GET',undefined,signal),
  studentJourney:(cursor='0',signal?:AbortSignal)=>request<OnlineStudentSummary>('/student/journey','POST',{cursor},signal),
  advanceWeek:(body:{weekId:string;requestId:string})=>request<OnlineStudentSummary>('/student/advance-week','POST',body),
  packGames:(id:string,version:number,signal?:AbortSignal)=>request<{packId:string;contentVersion:number;games:{id:ModuleId;label:string}[]}>(`/student/pack/${segment(id)}/${version}/games`,'GET',undefined,signal),
  playCompact:(body:{moduleId:ModuleId;packId:string;contentVersion:number;requestId:string;reviewItemIds?:string[]},signal?:AbortSignal)=>request<OnlineCompactPlay>('/play/compact','POST',body,signal),
  openQuestion:(id:string,itemId:string)=>request<QuestionOpenReceipt>(`/play/${segment(id)}/question-open`,'POST',{itemId}),
  questionHint:(id:string,itemId:string)=>request<{hint:string;hintsUsed:number}>(`/play/${segment(id)}/question-hint`,'POST',{itemId}),
  completeCompact:(id:string)=>request<{state:OnlineStudentSummary;gained:number;tier:number}>(`/play/${segment(id)}/complete-compact`,'POST',{}),
  play:(body:{moduleId:ModuleId;packId:string;contentVersion:number;requestId:string})=>request<OnlineCompactPlay>('/play','POST',body),
  attempt:(id:string,input:AttemptInput)=>request<OnlineAttemptReceipt>(`/play/${segment(id)}/attempt`,'POST',{attemptKey:input.attemptKey,itemId:input.itemId,response:input.response,hintsUsed:input.hintsUsed,elapsedMs:input.elapsedMs}),
  complete:(id:string)=>request<{state:OnlineStudentSummary;gained:number;tier:number}>(`/play/${segment(id)}/complete`,'POST',{}),
  abandon:(id:string)=>request(`/play/${segment(id)}/abandon`,'POST',{}),
  requestRedemption:(body:{requestId:string;title:string;goalVnd:number})=>request('/redemptions','POST',body),
  cancelRedemption:(id:string)=>request(`/redemptions/${segment(id)}/cancel`,'POST',{}),
};
