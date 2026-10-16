import type {AttemptInput,ContentPack,ModuleId} from './contracts';
import type {OnlineAttemptReceipt,OnlineClass,OnlineDashboard,OnlineIdentity,OnlineMediaAsset,OnlinePlay,OnlineStudent,OnlineStudentState,OnlineWeek,OnlineRecoveryCapability,OnlineRestorePreview} from './online-contracts';

let csrfToken='';
let mediaMaxBytes=8*1024*1024;
export const getOnlineMediaMaxBytes=()=>mediaMaxBytes;
const expiredListeners=new Set<()=>void>();
export function subscribeOnlineSessionExpired(listener:()=>void){expiredListeners.add(listener);return()=>{expiredListeners.delete(listener);};}
export class OnlineError extends Error {
  readonly status:number;
  constructor(message:string,status:number){super(message);this.name='OnlineError';this.status=status;}
}
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  let response:Response;
  try{response=await fetch(`/api/online${path}`,{method,credentials:'include',cache:'no-store',headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&csrfToken?{'X-CSRF-Token':csrfToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
  catch{throw new OnlineError('Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại; thành tích chỉ được ghi nhận khi máy chủ xác nhận.',0);}
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok){if(response.status===401&&!['/me','/login','/setup'].includes(path)){csrfToken='';expiredListeners.forEach(listener=>listener());}const message=data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:`Máy chủ chưa xử lý được yêu cầu (${response.status}). Hãy thử lại.`;throw new OnlineError(message,response.status);}
  if(data===null)throw new OnlineError('Địa chỉ này chưa phục vụ API quản lý. Bản trên máy cần mở bằng máy chủ quản lý; bản Netlify cần cấu hình Functions và Supabase.',response.status);
  return data as T;
}
async function identity(path:string,method='GET',body?:unknown){const result=await request<OnlineIdentity>(path,method,body);csrfToken=result.csrfToken;return result;}
async function backup(){
  let response:Response;
  try{response=await fetch('/api/online/backup',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:'{}'});}catch{throw new OnlineError('Chưa kết nối được máy chủ để sao lưu. Hãy thử lại.',0);}
  if(!response.ok){const data=await response.json().catch(()=>null);if(response.status===401){csrfToken='';expiredListeners.forEach(listener=>listener());}throw new OnlineError(data?.error??'Chưa tạo được bản sao lưu.',response.status);}
  return response.blob();
}
const segment=(value:string)=>encodeURIComponent(value);
export const onlineApi={
  status:async()=>{const result=await request<{available:true;configured:boolean;mediaMaxBytes?:number}>('/status');mediaMaxBytes=result.mediaMaxBytes&&result.mediaMaxBytes>0?Math.min(result.mediaMaxBytes,8*1024*1024):8*1024*1024;return result;},
  me:()=>identity('/me'),
  setup:(body:{token:string;name:string;username:string;password:string})=>identity('/setup','POST',body),
  login:(body:{username:string;password:string})=>identity('/login','POST',body),
  logout:async()=>{await request('/logout','POST',{});csrfToken='';},
  dashboard:()=>request<OnlineDashboard>('/dashboard'),
  media:()=>request<OnlineMediaAsset[]>('/media'),
  recovery:()=>request<OnlineRecoveryCapability>('/recovery'),
  backup,
  restorePreview:(base64:string)=>request<OnlineRestorePreview>('/restore/preview','POST',{base64}),
  restoreCommit:async(body:{restoreToken:string;sha256:string;confirm:true})=>{const result=await request<{restored:true;reauthenticate:true;counts:Record<string,number>;preBackupCreated:boolean}>('/restore/commit','POST',body);csrfToken='';return result;},
  uploadMedia:(body:{name:string;mime:string;base64:string})=>request<OnlineMediaAsset>('/media','POST',body),
  createClass:(body:{name:string;grade:number})=>request<OnlineClass>('/classes','POST',body),
  createStudent:(body:{name:string;classId:string;username:string;password?:string})=>request<{student:OnlineStudent;credentials:{username:string;password:string}}>('/students','POST',body),
  updateStudent:(id:string,body:{active?:boolean;classId?:string;name?:string})=>request<OnlineStudent>(`/students/${segment(id)}`,'PATCH',body),
  resetPassword:(id:string)=>request<{username:string;password:string}>(`/students/${segment(id)}/reset-password`,'POST',{}),
  publishWeek:(body:{requestId:string;title:string;classId:string;sets:{subjectLabel:string;pack:ContentPack}[];replaceWeekId?:string})=>request<OnlineWeek>('/weeks','POST',body),
  configureWallet:(body:{enabled:boolean;rateVnd:number})=>request('/wallet','POST',body),
  transitionRedemption:(id:string,body:{status:'approved'|'rejected'|'fulfilled';note?:string})=>request(`/redemptions/${segment(id)}/transition`,'POST',body),
  student:()=>request<OnlineStudentState>('/student'),
  play:(body:{moduleId:ModuleId;packId:string;contentVersion:number;requestId:string})=>request<OnlinePlay>('/play','POST',body),
  attempt:(id:string,input:AttemptInput)=>request<OnlineAttemptReceipt>(`/play/${segment(id)}/attempt`,'POST',{attemptKey:input.attemptKey,itemId:input.itemId,response:input.response,hintsUsed:input.hintsUsed,elapsedMs:input.elapsedMs}),
  complete:(id:string)=>request<{state:OnlineStudentState;gained:number;tier:number}>(`/play/${segment(id)}/complete`,'POST',{}),
  abandon:(id:string)=>request(`/play/${segment(id)}/abandon`,'POST',{}),
  requestRedemption:(body:{requestId:string;title:string;goalVnd:number})=>request('/redemptions','POST',body),
  cancelRedemption:(id:string)=>request(`/redemptions/${segment(id)}/cancel`,'POST',{}),
};
