import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {parseContentImport} from '../src/core/content-io.ts';
import {GAME_REGISTRY,getGame} from '../src/core/registry.ts';
import {validatePack} from '../src/core/validation.ts';
import {onlinePresentation,onlineEvidenceErrors,onlineScoreResponse,onlineAward} from '../src/core/online-exercises.ts';
import {makeRewardRequest,changeRewardRequest,rewardStatus,rewardBalance} from '../src/core/reward-wallet.ts';
import {onlineImmutablePackIdentity,onlinePackQuestionKind,onlineSemanticPackIdentity,onlineWeekIdentity,onlineIdentityText,onlineRevisionOrder,onlinePreserveQuestionIds} from '../src/core/online-import-identity.ts';
import {summaryWeeks,summaryPage,compactPlay} from './student-summary.mjs';
import {createWeeklyPlan,weeklyPlanErrors,validateWeeklyPlan} from '../src/core/weekly-plan.ts';
import {readWeekPolicies,closedStudentCount,changesQuestionMeaning} from './weekly-policy.mjs';
import {journeyProgress,selectReviewItems,filterPlayPresentation,timedQuestion} from './question-journey.mjs';
import {initializeQuestionRewardLedger,applyQuestionRewardCandidates,questionRewardCandidates,questionRewardProgress,questionRewardThresholds,earnedQuestionRewardStars,v2QuestionCompletionErrors} from '../src/core/question-rewards.ts';
import {openProtocolQuestion,protocolAudioDelivery,protocolHint,answerFeedback} from './question-protocol.mjs';

