import {fail,shape,text} from './online-errors.mjs';
import {closedStudentCount,changesQuestionMeaning} from './weekly-policy.mjs';
import {onlineWeekIdentity,onlineRevisionOrder,onlineIdentityText,onlinePreserveQuestionIds,onlineRevisionComparison} from '../src/core/online-import-identity.ts';

const parse=value=>typeof value==='string'?JSON.parse(value):value;
const admin=auth=>{if(auth.role!=='admin')fail(403,'Chỉ quản lý được thực hiện thao tác này.');};
function reader(store){const pg=!!store.pool;return{pg,table:name=>(pg?'bao_an.':'')+name,fold:column=>(pg?'lower':'baoan_fold')+'('+column+')',json:(column,path)=>pg?`${column}#>>'{${path.split('.').join(',')}}'`:`json_extract(${column},'$.${path}')`,length:column=>pg?`jsonb_array_length(${column}->'items')`:`json_array_length(${column},'$.items')`};}
// Each invocation owns a positional parameter counter; no shared query state.
function access(store){const data=reader(store);return{...data,rows:async(sql,args=[])=>{let index=0;return data.pg?store.rows(sql.replace(/\?/g,()=>'$'+(++index)),args):store.db.prepare(sql).all(...args);}};}
function page(offset,total){return{offset,nextOffset:offset+20<total?offset+20:null,total,limit:20};}
function offsetOf(value){if(!/^(0|[1-9]\d{0,6})$/.test(String(value??'0')))fail(400,'Trang quản trị không hợp lệ.');return Number(value??0);}
export async function adminSummary(store,auth,input={}){
  admin(auth);shape(input,['classId','section','offset','query']);const db=access(store),t=db.table,offset=offsetOf(input.offset),section=input.section??'students';if(!['students','weeks','wallet','recovery'].includes(section))fail(400,'Mục quản trị không hợp lệ.');
  const classes=(await db.rows(`SELECT * FROM ${t('classes')} WHERE workspace_id=? ORDER BY created_at,id`,[auth.workspaceId])).map(row=>store.publicClass(row)),classId=input.classId||classes[0]?.id||'';if(classId&&!classes.some(row=>row.id===classId))fail(404,'Không tìm thấy lớp học.');
  const counts=(await db.rows(`SELECT (SELECT count(*) FROM ${t('students')} WHERE workspace_id=?) AS students,(SELECT count(*) FROM ${t('classes')} WHERE workspace_id=?) AS classes,(SELECT coalesce(sum(${db.length('json')}),0) FROM ${t('packs')} WHERE workspace_id=?) AS questions,(SELECT count(*) FROM ${t('redemptions')} WHERE workspace_id=? AND status IN ('pending','approved')) AS pending`,Array(4).fill(auth.workspaceId)))[0],workspace=await store.workspace(auth.workspaceId);
  const result={classes,students:[],weeks:[],redemptions:[],classId,section,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},stats:{students:Number(counts.students),classes:Number(counts.classes),questions:Number(counts.questions),pendingRequests:Number(counts.pending)},page:page(offset,0)};
  if(section==='students'&&classId){const query=input.query?text(input.query,'Tìm học sinh',100):'',search=query?` AND (${db.fold('s.name')} LIKE ? ESCAPE '!' OR ${db.fold('u.username')} LIKE ? ESCAPE '!')`:'',pattern='%'+query.normalize('NFC').toLocaleLowerCase('vi').replace(/[!%_]/g,char=>'!'+char)+'%',args=[auth.workspaceId,classId,...(query?[pattern,pattern]:[])],where=`FROM ${t('students')} s JOIN ${t('users')} u ON u.id=s.user_id AND u.workspace_id=s.workspace_id WHERE s.workspace_id=? AND s.class_id=?${search}`;
    const total=Number((await db.rows('SELECT count(*) AS n '+where,args))[0].n),rows=await db.rows('SELECT s.*,u.username '+where+' ORDER BY s.created_at,s.id LIMIT 20 OFFSET ?',[...args,offset]);
    if(rows.length){const ids=rows.map(row=>row.id),slots=ids.map(()=>'?').join(','),awards=await db.rows(`SELECT student_id,coalesce(sum(coalesce(CAST(${db.json('json','questionLedger.earnedStars')} AS BIGINT),tier)),0) AS earned FROM ${t('awards')} WHERE workspace_id=? AND student_id IN (${slots}) GROUP BY student_id`,[auth.workspaceId,...ids]),held=await db.rows(`SELECT student_id,status,sum(CAST(${db.json('json','stars')} AS BIGINT)) AS stars FROM ${t('redemptions')} WHERE workspace_id=? AND student_id IN (${slots}) AND status IN ('pending','approved','fulfilled') GROUP BY student_id,status`,[auth.workspaceId,...ids]);
      result.students=rows.map(row=>{const earned=Number(awards.find(award=>award.student_id===row.id)?.earned??0),pending=held.filter(value=>value.student_id===row.id&&value.status!=='fulfilled').reduce((n,value)=>n+Number(value.stars),0),redeemed=Number(held.find(value=>value.student_id===row.id&&value.status==='fulfilled')?.stars??0);return{id:row.id,classId:row.class_id,name:row.name,username:row.username,active:!!row.active,createdAt:row.created_at,balance:{earned,pending,redeemed,available:earned-pending-redeemed}};});}
    result.page=page(offset,total);
  }else if(section==='weeks'&&classId){const total=Number((await db.rows(`SELECT count(*) AS n FROM ${t('weeks')} WHERE workspace_id=? AND class_id=?`,[auth.workspaceId,classId]))[0].n),weeks=await db.rows(`SELECT * FROM ${t('weeks')} WHERE workspace_id=? AND class_id=? ORDER BY position LIMIT 20 OFFSET ?`,[auth.workspaceId,classId,offset]);
    const policies=await store.weekPolicies(auth),markers=await db.rows(`SELECT target_id FROM ${t('audit')} WHERE workspace_id=? AND action='student.journey.advance'`,[auth.workspaceId]);
    if(weeks.length){const ids=weeks.map(week=>week.id),sets=await db.rows(`SELECT s.week_id,p.pack_id,p.version,p.subject_label,${db.json('p.json','title')} AS title,${db.json('p.json','kind')} AS kind,${db.json('p.json','subject')} AS subject,${db.json('p.json','grade')} AS grade,${db.length('p.json')} AS item_count FROM ${t('week_sets')} s JOIN ${t('packs')} p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE s.workspace_id=? AND s.week_id IN (${ids.map(()=>'?').join(',')}) ORDER BY s.week_id,s.position`,[auth.workspaceId,...ids]);
      result.weeks=weeks.map(row=>{const week={id:row.id,classId:row.class_id,title:row.title,position:row.position,createdAt:row.created_at};return{...week,closedStudents:closedStudentCount(markers,week),...(policies.has(row.id)?{plan:policies.get(row.id)}:{}),sets:sets.filter(set=>set.week_id===row.id).map(set=>({subjectLabel:set.subject_label,...(policies.has(row.id)?{subjectId:policies.get(row.id).assignments[set.pack_id]}:{}),pack:{id:set.pack_id,version:Number(set.version),title:set.title,kind:set.kind,subject:set.subject,grade:Number(set.grade),itemCount:Number(set.item_count)},games:[]}))};});}
    result.page=page(offset,total);
  }else if(section==='wallet'){const total=Number((await db.rows(`SELECT count(*) AS n FROM ${t('redemptions')} WHERE workspace_id=?`,[auth.workspaceId]))[0].n),order=db.pg?'r.created_order':'r.rowid';result.redemptions=(await db.rows(`SELECT r.json,s.id AS student_id,s.name,s.class_id FROM ${t('redemptions')} r JOIN ${t('students')} s ON s.workspace_id=r.workspace_id AND s.id=r.student_id WHERE r.workspace_id=? ORDER BY ${order} DESC LIMIT 20 OFFSET ?`,[auth.workspaceId,offset])).map(row=>({...parse(row.json),studentId:row.student_id,studentName:row.name,classId:row.class_id}));result.page=page(offset,total);}
  return result;
}
export async function adminWeek(store,auth,weekId){admin(auth);const db=access(store),row=(await db.rows(`SELECT class_id FROM ${db.table('weeks')} WHERE workspace_id=? AND id=?`,[auth.workspaceId,text(weekId,'Mã tuần',100)]))[0];if(!row)fail(404,'Không tìm thấy tuần học.');
  const weekRows=await db.rows(`SELECT * FROM ${db.table('weeks')} WHERE workspace_id=? AND id=?`,[auth.workspaceId,weekId]),rowWeek=weekRows[0],sets=await db.rows(`SELECT p.* FROM ${db.table('week_sets')} s JOIN ${db.table('packs')} p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE s.workspace_id=? AND s.week_id=? ORDER BY s.position`,[auth.workspaceId,weekId]),policies=await store.weekPolicies(auth),markers=await db.rows(`SELECT target_id FROM ${db.table('audit')} WHERE workspace_id=? AND action='student.journey.advance'`,[auth.workspaceId]);const week={id:weekId,classId:row.class_id,title:rowWeek.title,position:rowWeek.position,createdAt:rowWeek.created_at};return{...week,closedStudents:closedStudentCount(markers,week),...(policies.has(weekId)?{plan:policies.get(weekId)}:{}),sets:sets.map(set=>({...store.packRecord(set),...(policies.has(weekId)?{subjectId:policies.get(weekId).assignments[set.pack_id]}:{})}))};
}
export async function adminMedia(store,auth,input={}){admin(auth);shape(input,['offset','names']);const db=access(store);if(input.names!==undefined){if(!Array.isArray(input.names)||input.names.length>100||input.names.some(name=>typeof name!=='string'||!name.trim()||name.length>180))fail(400,'Tra cứu tối đa 100 tên tư liệu mỗi lần.');if(!input.names.length)return[];const normalized=[...new Set(input.names.flatMap(name=>[name.normalize('NFC').toLocaleLowerCase('vi'),name.normalize('NFD').toLocaleLowerCase('vi')]))];return(await db.rows(`SELECT id,name,mime,kind,size,sha256 FROM ${db.table('media')} WHERE workspace_id=? AND ${db.fold('name')} IN (${normalized.map(()=>'?').join(',')})`,[auth.workspaceId,...normalized])).map(row=>store.publicMedia(row));}
  const offset=offsetOf(input.offset),total=Number((await db.rows(`SELECT count(*) AS n FROM ${db.table('media')} WHERE workspace_id=?`,[auth.workspaceId]))[0].n),assets=(await db.rows(`SELECT id,name,mime,kind,size,sha256 FROM ${db.table('media')} WHERE workspace_id=? ORDER BY created_at,id LIMIT 20 OFFSET ?`,[auth.workspaceId,offset])).map(row=>store.publicMedia(row));return{assets,page:page(offset,total)};
}
export async function adminWeekCheck(store,auth,input){
  admin(auth);shape(input,['classId','title','sets','replaceWeekId']);await store.class(auth,text(input.classId,'Lớp',100));text(input.title,'Tên tuần',100);
  if(!Array.isArray(input.sets)||input.sets.length>30||input.sets.some(set=>!set?.pack||!Array.isArray(set.pack.items)))fail(400,'Danh sách bộ không hợp lệ.');
  const db=access(store),t=db.table,metadata=await db.rows(`SELECT id,title FROM ${t('weeks')} WHERE workspace_id=? AND class_id=? ORDER BY position`,[auth.workspaceId,input.classId]),ids=input.sets.map(set=>set.pack.id);
  const assigned=ids.length?await db.rows(`SELECT DISTINCT s.week_id FROM ${t('week_sets')} s JOIN ${t('weeks')} w ON w.workspace_id=s.workspace_id AND w.id=s.week_id WHERE s.workspace_id=? AND w.class_id=? AND s.pack_id IN (${ids.map(()=>'?').join(',')})`,[auth.workspaceId,input.classId,...ids]):[];
  const related=new Set(assigned.map(row=>row.week_id)),candidates=metadata.filter(row=>input.replaceWeekId?row.id===input.replaceWeekId:related.has(row.id)||onlineIdentityText(row.title)===onlineIdentityText(input.title));
  let duplicateWeek,conflictWeek,revision,revisionError='';
  for(const candidate of candidates){
    // At most one candidate's question bodies are held at a time; initial admin
    // navigation never reads these bodies or a complete media catalog.
    const old=await adminWeek(store,auth,candidate.id),mediaIds=[...new Set([...old.sets,...input.sets].flatMap(set=>[...store.referencedMedia(set.pack)]))];
    const hashes=Object.fromEntries((mediaIds.length?await db.rows(`SELECT id,sha256 FROM ${t('media')} WHERE workspace_id=? AND id IN (${mediaIds.map(()=>'?').join(',')})`,[auth.workspaceId,...mediaIds]):[]).map(row=>[row.id,row.sha256]));
    if(input.replaceWeekId){try{if(old.closedStudents&&changesQuestionMeaning(old,input,hashes))throw new Error(`Có ${old.closedStudents} học sinh đã đóng tuần này. Giữ nội dung đã học; giao câu mới ở tuần chưa học.`);for(const set of input.sets){const original=old.sets.find(row=>row.pack.id===set.pack.id);if(original)onlinePreserveQuestionIds(original.pack,set.pack,hashes);}onlineRevisionOrder(old,input,hashes);revision=onlineRevisionComparison(old,input,hashes);}catch(error){revisionError=error.message;}break;}
    try{if(onlineWeekIdentity(old,hashes)===onlineWeekIdentity(input,hashes)){duplicateWeek={id:old.id,title:old.title};conflictWeek=undefined;break;}}catch{fail(400,'Nội dung xem trước không hợp lệ.');}
    if(related.has(old.id)&&!conflictWeek)conflictWeek={id:old.id,title:old.title};
  }
  if(input.replaceWeekId&&!candidates.length)revisionError='Tuần gốc không còn trong lớp.';
  return{...(duplicateWeek?{duplicateWeek}:{}),...(conflictWeek?{conflictWeek}:{}),...(revision?{revision}:{}),revisionError};
}

