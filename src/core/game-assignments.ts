import type { ContentPack,ModuleId } from './contracts.ts';
import type { CurriculumSnapshot,GameAssignment } from './learning-contracts.ts';
import { compatible,packKey,validatePack } from './validation.ts';

const modules=new Set<ModuleId>(['math-quest','memory-match','sentence-builder','word-connect','sequence-trail']);
export const isGameModuleId=(value:unknown):value is ModuleId=>typeof value==='string'&&modules.has(value as ModuleId);
const object=(value:unknown,keys:string[]):value is Record<string,unknown>=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return false;
  return Reflect.ownKeys(value).every(key=>typeof key==='string'&&keys.includes(key)&&'value'in Object.getOwnPropertyDescriptor(value,key)!&&Object.getOwnPropertyDescriptor(value,key)!.enumerable);
};
export function validateGameAssignments(input:unknown):string[]{
  if(!object(input,[...modules]))return ['Gán bộ câu hỏi: danh sách game không hợp lệ.'];
  const errors:string[]=[];
  for(const [moduleId,value]of Object.entries(input)){
    if(!object(value,['packId','contentVersion'])||typeof value.packId!=='string'||!/^[a-z0-9-]{3,80}$/.test(value.packId)
      ||typeof value.contentVersion!=='number'||!Number.isInteger(value.contentVersion)||value.contentVersion<1)errors.push(`Gán bộ câu hỏi ${moduleId}: cần mã bộ và phiên bản chính xác.`);
  }
  return errors;
}

/** Both the parent picker and the host use the same protected assessment set. */
export function gameAssignmentChoices(moduleId:ModuleId,packs:ContentPack[],curricula:CurriculumSnapshot[]):ContentPack[]{
  if(!isGameModuleId(moduleId))return [];
  const reserved=new Set(curricula.flatMap(curriculum=>curriculum.lessons).flatMap(lesson=>lesson.forms)
    .filter(form=>form.role!=='practice').flatMap(form=>form.itemRefs).map(ref=>packKey({id:ref.packId,version:ref.contentVersion})));
  const seen=new Set<string>();
  return packs.filter(pack=>{
    const key=packKey(pack);if(seen.has(key)||reserved.has(key)||!['builtin','local'].includes(pack.source)||!compatible(moduleId,pack)||validatePack(pack).length)return false;
    seen.add(key);return true;
  });
}
export function findGameAssignment(moduleId:ModuleId,assignment:GameAssignment|undefined,packs:ContentPack[],curricula:CurriculumSnapshot[]=[]):ContentPack|undefined{
  if(!assignment)return;
  return gameAssignmentChoices(moduleId,packs,curricula).find(pack=>pack.id===assignment.packId&&pack.version===assignment.contentVersion);
}
