import type {ContentPack} from './contracts.ts';
import {onlineIdentityHash} from './online-import-identity.ts';

export const WEEKLY_PLAN_VERSION=1 as const;
export const MAX_WEEKLY_SUBJECT_QUESTIONS=12;
export type WeeklySubject={id:string;label:string};
export type WeeklyPlan={version:1;maxQuestionsPerSubject:12;subjects:WeeklySubject[];assignments:Record<string,string>};
export type PlannedSet={subjectLabel:string;subjectId?:string;pack:Pick<ContentPack,'id'|'items'>};
const labelKey=(value:string)=>value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
export const DEFAULT_WEEKLY_SUBJECTS:WeeklySubject[]=[{id:'math',label:'Toán'},{id:'vietnamese',label:'Tiếng Việt'},{id:'english',label:'Tiếng Anh'},{id:'computing',label:'Tin học'}];
const aliases:Record<string,string>={
  'toán':'math',
  'toan':'math',
  'toán học':'math',
  'toan hoc':'math',
  'math':'math',
  'mathematics':'math',
  'tiếng việt':'vietnamese',
  'tieng viet':'vietnamese',
  'vietnamese':'vietnamese',
  'tiếng anh':'english',
  'tieng anh':'english',
  'english':'english',
  'tin học':'computing',
  'tin hoc':'computing',
  'computing':'computing',
  'informatics':'computing',
  'computer science':'computing',
  'tin':'computing',
};
export const CANONICAL_SUBJECT_CODES:Record<string,string>={
  'math':'toan',
  'toan':'toan',
  'vietnamese':'tieng-viet',
  'tieng-viet':'tieng-viet',
  'english':'tieng-anh',
  'tieng-anh':'tieng-anh',
  'computing':'tin-hoc',
  'tin-hoc':'tin-hoc',
};
// These names were opaque subject IDs before the expanded aliases in 4.1.
// Accept their exact historical hashes only when reading an existing snapshot.
const expandedAliasKeys=['toán học','toan hoc','mathematics','tin học','tin hoc','computing','informatics','computer science','tin'];
const historicalSubjectId=(key:string)=>'subject-'+onlineIdentityHash(key).slice(0,24);
const historicalAliases=new Map(expandedAliasKeys.map(key=>[historicalSubjectId(key),aliases[key]]));
export function toCanonicalSubjectCode(subjectIdOrLabel:string):string{
  const key=labelKey(subjectIdOrLabel);
  if(Object.hasOwn(CANONICAL_SUBJECT_CODES,key))return CANONICAL_SUBJECT_CODES[key];
  const historical=historicalAliases.get(key);
  if(historical)return CANONICAL_SUBJECT_CODES[historical];
  if(/^subject-[a-f0-9]{24}$/.test(key))return key;
  const id=weeklySubjectId(subjectIdOrLabel);
  return CANONICAL_SUBJECT_CODES[id]||id;
}
export function weeklySubjectId(label:string):string{const key=labelKey(label);return Object.hasOwn(aliases,key)?aliases[key]:'subject-'+onlineIdentityHash(key).slice(0,24);}
export function summarizeWeeklySubjects(sets:readonly PlannedSet[]){
  const groups=new Map<string,WeeklySubject&{questions:number;easy:number;medium:number;hard:number;sets:number}>();
  for(const set of sets){const id=set.subjectId??weeklySubjectId(set.subjectLabel),group=groups.get(id)??{id,label:set.subjectLabel.trim(),questions:0,easy:0,medium:0,hard:0,sets:0};
    group.sets++;group.questions+=set.pack.items.length;for(const item of set.pack.items)group[item.metadata?.difficulty??'medium']++;groups.set(id,group);}
  return [...groups.values()];
}
export function weeklyPlanErrors(sets:readonly PlannedSet[]):string[]{
  return planErrors(sets,false);
}
function planErrors(sets:readonly PlannedSet[],storedSnapshot:boolean):string[]{
  const errors:string[]=[],labels=new Map<string,string>();
  for(const set of sets){if(typeof set.subjectLabel!=='string'||!set.subjectLabel.trim()||set.subjectLabel.length>120){errors.push('Mỗi bộ cần tên môn từ 1–120 ký tự.');continue;}
    const id=set.subjectId??weeklySubjectId(set.subjectLabel);if(!/^[a-z][a-z0-9-]{1,63}$/.test(id)){errors.push('Mã môn không hợp lệ.');continue;}
    const key=labelKey(set.subjectLabel),prior=labels.get(key);if(prior&&prior!==id)errors.push(`Môn “${set.subjectLabel}” đang được gắn hai mã khác nhau.`);labels.set(key,id);
    const historical=storedSnapshot&&expandedAliasKeys.includes(key)&&id===historicalSubjectId(key);
    if(Object.hasOwn(aliases,key)&&aliases[key]!==id&&!historical)errors.push(`Môn “${set.subjectLabel}” cần dùng mã ${aliases[key]}.`);}
  if(errors.length)return [...new Set(errors)];
  const groups=summarizeWeeklySubjects(sets);if(groups.length<3||groups.length>4)errors.push(`Tuần mới cần 3–4 môn; hiện có ${groups.length} môn. Chọn lại môn trước khi giao.`);
  for(const group of groups)if(group.questions>MAX_WEEKLY_SUBJECT_QUESTIONS)errors.push(`Môn ${group.label} có ${group.questions} câu, vượt tối đa 12 câu/tuần. Chọn lại câu; hệ thống không tự cắt.`);
  return errors;
}
export function createWeeklyPlan(sets:readonly PlannedSet[]):WeeklyPlan{
  const errors=weeklyPlanErrors(sets);if(errors.length)throw new Error(errors.join(' '));
  return{version:1,maxQuestionsPerSubject:12,subjects:summarizeWeeklySubjects(sets).map(({id,label})=>({id,label})),assignments:Object.fromEntries(sets.map(set=>[set.pack.id,set.subjectId??weeklySubjectId(set.subjectLabel)]))};
}
/** Stored snapshots are validated independently of UI defaults, including during recovery. */
export function validateWeeklyPlan(plan:unknown,sets:readonly PlannedSet[]):plan is WeeklyPlan{
  if(!plan||typeof plan!=='object')return false;const value=plan as WeeklyPlan;
  if(value.version!==1||value.maxQuestionsPerSubject!==12||!Array.isArray(value.subjects)||!value.assignments||typeof value.assignments!=='object'||Array.isArray(value.assignments))return false;
  if(Object.keys(value).some(key=>!['version','maxQuestionsPerSubject','subjects','assignments'].includes(key))||Object.keys(value.assignments).length!==sets.length)return false;
  if(value.subjects.some(subject=>!subject||typeof subject.id!=='string'||typeof subject.label!=='string'||!subject.label.trim()||subject.label.length>120)||new Set(value.subjects.map(subject=>subject.id)).size!==value.subjects.length)return false;
  const mapped=sets.map(set=>({...set,subjectId:Object.hasOwn(value.assignments,set.pack.id)?value.assignments[set.pack.id]:''}));
  if(planErrors(mapped,true).length)return false;const ids=new Set(mapped.map(set=>set.subjectId));return value.subjects.length===ids.size&&value.subjects.every(subject=>ids.has(subject.id));
}
