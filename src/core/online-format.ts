import type {RewardRequestStatus} from './learning-contracts';

export const onlineMoney=(value:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(value);
export const onlineTime=(value:string)=>new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
export const onlineRewardStatus:Record<RewardRequestStatus,string>={pending:'Chờ quản trị viên duyệt',approved:'Đã duyệt · chờ trao',fulfilled:'Đã trao tiền / quà',cancelled:'Đã hủy',rejected:'Đã từ chối'};