const EXPORT_EVENT_LIMIT=50000;
const median=values=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return Math.round(sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2);};
const wrongLabel=response=>!response?undefined:response.kind==='choice'&&Number.isInteger(response.choiceIndex)?'ABCD'[response.choiceIndex]:response.kind==='text'&&typeof response.value==='string'?response.value.normalize('NFC').trim().replace(/\s+/g,' ').slice(0,60):undefined;
/** Per question: who tried it, first-try accuracy, wrong answers and the stars the class holds. Numbers and answers only, no student names. */
export function exportQuestionStats(sets,events,awards,classStudents){
  const stats={};
  for(const {pack} of sets){stats[pack.id]={};for(const item of pack.items)stats[pack.id][item.id]={students:0,firstTryCorrect:0,attempts:0,wrong:0,medianCorrectMs:null,tiers:[classStudents,0,0,0],commonWrong:null};}
  const grouped=new Map();
  for(const {studentId,event} of events){const row=stats[event?.packId]?.[event?.itemId];if(!row)continue;const key=JSON.stringify([event.packId,event.itemId,studentId]);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(event);}
  const correctMs=new Map(),wrongAnswers=new Map();
  for(const [key,list] of grouped){
    const [packId,itemId]=JSON.parse(key),row=stats[packId][itemId],ordered=list.sort((a,b)=>String(a.occurredAt).localeCompare(String(b.occurredAt))||(a.gameSequence??0)-(b.gameSequence??0));
    row.students++;row.attempts+=ordered.length;if(ordered[0].correct)row.firstTryCorrect++;
    for(const event of ordered){const id=packId+'\u0000'+itemId;
      if(event.correct){if(Number.isFinite(event.elapsedMs)&&event.elapsedMs>=0){if(!correctMs.has(id))correctMs.set(id,[]);correctMs.get(id).push(event.elapsedMs);}}
      else{row.wrong++;const label=wrongLabel(event.response);if(label){if(!wrongAnswers.has(id))wrongAnswers.set(id,new Map());const counts=wrongAnswers.get(id);counts.set(label,(counts.get(label)??0)+1);}}}
  }
  for(const [packId,items] of Object.entries(stats))for(const [itemId,row] of Object.entries(items)){const id=packId+'\u0000'+itemId;row.medianCorrectMs=median(correctMs.get(id)??[]);
    const counts=[...(wrongAnswers.get(id)??new Map()).entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));if(counts.length)row.commonWrong={answer:counts[0][0],count:counts[0][1]};}
  for(const {pack_id:packId,json} of awards){const tiers=parse(json)?.questionLedger?.questionTiers??{};for(const [itemId,tier] of Object.entries(tiers)){const row=stats[packId]?.[itemId];if(!row||![1,2,3].includes(tier))continue;row.tiers[0]=Math.max(0,row.tiers[0]-1);row.tiers[tier]++;}}
  return stats;
}
/** Everything needed to rebuild one week as an importable workbook: answers, file names and class statistics. */
export async function adminExport(store,auth,weekId){
  admin(auth);const week=await adminWeek(store,auth,text(weekId,'Mã tuần',100)),db=access(store),t=db.table;
  const cls=(await db.rows(`SELECT name FROM ${t('classes')} WHERE workspace_id=? AND id=?`,[auth.workspaceId,week.classId]))[0];
  const mediaIds=[...new Set(week.sets.flatMap(set=>[...store.referencedMedia(set.pack)]))];
  const media=mediaIds.length?(await db.rows(`SELECT id,name,mime,kind,size,sha256 FROM ${t('media')} WHERE workspace_id=? AND id IN (${mediaIds.map(()=>'?').join(',')})`,[auth.workspaceId,...mediaIds])).map(row=>store.publicMedia(row)):[];
  const packIds=[...new Set(week.sets.map(set=>set.pack.id))],classStudents=Number((await db.rows(`SELECT count(*) AS n FROM ${t('students')} WHERE workspace_id=? AND class_id=?`,[auth.workspaceId,week.classId]))[0].n);
  let events=[],awards=[],truncated=false;
  if(packIds.length&&classStudents){
    const slots=packIds.map(()=>'?').join(','),scope=`p.workspace_id=? AND p.student_id IN (SELECT id FROM ${t('students')} WHERE workspace_id=? AND class_id=?)`;
    const rows=await db.rows(`SELECT a.json AS json,p.student_id AS student_id FROM ${t('attempts')} a JOIN ${t('plays')} p ON p.workspace_id=a.workspace_id AND p.id=a.play_id WHERE ${scope} AND ${db.json('a.json','packId')} IN (${slots}) LIMIT ${EXPORT_EVENT_LIMIT+1}`,[auth.workspaceId,auth.workspaceId,week.classId,...packIds]);
    truncated=rows.length>EXPORT_EVENT_LIMIT;events=rows.slice(0,EXPORT_EVENT_LIMIT).map(row=>({studentId:row.student_id,event:parse(row.json)}));
    awards=await db.rows(`SELECT pack_id,json FROM ${t('awards')} WHERE workspace_id=? AND pack_id IN (${slots}) AND student_id IN (SELECT id FROM ${t('students')} WHERE workspace_id=? AND class_id=?)`,[auth.workspaceId,...packIds,auth.workspaceId,week.classId]);
  }
  await store.audit(auth,'questions.export',week.id);
  return{exportedAt:new Date().toISOString(),week:{id:week.id,title:week.title,position:week.position,classId:week.classId,className:cls?.name??''},sets:week.sets.map(set=>({subjectLabel:set.subjectLabel,pack:set.pack})),media,classStudents,statsTruncated:truncated,stats:exportQuestionStats(week.sets,events,awards,classStudents)};
}
