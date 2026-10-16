import type { CurriculumSnapshot,RewardRequest,RewardRequestStatus,RewardWallet,SessionResult } from './learning-contracts.ts';
import { rebuildLessonProgress,totalRewardStars } from './curriculum.ts';
import { earnedGameStars,gameRewardAwards,type GameRewardEvidence } from './game-rewards.ts';

export const REWARD_WALLET_LIMITS={requests:500,rateVnd:1_000_000,goalVnd:100_000_000,stars:100_000} as const;
const statuses=new Set<RewardRequestStatus>(['pending','approved','fulfilled','cancelled','rejected']);
const reserved=new Set<RewardRequestStatus>(['pending','approved','fulfilled']);
const validTime=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const integer=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const object=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).every(key=>typeof key==='string'&&keys.includes(key)&&!!Object.getOwnPropertyDescriptor(value,key)&&'value'in Object.getOwnPropertyDescriptor(value,key)!);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);
export const rewardStatus=(request:RewardRequest):RewardRequestStatus=>request.history.at(-1)!.status;
export function rewardBalance(earned:number,wallet?:RewardWallet){const requests=wallet?.requests??[];const held=requests.filter(row=>reserved.has(rewardStatus(row))).reduce((sum,row)=>sum+row.stars,0);
  return {earned,available:earned-held,pending:requests.filter(row=>['pending','approved'].includes(rewardStatus(row))).reduce((sum,row)=>sum+row.stars,0),redeemed:requests.filter(row=>rewardStatus(row)==='fulfilled').reduce((sum,row)=>sum+row.stars,0)};}
export const earnedRewardStars=(profileId:string,results:SessionResult[],curricula:CurriculumSnapshot[],at?:string,games?:GameRewardEvidence)=>totalRewardStars(rebuildLessonProgress(results.filter(row=>row.profileId===profileId&&(!at||row.completedAt<=at)),curricula),profileId)+(games?earnedGameStars(games,profileId,at):0);
export function validateRewardWallet(input:unknown,evidence?:{profileId:string;results:SessionResult[];curricula:CurriculumSnapshot[];notAfter?:string}&Partial<GameRewardEvidence>):string[]{
  const errors:string[]=[];const fail=(reason:string)=>errors.push(`Ví đổi thưởng: ${reason}`);
  if(!object(input,['schemaVersion','enabled','rateVnd','updatedAt','requests']))return ['Ví đổi thưởng: cấu trúc không hợp lệ.'];
  if(input.schemaVersion!==1||typeof input.enabled!=='boolean'||!integer(input.rateVnd,1,REWARD_WALLET_LIMITS.rateVnd)||!validTime(input.updatedAt))fail('cài đặt/tỷ lệ/thời gian không hợp lệ.');
  if(!Array.isArray(input.requests)||input.requests.length>REWARD_WALLET_LIMITS.requests)return [...errors,'Ví đổi thưởng: tối đa 500 yêu cầu.'];
  const ids=new Set<string>();
  for(const value of input.requests){
    if(!object(value,['requestId','title','goalVnd','stars','rateVnd','amountVnd','requestedAt','history'])){fail('yêu cầu sai cấu trúc.');continue;}
    if(!text(value.requestId,100)||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.requestId)||ids.has(value.requestId))fail('mã yêu cầu không hợp lệ hoặc trùng.');else ids.add(value.requestId);
    if(!text(value.title,120)||!integer(value.goalVnd,1,REWARD_WALLET_LIMITS.goalVnd)||!integer(value.stars,1,REWARD_WALLET_LIMITS.stars)||!integer(value.rateVnd,1,REWARD_WALLET_LIMITS.rateVnd)||!integer(value.amountVnd,1,REWARD_WALLET_LIMITS.goalVnd)||value.amountVnd!==Number(value.stars)*Number(value.rateVnd))fail('món đồ/sao/số tiền hoặc tỷ lệ không khớp.');
    if(integer(value.goalVnd,1,REWARD_WALLET_LIMITS.goalVnd)&&integer(value.rateVnd,1,REWARD_WALLET_LIMITS.rateVnd)&&value.stars!==Math.ceil(value.goalVnd/value.rateVnd))fail('số sao không khớp mục tiêu.');
    if(!validTime(value.requestedAt)||!Array.isArray(value.history)||value.history.length<1||value.history.length>3){fail('lịch sử thời gian không hợp lệ.');continue;}
    let previous:RewardRequestStatus|undefined,lastTime=value.requestedAt;
    for(const step of value.history){
      if(!object(step,['status','at','note'])||typeof step.status!=='string'||!statuses.has(step.status as RewardRequestStatus)||!validTime(step.at)||('note'in step&&!text(step.note,300))){fail('lịch sử trạng thái không hợp lệ.');continue;}
      const current=step.status as RewardRequestStatus;
      if(previous===undefined?(current!=='pending'||step.at!==value.requestedAt):previous==='pending'?!['approved','cancelled','rejected'].includes(current):previous==='approved'?current!=='fulfilled':true)fail('thứ tự trạng thái không hợp lệ.');
      if(step.at<lastTime||validTime(input.updatedAt)&&step.at>input.updatedAt)fail('thời điểm trạng thái bị lùi hoặc vượt thời điểm cập nhật ví.');
      previous=current;lastTime=step.at;
    }
  }
  if(evidence&&validTime(input.updatedAt)&&evidence.notAfter&&input.updatedAt>evidence.notAfter)fail('cập nhật sau thời điểm hồ sơ/sao lưu.');
  if(errors.length||!evidence)return errors;
  const wallet=input as unknown as RewardWallet;
  // Ties follow the persisted request order. Each request's state machine is
  // monotonic, and a cancellation releases only its own existing reservation.
  const events=wallet.requests.flatMap((row,order)=>row.history.map((step,index)=>({row,step,index,order}))).sort((a,b)=>a.step.at.localeCompare(b.step.at)||a.order-b.order||a.index-b.index);
  const games=evidence.sessions&&evidence.events&&evidence.packs?{sessions:evidence.sessions,events:evidence.events,packs:evidence.packs}:undefined;
  const awards=[...evidence.results.filter(row=>row.profileId===evidence.profileId).map(row=>({completedAt:row.completedAt,rewardGroupId:JSON.stringify(['lesson',row.rewardGroupId]),starTier:row.starTier})),
    ...(games?gameRewardAwards(games,evidence.profileId).map(row=>({completedAt:row.completedAt,rewardGroupId:JSON.stringify(['game',row.packId]),starTier:row.starTier})):[])].sort((a,b)=>a.completedAt.localeCompare(b.completedAt)),groups=new Map<string,number>();
  let held=0,earned=0,nextAward=0;
  for(const {row,step,index} of events){if(index===0)held+=row.stars;else if(step.status==='cancelled'||step.status==='rejected')held-=row.stars;
    while(nextAward<awards.length&&awards[nextAward].completedAt<=step.at){const award=awards[nextAward++],old=groups.get(award.rewardGroupId)??0,next=Math.max(old,award.starTier);groups.set(award.rewardGroupId,next);earned+=next-old;}
    if(held>earned){fail('yêu cầu sử dụng nhiều sao hơn thành tích đã có tại thời điểm đó.');break;}}
  return errors;
}