import {OnlineError,fail,text,integer,shape} from './online-errors.mjs';
export {OnlineError,fail,text,integer,shape};
const id=()=>randomUUID();
const now=()=>new Date().toISOString();
const json=JSON.stringify;
const parse=JSON.parse;
const stable=value=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row);
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
const contentIdentity=pack=>{const{publishedAt,source,...content}=pack;void publishedAt;void source;return digest(content);};
export class OnlineStore{
  constructor(databasePath){
    if(databasePath!==':memory:')mkdirSync(dirname(databasePath),{recursive:true});
    this.db=new DatabaseSync(databasePath);this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO schema_version VALUES(1);
      CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,wallet_enabled INTEGER NOT NULL DEFAULT 0,rate_vnd INTEGER NOT NULL DEFAULT 1000,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student')),student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS classes(id TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES workspaces(id),name TEXT NOT NULL,grade INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,id));
      CREATE TABLE IF NOT EXISTS students(id TEXT NOT NULL,workspace_id TEXT NOT NULL,class_id TEXT NOT NULL,name TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,class_id) REFERENCES classes(workspace_id,id));
      CREATE TABLE IF NOT EXISTS packs(workspace_id TEXT NOT NULL REFERENCES workspaces(id),pack_id TEXT NOT NULL,version INTEGER NOT NULL,subject_label TEXT NOT NULL,json TEXT NOT NULL,content_hash TEXT NOT NULL,PRIMARY KEY(workspace_id,pack_id,version));
      CREATE TABLE IF NOT EXISTS weeks(id TEXT NOT NULL,workspace_id TEXT NOT NULL,class_id TEXT NOT NULL,title TEXT NOT NULL,position INTEGER NOT NULL,request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,request_id),UNIQUE(workspace_id,class_id,position),FOREIGN KEY(workspace_id,class_id) REFERENCES classes(workspace_id,id));
      CREATE TABLE IF NOT EXISTS week_sets(workspace_id TEXT NOT NULL,week_id TEXT NOT NULL,position INTEGER NOT NULL,pack_id TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(workspace_id,week_id,position),UNIQUE(workspace_id,week_id,pack_id),FOREIGN KEY(workspace_id,week_id) REFERENCES weeks(workspace_id,id),FOREIGN KEY(workspace_id,pack_id,version) REFERENCES packs(workspace_id,pack_id,version));
      CREATE TABLE IF NOT EXISTS plays(id TEXT NOT NULL,workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,request_id TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,student_id,request_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS attempts(workspace_id TEXT NOT NULL,play_id TEXT NOT NULL,attempt_key TEXT NOT NULL,payload_hash TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(workspace_id,play_id,attempt_key),FOREIGN KEY(workspace_id,play_id) REFERENCES plays(workspace_id,id));
      CREATE TABLE IF NOT EXISTS awards(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,pack_id TEXT NOT NULL,tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 3),json TEXT NOT NULL,PRIMARY KEY(workspace_id,student_id,pack_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS redemptions(workspace_id TEXT NOT NULL,id TEXT NOT NULL,student_id TEXT NOT NULL,status TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media(id TEXT NOT NULL,workspace_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,kind TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,bytes BLOB NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,name,sha256));
      CREATE INDEX IF NOT EXISTS plays_student ON plays(workspace_id,student_id); CREATE INDEX IF NOT EXISTS redemption_student ON redemptions(workspace_id,student_id);
      CREATE INDEX IF NOT EXISTS auth_expiry ON auth_sessions(expires_at);`);
    this.db.function('baoan_fold',{deterministic:true},value=>typeof value==='string'?value.normalize('NFC').toLocaleLowerCase('vi'):value);
    if(this.db.prepare('SELECT max(version) AS version FROM schema_version').get().version!==1)fail(500,'Phiên bản dữ liệu online chưa được hỗ trợ.');
  }
  close(){this.db.close();}
  tx(action){this.db.exec('BEGIN IMMEDIATE');try{const result=action();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  audit(auth,action,target){this.db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(id(),auth.workspaceId,auth.id,action,target,now());}
  configured(){return !!this.db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();}
  changeOwnPassword(auth,expectedHash,newHash){
    if(auth.role!=='student')fail(403,'Chỉ học sinh được tự đổi mật khẩu tại đây.');
    text(expectedHash,'Mật khẩu hiện tại đã mã hóa',500);text(newHash,'Mật khẩu mới đã mã hóa',500);
    return this.tx(()=>{
      const user=this.db.prepare('SELECT u.* FROM users u JOIN auth_sessions a ON a.user_id=u.id JOIN students s ON s.user_id=u.id AND s.workspace_id=u.workspace_id AND s.id=u.student_id WHERE u.workspace_id=? AND u.id=? AND u.role=\'student\' AND u.student_id=? AND u.active=1 AND s.active=1 AND a.token_hash=? AND a.csrf_token=? AND a.expires_at>?').get(auth.workspaceId,auth.id,auth.studentId,auth.tokenHash??'',auth.csrfToken??'',Date.now());
      if(!user)fail(401,'Phiên đăng nhập đã hết hạn hoặc đã được thu hồi. Hãy đăng nhập lại.');
      if(user.password_hash!==expectedHash)fail(409,'Mật khẩu đã được thay đổi. Hãy đăng nhập lại trước khi tiếp tục.');
      this.db.prepare('UPDATE users SET password_hash=? WHERE workspace_id=? AND id=?').run(newHash,auth.workspaceId,auth.id);
      this.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(auth.id);this.abandonActive(auth,auth.studentId);this.audit(auth,'student.change-password',auth.studentId);
      return{changed:true,reauthenticate:true};
    });
  }
  workspace(workspaceId){return this.db.prepare('SELECT * FROM workspaces WHERE id=?').get(workspaceId)??fail(404,'Không tìm thấy đơn vị.');}
  class(auth,classId){return this.db.prepare('SELECT * FROM classes WHERE workspace_id=? AND id=?').get(auth.workspaceId,classId)??fail(404,'Không tìm thấy lớp học.');}
  student(auth,studentId){
    if(auth.role==='student'&&auth.studentId!==studentId)fail(404,'Không tìm thấy học sinh.');
    return this.db.prepare('SELECT s.*,u.username FROM students s JOIN users u ON u.id=s.user_id WHERE s.workspace_id=? AND s.id=?').get(auth.workspaceId,studentId)??fail(404,'Không tìm thấy học sinh.');
  }
  publicClass(row){return{id:row.id,name:row.name,grade:row.grade,createdAt:row.created_at};}
  publicMedia(row){return{id:row.id,name:row.name,mime:row.mime,kind:row.kind,size:row.size,sha256:row.sha256};}
  listMedia(auth){return this.db.prepare('SELECT id,name,mime,kind,size,sha256 FROM media WHERE workspace_id=? ORDER BY created_at').all(auth.workspaceId).map(row=>this.publicMedia(row));}
  uploadMedia(auth,input){shape(input,['name','mime','base64']);const name=text(input.name,'Tên tệp',180);if(/[\\/]/.test(name))fail(400,'Tên tệp không được chứa đường dẫn.');
    if(typeof input.base64!=='string'||input.base64.length>12*1024*1024||!input.base64.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)||input.base64.length%4)fail(400,'Tệp đính kèm không đúng định dạng base64.');
    const bytes=Buffer.from(input.base64,'base64');if(bytes.length<12||bytes.length>8*1024*1024)fail(400,'Mỗi tệp hình/âm thanh cần từ 12 byte đến 8 MB.');
    let mime,kind;
    if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime='image/png';kind='image';}
    else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';kind='image';}
    else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){mime='image/webp';kind='image';}
    else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE'){mime='audio/wav';kind='audio';}
    else if(bytes.toString('ascii',0,4)==='OggS'){mime='audio/ogg';kind='audio';}
    else if(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&0xe0)===0xe0){mime='audio/mpeg';kind='audio';}
    else fail(400,'Chỉ nhận ảnh PNG/JPEG/WebP và âm thanh MP3/WAV/OGG đúng định dạng thực.');
    if(input.mime&&input.mime!==mime&&!(mime==='audio/mpeg'&&input.mime==='audio/mp3')&&!(mime==='audio/wav'&&['audio/x-wav','audio/wave'].includes(input.mime)))fail(400,'Loại tệp khai báo không khớp nội dung.');
    const sha256=createHash('sha256').update(bytes).digest('hex');return this.tx(()=>{
      const prior=this.db.prepare('SELECT * FROM media WHERE workspace_id=? AND name=? AND sha256=?').get(auth.workspaceId,name,sha256);if(prior)return this.publicMedia(prior);
      const used=this.db.prepare('SELECT coalesce(sum(size),0) AS used FROM media WHERE workspace_id=?').get(auth.workspaceId).used;if(used+bytes.length>256*1024*1024)fail(400,'Kho hình/âm thanh đã đạt giới hạn 256 MB của bản này.');
      const asset={id:id(),workspace_id:auth.workspaceId,name,mime,kind,size:bytes.length,sha256};this.db.prepare('INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?)').run(asset.id,auth.workspaceId,name,mime,kind,bytes.length,sha256,bytes,now());this.audit(auth,'media.upload',asset.id);return this.publicMedia(asset);
    });
  }
  referencedMedia(pack){return new Set([...(pack.media??[]).map(asset=>asset.mediaId),...pack.items.flatMap(item=>[item.media?.imageId,item.media?.audioId,...('audioId'in item?[item.audioId]:[])])].filter(Boolean));}
  readMedia(auth,mediaId){const row=this.db.prepare('SELECT * FROM media WHERE workspace_id=? AND id=?').get(auth.workspaceId,mediaId);if(!row)fail(404,'Không tìm thấy tệp hình/âm thanh.');
    if(auth.role==='student'){const student=this.student(auth,auth.studentId),ref="(EXISTS(SELECT 1 FROM json_each(p.json,'$.items') item WHERE json_extract(item.value,'$.media.imageId')=? OR json_extract(item.value,'$.media.audioId')=? OR json_extract(item.value,'$.audioId')=?) OR EXISTS(SELECT 1 FROM json_each(p.json,'$.media') asset WHERE json_extract(asset.value,'$.mediaId')=?))";
      const assigned=this.db.prepare(`SELECT 1 FROM weeks w JOIN week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id JOIN packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE w.workspace_id=? AND w.class_id=? AND ${ref} LIMIT 1`).get(auth.workspaceId,student.class_id,...Array(4).fill(mediaId));
      const pinned=assigned||this.db.prepare(`SELECT 1 FROM plays s JOIN packs p ON p.workspace_id=s.workspace_id AND p.pack_id=json_extract(s.json,'$.packId') AND p.version=json_extract(s.json,'$.contentVersion') WHERE s.workspace_id=? AND s.student_id=? AND json_extract(s.json,'$.profileId')=? AND json_extract(s.json,'$.status') IN ('active','completed') AND ${ref} LIMIT 1`).get(auth.workspaceId,student.id,student.id,...Array(4).fill(mediaId));
      if(!pinned)fail(404,'Không tìm thấy tệp hình/âm thanh.');}return row;
  }
  validateMedia(auth,pack){for(const mediaId of this.referencedMedia(pack)){const asset=this.db.prepare('SELECT id,kind,sha256 FROM media WHERE workspace_id=? AND id=?').get(auth.workspaceId,mediaId);if(!asset)fail(400,`Tệp ${mediaId} chưa được tải lên kho của đơn vị.`);
    for(const item of pack.items){if(item.media?.imageId===mediaId&&asset.kind!=='image'||(item.media?.audioId===mediaId||'audioId'in item&&item.audioId===mediaId)&&asset.kind!=='audio')fail(400,'Tệp đính kèm không đúng loại hình hoặc âm thanh.');}
    for(const catalog of pack.media??[])if(catalog.mediaId===mediaId&&(asset.kind!=='audio'||catalog.sha256!==asset.sha256))fail(400,'Hash hoặc loại âm thanh không khớp tệp đã tải lên.');
  }}
  createClass(auth,input){shape(input,['name','grade']);const name=text(input.name,'Tên lớp',120),grade=integer(input.grade,'Khối lớp',1,12);
    return this.tx(()=>{if(this.db.prepare('SELECT count(*) AS n FROM classes WHERE workspace_id=?').get(auth.workspaceId).n>=200)fail(400,'Mỗi đơn vị hỗ trợ tối đa 200 lớp trong bản này.');
      const row={id:id(),name,grade,created_at:now()};this.db.prepare('INSERT INTO classes VALUES(?,?,?,?,?)').run(row.id,auth.workspaceId,name,grade,row.created_at);this.audit(auth,'class.create',row.id);return this.publicClass(row);});}
  rewards(auth,studentId){return this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? ORDER BY pack_id').all(auth.workspaceId,studentId).map(row=>parse(row.json));}
  requests(auth,studentId){return this.db.prepare('SELECT json FROM redemptions WHERE workspace_id=? AND student_id=? ORDER BY rowid').all(auth.workspaceId,studentId).map(row=>parse(row.json));}
  balance(auth,studentId){return rewardBalance(earnedQuestionRewardStars(this.rewards(auth,studentId)),{requests:this.requests(auth,studentId)});}
  publicStudent(auth,row){const current=this.progress(auth,row).current;return{id:row.id,classId:row.class_id,name:row.name,username:row.username,active:!!row.active,createdAt:row.created_at,balance:this.balance(auth,row.id),...(current?{currentWeek:current.weekTitle}:{})};}
  createStudent(auth,input,passwordHash,username){shape(input,['name','classId','username','password']);const name=text(input.name,'Tên học sinh',100),classId=text(input.classId,'Lớp học',100);
    return this.tx(()=>{this.class(auth,classId);if(this.db.prepare('SELECT count(*) AS n FROM students WHERE workspace_id=?').get(auth.workspaceId).n>=3000)fail(400,'Mỗi đơn vị hỗ trợ tối đa 3.000 học sinh trong bản này.');
      if(this.db.prepare('SELECT id FROM users WHERE username=?').get(username))fail(409,'Tên đăng nhập đã được sử dụng.');
      const studentId=id(),userId=id(),createdAt=now();this.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,student_id,created_at) VALUES(?,?,?,?,?,?,?)').run(userId,auth.workspaceId,username,passwordHash,'student',studentId,createdAt);
      this.db.prepare('INSERT INTO students VALUES(?,?,?,?,?,?,?)').run(studentId,auth.workspaceId,classId,name,userId,1,createdAt);this.audit(auth,'student.create',studentId);return this.publicStudent(auth,this.student(auth,studentId));});}
  updateStudent(auth,studentId,input){shape(input,['name','classId','active']);return this.tx(()=>{const row=this.student(auth,studentId);
    const name=input.name===undefined?row.name:text(input.name,'Tên học sinh',100),classId=input.classId===undefined?row.class_id:text(input.classId,'Lớp học',100);this.class(auth,classId);
    if(input.active!==undefined&&typeof input.active!=='boolean')fail(400,'Trạng thái tài khoản không hợp lệ.');const active=input.active===undefined?row.active:Number(input.active);
    this.db.prepare('UPDATE students SET name=?,class_id=?,active=? WHERE workspace_id=? AND id=?').run(name,classId,active,auth.workspaceId,studentId);
    this.db.prepare('UPDATE users SET active=? WHERE workspace_id=? AND id=?').run(active,auth.workspaceId,row.user_id);
    if(!active||classId!==row.class_id){this.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(row.user_id);this.abandonActive(auth,studentId);}
    this.audit(auth,'student.update',studentId);return this.publicStudent(auth,this.student(auth,studentId));});}
  packRecord(row){const pack=parse(row.json);return{pack,subjectLabel:row.subject_label,games:GAME_REGISTRY.filter(game=>{const view=onlinePresentation(game.id,pack);return view&&!validatePack(view).length;}).map(game=>({id:game.id,label:game.id==='math-quest'?'Đảo Câu Hỏi':game.label}))};}
  weekPolicies(auth){return readWeekPolicies(this.db.prepare("SELECT target_id FROM audit WHERE workspace_id=? AND action='week.policy'").all(auth.workspaceId));}
  weeks(auth,classId){const policies=this.weekPolicies(auth);return this.db.prepare('SELECT * FROM weeks WHERE workspace_id=? AND class_id=? ORDER BY position').all(auth.workspaceId,classId).map(row=>({id:row.id,classId:row.class_id,title:row.title,position:row.position,createdAt:row.created_at,...(policies.has(row.id)?{plan:policies.get(row.id)}:{}),
    sets:this.db.prepare('SELECT p.* FROM week_sets s JOIN packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE s.workspace_id=? AND s.week_id=? ORDER BY s.position').all(auth.workspaceId,row.id).map(set=>({...this.packRecord(set),...(policies.has(row.id)?{subjectId:policies.get(row.id).assignments[set.pack_id]}:{})}))}));}
  publishWeek(auth,input){shape(input,['requestId','title','classId','sets','replaceWeekId']);const requestId=text(input.requestId,'Mã lần nạp',100),title=text(input.title,'Tên tuần',100),classId=text(input.classId,'Lớp học',100),replaceWeekId=input.replaceWeekId===undefined?undefined:text(input.replaceWeekId,'Tuần cần cập nhật',100);
    if(!Array.isArray(input.sets)||input.sets.length<1||input.sets.length>30)fail(400,'Mỗi tuần cần từ 1–30 bộ câu hỏi.');
    const hash=digest(input);
    return this.tx(()=>{
      const cls=this.class(auth,classId),catalog=this.db.prepare('SELECT * FROM packs WHERE workspace_id=? ORDER BY version').all(auth.workspaceId).map(row=>({...row,pack:parse(row.json)})),seen=new Set(),sets=input.sets.map((set,index)=>{
        shape(set,['subjectLabel','subjectId','pack']);const label=set.subjectLabel===undefined||set.subjectLabel===''?'':text(set.subjectLabel,'Tên môn/chủ đề',120);
        if(!set.pack||typeof set.pack!=='object'||!['quiz','pairs','sentences','learning'].includes(set.pack.kind))fail(400,`Bộ ${index+1}: dạng câu chưa có trò chơi phù hợp.`);
        // Grade belongs to the published source; the receiving class keeps its own grade.
        const source=catalog.find(row=>row.pack_id===set.pack.id&&row.version===set.pack.version)??catalog.find(row=>row.pack_id===set.pack.id);
        let parsed;try{parsed=parseContentImport(json({schema:'baoan-learning-content',formatVersion:set.pack.kind==='learning'?2:1,packs:[{...set.pack,grade:source?.pack.grade??cls.grade,subject:'thinking'}]}))[0];}catch(error){fail(400,`Bộ ${index+1}: ${error.message}`);}this.validateMedia(auth,parsed);
        if(!GAME_REGISTRY.some(game=>{const view=onlinePresentation(game.id,parsed);return view&&!validatePack(view).length;}))fail(400,`Bộ ${index+1}: chưa có trò chung cho tất cả câu; sửa giới hạn game hoặc tách bộ trước khi giao.`);
        if(seen.has(parsed.id))fail(400,'Một tuần không được lặp lại mã bộ câu hỏi gốc.');seen.add(parsed.id);return{subjectLabel:label,...(set.subjectId!==undefined?{subjectId:text(set.subjectId,'Mã môn',64)}:{}),pack:parsed};
      });
      const mediaHashes=Object.fromEntries(this.db.prepare('SELECT id,sha256 FROM media WHERE workspace_id=?').all(auth.workspaceId).map(row=>[row.id,row.sha256]));
      for(const set of sets){const history=catalog.filter(row=>row.pack_id===set.pack.id&&row.version<=set.pack.version).reverse(),existing=history.find(row=>row.version===set.pack.version);const knownIds=new Set();for(const source of existing?[existing]:history){const prior={...source.pack,items:source.pack.items.filter(item=>!knownIds.has(item.id))};source.pack.items.forEach(item=>knownIds.add(item.id));try{set.pack=onlinePreserveQuestionIds(prior,set.pack,mediaHashes);}catch(error){fail(409,error.message);}}}
      const incomingIdentity=onlineWeekIdentity({title,sets},mediaHashes),weeks=this.weeks(auth,classId),revisionHash=digest({classId,replaceWeekId,content:incomingIdentity,sources:sets.map(set=>`${set.pack.id}@${set.pack.version}`).sort()});
      const marker=this.db.prepare("SELECT target_id FROM audit WHERE workspace_id=? AND action='week.revise'").all(auth.workspaceId).map(row=>{try{return parse(row.target_id);}catch{return null;}}).find(row=>row?.requestId===requestId);
      if(marker){if(marker.weekId!==replaceWeekId||marker.payloadHash!==revisionHash)fail(409,'Mã lần cập nhật đã dùng cho nội dung khác.');return weeks.find(week=>week.id===marker.weekId)??fail(404,'Không tìm thấy tuần gốc.');}
      const prior=this.db.prepare('SELECT id,payload_hash,class_id FROM weeks WHERE workspace_id=? AND request_id=?').get(auth.workspaceId,requestId);
      if(prior){const priorWeek=prior.class_id===classId?weeks.find(week=>week.id===prior.id):undefined;
        if(priorWeek&&(prior.payload_hash===hash||onlineWeekIdentity(priorWeek,mediaHashes)===incomingIdentity))return priorWeek;
        fail(409,'Mã lần nạp đã được dùng cho nội dung khác.');}
      const replay=replaceWeekId?undefined:weeks.find(week=>onlineWeekIdentity(week,mediaHashes)===incomingIdentity);if(replay)return replay;
      let revision;
      if(replaceWeekId){const original=weeks.find(week=>week.id===replaceWeekId)??fail(404,'Không tìm thấy tuần cần cập nhật trong lớp này.');
        try{revision=onlineRevisionOrder(original,{title,sets},mediaHashes);}catch(error){fail(409,error.message);}if(original.plan)for(const set of sets)if(set.subjectId&&set.subjectId!==original.plan.assignments[set.pack.id])fail(409,'Không đổi mã môn của tuần đã giao.');if(revision.unchanged)return original;
        const closed=closedStudentCount(this.db.prepare("SELECT target_id FROM audit WHERE workspace_id=? AND action='student.journey.advance'").all(auth.workspaceId),original);
        if(closed&&changesQuestionMeaning(original,{sets},mediaHashes))fail(409,`Có ${closed} học sinh đã đóng tuần này. Giữ nội dung câu hỏi đã học; giao nội dung bổ sung ở tuần chưa học.`);
        if(original.plan){const mapped=sets.map(set=>({...set,subjectId:original.plan.assignments[set.pack.id]}));if(!validateWeeklyPlan(original.plan,mapped))fail(400,'Bản cập nhật vượt giới hạn môn hoặc 12 câu/môn của tuần.');for(const set of sets)if(set.subjectId&&set.subjectId!==original.plan.assignments[set.pack.id])fail(409,'Không đổi mã môn của tuần đã giao.');}
        sets.splice(0,sets.length,...revision.sets);
      }
      const duplicateContent=new Set();
      for(const set of sets){const pack=set.pack,key=`${pack.id}@${pack.version}`,meaning=onlineSemanticPackIdentity(pack,mediaHashes);
        if(duplicateContent.has(meaning))fail(409,'Tuần có hai bộ sao chép cùng câu hỏi. Giữ một bộ nguồn để tránh tính sao trùng.');duplicateContent.add(meaning);
        const existing=catalog.find(row=>row.pack_id===pack.id&&row.version===pack.version);
        if(existing&&(onlineImmutablePackIdentity(existing.pack)!==onlineImmutablePackIdentity(pack)||existing.subject_label!==set.subjectLabel))fail(409,`Bộ ${key} đã công bố và không thể sửa. Giữ mã nguồn, chọn phiên bản mới khi cập nhật; thành tích cũ không bị đặt lại.`);
        const assigned=weeks.find(week=>week.id!==replaceWeekId&&week.sets.some(row=>row.pack.id===pack.id));
        if(assigned)fail(409,`Bộ nguồn ${pack.id} đã giao trong “${assigned.title}”. Hãy mở tuần gốc để xem hoặc cập nhật, không tạo tuần sao chép để nhận lại sao.`);
        const copied=catalog.find(row=>row.pack_id!==pack.id&&onlineSemanticPackIdentity(row.pack,mediaHashes)===meaning);
        if(copied)fail(409,`Nội dung đã có ở bộ nguồn ${copied.pack_id}, phiên bản ${copied.version}. Dùng lại bộ gốc; đổi tên hoặc mã không tạo bộ nhận sao mới.`);
        const sameGroup=weeks.find(week=>week.id!==replaceWeekId&&onlineIdentityText(week.title)===onlineIdentityText(title)&&week.sets.some(row=>onlineIdentityText(row.subjectLabel)===onlineIdentityText(set.subjectLabel)&&onlinePackQuestionKind(row.pack)===onlinePackQuestionKind(pack)));
        if(sameGroup)fail(409,'Nhóm môn và dạng câu này đã được giao trong tuần. Giữ mã bộ nguồn và cập nhật phiên bản qua tuần gốc.');
      }
      const newPlan=revision?null:(()=>{const errors=weeklyPlanErrors(sets);if(errors.length)fail(400,errors.join(' '));return createWeeklyPlan(sets);})();
      for(const set of sets){const existing=catalog.find(row=>row.pack_id===set.pack.id&&row.version===set.pack.version);
        if(existing)set.pack=existing.pack;else this.db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)').run(auth.workspaceId,set.pack.id,set.pack.version,set.subjectLabel,json(set.pack),contentIdentity(set.pack));}
      if(revision){sets.forEach((set,index)=>this.db.prepare('UPDATE week_sets SET version=? WHERE workspace_id=? AND week_id=? AND position=? AND pack_id=?').run(set.pack.version,auth.workspaceId,replaceWeekId,index+1,set.pack.id));
        this.db.prepare('UPDATE weeks SET title=? WHERE workspace_id=? AND id=? AND class_id=?').run(title,auth.workspaceId,replaceWeekId,classId);
        this.audit(auth,'week.revise',json({weekId:replaceWeekId,requestId,payloadHash:revisionHash}));return this.weeks(auth,classId).find(week=>week.id===replaceWeekId);}
      const weekId=id(),position=this.db.prepare('SELECT coalesce(max(position),0)+1 AS p FROM weeks WHERE workspace_id=? AND class_id=?').get(auth.workspaceId,classId).p;
      this.db.prepare('INSERT INTO weeks VALUES(?,?,?,?,?,?,?,?)').run(weekId,auth.workspaceId,classId,title,position,requestId,hash,now());
      sets.forEach((set,index)=>this.db.prepare('INSERT INTO week_sets VALUES(?,?,?,?,?)').run(auth.workspaceId,weekId,index+1,set.pack.id,set.pack.version));
      this.audit(auth,'week.policy',json({weekId,plan:newPlan}));
      this.audit(auth,'week.publish',weekId);return this.weeks(auth,classId).find(week=>week.id===weekId);
    });
  }
  journeyMarker(auth,student){
    const markers=this.db.prepare("SELECT target_id FROM audit WHERE workspace_id=? AND user_id=? AND action IN ('student.journey.init','student.journey.advance')").all(auth.workspaceId,student.user_id).flatMap(row=>{try{const marker=parse(row.target_id);return marker?.studentId===student.id&&marker.classId===student.class_id?[marker]:[];}catch{return[];}});
    return markers.sort((a,b)=>b.position-a.position)[0]??null;
  }
  progress(auth,student){return journeyProgress(this.weeks(auth,student.class_id),this.rewards(auth,student.id),this.journeyMarker(auth,student));}
  summaryProgress(auth,student,awards=this.rewards(auth,student.id)){
    const rows=this.db.prepare(`SELECT w.id AS week_id,w.class_id,w.title AS week_title,w.position AS week_position,w.created_at,p.subject_label,
      CASE WHEN p.pack_id IS NOT NULL THEN json_object('id',p.pack_id,'version',p.version,'title',json_extract(p.json,'$.title'),'kind',json_extract(p.json,'$.kind'),'subject',json_extract(p.json,'$.subject'),'grade',json_extract(p.json,'$.grade'),'itemCount',json_array_length(p.json,'$.items'),'questionIds',json((SELECT json_group_array(json_extract(item.value,'$.id')) FROM json_each(p.json,'$.items') item))) END AS summary
      FROM weeks w LEFT JOIN week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id LEFT JOIN packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE w.workspace_id=? AND w.class_id=? ORDER BY w.position,s.position`).all(auth.workspaceId,student.class_id);
    return journeyProgress(summaryWeeks(rows),awards,this.journeyMarker(auth,student));
  }
  studentSummary(auth,cursor='0'){
    if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');
    const student=this.student(auth,auth.studentId),cls=this.class(auth,student.class_id),workspace=this.workspace(auth.workspaceId),rewards=this.rewards(auth,student.id),requests=this.requests(auth,student.id),progress=summaryPage(this.summaryProgress(auth,student,rewards),cursor),balance=rewardBalance(earnedQuestionRewardStars(rewards),{requests});
    const keys=progress.current?[progress.current.pack]:[];
    const games=new Map(keys.length?this.db.prepare(`SELECT * FROM packs WHERE workspace_id=? AND (${keys.map(()=>'(pack_id=? AND version=?)').join(' OR ')})`).all(auth.workspaceId,...keys.flatMap(p=>[p.id,p.version])).map(row=>[`${row.pack_id}@${row.version}`,this.packRecord(row).games]):[]);
    const decorate=set=>({...set,games:games.get(`${set.pack.id}@${set.pack.version}`)??[]});progress.weeks=progress.weeks.map(w=>({...w,sets:w.sets.map(decorate)}));if(progress.current)progress.current=decorate(progress.current);
    return{student:{id:student.id,classId:student.class_id,name:student.name,username:student.username,active:!!student.active,createdAt:student.created_at,balance,...(progress.current?{currentWeek:progress.current.weekTitle}:{})},profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,balance,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests};
  }
  pinJourney(auth,student){
    let marker=this.journeyMarker(auth,student);if(marker)return marker;
    const progress=this.summaryProgress(auth,student);if(!progress.journey)return null;
    marker={studentId:student.id,classId:student.class_id,...progress.journey};this.audit(auth,'student.journey.init',json(marker));return marker;
  }
  ensureJourney(auth,input={}){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,['cursor']);return this.tx(()=>{const student=this.student(auth,auth.studentId);this.pinJourney(auth,student);return this.studentSummary(auth,input.cursor??'0');});}
  advanceWeek(auth,input){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,['weekId','requestId']);const weekId=text(input.weekId,'Mã tuần',100),requestId=text(input.requestId,'Mã chuyển tuần',100);
    return this.tx(()=>{
      const student=this.student(auth,auth.studentId),prior=this.db.prepare("SELECT target_id FROM audit WHERE workspace_id=? AND user_id=? AND action='student.journey.advance'").all(auth.workspaceId,auth.id).flatMap(row=>{try{return[parse(row.target_id)];}catch{return[];}}).find(row=>row.studentId===student.id&&row.classId===student.class_id&&row.requestId===requestId);
      if(prior){if(prior.fromWeekId!==weekId)fail(409,'Mã chuyển tuần đã được dùng cho tuần khác.');return this.studentSummary(auth,'current');}
      this.pinJourney(auth,student);const progress=this.summaryProgress(auth,student),current=progress.currentWeekSummary;
      if(current?.weekId!==weekId)fail(403,'Con chỉ được chuyển từ tuần hiện tại.');if(!current.ready)fail(400,'Tất cả câu hỏi trong tuần cần đạt ít nhất 2 sao trước khi chuyển tuần.');
      const next=progress.weeks.find(week=>week.id===current.nextWeekId);if(!next)fail(400,'Đây là tuần cuối cùng đã được giao.');
      const masteredPacks=progress.weeks.find(week=>week.id===weekId).sets.map(set=>({packId:set.pack.id,contentVersion:set.pack.version}));
      this.abandonActive(auth,student.id);this.audit(auth,'student.journey.advance',json({studentId:student.id,classId:student.class_id,weekId:next.id,position:next.position,fromWeekId:weekId,requestId,masteredPacks}));return this.studentSummary(auth,'current');
    });
  }
  assignedPack(auth,packId,version){
    const student=this.student(auth,auth.studentId),progress=this.summaryProgress(auth,student),assigned=progress.weeks.filter(week=>week.unlocked).flatMap(week=>week.sets).find(set=>set.pack.id===packId&&set.pack.version===version);
    if(!assigned)fail(403,'Con chỉ được học bộ câu hỏi thuộc tuần hiện tại. Tuần đã đóng và tuần chưa mở không thể chơi.');return this.packRecord(this.db.prepare('SELECT * FROM packs WHERE workspace_id=? AND pack_id=? AND version=?').get(auth.workspaceId,packId,version));
  }
  packGames(auth,packId,version){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');return{packId,contentVersion:version,games:this.assignedPack(auth,packId,version).games};}
  studentState(auth){const student=this.student(auth,auth.studentId),cls=this.class(auth,student.class_id),workspace=this.workspace(auth.workspaceId),progress=this.progress(auth,student);
    return{student:this.publicStudent(auth,student),profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,rewards:this.rewards(auth,student.id),balance:this.balance(auth,student.id),wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests:this.requests(auth,student.id)};}
  dashboard(auth){const classes=this.db.prepare('SELECT * FROM classes WHERE workspace_id=? ORDER BY created_at').all(auth.workspaceId).map(row=>this.publicClass(row));
    const students=this.db.prepare('SELECT s.*,u.username FROM students s JOIN users u ON u.id=s.user_id WHERE s.workspace_id=? ORDER BY s.created_at').all(auth.workspaceId).map(row=>this.publicStudent(auth,row));
    const weeks=classes.flatMap(cls=>this.weeks(auth,cls.id)),redemptions=this.db.prepare('SELECT r.json,s.id AS student_id,s.name,s.class_id FROM redemptions r JOIN students s ON s.workspace_id=r.workspace_id AND s.id=r.student_id WHERE r.workspace_id=? ORDER BY r.rowid DESC').all(auth.workspaceId).map(row=>({...parse(row.json),studentId:row.student_id,studentName:row.name,classId:row.class_id})),workspace=this.workspace(auth.workspaceId);
    return{classes,students,weeks,redemptions,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},stats:{students:students.length,classes:classes.length,questions:this.db.prepare('SELECT json FROM packs WHERE workspace_id=?').all(auth.workspaceId).reduce((sum,row)=>sum+parse(row.json).items.length,0),pendingRequests:redemptions.filter(row=>['pending','approved'].includes(rewardStatus(row))).length}};}
  play(auth,playId){const row=this.db.prepare('SELECT * FROM plays WHERE workspace_id=? AND id=? AND student_id=?').get(auth.workspaceId,playId,auth.studentId);if(!row)fail(404,'Không tìm thấy lượt chơi.');const session=parse(row.json);
    const packed=this.db.prepare('SELECT * FROM packs WHERE workspace_id=? AND pack_id=? AND version=?').get(auth.workspaceId,session.packId,session.contentVersion);if(!packed)fail(409,'Bộ câu hỏi của lượt chơi không còn sẵn sàng.');return{session,pack:parse(packed.json)};}
  abandonActive(auth,studentId){for(const row of this.db.prepare('SELECT * FROM plays WHERE workspace_id=? AND student_id=?').all(auth.workspaceId,studentId)){const session=parse(row.json);if(session.status==='active'){session.status='abandoned';session.endedAt=now();this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,session.sessionId);}}}
  startPlay(auth,input,compact=false,secure=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,compact?['requestId','moduleId','packId','contentVersion','reviewItemIds']:['requestId','moduleId','packId','contentVersion']);const requestId=text(input.requestId,'Mã lượt chơi',100),moduleId=text(input.moduleId,'Trò chơi',80),packId=text(input.packId,'Mã bộ',80),version=integer(input.contentVersion,'Phiên bản');
    return this.tx(()=>{const student=this.student(auth,auth.studentId),marker=this.pinJourney(auth,student),prior=this.db.prepare('SELECT id FROM plays WHERE workspace_id=? AND student_id=? AND request_id=?').get(auth.workspaceId,auth.studentId,requestId);
      const choice=this.assignedPack(auth,packId,version);if(!choice.games.some(game=>game.id===moduleId))fail(400,'Dạng câu của bộ này chưa phù hợp với trò chơi đã chọn.');
      const presentation=onlinePresentation(moduleId,choice.pack),requiredItemIds=compact?selectReviewItems(input.reviewItemIds,choice.pack,presentation):undefined;
      if(prior){const value=this.play(auth,prior.id);if(secure&&value.session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(value.session.packId!==packId||value.session.contentVersion!==version||value.session.moduleId!==moduleId||value.session.journeyWeekId&&value.session.journeyWeekId!==marker?.weekId||compact&&(value.session.rewardPolicyVersion!==2||json(value.session.requiredItemIds)!==json(requiredItemIds)))fail(409,'Mã lượt chơi đã dùng cho nội dung khác.');if(value.session.status==='abandoned')fail(409,'Lượt chơi đã thoát. Hãy mở lượt mới.');const result={...value,presentation:filterPlayPresentation(value.session,value.pack,onlinePresentation(moduleId,value.pack))};return compact||secure?compactPlay(result):result;}
      this.abandonActive(auth,student.id);
      const session={sessionId:id(),profileId:student.id,packId,contentVersion:version,moduleId,moduleVersion:getGame(moduleId).version,startedAt:now(),status:'active',rewardPolicyVersion:compact?2:1,presentationVersion:1,journeyWeekId:marker?.weekId,...(compact?{requiredItemIds,questionClocks:{}}:{}),...(secure?{questionProtocolVersion:1,questionClocks:{},questionHints:{},audioReceipts:{}}:{})};
      this.db.prepare('INSERT INTO plays VALUES(?,?,?,?,?)').run(session.sessionId,auth.workspaceId,student.id,requestId,json(session));const result={session,pack:choice.pack,presentation:filterPlayPresentation(session,choice.pack,presentation)};return compact||secure?compactPlay(result):result;
    });}
  assertCurrentPlay(auth,session){
    const student=this.student(auth,auth.studentId),marker=this.journeyMarker(auth,student)??this.pinJourney(auth,student);
    if(session.journeyWeekId&&session.journeyWeekId!==marker?.weekId||!marker)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');
    const assigned=this.db.prepare('SELECT s.version FROM weeks w JOIN week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id WHERE w.workspace_id=? AND w.class_id=? AND w.id=? AND s.pack_id=?').get(auth.workspaceId,student.class_id,marker.weekId,session.packId);
    if(!assigned)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');
    if(session.rewardPolicyVersion===2&&assigned.version!==session.contentVersion)fail(409,'Bộ câu hỏi vừa được cập nhật. Thoát rồi mở lại bài; sao đã lưu vẫn được giữ nguyên.');
  }
  questionHint(auth,playId,input){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');shape(input,['itemId']);const itemId=text(input.itemId,'Mã câu',80);return this.tx(()=>{const{session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');const result=protocolHint(session,pack,this.events(auth,playId),itemId);this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);return result;});}
  recordAudioDelivery(auth,playId,itemId,mediaId,durationMs){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');text(playId,'Mã lượt',100);text(itemId,'Mã câu',80);return this.tx(()=>{const{session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');protocolAudioDelivery(session,pack,this.events(auth,playId),itemId,mediaId,durationMs);this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);});}
  openQuestion(auth,playId,input,requireProtocol=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,['itemId']);const itemId=text(input.itemId,'Mã câu',80);
    return this.tx(()=>{
      const{session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);
      if(session.status!=='active'||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã kết thúc hoặc quá hạn.');
      if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');
      if(session.questionProtocolVersion===1){const receipt=openProtocolQuestion(session,pack,this.events(auth,playId),itemId);this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);return receipt;}
      const presentation=onlinePresentation(session.moduleId,pack),item=presentation?.items.find(item=>item.id===itemId);
      if(!timedQuestion(session,presentation)||!item||!session.requiredItemIds?.includes(itemId))fail(400,'Câu hỏi không dùng bộ đếm thời gian của lượt chơi này.');
      const clock=session.questionClocks??{},openedAt=Object.hasOwn(clock,itemId)?clock[itemId]:now();if(!Object.hasOwn(clock,itemId)){
        Object.defineProperty(clock,itemId,{value:openedAt,enumerable:true,writable:true,configurable:true});session.questionClocks=clock;this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);
      }
      return{openedAt,serverNow:now(),...questionRewardThresholds(item)};
    });
  }
  events(auth,playId){return this.db.prepare('SELECT json FROM attempts WHERE workspace_id=? AND play_id=? ORDER BY rowid').all(auth.workspaceId,playId).map(row=>parse(row.json));}
  attempt(auth,playId,input,requireProtocol=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,['attemptKey','itemId','response','hintsUsed','elapsedMs']);const key=text(input.attemptKey,'Mã lần trả lời',120);if(!/^[a-zA-Z0-9._:-]+$/.test(key))fail(400,'Mã lần trả lời không hợp lệ.');
    const itemId=text(input.itemId,'Mã câu',80),hintsUsed=integer(input.hintsUsed??0,'Số gợi ý',0,20),hash=digest({key,itemId,response:input.response,hintsUsed});
    return this.tx(()=>{const {session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');const prior=this.db.prepare('SELECT payload_hash,json FROM attempts WHERE workspace_id=? AND play_id=? AND attempt_key=?').get(auth.workspaceId,playId,key);
      if(prior){if(prior.payload_hash!==hash)fail(409,'Lần trả lời đã được lưu với đáp án khác.');if(session.status==='abandoned')fail(409,'Lượt chơi đã thoát.');const event=parse(prior.json);let questionRewards;
        if(session.rewardPolicyVersion===2){let questions=[];if(event.correct){const row=this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? AND pack_id=?').get(auth.workspaceId,auth.studentId,pack.id),reward=row?parse(row.json):null,touched=new Set(onlineScoreResponse(pack,session.moduleId,event.itemId,event.response).touchedItemIds);questions=questionRewardProgress(pack,reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0)).questions.filter(question=>touched.has(question.itemId));}questionRewards={gained:0,questions};}
        return{event,duplicate:true,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};}
      if(session.status!=='active')fail(409,'Lượt chơi đã kết thúc hoặc được thay bằng lượt mới ở thiết bị khác.');
      if(Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã quá hạn. Hãy mở lượt mới.');
      const events=this.events(auth,playId);if(events.length>=5000)fail(400,'Lượt chơi đã đạt giới hạn số lần thử.');
      const item=pack.items.find(row=>row.id===itemId);if(!item)fail(400,'Câu hỏi không thuộc lượt chơi.');
      let outcome;try{outcome=onlineScoreResponse(pack,session.moduleId,itemId,input.response);}catch(error){fail(400,error.message);}
      if(session.rewardPolicyVersion===2&&outcome.touchedItemIds.some(id=>!session.requiredItemIds?.includes(id)))fail(400,'Câu trả lời nằm ngoài các câu đã chọn cho lượt học lại.');
      const occurredAt=now();let elapsedMs=input.elapsedMs;if(timedQuestion(session,onlinePresentation(session.moduleId,pack))){const openedAt=session.questionClocks&&Object.hasOwn(session.questionClocks,itemId)&&session.questionClocks[itemId];if(!openedAt)fail(400,'Cần mở câu hỏi trước khi trả lời.');elapsedMs=Date.parse(occurredAt)-Date.parse(openedAt);}
      else if(session.rewardPolicyVersion===2)elapsedMs=0;
      if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>14400000)fail(400,'Thời gian trả lời không hợp lệ.');
      const event={eventId:`${session.sessionId}:${key}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:pack.version,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId,objectiveId:item.objectiveId,correct:outcome.correct,hintsUsed:session.questionProtocolVersion===1?(Object.hasOwn(session.questionHints??{},itemId)?session.questionHints[itemId].used:0):hintsUsed,elapsedMs,occurredAt,response:input.response,gameSequence:events.length+1};
      const errors=onlineEvidenceErrors(session,[...events,event],pack);if(errors.length)fail(400,errors[0]);
      this.db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?)').run(auth.workspaceId,playId,key,hash,json(event));
      let questionRewards=session.rewardPolicyVersion===2?{gained:0,questions:[]}:undefined;if(session.rewardPolicyVersion===2&&outcome.correct){const previous=this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? AND pack_id=?').get(auth.workspaceId,auth.studentId,pack.id),reward=previous?parse(previous.json):null;
        const result=applyQuestionRewardCandidates(reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0),questionRewardCandidates(session,[...events,event],pack)),progress=questionRewardProgress(pack,result.ledger),tier=Math.max(1,progress.bestTier);
        if(!reward||json(reward.questionLedger)!==json(result.ledger)){const award={...(reward??{profileId:auth.studentId,packId:pack.id,sessionId:session.sessionId,completedAt:event.occurredAt,totalItems:pack.items.length,firstTryCorrect:0}),starTier:tier,questionLedger:result.ledger};this.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json').run(auth.workspaceId,auth.studentId,pack.id,tier,json(award));}
        const touched=new Set(outcome.touchedItemIds);questionRewards={gained:result.gained,questions:progress.questions.filter(question=>touched.has(question.itemId))};
      }return{event,duplicate:false,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};
    });}
  finishPlay(auth,playId,abandon=false,compact=false,requireProtocol=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');return this.tx(()=>{const{session,pack}=this.play(auth,playId);if(!abandon)this.assertCurrentPlay(auth,session);if(!abandon&&requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(session.status==='abandoned'){if(abandon)return{};fail(409,'Lượt chơi đã thoát.');}
    if(session.status==='completed')return{state:compact?this.studentSummary(auth,'current'):this.studentState(auth),gained:0,tier:this.rewards(auth,auth.studentId).find(row=>row.packId===pack.id)?.starTier??0};
    const completed={...session,status:abandon?'abandoned':'completed',endedAt:now()},events=this.events(auth,playId);let gained=0,tier=0;
    if(!abandon){const errors=session.rewardPolicyVersion===2?v2QuestionCompletionErrors(completed,events,pack):onlineEvidenceErrors(completed,events,pack,true);if(errors.length)fail(400,errors[0]);const previous=this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? AND pack_id=?').get(auth.workspaceId,auth.studentId,pack.id),prior=previous?parse(previous.json):null;
      if(session.rewardPolicyVersion===2){tier=questionRewardProgress(pack,prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0)).bestTier;}
      else{const award=onlineAward(completed,events,pack);if(!award)fail(400,'Chưa đủ dữ liệu để xác nhận sao.');const legacyStars=Math.max(award.starTier,prior?.questionLedger?.legacyStars??prior?.starTier??0),result=applyQuestionRewardCandidates(prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0),[],legacyStars);gained=result.gained;tier=legacyStars;
        const value={...award,starTier:Math.max(1,questionRewardProgress(pack,result.ledger).bestTier),questionLedger:result.ledger};this.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json').run(auth.workspaceId,auth.studentId,pack.id,value.starTier,json(value));
      }
    }
    this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(completed),auth.workspaceId,playId);this.audit(auth,abandon?'play.abandon':'play.complete',playId);return abandon?{}:{state:compact?this.studentSummary(auth,'current'):this.studentState(auth),gained,tier};
  });}
  configureWallet(auth,input){shape(input,['enabled','rateVnd']);if(typeof input.enabled!=='boolean')fail(400,'Trạng thái đổi sao không hợp lệ.');const rate=integer(input.rateVnd,'Giá trị mỗi sao',1,1000000);
    return this.tx(()=>{this.db.prepare('UPDATE workspaces SET wallet_enabled=?,rate_vnd=? WHERE id=?').run(Number(input.enabled),rate,auth.workspaceId);this.audit(auth,'wallet.configure',auth.workspaceId);return{enabled:input.enabled,rateVnd:rate};});}
  requestReward(auth,input){shape(input,['requestId','title','goalVnd']);text(input.requestId,'Mã yêu cầu',100);text(input.title,'Tên phần thưởng',120);integer(input.goalVnd,'Mục tiêu',1,100000000);return this.tx(()=>{this.student(auth,auth.studentId);const workspace=this.workspace(auth.workspaceId),prior=this.db.prepare('SELECT student_id FROM redemptions WHERE workspace_id=? AND id=?').get(auth.workspaceId,input.requestId);if(prior&&prior.student_id!==auth.studentId)fail(409,'Mã yêu cầu không thể sử dụng.');
    const wallet={schemaVersion:1,enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd,updatedAt:now(),requests:this.requests(auth,auth.studentId)};let request;
    try{request=makeRewardRequest(wallet,this.balance(auth,auth.studentId).earned,input,now());}catch(error){fail(400,error.message);}
    this.db.prepare('INSERT OR IGNORE INTO redemptions VALUES(?,?,?,?,?)').run(auth.workspaceId,request.requestId,auth.studentId,rewardStatus(request),json(request));this.audit(auth,'redemption.request',request.requestId);return request;
  });}
  transitionReward(auth,requestId,input,cancel=false){shape(input,cancel?[]:['status','note']);return this.tx(()=>{const row=this.db.prepare('SELECT * FROM redemptions WHERE workspace_id=? AND id=?').get(auth.workspaceId,requestId);if(!row||cancel&&row.student_id!==auth.studentId)fail(404,'Không tìm thấy yêu cầu đổi sao.');
    const status=cancel?'cancelled':input.status;if(!['approved','rejected','fulfilled','cancelled'].includes(status)||!cancel&&status==='cancelled')fail(400,'Trạng thái đổi thưởng không hợp lệ.');
    let request;try{request=changeRewardRequest(parse(row.json),status,now(),input.note);}catch(error){fail(409,error.message);}
    this.db.prepare('UPDATE redemptions SET status=?,json=? WHERE workspace_id=? AND id=?').run(status,json(request),auth.workspaceId,requestId);this.audit(auth,`redemption.${status}`,requestId);return request;
  });}
}
