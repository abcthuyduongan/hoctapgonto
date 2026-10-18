import {onlineCanonical,onlineSemanticPackIdentity} from '../src/core/online-import-identity.ts';

export function readWeekPolicies(rows){const result=new Map();for(const row of rows){const marker=typeof row.target_id==='string'?JSON.parse(row.target_id):row.target_id;if(!marker||typeof marker.weekId!=='string'||!marker.plan)throw new Error('Invalid stored week policy');result.set(marker.weekId,marker.plan);}return result;}
export function closedStudentCount(rows,week){const students=new Set();for(const row of rows){try{const marker=typeof row.target_id==='string'?JSON.parse(row.target_id):row.target_id;if(marker.classId===week.classId&&marker.position>week.position)students.add(marker.studentId);}catch{}}return students.size;}
export function changesQuestionMeaning(original,incoming,hashes){
  const meaning=sets=>onlineCanonical(sets.map(set=>({id:set.pack.id,meaning:onlineSemanticPackIdentity(set.pack,hashes)})).sort((a,b)=>a.id.localeCompare(b.id)));
  return meaning(original.sets)!==meaning(incoming.sets);
}