export function makeRewardRequest(wallet:RewardWallet,earned:number,input:{requestId:string;title:string;goalVnd:number},now:string):RewardRequest{
  const prior=wallet.requests.find(row=>row.requestId===input.requestId);
  if(prior){if(prior.title!==input.title.trim()||prior.goalVnd!==input.goalVnd)throw new Error('Mã đổi thưởng đã được dùng cho yêu cầu khác.');return prior;}
  if(!wallet.enabled)throw new Error('Phụ huynh chưa bật đổi sao cho hồ sơ này.');
  if(wallet.requests.length>=REWARD_WALLET_LIMITS.requests)throw new Error('Ví đã có 500 yêu cầu. Hãy giữ bản sao lưu lịch sử trước khi bắt đầu hồ sơ mới.');
  const stars=Math.ceil(input.goalVnd/wallet.rateVnd),request:RewardRequest={...input,title:input.title.trim(),stars,rateVnd:wallet.rateVnd,amountVnd:stars*wallet.rateVnd,requestedAt:now,history:[{status:'pending',at:now}]};
  const errors=validateRewardWallet({...wallet,updatedAt:now,requests:[...wallet.requests,request]});if(errors.length)throw new Error(errors[0]);
  if(stars>rewardBalance(earned,wallet).available)throw new Error('Con chưa đủ sao khả dụng cho mục tiêu này.');
  return request;
}
export function changeRewardRequest(request:RewardRequest,status:Exclude<RewardRequestStatus,'pending'>,now:string,note?:string):RewardRequest{
  const current=rewardStatus(request);if(current===status)return request;
  if(current==='pending'?!['approved','cancelled','rejected'].includes(status):current==='approved'?status!=='fulfilled':true)throw new Error('Yêu cầu đã đổi trạng thái. Hãy tải lại lịch sử.');
  if(!validTime(now)||now<request.history.at(-1)!.at)throw new Error('Thời gian thiết bị đang lùi. Hãy kiểm tra đồng hồ rồi thử lại.');
  return {...request,history:[...request.history,{status,at:now,...(note?.trim()?{note:note.trim()}: {})}]};
}
