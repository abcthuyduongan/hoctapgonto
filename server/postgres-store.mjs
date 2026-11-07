import pg from 'pg';
import {BAO_AN_GIFT_PRESET,BAO_AN_GIFT_RATE_VND,BAO_AN_GIFT_PRESET_ID,presetGiftDetails} from '../src/core/gift-presets.ts';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {OnlineError,fail,shape,text,integer} from './online-errors.mjs';
import {parseContentImport} from '../src/core/content-io.ts';
import {GAME_REGISTRY,getGame} from '../src/core/registry.ts';
import {validatePack} from '../src/core/validation.ts';
import {onlinePresentation,onlineEvidenceErrors,onlineScoreResponse,onlineAward} from '../src/core/online-exercises.ts';
import {makeRewardRequest,changeRewardRequest,rewardStatus,rewardBalance} from '../src/core/reward-wallet.ts';
import {onlineImmutablePackIdentity,onlinePackQuestionKind,onlineSemanticPackIdentity,onlineWeekIdentity,onlineIdentityText,onlineRevisionOrder,onlinePreserveQuestionIds} from '../src/core/online-import-identity.ts';
import {summaryWeeks,summaryPage,compactPlay} from './student-summary.mjs';
import {projectStudentMap} from './world-map-summary.mjs';
import {createWeeklyPlan,weeklyPlanErrors,validateWeeklyPlan} from '../src/core/weekly-plan.ts';
import {readWeekPolicies,closedStudentCount,changesQuestionMeaning} from './weekly-policy.mjs';
import {journeyProgress,selectReviewItems,filterPlayPresentation,timedQuestion} from './question-journey.mjs';
import {initializeQuestionRewardLedger,applyQuestionRewardCandidates,questionRewardCandidates,questionRewardProgress,questionRewardThresholds,earnedQuestionRewardStars,v2QuestionCompletionErrors} from '../src/core/question-rewards.ts';
import {openProtocolQuestion,protocolAudioDelivery,protocolHint,answerFeedback,publicSession} from './question-protocol.mjs';
import {measureApiSpan} from './api-diagnostics.mjs';
import {toVietnamDateString,getVietnamWeekKey,computeStreakState,registerDailyCorrectAnswer,buildDailyMissions,buildStudentBadgeStatuses,BADGE_CATALOG} from '../src/core/badges.ts';
import {checkCurfewHours,checkDailyScreenTime,msToMinutes,getVietnamTimeParts} from '../src/core/parent-controls.ts';
import {buildParentWeeklyReport,hashParentPin,verifyParentPin,issueParentElevationToken,verifyParentElevationToken,revokeParentElevationToken,sanitizeParentControls} from './parent-data.mjs';
import {CONTEST_PRESETS,CONTESTANT_BADGE,sanitizeContestItem,evaluateContestSubmission,checkReadinessForExam,generateContestQuestions,buildReviewMistakesPack} from './contest-data.mjs';
import {TOWN_BUILDING_CATALOG,TOWN_BUILDING_MAP,resolveTownSubject,getMaterialForSubject,calculateEarnedMaterialsFromAwards,calculateTotalSpentMaterials,calculateAvailableMaterials,canAffordBuilding,defaultTownState,evaluateBuildingPlacement} from './town-data.mjs';
import {ANIMAL_CATALOG,ANIMAL_MAP,getUnlockedAnimals,validateAnimalName} from '../src/core/animal-neighbors.ts';
import {sanitizeClassFeedEvent,verifyPrivacyCompliance} from '../src/core/class-feed.ts';
import {normalizeIntegrationSubject} from './safetime-integration.mjs';

const now=()=>new Date().toISOString(),id=()=>randomUUID(),json=JSON.stringify;
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const MAX_PIN_FAILURES=5;
const PIN_LOCKOUT_MS=15*60*1000;
const currentMarker=(values,student)=>(values??[]).flatMap(value=>{try{const marker=parse(value);return marker?.studentId===student.id&&marker.classId===student.class_id?[marker]:[];}catch{return[];}}).sort((a,b)=>b.position-a.position)[0]??null;
const stable=value=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row);
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
const contentIdentity=pack=>{const{publishedAt,source,...content}=pack;void publishedAt;void source;return digest(content);};
const role=(auth,expected)=>{if(auth.role!==expected)fail(403,expected==='admin'?'Chỉ quản lý được thực hiện thao tác này.':'Hãy dùng tài khoản học sinh để vào luyện tập.');};
function databaseError(error){
  if(error instanceof OnlineError)return error;
  if(error?.code==='23505')return new OnlineError(409,'Dữ liệu đã có hoặc được thay đổi đồng thời. Hãy tải lại.');
  if(['23503','23514','22P02'].includes(error?.code))return new OnlineError(400,'Dữ liệu tham chiếu không hợp lệ.');
  return error;
}

/** Server-only PostgreSQL repository. Every statement names the private schema explicitly. */
export class PostgresStore{
  constructor({pool,connectionString,ssl,max=5}={}){
    this.pool=pool??new pg.Pool({connectionString,ssl,max,connectionTimeoutMillis:10000,idleTimeoutMillis:20000});this.ownsPool=!pool;
    this.lastCorrectPositions = new Map();
  }
  async lastQuestionCorrectPosition(workspaceId, studentId, itemId, version, client = this.pool, packId = null) {
    try {
      let query = `
        SELECT (json->'questionPresentations'->$3->>'displayedCorrectIndex')::int AS pos
        FROM bao_an.plays
        WHERE workspace_id=$1 AND student_id=$2 AND (json->'questionPresentations'->$3->>'displayedCorrectIndex') IS NOT NULL
      `;
      const params = [workspaceId, studentId, itemId];
      let pIdx = 4;
      if (packId) {
        query += ` AND json->>'packId' = $${pIdx++}`;
        params.push(packId);
      }
      if (version) {
        query += ` AND (json->>'contentVersion')::int = $${pIdx++}`;
        params.push(version);
      }
      query += ` ORDER BY (json->>'startedAt') DESC LIMIT 1`;
      const row = await this.one(query, params, client);
      if (row && Number.isInteger(row.pos)) {
        return row.pos;
      }
    } catch {}
    return null;
  }
  recordQuestionCorrectPosition(workspaceId, studentId, itemId, version, pos) {}
  async ready(){
    const row=await this.one('SELECT max(version) AS version, count(*)::int AS count FROM bao_an.schema_version');
    if(!row||row.version<9||row.count<9)fail(500,'Cần chạy migration dữ liệu online đầy đủ (phiên bản 9). Chạy cloud:setup hoặc áp dụng các migration trong supabase/migrations/.');
    const required=['student_goals','parent_controls','parent_students','gift_catalog','badge_awards','contest_sessions','town_states','integration_clients','integration_pair_codes','integration_tickets','integration_refresh_tokens','integration_events'];
    const existing=(await this.rows("SELECT tablename FROM pg_tables WHERE schemaname='bao_an'")).map(r=>r.tablename);
    for(const t of required)if(!existing.includes(t))fail(500,`Cần chạy migration dữ liệu online: thiếu bảng bao_an.${t}.`);
    return this;
  }
  async close(){if(this.ownsPool)await this.pool.end();}
  async query(sql,values=[],client=this.pool){return measureApiSpan('sql',()=>/\bFOR (UPDATE|SHARE)\b/i.test(sql)?measureApiSpan('lockingSql',()=>client.query(sql,values)):client.query(sql,values));}
  async rows(sql,values=[],client=this.pool){return(await this.query(sql,values,client)).rows;}
  async one(sql,values=[],client=this.pool){return(await this.rows(sql,values,client))[0];}
  async exec(sql,values=[],client=this.pool){return this.query(sql,values,client);}
  async transaction(action){
    for(let attempt=0;;attempt++){
      const client=await measureApiSpan('pool',()=>this.pool.connect());
      try{await this.exec('BEGIN',[],client);await this.exec("SELECT set_config('statement_timeout','15000ms',true),set_config('lock_timeout','10000ms',true)",[],client);const result=await action(client);await this.exec('COMMIT',[],client);return result;}
      catch(error){await this.exec('ROLLBACK',[],client).catch(()=>{});if(attempt<2&&['40001','40P01'].includes(error?.code))continue;throw databaseError(error);}
      finally{client.release();}
    }
  }
  async activeActor(auth,client){
    const user=await this.one(`SELECT u.*,
      EXISTS(SELECT 1 FROM bao_an.auth_sessions s WHERE s.token_hash=$3 AND s.user_id=u.id AND s.csrf_token=$4 AND s.expires_at>$5) AS session_active,
      EXISTS(SELECT 1 FROM bao_an.students s WHERE s.workspace_id=u.workspace_id AND s.id=u.student_id AND s.active=true) AS student_active
      FROM bao_an.users u WHERE u.workspace_id=$1 AND u.id=$2 FOR UPDATE OF u`,[auth.workspaceId,auth.id,auth.tokenHash??null,auth.csrfToken??null,Date.now()],client);
    if(!user?.active||user.role!==auth.role||(user.student_id??undefined)!==(auth.studentId??undefined))fail(401,'Tài khoản hoặc quyền truy cập đã thay đổi. Hãy đăng nhập lại.');
    // HTTP actors carry their session; trusted in-process callers may omit it.
    // mutate holds the same workspace lock as logout/reset until commit.
    if(auth.tokenHash!==undefined&&!user.session_active)fail(401,'Phiên đăng nhập đã hết hạn hoặc đã được thu hồi. Hãy đăng nhập lại.');
    if(user.role==='student'&&!user.student_active)fail(401,'Tài khoản học sinh đã được khóa.');
  }
  // Student actions share the workspace lock: students no longer queue behind each other, while an
  // admin change (exclusive lock) still waits for in-flight student work and blocks new work.
  // activeActor's FOR UPDATE on the user row keeps one student's own requests serialized.
  async mutate(auth,action){return this.transaction(async client=>{await this.workspace(auth.workspaceId,client,auth.role==='student'?'share':true);await this.activeActor(auth,client);return action(client);});}
  async audit(auth,action,target,client){await this.exec('INSERT INTO bao_an.audit(id,workspace_id,user_id,action,target_id,at) VALUES($1,$2,$3,$4,$5,$6)',[id(),auth.workspaceId,auth.id,action,target,now()],client);}
  async configured(client=this.pool){return!!await this.one("SELECT id FROM bao_an.users WHERE role='admin' LIMIT 1",[],client);}
  async workspace(workspaceId,client=this.pool,lock=false){return await this.one(`SELECT * FROM bao_an.workspaces WHERE id=$1${lock==='share'?' FOR SHARE':lock?' FOR UPDATE':''}`,[workspaceId],client)??fail(404,'Không tìm thấy đơn vị.');}
  async findUserByUsername(name){return this.one('SELECT * FROM bao_an.users WHERE username=$1',[name]);}
  async findUserById(userId){return this.one('SELECT * FROM bao_an.users WHERE id=$1',[userId]);}
  async changeOwnPassword(auth,expectedHash,newHash){
    role(auth,'student');text(expectedHash,'Mật khẩu hiện tại đã mã hóa',500);text(newHash,'Mật khẩu mới đã mã hóa',500);
    if(typeof auth.tokenHash!=='string'||typeof auth.csrfToken!=='string')fail(401,'Hãy đăng nhập lại trước khi đổi mật khẩu.');
    return this.mutate(auth,async client=>{
      const user=await this.one('SELECT password_hash FROM bao_an.users WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,auth.id],client);
      if(user.password_hash!==expectedHash)fail(409,'Mật khẩu đã được thay đổi. Hãy đăng nhập lại trước khi tiếp tục.');
      await this.exec('UPDATE bao_an.users SET password_hash=$3 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,auth.id,newHash],client);
      await this.exec('DELETE FROM bao_an.auth_sessions WHERE user_id=$1',[auth.id],client);await this.abandonActive(auth,auth.studentId,client);await this.audit(auth,'student.change-password',auth.studentId,client);
      return{changed:true,reauthenticate:true};
    });
  }
  async createWorkspaceAdmin({name,username,passwordHash}){
    text(name,'Tên đơn vị',120);text(username,'Tên đăng nhập',60);text(passwordHash,'Mật khẩu đã mã hóa',500);
    return this.transaction(async client=>{
      await this.one('SELECT version FROM bao_an.schema_version WHERE version=1 FOR UPDATE',[],client);if(await this.configured(client))fail(409,'Máy chủ đã được khởi tạo.');
      const workspaceId=id(),userId=id(),created=now();await this.exec('INSERT INTO bao_an.workspaces(id,name,created_at) VALUES($1,$2,$3)',[workspaceId,name,created],client);
      return this.one("INSERT INTO bao_an.users(id,workspace_id,username,password_hash,role,created_at) VALUES($1,$2,$3,$4,'admin',$5) RETURNING *",[userId,workspaceId,username,passwordHash,created],client);
    });
  }
  async findSession(tokenHash,nowMs=Date.now()){
    return this.one('SELECT u.*,s.csrf_token,s.token_hash FROM bao_an.auth_sessions s JOIN bao_an.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.active=true',[tokenHash,nowMs]);
  }
  async createSession({tokenHash,userId,csrfToken,expiresAt,passwordHash,workspaceId}){
    text(tokenHash,'Mã phiên',64);text(csrfToken,'Mã biểu mẫu',200);integer(expiresAt,'Hạn phiên',1,Number.MAX_SAFE_INTEGER);
    const expectedWorkspace=workspaceId??(await this.findUserById(userId))?.workspace_id;if(!expectedWorkspace)fail(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
    return this.transaction(async client=>{
      const workspace=await this.workspace(expectedWorkspace,client,'share'),user=await this.one('SELECT * FROM bao_an.users WHERE id=$1 FOR UPDATE',[userId],client);
      if(!user?.active||user.workspace_id!==expectedWorkspace||typeof passwordHash!=='string'||user.password_hash!==passwordHash)fail(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
      // Concurrent logins only share the workspace lock now; skip rows another login is already removing.
      await this.exec('DELETE FROM bao_an.auth_sessions WHERE token_hash IN (SELECT token_hash FROM bao_an.auth_sessions WHERE expires_at<$1 LIMIT 500 FOR UPDATE SKIP LOCKED)',[Date.now()],client);
      await this.exec('INSERT INTO bao_an.auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)',[tokenHash,userId,csrfToken,expiresAt],client);return{...user,session_workspace:{id:workspace.id,name:workspace.name}};
    });
  }
  async revokeSession(tokenHash){
    const session=await this.one('SELECT u.workspace_id FROM bao_an.auth_sessions s JOIN bao_an.users u ON u.id=s.user_id WHERE s.token_hash=$1',[tokenHash]);
    if(!session)return;
    await this.transaction(async client=>{await this.workspace(session.workspace_id,client,'share');await this.exec('DELETE FROM bao_an.auth_sessions WHERE token_hash=$1',[tokenHash],client);});
  }
  async consumeLoginLimit({addressHash,userHash,now:time=Date.now(),purpose='login'}){
    const entries=[{key:addressHash,max:100},{key:userHash,max:12}].sort((a,b)=>a.key.localeCompare(b.key));
    for(const entry of entries)text(entry.key,'Mã giới hạn đăng nhập',100);
    await this.transaction(async client=>{
      // Skip counters being renewed by another request rather than waiting on them.
      // Exclude our own keys; their expiry is handled atomically by the UPSERT below.
      // A single ordered UPSERT locks both counters. Throwing rolls back both,
      // including a previously absent address counter when the user is limited.
      const rows=await this.rows(`WITH expired AS (
        DELETE FROM bao_an.login_limits WHERE key IN (
          SELECT key FROM bao_an.login_limits WHERE reset_at<=$2 AND NOT(key=ANY($1::text[]))
          ORDER BY reset_at,key LIMIT 100 FOR UPDATE SKIP LOCKED) RETURNING key
      ) INSERT INTO bao_an.login_limits(key,count,reset_at)
        SELECT key,1,$2::bigint+900000 FROM unnest($1::text[]) AS entry(key) ORDER BY key
        ON CONFLICT(key) DO UPDATE SET count=CASE WHEN bao_an.login_limits.reset_at>$2 THEN bao_an.login_limits.count+1 ELSE 1 END,
          reset_at=CASE WHEN bao_an.login_limits.reset_at>$2 THEN bao_an.login_limits.reset_at ELSE $2::bigint+900000 END
        RETURNING key,count`,[entries.map(entry=>entry.key),time],client);
      if(rows.some(row=>row.count>entries.find(entry=>entry.key===row.key).max))fail(429,purpose==='password'?'Đã thử đổi mật khẩu quá nhiều lần. Hãy đợi 15 phút rồi thử lại.':'Đã thử đăng nhập quá nhiều lần. Hãy đợi 15 phút rồi thử lại.');
    });
  }
  async clearLoginUserLimit(userHash){await this.exec('DELETE FROM bao_an.login_limits WHERE key=$1',[userHash]);}
  async class(auth,classId,client=this.pool){return await this.one('SELECT * FROM bao_an.classes WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,classId],client)??fail(404,'Không tìm thấy lớp học.');}
  async student(auth,studentId,client=this.pool){
    if(auth.role==='student'&&auth.studentId!==studentId)fail(404,'Không tìm thấy học sinh.');
    return await this.one('SELECT s.*,u.username FROM bao_an.students s JOIN bao_an.users u ON u.id=s.user_id AND u.workspace_id=s.workspace_id WHERE s.workspace_id=$1 AND s.id=$2',[auth.workspaceId,studentId],client)??fail(404,'Không tìm thấy học sinh.');
  }
  publicClass(row){return{id:row.id,name:row.name,grade:row.grade,feedEnabled:row.feed_enabled===undefined||row.feed_enabled===null?true:!!row.feed_enabled,createdAt:row.created_at};}
  async updateClassSettings(auth,classId,input,client=this.pool){
    role(auth,'admin');
    shape(input,['feedEnabled']);
    const cls=await this.class(auth,classId,client);
    const feedEnabled=input.feedEnabled===undefined?true:!!input.feedEnabled;
    await this.exec('UPDATE bao_an.classes SET feed_enabled=$3 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,classId,feedEnabled],client);
    return this.publicClass({...cls,feed_enabled:feedEnabled});
  }
  publicMedia(row){return{id:row.id,name:row.name,mime:row.mime,kind:row.kind,size:row.size,sha256:row.sha256};}
  async listMedia(auth){role(auth,'admin');return(await this.rows('SELECT * FROM bao_an.media WHERE workspace_id=$1 ORDER BY created_at,id',[auth.workspaceId])).map(row=>this.publicMedia(row));}
  prepareMedia(auth,{id:mediaId,name,mime,bytes,objectPath}){
    role(auth,'admin');name=text(name,'Tên tệp',180);if(/[\\/]/.test(name))fail(400,'Tên tệp không được chứa đường dẫn.');
    if(!Buffer.isBuffer(bytes)&&!(bytes instanceof Uint8Array))fail(400,'Dữ liệu tệp không hợp lệ.');bytes=Buffer.from(bytes);if(bytes.length<12||bytes.length>2*1024*1024)fail(400,'Mỗi tệp cần từ 12 byte đến 2 MB.');
    text(mediaId,'Mã tệp',100);if(!/^[A-Za-z0-9-]+$/.test(mediaId))fail(400,'Mã tệp không hợp lệ.');
    const objectBase=`${auth.workspaceId}/${mediaId}`;
    if(typeof objectPath!=='string'||objectPath!==objectBase&&!(objectPath.startsWith(`${objectBase}.`)&&/^[a-z0-9]{1,5}$/.test(objectPath.slice(objectBase.length+1))))fail(400,'Đường dẫn tệp không thuộc đơn vị hoặc mã tệp này.');
    let detected,kind;
    if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){detected='image/png';kind='image';}
    else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){detected='image/jpeg';kind='image';}
    else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){detected='image/webp';kind='image';}
    else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE'){detected='audio/wav';kind='audio';}
    else if(bytes.toString('ascii',0,4)==='OggS'){detected='audio/ogg';kind='audio';}
    else if(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&0xe0)===0xe0){detected='audio/mpeg';kind='audio';}
    else fail(400,'Chỉ nhận ảnh PNG/JPEG/WebP và âm thanh MP3/WAV/OGG đúng định dạng thực.');
    if(mime&&mime!==detected&&!(detected==='audio/mpeg'&&mime==='audio/mp3')&&!(detected==='audio/wav'&&['audio/x-wav','audio/wave'].includes(mime)))fail(400,'Loại tệp khai báo không khớp nội dung.');
    const sha256=createHash('sha256').update(bytes).digest('hex');
    return{mediaId,name,bytes,objectPath,sha256,detected,kind};
  }
  async addMedia(auth,input){
    const{mediaId,name,bytes,objectPath,sha256,detected,kind}=this.prepareMedia(auth,input);
    return this.mutate(auth,async client=>{
      const prior=await this.one('SELECT * FROM bao_an.media WHERE workspace_id=$1 AND name=$2 AND sha256=$3',[auth.workspaceId,name,sha256],client);if(prior)return this.publicMedia(prior);
      const used=await this.one('SELECT coalesce(sum(size),0) AS used FROM bao_an.media WHERE workspace_id=$1',[auth.workspaceId],client);if(Number(used.used)+bytes.length>256*1024*1024)fail(400,'Kho hình/âm thanh đã đạt giới hạn 256 MB của bản này.');
      const row=await this.one('INSERT INTO bao_an.media(id,workspace_id,name,mime,kind,size,sha256,object_path,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[mediaId,auth.workspaceId,name,detected,kind,bytes.length,sha256,objectPath,now()],client);
      await this.audit(auth,'media.upload',mediaId,client);return this.publicMedia(row);
    });
  }
  async addMediaBatch(auth,inputs){
    role(auth,'admin');if(!Array.isArray(inputs)||inputs.length<1||inputs.length>24)fail(400,'Mỗi đợt tải cần 1–24 tệp.');
    const prepared=inputs.map(input=>this.prepareMedia(auth,input));
    if(prepared.reduce((n,row)=>n+row.bytes.length,0)>2*1024*1024)fail(400,'Mỗi đợt tải tối đa 2 MB.');
    return this.mutate(auth,async client=>{
      const prior=await this.rows('SELECT * FROM bao_an.media WHERE workspace_id=$1 AND name=ANY($2::text[]) AND sha256=ANY($3::text[])',[auth.workspaceId,prepared.map(row=>row.name),prepared.map(row=>row.sha256)],client);
      const rows=[...prior],fresh=[];
      for(const row of prepared)if(!rows.some(old=>old.name===row.name&&old.sha256===row.sha256)){
        const value={id:row.mediaId,workspace_id:auth.workspaceId,name:row.name,mime:row.detected,kind:row.kind,size:row.bytes.length,sha256:row.sha256,object_path:row.objectPath,created_at:now()};rows.push(value);fresh.push(value);
      }
      if(fresh.length){
        const used=await this.one('SELECT coalesce(sum(size),0) AS used FROM bao_an.media WHERE workspace_id=$1',[auth.workspaceId],client);
        if(Number(used.used)+fresh.reduce((n,row)=>n+row.size,0)>256*1024*1024)fail(400,'Kho hình/âm thanh đã đạt giới hạn 256 MB của bản này.');
        await this.exec(`INSERT INTO bao_an.media(id,workspace_id,name,mime,kind,size,sha256,object_path,created_at)
          SELECT id,workspace_id,name,mime,kind,size,sha256,object_path,created_at FROM jsonb_to_recordset($1::jsonb)
          AS x(id text,workspace_id text,name text,mime text,kind text,size integer,sha256 text,object_path text,created_at text)`,[json(fresh)],client);
        const audits=fresh.map(row=>({id:id(),workspace_id:auth.workspaceId,user_id:auth.id,action:'media.upload',target_id:row.id,at:now()}));
        await this.exec(`INSERT INTO bao_an.audit(id,workspace_id,user_id,action,target_id,at) SELECT id,workspace_id,user_id,action,target_id,at
          FROM jsonb_to_recordset($1::jsonb) AS x(id text,workspace_id text,user_id text,action text,target_id text,at text)`,[json(audits)],client);
      }
      return prepared.map(row=>this.publicMedia(rows.find(old=>old.name===row.name&&old.sha256===row.sha256)));
    });
  }
  referencedMedia(pack){return new Set([...(pack.media??[]).map(asset=>asset.mediaId),...pack.items.flatMap(item=>[item.media?.imageId,item.media?.audioId,...('audioId'in item?[item.audioId]:[])])].filter(Boolean));}
  async authorizedMedia(auth,mediaId,client=this.pool){
    if(auth.role==='admin')return this.one('SELECT * FROM bao_an.media WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,mediaId],client);
    if(auth.role!=='student')return undefined;
    const ref="(EXISTS(SELECT 1 FROM jsonb_array_elements(p.json->'items') item WHERE item#>>'{media,imageId}'=$2 OR item#>>'{media,audioId}'=$2 OR item->>'audioId'=$2) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.json->'media') asset WHERE asset->>'mediaId'=$2))";
    return this.one(`SELECT m.* FROM bao_an.media m JOIN bao_an.students learner ON learner.workspace_id=m.workspace_id AND learner.id=$3
      WHERE m.workspace_id=$1 AND m.id=$2 AND (EXISTS(
        SELECT 1 FROM bao_an.weeks w JOIN bao_an.week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id
        JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version
        WHERE w.workspace_id=m.workspace_id AND w.class_id=learner.class_id AND ${ref}) OR EXISTS(
        SELECT 1 FROM bao_an.plays s JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.json->>'packId' AND p.version=(s.json->>'contentVersion')::integer
        WHERE s.workspace_id=m.workspace_id AND s.student_id=learner.id AND s.json->>'profileId'=learner.id AND s.json->>'status' IN ('active','completed') AND ${ref}))`,[auth.workspaceId,mediaId,auth.studentId],client);
  }
  async hasMediaAccess(auth,mediaId,client=this.pool){return!!await this.authorizedMedia(auth,mediaId,client);}
  async getMedia(auth,mediaId){return await this.authorizedMedia(auth,mediaId)??fail(404,'Không tìm thấy tệp hình/âm thanh.');}
  async readMedia(auth,mediaId){return this.getMedia(auth,mediaId);}
  async validateMedia(auth,pack,client){for(const mediaId of this.referencedMedia(pack)){
    const asset=await this.one('SELECT * FROM bao_an.media WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,mediaId],client);if(!asset)fail(400,`Tệp ${mediaId} chưa được tải lên kho của đơn vị.`);
    for(const item of pack.items)if(item.media?.imageId===mediaId&&asset.kind!=='image'||(item.media?.audioId===mediaId||'audioId'in item&&item.audioId===mediaId)&&asset.kind!=='audio')fail(400,'Tệp đính kèm không đúng loại hình hoặc âm thanh.');
    for(const catalog of pack.media??[])if(catalog.mediaId===mediaId&&(asset.kind!=='audio'||catalog.sha256!==asset.sha256))fail(400,'Hash hoặc loại âm thanh không khớp tệp đã tải lên.');
  }}
  async createClass(auth,input){role(auth,'admin');shape(input,['name','grade']);const name=text(input.name,'Tên lớp',120),grade=integer(input.grade,'Khối lớp',1,12);
    return this.mutate(auth,async client=>{if(Number((await this.one('SELECT count(*) AS n FROM bao_an.classes WHERE workspace_id=$1',[auth.workspaceId],client)).n)>=200)fail(400,'Mỗi đơn vị hỗ trợ tối đa 200 lớp trong bản này.');
      const row=await this.one('INSERT INTO bao_an.classes(id,workspace_id,name,grade,created_at) VALUES($1,$2,$3,$4,$5) RETURNING *',[id(),auth.workspaceId,name,grade,now()],client);await this.audit(auth,'class.create',row.id,client);return this.publicClass(row);});
  }
  async rewards(auth,studentId,client=this.pool){if(auth.role==='student'&&auth.studentId!==studentId)fail(404,'Không tìm thấy học sinh.');return(await this.rows('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 ORDER BY pack_id',[auth.workspaceId,studentId],client)).map(row=>parse(row.json));}
  async requests(auth,studentId,client=this.pool){if(auth.role==='student'&&auth.studentId!==studentId)fail(404,'Không tìm thấy học sinh.');return(await this.rows('SELECT json FROM bao_an.redemptions WHERE workspace_id=$1 AND student_id=$2 ORDER BY created_order',[auth.workspaceId,studentId],client)).map(row=>parse(row.json));}
  async balance(auth,studentId,client=this.pool){return rewardBalance(earnedQuestionRewardStars(await this.rewards(auth,studentId,client)),{requests:await this.requests(auth,studentId,client)});}
  studentRecord(row,current,balance){return{id:row.id,classId:row.class_id,name:row.name,username:row.username,active:!!row.active,createdAt:row.created_at,balance,...(current?{currentWeek:current.weekTitle}:{})};}
  async publicStudent(auth,row,client=this.pool){const current=(await this.progress(auth,row,client)).current;return this.studentRecord(row,current,await this.balance(auth,row.id,client));}
  async createStudent(auth,input,passwordHash,username){role(auth,'admin');shape(input,['name','classId','username','password']);const name=text(input.name,'Tên học sinh',100),classId=text(input.classId,'Lớp học',100);text(username,'Tên đăng nhập',60);text(passwordHash,'Mật khẩu đã mã hóa',500);
    return this.mutate(auth,async client=>{await this.class(auth,classId,client);if(Number((await this.one('SELECT count(*) AS n FROM bao_an.students WHERE workspace_id=$1',[auth.workspaceId],client)).n)>=3000)fail(400,'Mỗi đơn vị hỗ trợ tối đa 3.000 học sinh trong bản này.');
      if(await this.one('SELECT id FROM bao_an.users WHERE username=$1',[username],client))fail(409,'Tên đăng nhập đã được sử dụng.');const studentId=id(),userId=id(),created=now();
      await this.exec("INSERT INTO bao_an.users(id,workspace_id,username,password_hash,role,student_id,created_at) VALUES($1,$2,$3,$4,'student',$5,$6)",[userId,auth.workspaceId,username,passwordHash,studentId,created],client);
      await this.exec('INSERT INTO bao_an.students(id,workspace_id,class_id,name,user_id,created_at) VALUES($1,$2,$3,$4,$5,$6)',[studentId,auth.workspaceId,classId,name,userId,created],client);await this.audit(auth,'student.create',studentId,client);return this.publicStudent(auth,await this.student(auth,studentId,client),client);});
  }
  async updateStudent(auth,studentId,input){role(auth,'admin');shape(input,['name','classId','active']);return this.mutate(auth,async client=>{
    const row=await this.student(auth,studentId,client),name=input.name===undefined?row.name:text(input.name,'Tên học sinh',100),classId=input.classId===undefined?row.class_id:text(input.classId,'Lớp học',100);await this.class(auth,classId,client);
    if(input.active!==undefined&&typeof input.active!=='boolean')fail(400,'Trạng thái tài khoản không hợp lệ.');const active=input.active??row.active;
    await this.exec('UPDATE bao_an.students SET name=$3,class_id=$4,active=$5 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,studentId,name,classId,active],client);
    await this.exec('UPDATE bao_an.users SET active=$3 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,row.user_id,active],client);
    if(!active||classId!==row.class_id){await this.exec('DELETE FROM bao_an.auth_sessions WHERE user_id=$1',[row.user_id],client);await this.abandonActive(auth,studentId,client);}
    await this.audit(auth,'student.update',studentId,client);return this.publicStudent(auth,await this.student(auth,studentId,client),client);
  });}
  async resetStudentPassword(auth,studentId,passwordHash){role(auth,'admin');text(passwordHash,'Mật khẩu đã mã hóa',500);return this.mutate(auth,async client=>{
    const row=await this.student(auth,studentId,client);await this.exec('UPDATE bao_an.users SET password_hash=$3 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,row.user_id,passwordHash],client);
    await this.exec('DELETE FROM bao_an.auth_sessions WHERE user_id=$1',[row.user_id],client);await this.abandonActive(auth,studentId,client);await this.audit(auth,'student.reset-password',studentId,client);return{username:row.username};
  });}
  packRecord(row){const pack=parse(row.json);return{pack,subjectLabel:row.subject_label,games:GAME_REGISTRY.filter(game=>{const view=onlinePresentation(game.id,pack);return view&&!validatePack(view).length;}).map(game=>({id:game.id,label:game.id==='math-quest'?'Đảo Câu Hỏi':game.label}))};}
  async weekPolicies(auth,client=this.pool){return readWeekPolicies(await this.rows("SELECT target_id FROM bao_an.audit WHERE workspace_id=$1 AND action='week.policy'",[auth.workspaceId],client));}
  async weeks(auth,classId,client=this.pool){const rows=await this.rows("SELECT w.*,policy.plan FROM bao_an.weeks w LEFT JOIN (SELECT workspace_id,target_id::jsonb->>'weekId' AS week_id,target_id::jsonb->'plan' AS plan FROM bao_an.audit WHERE workspace_id=$1 AND action='week.policy') policy ON policy.workspace_id=w.workspace_id AND policy.week_id=w.id WHERE w.workspace_id=$1 AND w.class_id=$2 ORDER BY w.position",[auth.workspaceId,classId],client);
    if(!rows.length)return[];
    // One read for every assigned version, using the same transaction client.
    // Filtering by the class as well as the workspace avoids loading other
    // classes' catalogs when a student opens or completes a game.
    const sets=await this.rows('SELECT s.week_id,p.* FROM bao_an.week_sets s JOIN bao_an.weeks w ON w.workspace_id=s.workspace_id AND w.id=s.week_id JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE w.workspace_id=$1 AND w.class_id=$2 ORDER BY w.position,s.position',[auth.workspaceId,classId],client),byWeek=new Map();
    const policies=new Map(rows.filter(row=>row.plan).map(row=>[row.id,parse(row.plan)]));
    for(const set of sets){if(!byWeek.has(set.week_id))byWeek.set(set.week_id,[]);byWeek.get(set.week_id).push({...this.packRecord(set),...(policies.has(set.week_id)?{subjectId:policies.get(set.week_id).assignments[set.pack_id]}:{})});}
    return rows.map(row=>({id:row.id,classId:row.class_id,title:row.title,position:row.position,createdAt:row.created_at,...(policies.has(row.id)?{plan:policies.get(row.id)}:{}),sets:byWeek.get(row.id)??[]}));
  }
  async publishWeek(auth,input){role(auth,'admin');shape(input,['requestId','title','classId','sets','replaceWeekId']);const requestId=text(input.requestId,'Mã lần nạp',100),title=text(input.title,'Tên tuần',100),classId=text(input.classId,'Lớp học',100),replaceWeekId=input.replaceWeekId===undefined?undefined:text(input.replaceWeekId,'Tuần cần cập nhật',100);
    if(!Array.isArray(input.sets)||input.sets.length<1||input.sets.length>30)fail(400,'Mỗi tuần cần từ 1–30 bộ câu hỏi.');const hash=digest(input);
    return this.mutate(auth,async client=>{
      const cls=await this.class(auth,classId,client),catalog=(await this.rows('SELECT * FROM bao_an.packs WHERE workspace_id=$1 ORDER BY version',[auth.workspaceId],client)).map(row=>({...row,pack:parse(row.json)})),seen=new Set(),sets=[];
      for(const[ index,set]of input.sets.entries()){
        shape(set,['subjectLabel','subjectId','pack']);const label=set.subjectLabel===undefined||set.subjectLabel===''?'':text(set.subjectLabel,'Tên môn/chủ đề',120);
        if(!set.pack||typeof set.pack!=='object'||!['quiz','pairs','sentences','learning','compare','categorize'].includes(set.pack.kind))fail(400,`Bộ ${index+1}: dạng câu chưa có trò chơi phù hợp.`);
        // Grade belongs to the published source; the receiving class keeps its own grade.
        const source=catalog.find(row=>row.pack_id===set.pack.id&&row.version===set.pack.version)??catalog.find(row=>row.pack_id===set.pack.id);
        let pack;try{pack=parseContentImport(json({schema:'baoan-learning-content',formatVersion:set.pack.kind==='learning'?2:1,packs:[{...set.pack,grade:source?.pack.grade??cls.grade,subject:'thinking'}]}))[0];}catch(error){fail(400,`Bộ ${index+1}: ${error.message}`);}await this.validateMedia(auth,pack,client);
        if(!GAME_REGISTRY.some(game=>{const view=onlinePresentation(game.id,pack);return view&&!validatePack(view).length;}))fail(400,`Bộ ${index+1}: chưa có trò chung cho tất cả câu; sửa giới hạn game hoặc tách bộ trước khi giao.`);
        if(seen.has(pack.id))fail(400,'Một tuần không được lặp lại mã bộ câu hỏi gốc.');seen.add(pack.id);
        sets.push({subjectLabel:label,...(set.subjectId!==undefined?{subjectId:text(set.subjectId,'Mã môn',64)}:{}),pack});
      }
      const mediaHashes=Object.fromEntries((await this.rows('SELECT id,sha256 FROM bao_an.media WHERE workspace_id=$1',[auth.workspaceId],client)).map(row=>[row.id,row.sha256]));
      for(const set of sets){const history=catalog.filter(row=>row.pack_id===set.pack.id&&row.version<=set.pack.version).reverse(),existing=history.find(row=>row.version===set.pack.version);const knownIds=new Set();for(const source of existing?[existing]:history){const prior={...source.pack,items:source.pack.items.filter(item=>!knownIds.has(item.id))};source.pack.items.forEach(item=>knownIds.add(item.id));try{set.pack=onlinePreserveQuestionIds(prior,set.pack,mediaHashes);}catch(error){fail(409,error.message);}}}
      const incomingIdentity=onlineWeekIdentity({title,sets},mediaHashes),weeks=await this.weeks(auth,classId,client),revisionHash=digest({classId,replaceWeekId,content:incomingIdentity,sources:sets.map(set=>`${set.pack.id}@${set.pack.version}`).sort()});
      const marker=(await this.rows("SELECT target_id FROM bao_an.audit WHERE workspace_id=$1 AND action='week.revise'",[auth.workspaceId],client)).map(row=>{try{return parse(row.target_id);}catch{return null;}}).find(row=>row?.requestId===requestId);
      if(marker){if(marker.weekId!==replaceWeekId||marker.payloadHash!==revisionHash)fail(409,'Mã lần cập nhật đã dùng cho nội dung khác.');return weeks.find(week=>week.id===marker.weekId)??fail(404,'Không tìm thấy tuần gốc.');}
      const prior=await this.one('SELECT id,payload_hash,class_id FROM bao_an.weeks WHERE workspace_id=$1 AND request_id=$2',[auth.workspaceId,requestId],client);
      if(prior){const priorWeek=prior.class_id===classId?weeks.find(week=>week.id===prior.id):undefined;
        if(priorWeek&&(prior.payload_hash===hash||onlineWeekIdentity(priorWeek,mediaHashes)===incomingIdentity))return priorWeek;
        fail(409,'Mã lần nạp đã được dùng cho nội dung khác.');}
      const replay=replaceWeekId?undefined:weeks.find(week=>onlineWeekIdentity(week,mediaHashes)===incomingIdentity);if(replay)return replay;
      let revision;
      if(replaceWeekId){const original=weeks.find(week=>week.id===replaceWeekId)??fail(404,'Không tìm thấy tuần cần cập nhật trong lớp này.');
        try{revision=onlineRevisionOrder(original,{title,sets},mediaHashes);}catch(error){fail(409,error.message);}if(original.plan)for(const set of sets)if(set.subjectId&&set.subjectId!==original.plan.assignments[set.pack.id])fail(409,'Không đổi mã môn của tuần đã giao.');if(revision.unchanged)return original;
        const closed=closedStudentCount(await this.rows("SELECT target_id FROM bao_an.audit WHERE workspace_id=$1 AND action='student.journey.advance'",[auth.workspaceId],client),original);
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
        if(existing)set.pack=existing.pack;else await this.exec('INSERT INTO bao_an.packs(workspace_id,pack_id,version,subject_label,json,content_hash) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[auth.workspaceId,set.pack.id,set.pack.version,set.subjectLabel,json(set.pack),contentIdentity(set.pack)],client);}
      if(revision){for(const[index,set]of sets.entries())await this.exec('UPDATE bao_an.week_sets SET version=$1 WHERE workspace_id=$2 AND week_id=$3 AND position=$4 AND pack_id=$5',[set.pack.version,auth.workspaceId,replaceWeekId,index+1,set.pack.id],client);
        await this.exec('UPDATE bao_an.weeks SET title=$1 WHERE workspace_id=$2 AND id=$3 AND class_id=$4',[title,auth.workspaceId,replaceWeekId,classId],client);
        await this.audit(auth,'week.revise',json({weekId:replaceWeekId,requestId,payloadHash:revisionHash}),client);return(await this.weeks(auth,classId,client)).find(week=>week.id===replaceWeekId);}
      const weekId=id(),position=(await this.one('SELECT coalesce(max(position),0)+1 AS p FROM bao_an.weeks WHERE workspace_id=$1 AND class_id=$2',[auth.workspaceId,classId],client)).p;
      await this.exec('INSERT INTO bao_an.weeks(id,workspace_id,class_id,title,position,request_id,payload_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[weekId,auth.workspaceId,classId,title,position,requestId,hash,now()],client);
      for(const[index,set]of sets.entries())await this.exec('INSERT INTO bao_an.week_sets(workspace_id,week_id,position,pack_id,version) VALUES($1,$2,$3,$4,$5)',[auth.workspaceId,weekId,index+1,set.pack.id,set.pack.version],client);
      await this.audit(auth,'week.policy',json({weekId,plan:newPlan}),client);
      await this.audit(auth,'week.publish',weekId,client);return(await this.weeks(auth,classId,client)).find(week=>week.id===weekId);
    });
  }
  async journeyMarker(auth,student,client=this.pool){
    return currentMarker((await this.rows("SELECT target_id FROM bao_an.audit WHERE workspace_id=$1 AND user_id=$2 AND action IN ('student.journey.init','student.journey.advance')",[auth.workspaceId,student.user_id],client)).map(row=>row.target_id),student);
  }
  /** A transaction-local snapshot. Never retained across requests or used instead of activeActor. */
  async studentPlayContext(auth,client,{requestId=null,packId=null}={}){
    const row=await this.one(`SELECT s.*,u.username,
      coalesce((SELECT jsonb_agg(a.target_id) FROM bao_an.audit a WHERE a.workspace_id=s.workspace_id AND a.user_id=s.user_id AND a.action IN ('student.journey.init','student.journey.advance')),'[]'::jsonb) AS journey_markers,
      (SELECT p.id FROM bao_an.plays p WHERE p.workspace_id=s.workspace_id AND p.student_id=s.id AND p.request_id=$3) AS prior_id,
      coalesce((SELECT jsonb_agg(jsonb_build_object('weekId',w.id,'version',ws.version)) FROM bao_an.week_sets ws JOIN bao_an.weeks w ON w.workspace_id=ws.workspace_id AND w.id=ws.week_id WHERE ws.workspace_id=s.workspace_id AND w.class_id=s.class_id AND ws.pack_id=$4),'[]'::jsonb) AS assignments,
      (SELECT row_to_json(pc) FROM bao_an.parent_controls pc WHERE pc.workspace_id=s.workspace_id AND pc.student_id=s.id) AS parent_controls_row
      FROM bao_an.students s JOIN bao_an.users u ON u.id=s.user_id AND u.workspace_id=s.workspace_id WHERE s.workspace_id=$1 AND s.id=$2`,[auth.workspaceId,auth.studentId,requestId,packId],client);
    if(!row)fail(404,'Không tìm thấy học sinh.');
    const{journey_markers,prior_id,assignments,parent_controls_row,...student}=row;
    const parentControls=parent_controls_row?{
      workspaceId:parent_controls_row.workspace_id,
      studentId:parent_controls_row.student_id,
      pinHash:parent_controls_row.pin_hash,
      pinSalt:parent_controls_row.pin_salt,
      pinFailedCount:parent_controls_row.pin_failed_count,
      pinLockedUntil:parent_controls_row.pin_locked_until,
      maxMinutesPerDay:parent_controls_row.max_minutes_per_day,
      allowedStartHour:parent_controls_row.allowed_start_hour,
      allowedEndHour:parent_controls_row.allowed_end_hour,
      updatedAt:parent_controls_row.updated_at
    }:{
      workspaceId:auth.workspaceId,
      studentId:student.id,
      pinHash:null,
      pinSalt:null,
      pinFailedCount:0,
      pinLockedUntil:null,
      maxMinutesPerDay:0,
      allowedStartHour:0,
      allowedEndHour:24,
      updatedAt:student.created_at
    };
    return{student,marker:currentMarker(journey_markers,student),prior:prior_id?{id:prior_id}:null,assignments,parentControls};
  }
  async progress(auth,student,client=this.pool,awards){return journeyProgress(await this.weeks(auth,student.class_id,client),awards??await this.rewards(auth,student.id,client),await this.journeyMarker(auth,student,client));}
  async studentState(auth,client=this.pool){role(auth,'student');const student=await this.student(auth,auth.studentId,client),cls=await this.class(auth,student.class_id,client),workspace=await this.workspace(auth.workspaceId,client),rewards=await this.rewards(auth,student.id,client),requests=await this.requests(auth,student.id,client),progress=await this.progress(auth,student,client,rewards),balance=rewardBalance(earnedQuestionRewardStars(rewards),{requests});
    return{student:this.studentRecord(student,progress.current,balance),profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,rewards,balance,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests};
  }
  async summaryProgress(auth,student,client=this.pool,awards,marker){
    const rows=await this.rows(`SELECT w.id AS week_id,w.class_id,w.title AS week_title,w.position AS week_position,w.created_at,p.subject_label,
      CASE WHEN p.pack_id IS NOT NULL THEN jsonb_build_object('id',p.pack_id,'version',p.version,'title',p.json->>'title','kind',p.json->>'kind','subject',p.json->>'subject','grade',(p.json->>'grade')::int,'itemCount',jsonb_array_length(p.json->'items'),'discovery',p.json->'discovery','questionIds',(SELECT jsonb_agg(item->>'id') FROM jsonb_array_elements(p.json->'items') item)) END AS summary
      FROM bao_an.weeks w LEFT JOIN bao_an.week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id LEFT JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE w.workspace_id=$1 AND w.class_id=$2 ORDER BY w.position,s.position`,[auth.workspaceId,student.class_id],client);
    return journeyProgress(summaryWeeks(rows),awards??await this.rewards(auth,student.id,client),marker===undefined?await this.journeyMarker(auth,student,client):marker);
  }
  async studentSummary(auth,cursor='0',client=this.pool){role(auth,'student');
    const row=await this.one(`SELECT s.*,u.username,row_to_json(c) AS class_row,row_to_json(w) AS workspace_row,
      coalesce((SELECT jsonb_agg(a.json ORDER BY a.pack_id) FROM bao_an.awards a WHERE a.workspace_id=s.workspace_id AND a.student_id=s.id),'[]'::jsonb) AS rewards,
      coalesce((SELECT jsonb_agg(r.json ORDER BY r.created_order) FROM bao_an.redemptions r WHERE r.workspace_id=s.workspace_id AND r.student_id=s.id),'[]'::jsonb) AS requests
      ,coalesce((SELECT jsonb_agg(a.target_id) FROM bao_an.audit a WHERE a.workspace_id=s.workspace_id AND a.user_id=s.user_id AND a.action IN ('student.journey.init','student.journey.advance')),'[]'::jsonb) AS journey_markers
      ,coalesce((SELECT jsonb_agg(DISTINCT a.target_id) FROM bao_an.audit a WHERE a.workspace_id=s.workspace_id AND a.user_id=s.user_id AND a.action='student.discovery.view'),'[]'::jsonb) AS viewed_discovery
      ,(SELECT json_build_object('studentId',sg.student_id,'giftId',sg.gift_id,'pinnedAt',sg.pinned_at,'giftTitle',gc.title,'targetStars',gc.price_stars,'giftImageMediaId',gc.image_media_id,'gift',row_to_json(gc)) FROM bao_an.student_goals sg JOIN bao_an.gift_catalog gc ON gc.workspace_id=sg.workspace_id AND gc.id=sg.gift_id WHERE sg.workspace_id=s.workspace_id AND sg.student_id=s.id) AS student_goal
      ,(SELECT row_to_json(st) FROM bao_an.student_streaks st WHERE st.workspace_id=s.workspace_id AND st.student_id=s.id) AS streak_row
      ,coalesce((SELECT jsonb_agg(json_build_object('badgeId',b.badge_id,'unlockedAt',b.unlocked_at,'json',b.json)) FROM bao_an.badge_awards b WHERE b.workspace_id=s.workspace_id AND b.student_id=s.id),'[]'::jsonb) AS badges_json
      ,coalesce((SELECT jsonb_agg(row_to_json(m)) FROM bao_an.daily_missions m WHERE m.workspace_id=s.workspace_id AND m.student_id=s.id AND m.date=$3),'[]'::jsonb) AS daily_missions_json
      ,(SELECT pc.pin_hash IS NOT NULL FROM bao_an.parent_controls pc WHERE pc.workspace_id=s.workspace_id AND pc.student_id=s.id) AS has_parent_pin
      ,coalesce((SELECT sum((a.json->>'elapsedMs')::int) FROM bao_an.attempts a JOIN bao_an.plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id WHERE a.workspace_id=s.workspace_id AND p.student_id=s.id AND substring(a.json->>'occurredAt' from 1 for 10)=$3),0)::int AS today_study_ms
      FROM bao_an.students s JOIN bao_an.users u ON u.id=s.user_id AND u.workspace_id=s.workspace_id
      JOIN bao_an.classes c ON c.workspace_id=s.workspace_id AND c.id=s.class_id JOIN bao_an.workspaces w ON w.id=s.workspace_id
      WHERE s.workspace_id=$1 AND s.id=$2`,[auth.workspaceId,auth.studentId,toVietnamDateString()],client);
    if(!row)fail(404,'Không tìm thấy học sinh.');
    const{class_row:cls,workspace_row:workspace,rewards:rewardRows,requests:requestRows,journey_markers,viewed_discovery,student_goal,streak_row,badges_json,daily_missions_json,has_parent_pin,today_study_ms,...student}=row,rewards=rewardRows.map(parse),requests=requestRows.map(parse),progress=summaryPage(await this.summaryProgress(auth,student,client,rewards,currentMarker(journey_markers,student)),cursor),balance=rewardBalance(earnedQuestionRewardStars(rewards),{requests});
    const keys=progress.current?[progress.current.pack]:[];
    const values=[auth.workspaceId,...keys.flatMap(p=>[p.id,p.version])],games=new Map(keys.length?(await this.rows(`SELECT * FROM bao_an.packs WHERE workspace_id=$1 AND (${keys.map((_,i)=>`(pack_id=$${2+i*2} AND version=$${3+i*2})`).join(' OR ')})`,values,client)).map(row=>[`${row.pack_id}@${row.version}`,this.packRecord(row).games]):[]);
    const decorate=set=>({...set,games:games.get(`${set.pack.id}@${set.pack.version}`)??[]});progress.weeks=progress.weeks.map(w=>({...w,sets:w.sets.map(decorate)}));if(progress.current)progress.current=decorate(progress.current);
    const viewedDiscoveryPacks = viewed_discovery ? JSON.parse(JSON.stringify(viewed_discovery)) : [];
    const goal = student_goal ? (student_goal.gift ? {...student_goal, gift: this.publicGift(student_goal.gift)} : student_goal) : null;
    const streak = computeStreakState(streak_row);
    let dailyMissions = (daily_missions_json || []).map(r=>({
      id: r.mission_id,
      date: r.date,
      type: r.mission_type,
      title: r.mission_type==='new_lesson'?'Bài tập mới':r.mission_type==='review_error'?'Sửa sai ôn luyện':'Câu đố hôm nay',
      description: r.mission_type==='new_lesson'?'Hoàn thành 1 bài tập trong tuần học hiện tại.':r.mission_type==='review_error'?'Làm đúng 1 câu hỏi con từng trả lời sai hoặc chỉ đạt 1 sao.':'Trả lời đúng câu đố nhanh của ngày hôm nay.',
      targetCount: r.target_count,
      progressCount: r.progress_count,
      completed: !!r.completed,
      completedAt: r.completed_at
    }));
    if(!dailyMissions.length){
      dailyMissions = buildDailyMissions(toVietnamDateString());
    }
    const badges = buildStudentBadgeStatuses(badges_json || [], {
      streak,
      retryFixedCount: 0,
      perfectMemoryCount: 0,
      perfectWeekCount: 0,
      distinctGamesPlayed: 0,
      consecutiveFirstTryCount: 0,
      completedPacksCount: rewards.length,
      totalQuestionsAttempted: 0,
      mathPacks3Star: 0,
      vietnamesePacks3Star: 0,
      englishPacks3Star: 0
    });
    const dailyRiddle = this.computeDailyRiddle(progress.weeks, student.id, student.class_id, daily_missions_json);
    const todayStudyMinutes = msToMinutes(today_study_ms || 0);
    return{student:this.studentRecord(student,progress.current,balance),profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,balance,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests,viewedDiscoveryPacks,goal,streak,badges,dailyMissions,dailyRiddle,todayStudyMinutes,hasParentPin:!!has_parent_pin};
  }
  async viewDiscovery(auth,packId,client=this.pool){
    role(auth,'student');
    if(typeof packId!=='string'||!packId.trim()||packId.length>100)fail(400,'Mã bộ câu hỏi không hợp lệ.');
    const existing=await this.one("SELECT 1 FROM bao_an.audit WHERE workspace_id=$1 AND user_id=$2 AND action='student.discovery.view' AND target_id=$3 LIMIT 1",[auth.workspaceId,auth.id,packId],client);
    if(!existing)await this.audit(auth,'student.discovery.view',packId,client);
    return{ok:true,packId};
  }
  async studentMap(auth,query={},client=this.pool){role(auth,'student');
    const student=await this.student(auth,auth.studentId,client);
    const progress=await this.summaryProgress(auth,student,client);
    return projectStudentMap(progress,query);
  }
  async pinJourney(auth,student,client,context={}){
    let marker=Object.hasOwn(context,'marker')?context.marker:await this.journeyMarker(auth,student,client);context.marker=marker;if(marker)return marker;
    const progress=await this.summaryProgress(auth,student,client,undefined,null);context.progress=progress;if(!progress.journey)return null;
    marker={studentId:student.id,classId:student.class_id,...progress.journey};await this.audit(auth,'student.journey.init',json(marker),client);context.marker=marker;return marker;
  }
  async ensureJourney(auth,input={}){role(auth,'student');shape(input,['cursor']);return this.mutate(auth,async client=>{const student=await this.student(auth,auth.studentId,client);await this.pinJourney(auth,student,client);return this.studentSummary(auth,input.cursor??'0',client);});}
  async advanceWeek(auth,input){role(auth,'student');shape(input,['weekId','requestId']);const weekId=text(input.weekId,'Mã tuần',100),requestId=text(input.requestId,'Mã chuyển tuần',100);
    return this.mutate(auth,async client=>{
      const student=await this.student(auth,auth.studentId,client),prior=(await this.rows("SELECT target_id FROM bao_an.audit WHERE workspace_id=$1 AND user_id=$2 AND action='student.journey.advance'",[auth.workspaceId,auth.id],client)).flatMap(row=>{try{return[parse(row.target_id)];}catch{return[];}}).find(row=>row.studentId===student.id&&row.classId===student.class_id&&row.requestId===requestId);
      if(prior){if(prior.fromWeekId!==weekId)fail(409,'Mã chuyển tuần đã được dùng cho tuần khác.');return this.studentSummary(auth,'current',client);}
      await this.pinJourney(auth,student,client);const progress=await this.summaryProgress(auth,student,client),current=progress.currentWeekSummary;
      if(current?.weekId!==weekId)fail(403,'Con chỉ được chuyển từ tuần hiện tại.');if(!current.ready)fail(400,'Tất cả câu hỏi trong tuần cần đạt ít nhất 2 sao trước khi chuyển tuần.');
      const next=progress.weeks.find(week=>week.id===current.nextWeekId);if(!next)fail(400,'Đây là tuần cuối cùng đã được giao.');
      const masteredPacks=progress.weeks.find(week=>week.id===weekId).sets.map(set=>({packId:set.pack.id,contentVersion:set.pack.version}));
      await this.abandonActive(auth,student.id,client);await this.audit(auth,'student.journey.advance',json({studentId:student.id,classId:student.class_id,weekId:next.id,position:next.position,fromWeekId:weekId,requestId,masteredPacks}),client);return this.studentSummary(auth,'current',client);
    });
  }
  async assignedPack(auth,packId,version,client=this.pool,context={}){
    if(context.marker){
      const row=await this.one(`SELECT p.* FROM bao_an.packs p JOIN bao_an.week_sets s ON s.workspace_id=p.workspace_id AND s.pack_id=p.pack_id AND s.version=p.version JOIN bao_an.weeks w ON w.workspace_id=s.workspace_id AND w.id=s.week_id
        WHERE p.workspace_id=$1 AND p.pack_id=$2 AND p.version=$3 AND s.week_id=$4 AND w.class_id=$5`,[auth.workspaceId,packId,version,context.marker.weekId,context.student.class_id],client);
      if(row)return this.packRecord(row);
    }
    const student=context.student??await this.student(auth,auth.studentId,client),progress=context.progress??await this.summaryProgress(auth,student,client,undefined,context.marker),assigned=progress.weeks.filter(week=>week.unlocked).flatMap(week=>week.sets).find(set=>set.pack.id===packId&&set.pack.version===version);
    if(assigned){
      const packed=await this.one('SELECT * FROM bao_an.packs WHERE workspace_id=$1 AND pack_id=$2 AND version=$3',[auth.workspaceId,packId,version],client);
      if(!packed)fail(404,'Không tìm thấy bộ câu hỏi.');
      return this.packRecord(packed);
    }
    const packed = await this.one('SELECT * FROM bao_an.packs WHERE workspace_id=$1 AND pack_id=$2 AND version=$3', [auth.workspaceId, packId, version], client);
    if (packed) {
      const packObj = parse(packed.json);
      if (packObj.ownerStudentId) {
        if (packObj.ownerStudentId !== auth.studentId) fail(403, 'Con chỉ được học gói ôn tập của chính mình.');
        return this.packRecord(packed);
      }
      const cleanSessionId = packId.replace(/^review-/, '');
      const contestRow = await this.one('SELECT student_id FROM bao_an.contest_sessions WHERE workspace_id=$1 AND session_id LIKE $2', [auth.workspaceId, `${cleanSessionId}%`], client);
      if (contestRow) {
        if (contestRow.student_id !== auth.studentId) fail(403, 'Con chỉ được học gói ôn tập của chính mình.');
        return this.packRecord(packed);
      }
    }
    fail(403,'Con chỉ được học bộ câu hỏi thuộc tuần hiện tại. Tuần đã đóng và tuần chưa mở không thể chơi.');
  }
  async packGames(auth,packId,version){role(auth,'student');return{packId,contentVersion:version,games:(await this.assignedPack(auth,packId,version)).games};}
  async dashboard(auth){role(auth,'admin');const classes=(await this.rows('SELECT * FROM bao_an.classes WHERE workspace_id=$1 ORDER BY created_at,id',[auth.workspaceId])).map(row=>this.publicClass(row)),students=[],weeks=[];
    for(const row of await this.rows('SELECT s.*,u.username FROM bao_an.students s JOIN bao_an.users u ON u.id=s.user_id AND u.workspace_id=s.workspace_id WHERE s.workspace_id=$1 ORDER BY s.created_at,s.id',[auth.workspaceId]))students.push(await this.publicStudent(auth,row));
    for(const cls of classes)weeks.push(...await this.weeks(auth,cls.id));
    const redemptions=(await this.rows('SELECT r.json,s.id AS student_id,s.name,s.class_id FROM bao_an.redemptions r JOIN bao_an.students s ON s.workspace_id=r.workspace_id AND s.id=r.student_id WHERE r.workspace_id=$1 ORDER BY r.created_order DESC',[auth.workspaceId])).map(row=>({...parse(row.json),studentId:row.student_id,studentName:row.name,classId:row.class_id})),workspace=await this.workspace(auth.workspaceId);
    return{classes,students,weeks,redemptions,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},gifts:await this.gifts(auth,null,this.pool),stats:{students:students.length,classes:classes.length,questions:(await this.rows('SELECT json FROM bao_an.packs WHERE workspace_id=$1',[auth.workspaceId])).reduce((sum,row)=>sum+parse(row.json).items.length,0),pendingRequests:redemptions.filter(row=>['pending','approved'].includes(rewardStatus(row))).length}};
  }
  async play(auth,playId,client=this.pool,{includeEvents=false}={}){const row=await this.one(`SELECT p.json,pack.json AS pack_json${includeEvents?",coalesce((SELECT jsonb_agg(a.json ORDER BY a.sequence) FROM bao_an.attempts a WHERE a.workspace_id=p.workspace_id AND a.play_id=p.id),'[]'::jsonb) AS events":''},(SELECT row_to_json(st) FROM bao_an.student_streaks st WHERE st.workspace_id=p.workspace_id AND st.student_id=p.student_id) AS streak_row
    FROM (SELECT * FROM bao_an.plays WHERE workspace_id=$1 AND id=$2 AND student_id=$3) p
    LEFT JOIN LATERAL (SELECT json FROM bao_an.packs WHERE workspace_id=p.workspace_id AND pack_id=p.json->>'packId' AND version=(p.json->>'contentVersion')::integer) pack ON true`,[auth.workspaceId,playId,auth.studentId],client);if(!row)fail(404,'Không tìm thấy lượt chơi.');
    if(!row.pack_json)fail(409,'Bộ câu hỏi của lượt chơi không còn sẵn sàng.');return{session:parse(row.json),pack:parse(row.pack_json),streakRow:row.streak_row,...(includeEvents?{events:row.events.map(parse)}:{})};
  }
  async abandonActive(auth,studentId,client){
    if(!client)return this.mutate(auth,async owned=>{await this.student(auth,studentId,owned);await this.abandonActive(auth,studentId,owned);await this.audit(auth,'play.abandon-active',studentId,owned);});
    await this.exec("UPDATE bao_an.plays SET json=json || jsonb_build_object('status','abandoned','endedAt',$3::text) WHERE workspace_id=$1 AND student_id=$2 AND json->>'status'='active'",[auth.workspaceId,studentId,now()],client);
  }
  async startPlay(auth,input,compact=false,secure=false){role(auth,'student');shape(input,compact?['requestId','moduleId','packId','contentVersion','reviewItemIds']:['requestId','moduleId','packId','contentVersion']);const requestId=text(input.requestId,'Mã lượt chơi',100),moduleId=text(input.moduleId,'Trò chơi',80),packId=text(input.packId,'Mã bộ',80),version=integer(input.contentVersion,'Phiên bản');
    return this.mutate(auth,async client=>{
      const context=await this.studentPlayContext(auth,client,{requestId}),{student,prior}=context,marker=await this.pinJourney(auth,student,client,context);
      await this.assertStudentScreenTimeAllowed(auth,student.id,client,context.parentControls);
      const choice=await this.assignedPack(auth,packId,version,client,context);if(!choice.games.some(game=>game.id===moduleId))fail(400,'Dạng câu của bộ này chưa phù hợp với trò chơi đã chọn.');
      const presentation=onlinePresentation(moduleId,choice.pack),requiredItemIds=compact?selectReviewItems(input.reviewItemIds,choice.pack,presentation):undefined;
      if(prior){const value=await this.play(auth,prior.id,client);if(secure&&value.session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(value.session.packId!==packId||value.session.contentVersion!==version||value.session.moduleId!==moduleId||value.session.journeyWeekId&&value.session.journeyWeekId!==marker?.weekId||compact&&(value.session.rewardPolicyVersion!==2||json(value.session.requiredItemIds)!==json(requiredItemIds)))fail(409,'Mã lượt chơi đã dùng cho nội dung khác.');if(value.session.status==='abandoned')fail(409,'Lượt chơi đã thoát. Hãy mở lượt mới.');const result={...value,presentation:filterPlayPresentation(value.session,value.pack,onlinePresentation(moduleId,value.pack))};return compact||secure?compactPlay(result):{...result,session:publicSession(result.session)};}
      await this.abandonActive(auth,student.id,client);
      const session={sessionId:id(),profileId:student.id,packId,contentVersion:version,moduleId,moduleVersion:getGame(moduleId).version,startedAt:now(),status:'active',rewardPolicyVersion:compact?2:1,presentationVersion:1,journeyWeekId:marker?.weekId,...(compact?{requiredItemIds,questionClocks:{}}:{}),...(secure?{questionProtocolVersion:1,questionClocks:{},questionHints:{},audioReceipts:{}}:{})};
      await this.exec('INSERT INTO bao_an.plays(id,workspace_id,student_id,request_id,json) VALUES($1,$2,$3,$4,$5::jsonb)',[session.sessionId,auth.workspaceId,student.id,requestId,json(session)],client);const result={session,pack:choice.pack,presentation:filterPlayPresentation(session,choice.pack,presentation)};return compact||secure?compactPlay(result):{...result,session:publicSession(result.session)};
    });
  }
  async assertCurrentPlay(auth,session,client){
    if (session.packId.startsWith('review-')) {
      const packed = await this.one('SELECT json FROM bao_an.packs WHERE workspace_id=$1 AND pack_id=$2 AND version=$3', [auth.workspaceId, session.packId, session.contentVersion], client);
      if (packed) {
        const pObj = parse(packed.json);
        if (pObj.ownerStudentId && pObj.ownerStudentId !== auth.studentId) fail(403, 'Con chỉ được học gói ôn tập của chính mình.');
      }
      return;
    }
    const{student,marker,assignments}=await this.studentPlayContext(auth,client,{packId:session.packId});
    if(marker){if(session.journeyWeekId&&session.journeyWeekId!==marker.weekId)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');const assigned=assignments.find(row=>row.weekId===marker.weekId);if(!assigned)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');if(session.rewardPolicyVersion===2&&assigned.version!==session.contentVersion)fail(409,'Bộ câu hỏi vừa được cập nhật. Thoát rồi mở lại bài; sao đã lưu vẫn được giữ nguyên.');return;}
    const progress=await this.summaryProgress(auth,student,client);if(session.journeyWeekId&&session.journeyWeekId!==progress.journey?.weekId)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');const assigned=progress.weeks.find(week=>week.current)?.sets.find(set=>set.pack.id===session.packId);if(!assigned)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');if(session.rewardPolicyVersion===2&&assigned.pack.version!==session.contentVersion)fail(409,'Bộ câu hỏi vừa được cập nhật. Thoát rồi mở lại bài; sao đã lưu vẫn được giữ nguyên.');
  }
  async questionHint(auth,playId,input){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');shape(input,['itemId']);const itemId=text(input.itemId,'Mã câu',80);return this.mutate(auth,async client=>{const{session,pack,events}=await this.play(auth,playId,client,{includeEvents:true});await this.assertCurrentPlay(auth,session,client);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');const result=protocolHint(session,pack,events,itemId);await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);return result;});}
  async recordAudioDelivery(auth,playId,itemId,mediaId,durationMs){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');text(playId,'Mã lượt',100);text(itemId,'Mã câu',80);return this.mutate(auth,async client=>{const{session,pack,events}=await this.play(auth,playId,client,{includeEvents:true});await this.assertCurrentPlay(auth,session,client);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');protocolAudioDelivery(session,pack,events,itemId,mediaId,durationMs);await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);});}
  async openQuestion(auth,playId,input,requireProtocol=false){role(auth,'student');shape(input,['itemId','openedAt']);const itemId=text(input.itemId,'Mã câu',80);
    const openedTime=input.openedAt?Date.parse(input.openedAt):Date.now();
    return this.mutate(auth,async client=>{
      const{session,pack,events}=await this.play(auth,playId,client,{includeEvents:true});await this.assertCurrentPlay(auth,session,client);
      if(session.status!=='active'||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã kết thúc hoặc quá hạn.');
      if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');
      if(session.questionProtocolVersion===1){
        const item = pack.items?.find(row => row.id === itemId);
        const hasOptions = Array.isArray(item?.options) && item.options.length > 1;
        const lastPos = hasOptions
          ? (session.questionPresentations?.[itemId]?.displayedCorrectIndex ?? await this.lastQuestionCorrectPosition(auth.workspaceId, auth.studentId, itemId, pack.version, client, session.packId))
          : null;
        const receipt=openProtocolQuestion(session,pack,events,itemId,openedTime,lastPos);
        const currentPos = session.questionPresentations?.[itemId]?.displayedCorrectIndex;
        if (Number.isInteger(currentPos)) {
          this.recordQuestionCorrectPosition(auth.workspaceId, auth.studentId, itemId, pack.version, currentPos);
        }
        session.presentationsById ??= {};
        if (session.questionPresentations?.[itemId]) {
          session.presentationsById[session.questionPresentations[itemId].presentationId] = session.questionPresentations[itemId];
        }
        await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);
        return receipt;
      }
      const presentation=onlinePresentation(session.moduleId,pack),item=presentation?.items.find(item=>item.id===itemId);
      if(!timedQuestion(session,presentation)||!item||!session.requiredItemIds?.includes(itemId))fail(400,'Câu hỏi không dùng bộ đếm thời gian của lượt chơi này.');
      const clock=session.questionClocks??{},openedAt=Object.hasOwn(clock,itemId)?clock[itemId]:(input.openedAt||now());if(!Object.hasOwn(clock,itemId)){
        Object.defineProperty(clock,itemId,{value:openedAt,enumerable:true,writable:true,configurable:true});session.questionClocks=clock;await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);
      }
      return{openedAt,serverNow:now(),...questionRewardThresholds(item)};
    });
  }
  async #playEvents(auth,playId,client){return(await this.rows('SELECT json FROM bao_an.attempts WHERE workspace_id=$1 AND play_id=$2 ORDER BY sequence',[auth.workspaceId,playId],client)).map(row=>parse(row.json));}
  async events(auth,playId,client=this.pool){if(auth.role==='student')await this.play(auth,playId,client);return this.#playEvents(auth,playId,client);}
  async attempt(auth,playId,input,requireProtocol=false){role(auth,'student');shape(input,['attemptKey','itemId','response','hintsUsed','elapsedMs','presentationId']);const key=text(input.attemptKey,'Mã lần trả lời',120);if(!/^[a-zA-Z0-9._:-]+$/.test(key))fail(400,'Mã lần trả lời không hợp lệ.');const itemId=text(input.itemId,'Mã câu',80),hintsUsed=integer(input.hintsUsed??0,'Số gợi ý',0,20);
    const hash=digest({key,itemId,response:input.response,hintsUsed});
    return this.mutate(auth,async client=>{
      const{session,pack,events,streakRow}=await this.play(auth,playId,client,{includeEvents:true});await this.assertCurrentPlay(auth,session,client);if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');const prior=await this.one('SELECT payload_hash,json FROM bao_an.attempts WHERE workspace_id=$1 AND play_id=$2 AND attempt_key=$3',[auth.workspaceId,playId,key],client);
      if(prior){if(prior.payload_hash!==hash)fail(409,'Lần trả lời đã được lưu với đáp án khác.');if(session.status==='abandoned')fail(409,'Lượt chơi đã thoát.');const event=parse(prior.json);let questionRewards;if(session.rewardPolicyVersion===2){questionRewards={gained:0,questions:[]};if(event.correct){const previous=await this.one('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3',[auth.workspaceId,auth.studentId,pack.id],client),reward=previous?parse(previous.json):null,touched=onlineScoreResponse(pack,session.moduleId,event.itemId,event.response).touchedItemIds;questionRewards.questions=questionRewardProgress(pack,reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0)).questions.filter(q=>touched.includes(q.itemId));}}return{event:{...event,response:input.response},duplicate:true,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};}
      if(session.status!=='active')fail(409,'Lượt chơi đã kết thúc hoặc được thay bằng lượt mới ở thiết bị khác.');if(Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã quá hạn. Hãy mở lượt mới.');
      if(events.length>=5000)fail(400,'Lượt chơi đã đạt giới hạn số lần thử.');const item=pack.items.find(row=>row.id===itemId);if(!item)fail(400,'Câu hỏi không thuộc lượt chơi.');
      session.presentationsById ??= {};
      const currentPres = session.questionPresentations?.[itemId];
      if (currentPres && input.presentationId && input.presentationId !== currentPres.presentationId) {
        fail(409, 'Lượt trình bày câu hỏi đã hết hạn hoặc không khớp. Vui lòng mở lại câu hỏi.');
      }
      const pres = (input.presentationId && session.presentationsById[input.presentationId])
        ?? currentPres;
      let evalResponse = input.response;
      if (pres && input.response?.kind === 'choice') {
        if (!Number.isInteger(input.response.choiceIndex) || input.response.choiceIndex < 0 || input.response.choiceIndex >= pres.permutation.length) {
          fail(400, 'Lựa chọn không hợp lệ.');
        }
        const originalChoiceIndex = pres.permutation[input.response.choiceIndex];
        evalResponse = { ...input.response, choiceIndex: originalChoiceIndex };
      }
      let outcome;try{outcome=onlineScoreResponse(pack,session.moduleId,itemId,evalResponse);}catch(error){fail(400,error.message);}
      if(session.rewardPolicyVersion===2&&outcome.touchedItemIds.some(id=>!session.requiredItemIds?.includes(id)))fail(400,'Câu trả lời nằm ngoài các câu đã chọn cho lượt học lại.');
      const occurredAt=now();let elapsedMs=input.elapsedMs;if(timedQuestion(session,onlinePresentation(session.moduleId,pack))){const openedAt=session.questionClocks&&Object.hasOwn(session.questionClocks,itemId)&&session.questionClocks[itemId];if(!openedAt)fail(400,'Cần mở câu hỏi trước khi trả lời.');elapsedMs=Date.parse(occurredAt)-Date.parse(openedAt);}
      else if(session.rewardPolicyVersion===2)elapsedMs=0;
      if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>14400000)fail(400,'Thời gian trả lời không hợp lệ.');
      const event={eventId:`${session.sessionId}:${key}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:pack.version,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId,objectiveId:item.objectiveId,correct:outcome.correct,hintsUsed:session.questionProtocolVersion===1?(Object.hasOwn(session.questionHints??{},itemId)?session.questionHints[itemId].used:0):hintsUsed,elapsedMs,occurredAt,response:evalResponse,displayedChoiceIndex:pres?input.response.choiceIndex:undefined,gameSequence:events.length+1};
      const errors=onlineEvidenceErrors(session,[...events,event],pack);if(errors.length)fail(400,errors[0]);
      const {newStreakRecord, streakIncreased} = registerDailyCorrectAnswer(streakRow, outcome.correct, occurredAt);
      await this.exec(`
        WITH ins_att AS (
          INSERT INTO bao_an.attempts(workspace_id,play_id,attempt_key,payload_hash,json,sequence)
          VALUES($1,$2,$3,$4,$5::jsonb,$6)
        )
        INSERT INTO bao_an.student_streaks(workspace_id, student_id, current_streak, longest_streak, last_active_date, freeze_used_week, today_correct_count, today_date, updated_at)
        VALUES($7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT(workspace_id, student_id) DO UPDATE SET
          current_streak=EXCLUDED.current_streak,
          longest_streak=EXCLUDED.longest_streak,
          last_active_date=EXCLUDED.last_active_date,
          freeze_used_week=EXCLUDED.freeze_used_week,
          today_correct_count=EXCLUDED.today_correct_count,
          today_date=EXCLUDED.today_date,
          updated_at=EXCLUDED.updated_at
      `, [
        auth.workspaceId, playId, key, hash, json(event), event.gameSequence,
        auth.workspaceId, auth.studentId, newStreakRecord.current_streak, newStreakRecord.longest_streak, newStreakRecord.last_active_date, newStreakRecord.freeze_used_week, newStreakRecord.today_correct_count, newStreakRecord.today_date, occurredAt
      ], client);
      if(streakIncreased){
        await this.audit(auth, 'student.streak.increase', json({studentId: auth.studentId, streak: newStreakRecord.current_streak}), client);
      }
      let questionRewards;if(session.rewardPolicyVersion===2){questionRewards={gained:0,questions:[]};if(outcome.correct){const previous=await this.one('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3',[auth.workspaceId,auth.studentId,pack.id],client),reward=previous?parse(previous.json):null;
        const result=applyQuestionRewardCandidates(reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0),questionRewardCandidates(session,[...events,event],pack)),progress=questionRewardProgress(pack,result.ledger),tier=Math.max(1,progress.bestTier);
        if(!reward||json(reward.questionLedger)!==json(result.ledger)){const award={...(reward??{profileId:auth.studentId,packId:pack.id,sessionId:session.sessionId,completedAt:event.occurredAt,totalItems:pack.items.length,firstTryCorrect:0}),starTier:tier,questionLedger:result.ledger};await this.exec('INSERT INTO bao_an.awards(workspace_id,student_id,pack_id,tier,json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json',[auth.workspaceId,auth.studentId,pack.id,tier,json(award)],client);}
        questionRewards={gained:result.gained,questions:progress.questions.filter(q=>outcome.touchedItemIds.includes(q.itemId))};}
      }return{event:{...event,response:input.response},duplicate:false,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};
    });
  }
  async finishPlay(auth,playId,abandon=false,compact=false,requireProtocol=false){role(auth,'student');return this.mutate(auth,async client=>{
    const{session,pack,events}=await this.play(auth,playId,client,{includeEvents:!abandon});if(!abandon)await this.assertCurrentPlay(auth,session,client);if(!abandon&&requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(session.status==='abandoned'){if(abandon)return{};fail(409,'Lượt chơi đã thoát.');}
    if(session.status==='completed')return{state:compact?await this.studentSummary(auth,'current',client):await this.studentState(auth,client),gained:0,tier:(await this.rewards(auth,auth.studentId,client)).find(row=>row.packId===pack.id)?.starTier??0};
    const completed={...session,status:abandon?'abandoned':'completed',endedAt:now()};let gained=0,tier=0;
    if(!abandon){const errors=session.rewardPolicyVersion===2?v2QuestionCompletionErrors(completed,events,pack):onlineEvidenceErrors(completed,events,pack,true);if(errors.length)fail(400,errors[0]);const previous=await this.one('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3',[auth.workspaceId,auth.studentId,pack.id],client),prior=previous?parse(previous.json):null;
      if(session.rewardPolicyVersion===2){tier=questionRewardProgress(pack,prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0)).bestTier;}
      else{const award=onlineAward(completed,events,pack);if(!award)fail(400,'Chưa đủ dữ liệu để xác nhận sao.');const legacyStars=Math.max(award.starTier,prior?.questionLedger?.legacyStars??prior?.starTier??0),result=applyQuestionRewardCandidates(prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0),[],legacyStars);gained=result.gained;tier=legacyStars;
        const value={...award,starTier:Math.max(1,questionRewardProgress(pack,result.ledger).bestTier),questionLedger:result.ledger};await this.exec('INSERT INTO bao_an.awards(workspace_id,student_id,pack_id,tier,json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json',[auth.workspaceId,auth.studentId,pack.id,value.starTier,json(value)],client);await this.syncAwardMaterial(auth,auth.studentId,pack.id,value.starTier,client);
      }
    }
    await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(completed)],client);await this.audit(auth,abandon?'play.abandon':'play.complete',playId,client);
    if(!abandon){
      await this.onPlayCompleted(auth, session, pack, events, completed.endedAt, client);
    }
    return abandon?{}:{state:compact?await this.studentSummary(auth,'current',client):await this.studentState(auth,client),gained,tier};
  });}
  async configureWallet(auth,input){role(auth,'admin');shape(input,['enabled','rateVnd']);if(typeof input.enabled!=='boolean')fail(400,'Trạng thái đổi sao không hợp lệ.');const rate=integer(input.rateVnd,'Giá trị mỗi sao',1,1000000);
    return this.mutate(auth,async client=>{await this.exec('UPDATE bao_an.workspaces SET wallet_enabled=$2,rate_vnd=$3 WHERE id=$1',[auth.workspaceId,input.enabled,rate],client);await this.audit(auth,'wallet.configure',auth.workspaceId,client);return{enabled:input.enabled,rateVnd:rate};});
  }
  async requestReward(auth,input){role(auth,'student');shape(input,['requestId','title','goalVnd']);text(input.requestId,'Mã yêu cầu',100);text(input.title,'Tên phần thưởng',120);integer(input.goalVnd,'Mục tiêu',1,100000000);
    return this.mutate(auth,async client=>{await this.student(auth,auth.studentId,client);const workspace=await this.workspace(auth.workspaceId,client),prior=await this.one('SELECT student_id FROM bao_an.redemptions WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,input.requestId],client);if(prior&&prior.student_id!==auth.studentId)fail(409,'Mã yêu cầu không thể sử dụng.');
      const wallet={schemaVersion:1,enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd,updatedAt:now(),requests:await this.requests(auth,auth.studentId,client)};let request;try{request=makeRewardRequest(wallet,(await this.balance(auth,auth.studentId,client)).earned,input,now());}catch(error){fail(400,error.message);}
      await this.exec('INSERT INTO bao_an.redemptions(workspace_id,id,student_id,status,json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id,id) DO NOTHING',[auth.workspaceId,request.requestId,auth.studentId,rewardStatus(request),json(request)],client);await this.audit(auth,'redemption.request',request.requestId,client);return request;
    });
  }
  publicGift(row){
    return{id:row.id,workspaceId:row.workspace_id,classId:row.class_id,title:row.title,imageMediaId:row.image_media_id,priceStars:row.price_stars,kind:row.kind,weeklyLimit:row.weekly_limit,stock:row.stock,unlockAfterWeek:row.unlock_after_week,active:!!row.active,sortOrder:row.sort_order,createdAt:row.created_at,...presetGiftDetails(row.id)};
  }
  async installGiftPreset(auth,input){
    role(auth,'admin');shape(input,[]);
    return this.mutate(auth,async client=>{
      let created=0;const at=now();
      for(const [index,item] of BAO_AN_GIFT_PRESET.entries()){
        const result=await client.query('INSERT INTO bao_an.gift_catalog(workspace_id,id,class_id,title,image_media_id,price_stars,kind,weekly_limit,stock,unlock_after_week,active,sort_order,created_at) VALUES($1,$2,NULL,$3,NULL,$4,\'item\',0,-1,0,true,$5,$6) ON CONFLICT(workspace_id,id) DO NOTHING RETURNING id',[auth.workspaceId,item.id,item.title,item.priceStars,index,at]);created+=result.rows.length;
      }
      await this.exec('UPDATE bao_an.workspaces SET rate_vnd=$1 WHERE id=$2',[BAO_AN_GIFT_RATE_VND,auth.workspaceId],client);
      await this.audit(auth,'gift.preset.install',BAO_AN_GIFT_PRESET_ID,client);
      return{created,kept:BAO_AN_GIFT_PRESET.length-created,rateVnd:BAO_AN_GIFT_RATE_VND};
    });
  }
  async gifts(auth,classId=null,client=this.pool){
    if(auth.role==='student'){
      const student=await this.student(auth,auth.studentId,client);
      return(await this.rows('SELECT * FROM bao_an.gift_catalog WHERE workspace_id=$1 AND active=true AND (class_id IS NULL OR class_id=$2) ORDER BY sort_order ASC, created_at DESC',[auth.workspaceId,student.class_id],client)).map(r=>this.publicGift(r));
    }
    const query=classId?'SELECT * FROM bao_an.gift_catalog WHERE workspace_id=$1 AND (class_id IS NULL OR class_id=$2) ORDER BY sort_order ASC, created_at DESC':'SELECT * FROM bao_an.gift_catalog WHERE workspace_id=$1 ORDER BY sort_order ASC, created_at DESC';
    const params=classId?[auth.workspaceId,classId]:[auth.workspaceId];
    return(await this.rows(query,params,client)).map(r=>this.publicGift(r));
  }
  async createGift(auth,input){
    role(auth,'admin');
    shape(input,['title','priceStars','kind','classId','imageMediaId','weeklyLimit','stock','unlockAfterWeek','active','sortOrder']);
    const title=text(input.title,'Tên phần thưởng',120),priceStars=integer(input.priceStars,'Giá sao',1,100000),kind=['item','experience','privilege','saving'].includes(input.kind)?input.kind:'item';
    const classId=input.classId?text(input.classId,'Lớp',100):null;
    const imageMediaId=input.imageMediaId?text(input.imageMediaId,'Ảnh phần thưởng',100):null;
    const weeklyLimit=(input.weeklyLimit!==undefined&&input.weeklyLimit!==null)?integer(input.weeklyLimit,'Giới hạn tuần',0,100):0;
    const stock=(input.stock!==undefined&&input.stock!==null)?integer(input.stock,'Tồn kho',-1,1000000):-1;
    const unlockAfterWeek=(input.unlockAfterWeek!==undefined&&input.unlockAfterWeek!==null)?integer(input.unlockAfterWeek,'Mở sau tuần',0,100):0;
    const active=input.active!==undefined?Boolean(input.active):true;
    const sortOrder=(input.sortOrder!==undefined&&input.sortOrder!==null)?integer(input.sortOrder,'Thứ tự',-1000,1000):0;
    const giftId=id(),createdAt=now();
    return this.mutate(auth,async client=>{
      if(classId)await this.class(auth,classId,client);
      await this.exec('INSERT INTO bao_an.gift_catalog(workspace_id,id,class_id,title,image_media_id,price_stars,kind,weekly_limit,stock,unlock_after_week,active,sort_order,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[auth.workspaceId,giftId,classId,title,imageMediaId,priceStars,kind,weeklyLimit,stock,unlockAfterWeek,active,sortOrder,createdAt],client);
      await this.audit(auth,'gift.create',giftId,client);
      return this.publicGift({workspace_id:auth.workspaceId,id:giftId,class_id:classId,title,image_media_id:imageMediaId,price_stars:priceStars,kind,weekly_limit:weeklyLimit,stock,unlock_after_week:unlockAfterWeek,active,sort_order:sortOrder,created_at:createdAt});
    });
  }
  async updateGift(auth,giftId,input){
    role(auth,'admin');
    text(giftId,'Mã phần thưởng',100);
    return this.mutate(auth,async client=>{
      const existing=await this.one('SELECT * FROM bao_an.gift_catalog WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,giftId],client);
      if(!existing)fail(404,'Không tìm thấy phần thưởng.');
      const title=input.title!==undefined?text(input.title,'Tên phần thưởng',120):existing.title;
      const priceStars=input.priceStars!==undefined?integer(input.priceStars,'Giá sao',1,100000):existing.price_stars;
      const kind=input.kind!==undefined?(['item','experience','privilege','saving'].includes(input.kind)?input.kind:existing.kind):existing.kind;
      const classId=input.classId!==undefined?(input.classId?text(input.classId,'Lớp',100):null):existing.class_id;
      if(classId)await this.class(auth,classId,client);
      const imageMediaId=input.imageMediaId!==undefined?(input.imageMediaId?text(input.imageMediaId,'Ảnh phần thưởng',100):null):existing.image_media_id;
      const weeklyLimit=(input.weeklyLimit!==undefined&&input.weeklyLimit!==null)?integer(input.weeklyLimit,'Giới hạn tuần',0,100):(input.weeklyLimit===null?0:existing.weekly_limit);
      const stock=(input.stock!==undefined&&input.stock!==null)?integer(input.stock,'Tồn kho',-1,1000000):(input.stock===null?-1:existing.stock);
      const unlockAfterWeek=(input.unlockAfterWeek!==undefined&&input.unlockAfterWeek!==null)?integer(input.unlockAfterWeek,'Mở sau tuần',0,100):(input.unlockAfterWeek===null?0:existing.unlock_after_week);
      const active=input.active!==undefined?Boolean(input.active):existing.active;
      const sortOrder=(input.sortOrder!==undefined&&input.sortOrder!==null)?integer(input.sortOrder,'Thứ tự',-1000,1000):(input.sortOrder===null?0:existing.sort_order);
      await this.exec('UPDATE bao_an.gift_catalog SET class_id=$3,title=$4,image_media_id=$5,price_stars=$6,kind=$7,weekly_limit=$8,stock=$9,unlock_after_week=$10,active=$11,sort_order=$12 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,giftId,classId,title,imageMediaId,priceStars,kind,weeklyLimit,stock,unlockAfterWeek,active,sortOrder],client);
      await this.audit(auth,'gift.update',giftId,client);
      return this.publicGift({workspace_id:auth.workspaceId,id:giftId,class_id:classId,title,image_media_id:imageMediaId,price_stars:priceStars,kind,weekly_limit:weeklyLimit,stock,unlock_after_week:unlockAfterWeek,active,sort_order:sortOrder,created_at:existing.created_at});
    });
  }
  async studentGoal(auth,studentId=auth.studentId,client=this.pool){
    const row=await this.one('SELECT * FROM bao_an.student_goals WHERE workspace_id=$1 AND student_id=$2',[auth.workspaceId,studentId],client);
    if(!row)return null;
    const giftRow=await this.one('SELECT * FROM bao_an.gift_catalog WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,row.gift_id],client);
    return{studentId:row.student_id,giftId:row.gift_id,pinnedAt:row.pinned_at,gift:giftRow?this.publicGift(giftRow):undefined};
  }
  async setStudentGoal(auth,giftId){
    role(auth,'student');
    text(giftId,'Mã phần thưởng',100);
    return this.mutate(auth,async client=>{
      const student=await this.student(auth,auth.studentId,client);
      const gift=await this.one('SELECT * FROM bao_an.gift_catalog WHERE workspace_id=$1 AND id=$2 AND active=true AND (class_id IS NULL OR class_id=$3)',[auth.workspaceId,giftId,student.class_id],client);
      if(!gift)fail(404,'Không tìm thấy phần thưởng khả dụng.');
      const pinnedAt=now();
      await this.exec('INSERT INTO bao_an.student_goals(workspace_id,student_id,gift_id,pinned_at) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,student_id) DO UPDATE SET gift_id=excluded.gift_id,pinned_at=excluded.pinned_at',[auth.workspaceId,student.id,giftId,pinnedAt],client);
      await this.audit(auth,'student.goal.pin',giftId,client);
      return{studentId:student.id,giftId,pinnedAt,gift:this.publicGift(gift)};
    });
  }
  async redeemGift(auth,input){
    role(auth,'student');
    shape(input,['requestId','giftId']);
    const requestId=text(input.requestId,'Mã yêu cầu',100),giftId=text(input.giftId,'Mã quà tặng',100);
    return this.mutate(auth,async client=>{
      const student=await this.student(auth,auth.studentId,client);
      const prior=await this.one('SELECT student_id FROM bao_an.redemptions WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,requestId],client);
      if(prior){
        if(prior.student_id!==auth.studentId)fail(409,'Mã yêu cầu không thể sử dụng.');
        return parse((await this.one('SELECT json FROM bao_an.redemptions WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,requestId],client)).json);
      }
      const gift=await this.one('SELECT * FROM bao_an.gift_catalog WHERE workspace_id=$1 AND id=$2 AND active=true AND (class_id IS NULL OR class_id=$3) FOR UPDATE',[auth.workspaceId,giftId,student.class_id],client);
      if(!gift)fail(404,'Món quà không tồn tại hoặc đã ngừng áp dụng.');
      if(gift.stock===0)fail(409,'Món quà đã hết hàng trong kho.');
      if(gift.unlock_after_week>0){
        const marker=await this.journeyMarker(auth,student,client);
        const currentPos=marker?marker.position:1;
        if(currentPos<gift.unlock_after_week)fail(403,`Món quà này mở khóa sau khi hoàn thành tuần ${gift.unlock_after_week}.`);
      }
      if(gift.weekly_limit>0){
        const studentRequests=await this.requests(auth,auth.studentId,client);
        const oneWeekAgo=new Date(Date.now()-7*86400000).toISOString();
        const countInWeek=studentRequests.filter(r=>r.giftId===giftId&&r.requestedAt>=oneWeekAgo&&['pending','approved','fulfilled'].includes(rewardStatus(r))).length;
        if(countInWeek>=gift.weekly_limit)fail(400,`Con đã đạt giới hạn đổi món quà này (${gift.weekly_limit} lần/tuần).`);
      }
      const balance=await this.balance(auth,auth.studentId,client);
      if(balance.available<gift.price_stars)fail(400,`Con cần ${gift.price_stars} sao nhưng chỉ có ${balance.available} sao khả dụng.`);
      if(gift.stock>0){
        await this.exec('UPDATE bao_an.gift_catalog SET stock=stock-1 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,giftId],client);
      }
      const workspace=await this.workspace(auth.workspaceId,client),currentTime=now();
      const request={
        requestId,
        title:gift.title,
        giftId:gift.id,
        kind:gift.kind,
        stars:gift.price_stars,
        goalVnd:gift.price_stars*workspace.rate_vnd,
        rateVnd:workspace.rate_vnd,
        amountVnd:gift.price_stars*workspace.rate_vnd,
        requestedAt:currentTime,
        history:[{status:'pending',at:currentTime}]
      };
      await this.exec('INSERT INTO bao_an.redemptions(workspace_id,id,student_id,status,json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id,id) DO NOTHING',[auth.workspaceId,requestId,auth.studentId,'pending',json(request)],client);
      await this.audit(auth,'redemption.request',requestId,client);
      return request;
    });
  }
  async confirmReceived(auth,requestId){
    role(auth,'student');
    text(requestId,'Mã yêu cầu',100);
    return this.mutate(auth,async client=>{
      const row=await this.one('SELECT * FROM bao_an.redemptions WHERE workspace_id=$1 AND id=$2 AND student_id=$3',[auth.workspaceId,requestId,auth.studentId],client);
      if(!row)fail(404,'Không tìm thấy yêu cầu đổi thưởng.');
      const request=parse(row.json);
      if(request.receivedAt)return request;
      const status=rewardStatus(request);
      if(status!=='fulfilled'&&status!=='approved')fail(400,'Chỉ có thể xác nhận khi quà đã được trao hoặc duyệt.');
      request.receivedAt=now();
      await this.exec('UPDATE bao_an.redemptions SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,requestId,json(request)],client);
      await this.audit(auth,'redemption.received',requestId,client);
      return request;
    });
  }
  async transitionReward(auth,requestId,input,cancel=false,parentToken=null){shape(input,cancel?[]:['status','note']);return this.mutate(auth,async client=>{
    const row=await this.one('SELECT * FROM bao_an.redemptions WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[auth.workspaceId,requestId],client);if(!row||cancel&&row.student_id!==auth.studentId)fail(404,'Không tìm thấy yêu cầu đổi sao.');
    if(cancel&&auth.role!=='student')fail(403,'Chỉ học sinh được hủy yêu cầu của mình.');
    if(auth.role==='parent'){
      const linked=await this.one('SELECT 1 FROM bao_an.parent_students WHERE workspace_id=$1 AND parent_user_id=$2 AND student_id=$3',[auth.workspaceId,auth.id,row.student_id],client);
      if(!linked)fail(403,'Phụ huynh chỉ có thể duyệt quà cho con của mình.');
    }else if(auth.role==='student'&&!cancel){
      const raw=await this.rawParentControls(auth.workspaceId,row.student_id,client);
      if(auth.studentId!==row.student_id||!raw.pinHash||!parentToken||!verifyParentElevationToken(parentToken,{userId:auth.id,studentId:row.student_id,workspaceId:auth.workspaceId,pinHash:raw.pinHash,sessionHash:auth.tokenHash}))fail(403,'Vui lòng xác thực mã PIN phụ huynh của học sinh này trước.');
    } else if (auth.role !== 'admin' && !cancel) {
      fail(403,'Chỉ giáo viên hoặc phụ huynh mới có quyền duyệt quà.');
    }
    const status=cancel?'cancelled':input.status;
    if(!['approved','rejected','fulfilled','cancelled'].includes(status)||!cancel&&status==='cancelled')fail(400,'Trạng thái đổi thưởng không hợp lệ.');
    const previous=parse(row.json);
    if(rewardStatus(previous)===status)return previous;
    let request;try{request=changeRewardRequest(previous,status,now(),input.note);}catch(error){fail(409,error.message);}
    if(['cancelled','rejected'].includes(status)&&previous.giftId){
      const gift=await this.one('SELECT stock FROM bao_an.gift_catalog WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,previous.giftId],client);
      if(gift&&gift.stock>=0){
        await this.exec('UPDATE bao_an.gift_catalog SET stock=stock+1 WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,previous.giftId],client);
      }
    }
    await this.exec('UPDATE bao_an.redemptions SET status=$3,json=$4::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,requestId,status,json(request)],client);await this.audit(auth,`redemption.${status}`,requestId,client);return request;
  });}
  computeDailyRiddle(weeks, studentId, classId, missionRows = [], nowIso = now()){
    if(!weeks || !weeks.length) return null;
    const today = toVietnamDateString(nowIso);
    const allItems = [];
    for(const w of weeks){
      for(const s of (w.sets || [])){
        const pack = s.pack;
        if(pack && Array.isArray(pack.items)){
          for(const item of pack.items){
            if(item.kind === 'choice' && Array.isArray(item.options) && item.options.length >= 2){
              allItems.push({packId: pack.id, packTitle: pack.title, item});
            } else if(item.left && item.right){
              allItems.push({
                packId: pack.id,
                packTitle: pack.title,
                item: {
                  id: item.id,
                  prompt: `Cặp đôi phù hợp với "${item.left}" là gì?`,
                  options: [item.right, 'Không xác định', 'Khác'],
                  correctIndex: 0
                }
              });
            }
          }
        }
      }
    }
    if(!allItems.length) return null;
    const seed = `${today}:${classId}`;
    let hashVal = 0;
    for(let i=0; i<seed.length; i++){
      hashVal = ((hashVal << 5) - hashVal) + seed.charCodeAt(i);
      hashVal |= 0;
    }
    const chosen = allItems[Math.abs(hashVal) % allItems.length];
    const isSolved = (missionRows || []).some(m=>m.mission_type==='daily_riddle' && !!m.completed);
    return {
      packId: chosen.packId,
      packTitle: chosen.packTitle,
      itemId: chosen.item.id,
      prompt: chosen.item.prompt || chosen.item.title || 'Câu hỏi đố vui',
      options: chosen.item.options || [],
      correctIndex: chosen.item.correctIndex ?? 0,
      explanation: chosen.item.explanation || 'Rất chính xác!',
      alreadySolved: isSolved
    };
  }
  async studentStreak(auth, studentId = auth.studentId, client = this.pool, nowIso = now()){
    const row = await this.one('SELECT * FROM bao_an.student_streaks WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    return computeStreakState(row, nowIso);
  }
  async recordDailyActivity(auth, studentId, wasCorrect, nowIso = now(), client = this.pool, existingRow = null){
    const row = existingRow || await this.one('SELECT * FROM bao_an.student_streaks WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    const {newStreakRecord, streakIncreased} = registerDailyCorrectAnswer(row, wasCorrect, nowIso);
    await this.exec(`
      INSERT INTO bao_an.student_streaks(workspace_id, student_id, current_streak, longest_streak, last_active_date, freeze_used_week, today_correct_count, today_date, updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(workspace_id, student_id) DO UPDATE SET
        current_streak=EXCLUDED.current_streak,
        longest_streak=EXCLUDED.longest_streak,
        last_active_date=EXCLUDED.last_active_date,
        freeze_used_week=EXCLUDED.freeze_used_week,
        today_correct_count=EXCLUDED.today_correct_count,
        today_date=EXCLUDED.today_date,
        updated_at=EXCLUDED.updated_at
    `, [auth.workspaceId, studentId, newStreakRecord.current_streak, newStreakRecord.longest_streak, newStreakRecord.last_active_date, newStreakRecord.freeze_used_week, newStreakRecord.today_correct_count, newStreakRecord.today_date, nowIso], client);
    if(streakIncreased){
      await this.audit(auth, 'student.streak.increase', json({studentId, streak: newStreakRecord.current_streak}), client);
    }
    return newStreakRecord;
  }
  async studentDailyMissions(auth, studentId = auth.studentId, nowIso = now(), client = this.pool){
    const today = toVietnamDateString(nowIso);
    let rows = await this.rows('SELECT * FROM bao_an.daily_missions WHERE workspace_id=$1 AND student_id=$2 AND date=$3', [auth.workspaceId, studentId, today], client);
    if(!rows.length){
      const defaults = buildDailyMissions(today);
      for(const m of defaults){
        await this.exec('INSERT INTO bao_an.daily_missions(workspace_id, student_id, date, mission_id, mission_type, target_count, progress_count, completed, completed_at, json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT(workspace_id, student_id, date, mission_id) DO NOTHING', [
          auth.workspaceId, studentId, today, m.id, m.type, m.targetCount, 0, false, null, '{}'
        ], client);
      }
      rows = await this.rows('SELECT * FROM bao_an.daily_missions WHERE workspace_id=$1 AND student_id=$2 AND date=$3', [auth.workspaceId, studentId, today], client);
    }
    return rows.map(r=>({
      id: r.mission_id,
      date: r.date,
      type: r.mission_type,
      title: r.mission_type==='new_lesson'?'Bài tập mới':r.mission_type==='review_error'?'Sửa sai ôn luyện':'Câu đố hôm nay',
      description: r.mission_type==='new_lesson'?'Hoàn thành 1 bài tập trong tuần học hiện tại.':r.mission_type==='review_error'?'Làm đúng 1 câu hỏi con từng trả lời sai hoặc chỉ đạt 1 sao.':'Trả lời đúng câu đố nhanh của ngày hôm nay.',
      targetCount: r.target_count,
      progressCount: r.progress_count,
      completed: !!r.completed,
      completedAt: r.completed_at
    }));
  }
  async updateDailyMissionProgress(auth, studentId, missionType, delta = 1, nowIso = now(), client = this.pool){
    const today = toVietnamDateString(nowIso);
    await this.studentDailyMissions(auth, studentId, nowIso, client);
    const row = await this.one('SELECT * FROM bao_an.daily_missions WHERE workspace_id=$1 AND student_id=$2 AND date=$3 AND mission_type=$4', [auth.workspaceId, studentId, today, missionType], client);
    if(row && !row.completed){
      const progress = row.progress_count + delta;
      const completed = progress >= row.target_count;
      const completedAt = completed ? nowIso : null;
      await this.exec('UPDATE bao_an.daily_missions SET progress_count=$1, completed=$2, completed_at=$3 WHERE workspace_id=$4 AND student_id=$5 AND date=$6 AND mission_type=$7', [
        progress, completed, completedAt, auth.workspaceId, studentId, today, missionType
      ], client);
      if(completed){
        await this.audit(auth, 'student.mission.complete', json({studentId, missionType, date: today}), client);
      }
    }
  }
  async studentDailyRiddle(auth, studentId = auth.studentId, classId = null, nowIso = now(), client = this.pool){
    const targetStudent = await this.student(auth, studentId, client);
    const targetClassId = classId || targetStudent.class_id;
    const today = toVietnamDateString(nowIso);
    const packRows = await this.rows(`
      SELECT p.json FROM bao_an.week_sets s
      JOIN bao_an.weeks w ON w.workspace_id=s.workspace_id AND w.id=s.week_id
      JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version
      WHERE s.workspace_id=$1 AND w.class_id=$2
      ORDER BY w.position, s.position
    `, [auth.workspaceId, targetClassId], client);
    const missionRows = await this.rows('SELECT * FROM bao_an.daily_missions WHERE workspace_id=$1 AND student_id=$2 AND date=$3 AND mission_type=$4', [auth.workspaceId, studentId, today, 'daily_riddle'], client);
    const fakeWeeks = [{sets: packRows.map(r=>{try{return {pack: parse(r.json)};}catch{return null;}}).filter(Boolean)}];
    return this.computeDailyRiddle(fakeWeeks, studentId, targetClassId, missionRows, nowIso);
  }
  async answerDailyRiddle(auth, input, nowIso = now()){
    role(auth, 'student');
    shape(input, ['chosenIndex']);
    const chosenIndex = integer(input.chosenIndex, 'Đáp án lựa chọn', 0, 10);
    return this.mutate(auth, async client=>{
      const student = await this.student(auth, auth.studentId, client);
      const riddle = await this.studentDailyRiddle(auth, student.id, student.class_id, nowIso, client);
      if(!riddle) fail(404, 'Hôm nay chưa có câu đố ngày.');
      const correct = chosenIndex === riddle.correctIndex;
      if(correct){
        await this.updateDailyMissionProgress(auth, student.id, 'daily_riddle', 1, nowIso, client);
        await this.recordDailyActivity(auth, student.id, true, nowIso, client);
        await this.evaluateAndAwardBadges(auth, student.id, client, nowIso);
      }
      return {
        correct,
        alreadySolved: correct || riddle.alreadySolved,
        streak: await this.studentStreak(auth, student.id, client, nowIso),
        missions: await this.studentDailyMissions(auth, student.id, nowIso, client)
      };
    });
  }
  async awardBadge(auth, studentId, badgeId, metadata = {}, nowIso = now(), client = this.pool){
    const exists = await this.one('SELECT 1 FROM bao_an.badge_awards WHERE workspace_id=$1 AND student_id=$2 AND badge_id=$3', [auth.workspaceId, studentId, badgeId], client);
    if(exists) return false;
    await this.exec('INSERT INTO bao_an.badge_awards(workspace_id, student_id, badge_id, unlocked_at, json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id, student_id, badge_id) DO NOTHING', [
      auth.workspaceId, studentId, badgeId, nowIso, json(metadata)
    ], client);
    await this.audit(auth, 'student.badge.award', json({studentId, badgeId}), client);
    return true;
  }
  async studentBadges(auth, studentId = auth.studentId, nowIso = now(), client = this.pool){
    const earnedRows = await this.rows('SELECT badge_id, unlocked_at, json FROM bao_an.badge_awards WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    const earnedBadges = earnedRows.map(r=>({badgeId: r.badge_id, unlockedAt: r.unlocked_at, json: r.json}));
    const metrics = await this.computeStudentMetrics(auth, studentId, nowIso, client);
    const evaluated = buildStudentBadgeStatuses(earnedBadges, metrics);
    for(const b of evaluated){
      if(b.currentProgress >= b.targetCount && !earnedBadges.some(e=>e.badgeId === b.id)){
        await this.awardBadge(auth, studentId, b.id, {progress: b.currentProgress}, nowIso, client);
        b.unlocked = true;
        b.unlockedAt = nowIso;
        b.missingRequirement = 'Đã mở khóa huy hiệu!';
      }
    }
    return evaluated;
  }
  async computeStudentMetrics(auth, studentId, nowIso = now(), client = this.pool){
    const streak = await this.studentStreak(auth, studentId, client, nowIso);
    const attemptRows = await this.rows(`
      SELECT a.json AS json FROM bao_an.attempts a
      JOIN bao_an.plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id
      WHERE p.workspace_id=$1 AND p.student_id=$2
      ORDER BY a.sequence ASC
    `, [auth.workspaceId, studentId], client);
    const attempts = attemptRows.map(r=>{try{return parse(r.json);}catch{return null;}}).filter(Boolean);
    const totalQuestionsAttempted = attempts.length;

    const wrongItems = new Set();
    const fixedItems = new Set();
    for(const a of attempts){
      if(!a.correct){
        wrongItems.add(a.itemId);
      } else if(wrongItems.has(a.itemId)){
        fixedItems.add(a.itemId);
      }
    }
    const retryFixedCount = fixedItems.size;

    let maxConsecutive = 0;
    let currConsecutive = 0;
    for(const a of attempts){
      if(a.correct){
        currConsecutive++;
        if(currConsecutive > maxConsecutive) maxConsecutive = currConsecutive;
      } else {
        currConsecutive = 0;
      }
    }

    const playRows = await this.rows('SELECT id, json FROM bao_an.plays WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    const completedPlays = playRows.map(r=>{try{return {id: r.id, ...parse(r.json)};}catch{return null;}}).filter(p=>p && p.status==='completed');
    const completedPacksCount = completedPlays.length;
    const distinctGamesPlayed = new Set(completedPlays.map(p=>p.moduleId)).size;

    let perfectMemoryCount = 0;
    for(const p of completedPlays){
      if(p.moduleId === 'memory-match' && p.id){
        const pEvents = (await this.rows('SELECT json FROM bao_an.attempts WHERE workspace_id=$1 AND play_id=$2', [auth.workspaceId, p.id], client)).map(r=>{try{return parse(r.json);}catch{return null;}}).filter(Boolean);
        const wrongMoves = pEvents.filter(e=>!e.correct);
        if(wrongMoves.length === 0 && pEvents.length > 0){
          perfectMemoryCount++;
        }
      }
    }

    const awardRows = await this.rows('SELECT pack_id, tier, json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    let mathPacks3Star = 0;
    let vietnamesePacks3Star = 0;
    let englishPacks3Star = 0;

    const packRows = await this.rows('SELECT pack_id, json FROM bao_an.packs WHERE workspace_id=$1', [auth.workspaceId], client);
    const packSubjects = new Map();
    for(const pr of packRows){
      try{
        const p = parse(pr.json);
        packSubjects.set(p.id, (p.subject || '').toLowerCase());
      }catch{}
    }

    for(const ar of awardRows){
      if(ar.tier === 3){
        const subj = packSubjects.get(ar.pack_id) || '';
        if(subj.includes('toan') || subj.includes('math')) mathPacks3Star++;
        else if(subj.includes('viet') || subj.includes('tieng-viet')) vietnamesePacks3Star++;
        else if(subj.includes('anh') || subj.includes('english')) englishPacks3Star++;
      }
    }

    const student = await this.student(auth, studentId, client);
    const weekRows = await this.rows('SELECT id FROM bao_an.weeks WHERE workspace_id=$1 AND class_id=$2', [auth.workspaceId, student.class_id], client);
    const weekSetRows = await this.rows('SELECT week_id, pack_id FROM bao_an.week_sets WHERE workspace_id=$1', [auth.workspaceId], client);
    const weekSetsByWeek = new Map();
    for(const ws of weekSetRows){
      let list = weekSetsByWeek.get(ws.week_id);
      if(!list){ list = []; weekSetsByWeek.set(ws.week_id, list); }
      list.push(ws.pack_id);
    }
    let perfectWeekCount = 0;
    for(const w of weekRows){
      const packIds = weekSetsByWeek.get(w.id);
      if(packIds && packIds.length > 0 && packIds.every(pid=>{
        const aw = awardRows.find(a=>a.pack_id === pid);
        return aw && aw.tier === 3;
      })){
        perfectWeekCount++;
      }
    }

    return {
      streak,
      retryFixedCount,
      perfectMemoryCount,
      perfectWeekCount,
      distinctGamesPlayed,
      consecutiveFirstTryCount: maxConsecutive,
      completedPacksCount,
      totalQuestionsAttempted,
      mathPacks3Star,
      vietnamesePacks3Star,
      englishPacks3Star
    };
  }
  async onAttemptRecorded(auth, session, event, pack, client, streakRow = null){
    const studentId = session.profileId || auth.studentId;
    await this.recordDailyActivity(auth, studentId, !!event.correct, event.occurredAt, client, streakRow);
  }
  async onPlayCompleted(auth, session, pack, events, completedAt = now(), client = this.pool){
    const studentId = session.profileId || auth.studentId;
    await this.updateDailyMissionProgress(auth, studentId, 'new_lesson', 1, completedAt, client);
    if(session.moduleId === 'memory-match'){
      const wrongMoves = events.filter(e=>!e.correct);
      if(wrongMoves.length === 0 && events.length > 0){
        await this.awardBadge(auth, studentId, 'perfect_memory', {earnedAt: completedAt}, completedAt, client);
      }
    }
    await this.evaluateAndAwardBadges(auth, studentId, client, completedAt);
  }
  async evaluateAndAwardBadges(auth, studentId, client = this.pool, nowIso = now()){
    await this.studentBadges(auth, studentId, nowIso, client);
  }
  async assertStudentScreenTimeAllowed(auth, studentId, client = this.pool, existingControls = null){
    const controls = existingControls !== null ? existingControls : await this.rawParentControls(auth.workspaceId, studentId, client);
    if (!controls) return;
    const curfew = checkCurfewHours(controls.allowedStartHour, controls.allowedEndHour);
    if (!curfew.allowed) fail(403, curfew.reason);
    if (controls.maxMinutesPerDay > 0) {
      const todayMinutes = await this.todayStudentStudyMinutes(auth, studentId, client);
      const limit = checkDailyScreenTime(todayMinutes, controls.maxMinutesPerDay);
      if (!limit.allowed) fail(403, limit.reason);
    }
  }
  async todayStudentStudyMinutes(auth, studentId, client = this.pool){
    const { dateStr } = getVietnamTimeParts();
    const rows = await this.rows('SELECT a.json FROM bao_an.attempts a JOIN bao_an.plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id WHERE a.workspace_id=$1 AND p.student_id=$2', [auth.workspaceId, studentId], client);
    let totalMs = 0;
    for (const r of rows) {
      try {
        const ev = parse(r.json);
        if (ev?.occurredAt && Number.isFinite(ev.elapsedMs) && ev.elapsedMs > 0) {
          const evDate = new Date(ev.occurredAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          if (evDate === dateStr) totalMs += ev.elapsedMs;
        }
      } catch {}
    }
    return msToMinutes(totalMs);
  }
  async rawParentControls(workspaceId, studentId, client = this.pool){
    text(studentId, 'Mã học sinh', 100);
    const row = await this.one('SELECT * FROM bao_an.parent_controls WHERE workspace_id=$1 AND student_id=$2', [workspaceId, studentId], client);
    if (!row) {
      return {
        workspaceId,
        studentId,
        pinHash: null,
        pinSalt: null,
        pinFailedCount: 0,
        pinLockedUntil: null,
        maxMinutesPerDay: 0,
        allowedStartHour: 0,
        allowedEndHour: 24,
        updatedAt: now()
      };
    }
    return {
      workspaceId: row.workspace_id,
      studentId: row.student_id,
      pinHash: row.pin_hash,
      pinSalt: row.pin_salt,
      pinFailedCount: row.pin_failed_count,
      pinLockedUntil: row.pin_locked_until,
      maxMinutesPerDay: row.max_minutes_per_day,
      allowedStartHour: row.allowed_start_hour,
      allowedEndHour: row.allowed_end_hour,
      updatedAt: row.updated_at
    };
  }
  async parentControls(auth, studentId, client = this.pool){
    return sanitizeParentControls(await this.rawParentControls(auth.workspaceId, studentId, client));
  }
  async setupParentPin(auth, studentId, input, parentToken = null){
    shape(input, ['pin', 'oldPin', 'studentId', 'parentToken']);
    const pin = text(input.pin, 'Mã PIN mới', 10);
    if (!/^\d{4,6}$/.test(pin)) fail(400, 'Mã PIN phụ huynh phải gồm từ 4 đến 6 chữ số.');
    await this.student(auth, studentId);
    const current = await this.rawParentControls(auth.workspaceId, studentId);
    if (auth.role === 'parent') {
      const linked = await this.one('SELECT 1 FROM bao_an.parent_students WHERE workspace_id=$1 AND parent_user_id=$2 AND student_id=$3', [auth.workspaceId, auth.id, studentId]);
      if (!linked) fail(403, 'Phụ huynh không có quyền thiết lập mã PIN cho học sinh này.');
    } else if (auth.role === 'student') {
      if (auth.studentId !== studentId) fail(403, 'Không có quyền truy cập học sinh khác.');
      if (current.pinHash) {
        if (current.pinLockedUntil && new Date(current.pinLockedUntil).getTime() > Date.now()) {
          const remainingMinutes = Math.ceil((new Date(current.pinLockedUntil).getTime() - Date.now()) / 60000);
          fail(429, `Mã PIN đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút.`);
        }
        const pToken = parentToken || input.parentToken;
        const tokenOk = pToken && verifyParentElevationToken(pToken, { userId: auth.id, studentId, workspaceId: auth.workspaceId, pinHash: current.pinHash, sessionHash: auth.tokenHash });
        if (!tokenOk) {
          const oldPin = input.oldPin ? text(input.oldPin, 'Mã PIN hiện tại', 10) : '';
          const isCorrect = oldPin && verifyParentPin(oldPin, current.pinHash, current.pinSalt);
          if (!isCorrect) {
            const newFailed = (current.pinFailedCount || 0) + 1;
            let lockedUntil = null;
            if (newFailed >= MAX_PIN_FAILURES) {
              lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
            }
            await this.exec('UPDATE bao_an.parent_controls SET pin_failed_count=$1, pin_locked_until=$2 WHERE workspace_id=$3 AND student_id=$4', [newFailed, lockedUntil, auth.workspaceId, studentId]);
            if (lockedUntil) {
              fail(429, 'Bạn đã nhập sai PIN 5 lần. Mã PIN bị tạm khóa 15 phút để bảo vệ tài khoản.');
            }
            fail(403, `Mã PIN cũ không chính xác. Bạn còn ${MAX_PIN_FAILURES - newFailed} lần thử.`);
          }
        }
      }
    }
    const { pinHash, pinSalt } = hashParentPin(pin);
    const updatedAt = now();
    await this.exec(`
      INSERT INTO bao_an.parent_controls(workspace_id, student_id, pin_hash, pin_salt, pin_failed_count, pin_locked_until, max_minutes_per_day, allowed_start_hour, allowed_end_hour, updated_at)
      VALUES($1,$2,$3,$4,0,NULL,$5,$6,$7,$8)
      ON CONFLICT(workspace_id, student_id) DO UPDATE SET
        pin_hash=EXCLUDED.pin_hash,
        pin_salt=EXCLUDED.pin_salt,
        pin_failed_count=0,
        pin_locked_until=NULL,
        updated_at=EXCLUDED.updated_at
    `, [auth.workspaceId, studentId, pinHash, pinSalt, current.maxMinutesPerDay, current.allowedStartHour, current.allowedEndHour, updatedAt]);
    revokeParentElevationToken(`${auth.id}:${studentId}`);
    const elevationToken = issueParentElevationToken({
      userId: auth.id,
      studentId,
      workspaceId: auth.workspaceId,
      pinHash,
      sessionHash: auth.tokenHash
    });
    await this.audit(auth, 'parent.setup_pin', studentId);
    return { success: true, parentToken: elevationToken };
  }
  async verifyParentPin(auth, studentId, pin){
    await this.student(auth, studentId);
    if (auth.role === 'student' && auth.studentId !== studentId) fail(403, 'Không có quyền truy cập học sinh khác.');
    if (auth.role === 'parent') {
      const linked = await this.one('SELECT 1 FROM bao_an.parent_students WHERE workspace_id=$1 AND parent_user_id=$2 AND student_id=$3', [auth.workspaceId, auth.id, studentId]);
      if (!linked) fail(403, 'Phụ huynh không có quyền truy cập học sinh này.');
    }
    const controls = await this.rawParentControls(auth.workspaceId, studentId);
    if (!controls.pinHash) fail(400, 'Chưa thiết lập mã PIN cho học sinh này.');
    if (controls.pinLockedUntil && new Date(controls.pinLockedUntil).getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((new Date(controls.pinLockedUntil).getTime() - Date.now()) / 60000);
      fail(429, `Mã PIN đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút.`);
    }
    const isCorrect = verifyParentPin(pin, controls.pinHash, controls.pinSalt);
    if (!isCorrect) {
      const newFailed = controls.pinFailedCount + 1;
      let lockedUntil = null;
      if (newFailed >= MAX_PIN_FAILURES) {
        lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
      }
      await this.exec('UPDATE bao_an.parent_controls SET pin_failed_count=$3, pin_locked_until=$4 WHERE workspace_id=$1 AND student_id=$2',
        [auth.workspaceId, studentId, newFailed, lockedUntil]);
      if (lockedUntil) {
        fail(429, 'Bạn đã nhập sai PIN 5 lần. Mã PIN bị tạm khóa 15 phút để bảo vệ tài khoản.');
      }
      fail(403, `Sai mã PIN phụ huynh. Bạn còn ${MAX_PIN_FAILURES - newFailed} lần thử.`);
    }
    await this.exec('UPDATE bao_an.parent_controls SET pin_failed_count=0, pin_locked_until=NULL WHERE workspace_id=$1 AND student_id=$2',
      [auth.workspaceId, studentId]);
    const parentToken = issueParentElevationToken({
      userId: auth.id,
      studentId,
      workspaceId: auth.workspaceId,
      pinHash: controls.pinHash,
      sessionHash: auth.tokenHash
    });
    await this.audit(auth, 'parent.verify_pin', studentId);
    return { success: true, parentToken, studentId };
  }
  async updateParentSettings(auth, studentId, input, parentToken = null){
    shape(input, ['maxMinutesPerDay', 'allowedStartHour', 'allowedEndHour', 'studentId', 'parentToken']);
    await this.student(auth, studentId);
    if (auth.role === 'parent') {
      const linked = await this.one('SELECT 1 FROM bao_an.parent_students WHERE workspace_id=$1 AND parent_user_id=$2 AND student_id=$3', [auth.workspaceId, auth.id, studentId]);
      if (!linked) fail(403, 'Phụ huynh không có quyền thay đổi cài đặt cho học sinh này.');
    } else if (auth.role === 'student') {
      if (auth.studentId !== studentId) fail(403, 'Không có quyền truy cập học sinh khác.');
      const currentRaw = await this.rawParentControls(auth.workspaceId, studentId);
      if (currentRaw.pinHash) {
        const pToken = parentToken || input.parentToken;
        const tokenOk = pToken && verifyParentElevationToken(pToken, {
          userId: auth.id,
          studentId,
          workspaceId: auth.workspaceId,
          pinHash: currentRaw.pinHash,
          sessionHash: auth.tokenHash
        });
        if (!tokenOk) fail(403, 'Chưa xác thực quyền phụ huynh.');
      }
    }
    const maxMinutes = input.maxMinutesPerDay !== undefined ? integer(input.maxMinutesPerDay, 'Thời gian học', 0, 480) : 0;
    const startHour = input.allowedStartHour !== undefined ? integer(input.allowedStartHour, 'Giờ bắt đầu', 0, 23) : 0;
    const endHour = input.allowedEndHour !== undefined ? integer(input.allowedEndHour, 'Giờ kết thúc', 1, 24) : 24;
    if (endHour <= startHour && endHour !== 24 && startHour !== 0) {
      fail(400, 'Giờ kết thúc phải sau giờ bắt đầu.');
    }
    const current = await this.rawParentControls(auth.workspaceId, studentId);
    const updatedAt = now();
    await this.exec(`
      INSERT INTO bao_an.parent_controls(workspace_id, student_id, pin_hash, pin_salt, pin_failed_count, pin_locked_until, max_minutes_per_day, allowed_start_hour, allowed_end_hour, updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(workspace_id, student_id) DO UPDATE SET
        max_minutes_per_day=EXCLUDED.max_minutes_per_day,
        allowed_start_hour=EXCLUDED.allowed_start_hour,
        allowed_end_hour=EXCLUDED.allowed_end_hour,
        updated_at=EXCLUDED.updated_at
    `, [auth.workspaceId, studentId, current.pinHash, current.pinSalt, current.pinFailedCount, current.pinLockedUntil, maxMinutes, startHour, endHour, updatedAt]);
    await this.audit(auth, 'parent.update_settings', studentId);
    return this.parentControls(auth, studentId);
  }
  async createParent(auth, input, passwordHash, username){
    shape(input, ['name', 'username', 'password', 'studentIds']);
    const name = text(input.name, 'Tên phụ huynh', 100);
    const studentIds = input.studentIds;
    if (!Array.isArray(studentIds) || studentIds.length < 1 || studentIds.length > 3) {
      fail(400, 'Tài khoản phụ huynh cần gắn với từ 1 đến 3 học sinh.');
    }
    return this.mutate(auth, async client => {
      const userId = id(), createdAt = now();
      await this.exec('INSERT INTO bao_an.users(id,workspace_id,username,password_hash,role,created_at) VALUES($1,$2,$3,$4,$5,$6)',
        [userId, auth.workspaceId, username, passwordHash, 'parent', createdAt], client);
      for (const sId of studentIds) {
        const student = await this.student(auth, sId, client);
        await this.exec('INSERT INTO bao_an.parent_students(workspace_id, parent_user_id, student_id, created_at) VALUES($1,$2,$3,$4)',
          [auth.workspaceId, userId, student.id, createdAt], client);
      }
      return { id: userId, username, name, studentIds };
    });
  }
  async parentStudents(auth, client = this.pool){
    if (auth.role !== 'parent') fail(403, 'Chỉ phụ huynh mới dùng hàm này.');
    const rows = await this.rows('SELECT s.*, c.name AS class_name FROM bao_an.parent_students ps JOIN bao_an.students s ON s.workspace_id=ps.workspace_id AND s.id=ps.student_id JOIN bao_an.classes c ON c.workspace_id=s.workspace_id AND c.id=s.class_id WHERE ps.workspace_id=$1 AND ps.parent_user_id=$2', [auth.workspaceId, auth.id], client);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      className: r.class_name,
      grade: r.grade,
      active: !!r.active
    }));
  }
  async parentDashboard(auth, studentId, weekId, parentToken = null){
    text(studentId, 'Mã học sinh', 100);
    await this.student(auth, studentId);
    if (auth.role === 'parent') {
      const linked = await this.one('SELECT 1 FROM bao_an.parent_students WHERE workspace_id=$1 AND parent_user_id=$2 AND student_id=$3', [auth.workspaceId, auth.id, studentId]);
      if (!linked) fail(403, 'Phụ huynh không có quyền xem thông tin học sinh này.');
    } else if (auth.role === 'student') {
      if (auth.studentId !== studentId) fail(403, 'Không có quyền truy cập.');
      const raw = await this.rawParentControls(auth.workspaceId, studentId);
      if (raw.pinHash) {
        const tokenOk = parentToken && verifyParentElevationToken(parentToken, {
          userId: auth.id,
          studentId,
          workspaceId: auth.workspaceId,
          pinHash: raw.pinHash,
          sessionHash: auth.tokenHash
        });
        if (!tokenOk) fail(403, 'Vui lòng xác thực mã PIN phụ huynh trước.');
      }
    }
    const student = await this.student(auth, studentId);
    const cls = await this.class(auth, student.class_id);
    const controls = await this.parentControls(auth, studentId);
    const todayMinutes = await this.todayStudentStudyMinutes(auth, studentId);

    let week;
    if (weekId) {
      week = await this.one('SELECT * FROM bao_an.weeks WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, weekId]);
    }
    if (!week) {
      const marker = (await this.journeyMarker(auth, student)) ?? (await this.pinJourney(auth, student));
      if (marker) {
        week = await this.one('SELECT * FROM bao_an.weeks WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, marker.weekId]);
      }
    }
    if (!week) {
      week = await this.one('SELECT * FROM bao_an.weeks WHERE workspace_id=$1 AND class_id=$2 ORDER BY position DESC LIMIT 1', [auth.workspaceId, student.class_id]);
    }

    let weekSets = [];
    if (week) {
      const setRows = await this.rows('SELECT s.position, p.* FROM bao_an.week_sets s JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE s.workspace_id=$1 AND s.week_id=$2 ORDER BY s.position', [auth.workspaceId, week.id]);
      weekSets = setRows.map(r => ({
        subjectLabel: r.subject_label,
        pack: parse(r.json)
      }));
    }

    const nowD = new Date();
    const dayOfWeek = (nowD.getDay() + 6) % 7;
    const monday = new Date(nowD.getTime() - dayOfWeek * 86400000);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday.getTime() + 6 * 86400000 + 86399999);
    const startDateIso = monday.toISOString();
    const endDateIso = sunday.toISOString();

    const attemptRows = await this.rows(`
      SELECT a.json FROM bao_an.attempts a
      JOIN bao_an.plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id
      WHERE a.workspace_id=$1 AND p.student_id=$2
    `, [auth.workspaceId, studentId]);
    const events = attemptRows.map(r => {
      try { return parse(r.json); } catch { return null; }
    }).filter(Boolean);

    const badgeRows = await this.rows('SELECT * FROM bao_an.badge_awards WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId]);
    const redRows = await this.rows('SELECT * FROM bao_an.redemptions WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId]);

    const report = buildParentWeeklyReport({
      student,
      className: cls.name,
      week: week ? { id: week.id, title: week.title, sets: weekSets } : null,
      events,
      badges: badgeRows,
      redemptions: redRows,
      startDateIso,
      endDateIso
    });

    let children = [];
    if (auth.role === 'parent') {
      children = await this.parentStudents(auth);
    }

    return {
      student: { id: student.id, name: student.name, className: cls.name },
      controls: {
        hasPin: Boolean(controls.hasPin),
        maxMinutesPerDay: controls.maxMinutesPerDay,
        allowedStartHour: controls.allowedStartHour,
        allowedEndHour: controls.allowedEndHour,
        pinLocked: Boolean(controls.pinLocked)
      },
      todayMinutes,
      report,
      children
    };
  }

  contestPresets(auth){
    return Object.values(CONTEST_PRESETS);
  }

  async startContest(auth, input){
    role(auth, 'student');
    shape(input, ['presetId', 'requestId']);
    const presetId = text(input.presetId, 'Mã ma trận đề', 80);
    const requestId = input.requestId ? text(input.requestId, 'Mã yêu cầu', 100) : null;
    const preset = CONTEST_PRESETS[presetId];
    if (!preset) fail(404, 'Không tìm thấy ma trận đề thi này.');

    await this.assertStudentScreenTimeAllowed(auth, auth.studentId);

    return this.mutate(auth, async client => {
      if (requestId) {
        const prior = await this.one('SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND request_id=$3', [auth.workspaceId, auth.studentId, requestId], client);
        if (prior) {
          const remainingSeconds = Math.max(0, Math.floor((Date.parse(prior.deadline_at) - Date.now()) / 1000));
          const items = parse(prior.items_json);
          return {
            sessionId: prior.session_id,
            preset,
            startedAt: prior.started_at,
            deadlineAt: prior.deadline_at,
            remainingSeconds,
            status: prior.status,
            items: items.map(sanitizeContestItem),
            answers: parse(prior.answers_json || '{}'),
            skippedKeys: parse(prior.skipped_keys || '[]')
          };
        }
      }

      const active = await this.one("SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND preset_id=$3 AND status='active' ORDER BY created_at DESC LIMIT 1", [auth.workspaceId, auth.studentId, presetId], client);
      if (active) {
        const remainingSeconds = Math.max(0, Math.floor((Date.parse(active.deadline_at) - Date.now()) / 1000));
        if (remainingSeconds > 0) {
          const items = parse(active.items_json);
          const stored = parse(active.answers_json || '{}');
          const { _revisions: _discard, ...cleanAnswers } = stored;
          return {
            sessionId: active.session_id,
            preset,
            startedAt: active.started_at,
            deadlineAt: active.deadline_at,
            remainingSeconds,
            status: 'active',
            items: items.map(sanitizeContestItem),
            answers: cleanAnswers,
            skippedKeys: parse(active.skipped_keys || '[]')
          };
        } else {
          await this.submitContest(auth, active.session_id, { answers: parse(active.answers_json || '{}') }, client);
        }
      }

      const sessionId = id();
      const startedAt = now();
      const deadlineAt = new Date(Date.now() + preset.durationSeconds * 1000).toISOString();

      const student = await this.student(auth, auth.studentId, client);
      const weekRows = await this.rows('SELECT ws.pack_id, ws.version, p.json FROM bao_an.week_sets ws JOIN bao_an.weeks w ON w.workspace_id=ws.workspace_id AND w.id=ws.week_id JOIN bao_an.packs p ON p.workspace_id=ws.workspace_id AND p.pack_id=ws.pack_id AND p.version=ws.version WHERE ws.workspace_id=$1 AND w.class_id=$2', [auth.workspaceId, student.class_id], client);
      const assignedPacks = weekRows.map(r => {
        try { return parse(r.json); } catch { return null; }
      }).filter(Boolean);

      const items = generateContestQuestions(preset, auth.studentId, sessionId, assignedPacks);

      await this.exec('INSERT INTO bao_an.contest_sessions(workspace_id, student_id, session_id, request_id, preset_id, title, subject, grade, duration_seconds, started_at, deadline_at, status, items_json, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)',
        [auth.workspaceId, auth.studentId, sessionId, requestId, presetId, preset.title, preset.subject, preset.grade, preset.durationSeconds, startedAt, deadlineAt, 'active', json(items), startedAt], client);

      await this.audit(auth, 'contest.start', json({ sessionId, presetId }), client);

      return {
        sessionId,
        preset,
        startedAt,
        deadlineAt,
        remainingSeconds: preset.durationSeconds,
        status: 'active',
        items: items.map(sanitizeContestItem),
        answers: {},
        skippedKeys: []
      };
    });
  }

  async activeContest(auth, client = this.pool){
    role(auth, 'student');
    const row = await this.one("SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND status='active' ORDER BY created_at DESC LIMIT 1", [auth.workspaceId, auth.studentId], client);
    if (!row) return { active: false };

    const remainingSeconds = Math.max(0, Math.floor((Date.parse(row.deadline_at) - Date.now()) / 1000));
    if (remainingSeconds <= 0) {
      const res = await this.submitContest(auth, row.session_id, { answers: parse(row.answers_json || '{}') }, client);
      return { active: false, lastResult: res };
    }

    const preset = CONTEST_PRESETS[row.preset_id];
    const items = parse(row.items_json);
    const stored = parse(row.answers_json || '{}');
    const { _revisions: _discard, ...cleanAnswers } = stored;
    return {
      active: true,
      session: {
        sessionId: row.session_id,
        preset,
        startedAt: row.started_at,
        deadlineAt: row.deadline_at,
        remainingSeconds,
        status: 'active',
        items: items.map(sanitizeContestItem),
        answers: cleanAnswers,
        skippedKeys: parse(row.skipped_keys || '[]')
      }
    };
  }

  async saveContestProgress(auth, sessionId, input){
    role(auth, 'student');
    text(sessionId, 'Mã lượt thi', 100);
    shape(input, ['answers', 'skippedKeys', 'revision', 'seq']);
    return this.mutate(auth, async client => {
      const row = await this.one("SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND session_id=$3 AND status='active'", [auth.workspaceId, auth.studentId, sessionId], client);
      if (!row) fail(404, 'Không tìm thấy lượt thi đang làm.');

      const remainingSeconds = Math.max(0, Math.floor((Date.parse(row.deadline_at) - Date.now()) / 1000));
      if (remainingSeconds <= 0) {
        return this.submitContest(auth, sessionId, { answers: input.answers ?? parse(row.answers_json || '{}') }, client);
      }

      const existingStored = parse(row.answers_json || '{}');
      const existingRevisions = existingStored._revisions && typeof existingStored._revisions === 'object'
        ? { ...existingStored._revisions }
        : {};
      const { _revisions: _discard, ...cleanExistingAnswers } = existingStored;

      let mergedAnswers = { ...cleanExistingAnswers };
      if (input.answers !== undefined && input.answers !== null && typeof input.answers === 'object') {
        const inputRev = typeof input.revision === 'number'
          ? input.revision
          : typeof input.seq === 'number'
          ? input.seq
          : null;

        for (const [key, val] of Object.entries(input.answers)) {
          if (key === '_revisions') continue;
          const currentRev = existingRevisions[key] ?? 0;
          if (inputRev === null || inputRev >= currentRev) {
            mergedAnswers[key] = val;
            existingRevisions[key] = inputRev !== null ? inputRev : currentRev + 1;
          }
        }
      }

      const answersToStore = json({ ...mergedAnswers, _revisions: existingRevisions });
      const existingSkipped = parse(row.skipped_keys || '[]');
      const skipped = input.skippedKeys !== undefined ? json(Array.from(new Set([...existingSkipped, ...input.skippedKeys]))) : row.skipped_keys;
      await this.exec('UPDATE bao_an.contest_sessions SET answers_json=$3::jsonb, skipped_keys=$4::jsonb WHERE workspace_id=$1 AND session_id=$2',
        [auth.workspaceId, sessionId, answersToStore, skipped], client);
      return { success: true, remainingSeconds, answers: mergedAnswers };
    });
  }

  async submitContest(auth, sessionId, input = {}, client = null){
    role(auth, 'student');
    text(sessionId, 'Mã lượt thi', 100);
    if (!client) {
      return this.mutate(auth, c => this.submitContest(auth, sessionId, input, c));
    }

    const row = await this.one('SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND session_id=$3', [auth.workspaceId, auth.studentId, sessionId], client);
    if (!row) fail(404, 'Không tìm thấy lượt thi.');

    const preset = CONTEST_PRESETS[row.preset_id];
    const items = parse(row.items_json);

    if (row.status !== 'active') {
      const historyRows = await this.rows("SELECT score, max_score, status FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND preset_id=$3 AND status IN ('submitted', 'timeout') ORDER BY created_at DESC", [auth.workspaceId, auth.studentId, row.preset_id], client);
      const readiness = checkReadinessForExam(historyRows.map(r => ({ percent: r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0, passed: (r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0) >= preset.passPercent })));
      const savedStored = parse(row.answers_json || '{}');
      const { _revisions: _discard, ...cleanSavedAnswers } = savedStored;
      const evaluation = evaluateContestSubmission(items, cleanSavedAnswers, preset, Math.min(preset.durationSeconds * 1000, Math.max(0, Date.parse(row.submitted_at || row.deadline_at) - Date.parse(row.started_at))), row.status);
      return {
        sessionId,
        ...evaluation,
        readyForExam: readiness.readyForExam,
        consecutivePasses: readiness.consecutiveCount
      };
    }

    const nowMs = Date.now();
    const deadlineMs = Date.parse(row.deadline_at);
    const isTimeout = nowMs > deadlineMs + 3000;
    const finishReason = isTimeout ? 'timeout' : 'submitted';
    const submittedAt = now();
    const savedStored = parse(row.answers_json || '{}');
    const { _revisions: _discard, ...cleanSavedAnswers } = savedStored;
    const inputAnswers = input.answers && typeof input.answers === 'object' ? input.answers : {};
    const { _revisions: _discard2, ...cleanInputAnswers } = inputAnswers;
    const answers = Object.keys(cleanInputAnswers).length > 0
      ? { ...cleanSavedAnswers, ...cleanInputAnswers }
      : cleanSavedAnswers;
    const elapsedMs = Math.min(preset.durationSeconds * 1000, Math.max(0, nowMs - Date.parse(row.started_at)));

    const evaluation = evaluateContestSubmission(items, answers, preset, elapsedMs, finishReason);

    await this.exec(`
      UPDATE bao_an.contest_sessions SET
        status=$3,
        submitted_at=$4,
        score=$5,
        max_score=$6,
        correct_count=$7,
        total_items=$8,
        answers_json=$9::jsonb
      WHERE workspace_id=$1 AND session_id=$2
    `, [auth.workspaceId, sessionId, finishReason, submittedAt, evaluation.score, evaluation.maxScore, evaluation.correctCount, evaluation.totalItems, json(answers)], client);

    let badgeAwarded = false;
    const existingBadge = await this.one('SELECT 1 FROM bao_an.badge_awards WHERE workspace_id=$1 AND student_id=$2 AND badge_id=$3', [auth.workspaceId, auth.studentId, CONTESTANT_BADGE.id], client);
    if (!existingBadge) {
      await this.awardBadge(auth, auth.studentId, CONTESTANT_BADGE.id, { title: CONTESTANT_BADGE.title, unlockedAt: submittedAt }, submittedAt, client);
      badgeAwarded = true;
    }

    await this.audit(auth, 'contest.submit', json({ sessionId, score: evaluation.score, maxScore: evaluation.maxScore, finishReason }), client);

    const historyRows = await this.rows("SELECT score, max_score, status FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND preset_id=$3 AND status IN ('submitted', 'timeout') ORDER BY created_at DESC", [auth.workspaceId, auth.studentId, row.preset_id], client);
    const readiness = checkReadinessForExam(historyRows.map(r => ({ percent: r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0, passed: (r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0) >= preset.passPercent })));

    return {
      sessionId,
      ...evaluation,
      readyForExam: readiness.readyForExam,
      consecutivePasses: readiness.consecutiveCount,
      badgeAwarded
    };
  }

  async contestHistory(auth, studentId = auth.studentId, presetId = null, client = this.pool){
    if (auth.role === 'student' && auth.studentId !== studentId) fail(403, 'Không có quyền truy cập.');
    text(studentId, 'Mã học sinh', 100);
    const sql = presetId
      ? "SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND preset_id=$3 AND status IN ('submitted', 'timeout') ORDER BY created_at DESC"
      : "SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND status IN ('submitted', 'timeout') ORDER BY created_at DESC";
    const params = presetId ? [auth.workspaceId, studentId, presetId] : [auth.workspaceId, studentId];
    const rows = await this.rows(sql, params, client);

    const attempts = rows.map(r => {
      const preset = CONTEST_PRESETS[r.preset_id];
      const percent = r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0;
      const elapsedMs = r.submitted_at ? Math.max(0, Date.parse(r.submitted_at) - Date.parse(r.started_at)) : r.duration_seconds * 1000;
      return {
        sessionId: r.session_id,
        presetId: r.preset_id,
        presetTitle: preset?.title || r.title,
        contest: preset?.contest || 'violympic',
        subject: r.subject,
        grade: r.grade,
        startedAt: r.started_at,
        submittedAt: r.submitted_at,
        score: r.score,
        maxScore: r.max_score,
        percent,
        passed: percent >= (preset?.passPercent || 80),
        finishReason: r.status,
        elapsedMs
      };
    });

    const readiness = checkReadinessForExam(attempts);

    return {
      attempts,
      readyForExam: readiness.readyForExam,
      consecutiveCount: readiness.consecutiveCount
    };
  }

  async contestReviewPack(auth, sessionId, client = this.pool){
    role(auth, 'student');
    text(sessionId, 'Mã lượt thi', 100);
    const row = await this.one('SELECT * FROM bao_an.contest_sessions WHERE workspace_id=$1 AND student_id=$2 AND session_id=$3', [auth.workspaceId, auth.studentId, sessionId], client);
    if (!row) fail(404, 'Không tìm thấy lượt thi.');
    const items = parse(row.items_json);
    const answers = parse(row.answers_json || '{}');
    const preset = CONTEST_PRESETS[row.preset_id];
    const evaluation = evaluateContestSubmission(items, answers, preset, 0, row.status);
    const pack = buildReviewMistakesPack({ sessionId: row.session_id, studentId: row.student_id, workspaceId: auth.workspaceId, title: row.title, subject: row.subject, grade: row.grade }, evaluation.mistakes);
    await this.exec('INSERT INTO bao_an.packs(workspace_id, pack_id, version, subject_label, json, content_hash) VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (workspace_id, pack_id, version) DO UPDATE SET json=EXCLUDED.json, content_hash=EXCLUDED.content_hash', [auth.workspaceId, pack.id, pack.version, pack.subject, json(pack), contentIdentity(pack)], client);
    return pack;
  }

  async resolvePackSubject(auth, packId, client = this.pool) {
    const row = await this.one('SELECT subject_label, json FROM bao_an.packs WHERE workspace_id=$1 AND pack_id=$2 ORDER BY version DESC LIMIT 1', [auth.workspaceId, packId], client);
    if (!row) return 'math';
    try {
      const p = parse(row.json);
      return resolveTownSubject(p.subject || row.subject_label);
    } catch {
      return resolveTownSubject(row.subject_label);
    }
  }

  async syncAwardMaterial(auth, studentId, packId, stars, client = this.pool) {
    if (!stars || stars <= 0) return;
    try {
      const subject = await this.resolvePackSubject(auth, packId, client);
      const material = getMaterialForSubject(subject);
      const existingRow = await this.one("SELECT coalesce(sum(delta), 0) as total FROM bao_an.materials_ledger WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3 AND delta > 0", [auth.workspaceId, studentId, packId], client);
      const existingEarned = Number(existingRow?.total || 0);
      const gained = stars - existingEarned;
      if (gained > 0) {
        await this.exec('INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
          auth.workspaceId, studentId, id(), packId, material, gained, 'award', `award:${packId}:${stars}`, now()
        ], client);
      }
    } catch (e) {
      // Ignore background sync errors
    }
  }

  async townState(auth, studentId, client = this.pool, { allowClassmate = false } = {}) {
    if (auth.role === 'student' && auth.studentId !== studentId && !allowClassmate) fail(404, 'Không tìm thấy học sinh.');
    let row = await this.one('SELECT * FROM bao_an.town_states WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    if (!row) {
      const initial = defaultTownState(studentId, now());
      await this.exec('INSERT INTO bao_an.town_states(workspace_id, student_id, grid_width, grid_height, revision, buildings_json, updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)', [
        auth.workspaceId, studentId, initial.gridWidth, initial.gridHeight, initial.revision, json(initial.buildings), initial.updatedAt
      ], client);
      return initial;
    }
    return {
      gridWidth: row.grid_width,
      gridHeight: row.grid_height,
      revision: row.revision,
      buildings: parse(row.buildings_json || '[]'),
      updatedAt: row.updated_at,
    };
  }

  async materials(auth, studentId, client = this.pool) {
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    const countRow = await this.one('SELECT count(*) as c FROM bao_an.materials_ledger WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    if (Number(countRow?.c || 0) === 0) {
      return this.recalculateMaterials(auth, studentId, client);
    }
    const rows = await this.rows('SELECT material_type, coalesce(sum(delta), 0) as balance FROM bao_an.materials_ledger WHERE workspace_id=$1 AND student_id=$2 GROUP BY material_type', [auth.workspaceId, studentId], client);
    const balances = { stone: 0, wood: 0, fish: 0, component: 0 };
    for (const r of rows) {
      if (r.material_type in balances) {
        balances[r.material_type] = Math.max(0, Number(r.balance));
      }
    }
    return balances;
  }

  async recalculateMaterials(auth, studentId, client = this.pool) {
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    return this.mutate(auth, async (tx) => {
      await this.exec('DELETE FROM bao_an.materials_ledger WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], tx);

      const awardRows = await this.rows('SELECT pack_id, tier, json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], tx);
      const awards = awardRows.map(r => ({
        packId: r.pack_id,
        tier: r.tier,
        ...parse(r.json)
      }));

      const packRows = await this.rows('SELECT pack_id, subject_label, json FROM bao_an.packs WHERE workspace_id=$1', [auth.workspaceId], tx);
      const subjectMap = new Map();
      for (const pr of packRows) {
        try {
          const p = parse(pr.json);
          subjectMap.set(pr.pack_id, resolveTownSubject(p.subject || pr.subject_label));
        } catch {
          subjectMap.set(pr.pack_id, resolveTownSubject(pr.subject_label));
        }
      }

      const earned = calculateEarnedMaterialsFromAwards(awards, (id) => subjectMap.get(id) || 'math');
      const currentTime = now();

      for (const [mat, amount] of Object.entries(earned)) {
        if (amount > 0) {
          await this.exec('INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
            auth.workspaceId, studentId, id(), null, mat, amount, 'award', `recalc:${studentId}:${mat}:${amount}`, currentTime
          ], tx);
        }
      }

      const town = await this.townState(auth, studentId, tx);
      for (const placed of town.buildings) {
        const item = TOWN_BUILDING_MAP.get(placed.buildingId);
        if (!item) continue;
        for (const [mat, cost] of Object.entries(item.cost)) {
          if (cost && cost > 0) {
            await this.exec('INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
              auth.workspaceId, studentId, id(), null, mat, -cost, 'build', `spend:${placed.id}:${mat}`, currentTime
            ], tx);
          }
        }
      }

      const spent = calculateTotalSpentMaterials(town.buildings);
      return calculateAvailableMaterials(earned, spent);
    });
  }

  async placeBuilding(auth, studentId, input, client = this.pool) {
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    shape(input, ['buildingId', 'x', 'y', 'expectedRevision', 'requestId', 'studentId']);
    text(input.buildingId, 'Mã công trình', 64);
    let requestId = input.requestId || id();

    return this.mutate(auth, async (tx) => {
      const existingTx = await this.one("SELECT 1 FROM bao_an.materials_ledger WHERE workspace_id=$1 AND student_id=$2 AND request_id=$3 AND reason='build' LIMIT 1", [auth.workspaceId, studentId, requestId], tx);
      if (existingTx) {
        const currentTown = await this.townState(auth, studentId, tx);
        const currentMaterials = await this.materials(auth, studentId, tx);
        return { ok: true, town: currentTown, materials: currentMaterials, duplicate: true };
      }

      const currentTown = await this.townState(auth, studentId, tx);
      const currentMaterials = await this.materials(auth, studentId, tx);
      const placementId = id();
      const currentTime = now();

      const { updatedTownState, placedBuilding, cost } = evaluateBuildingPlacement({
        currentTownState: currentTown,
        buildingId: input.buildingId,
        x: input.x,
        y: input.y,
        expectedRevision: input.expectedRevision,
        availableMaterials: currentMaterials,
        nowIso: currentTime,
        placementId,
      });

      for (const [mat, amount] of Object.entries(cost)) {
        if (amount && amount > 0) {
          await this.exec('INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
            auth.workspaceId, studentId, id(), null, mat, -amount, 'build', requestId, currentTime
          ], tx);
        }
      }

      await this.exec('UPDATE bao_an.town_states SET revision=$3, buildings_json=$4::jsonb, updated_at=$5 WHERE workspace_id=$1 AND student_id=$2', [
        auth.workspaceId, studentId, updatedTownState.revision, json(updatedTownState.buildings), updatedTownState.updatedAt
      ], tx);

      const updatedMaterials = calculateAvailableMaterials(
        currentMaterials,
        calculateTotalSpentMaterials([placedBuilding])
      );

      try {
        const student = await this.one('SELECT class_id, name FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, studentId], tx);
        if (student) {
          await this.publishClassFeedEvent(auth, student.class_id, studentId, student.name, 'building_built', {
            buildingId: placedBuilding.buildingId,
            buildingName: placedBuilding.name,
            buildingIcon: placedBuilding.icon,
          }, tx);
        }
      } catch {}

      return {
        ok: true,
        town: updatedTownState,
        materials: updatedMaterials,
        placedBuilding
      };
    });
  }

  async townSummary(auth, studentId, client = this.pool) {
    const town = await this.townState(auth, studentId, client);
    const materials = await this.materials(auth, studentId, client);
    const catalog = TOWN_BUILDING_CATALOG;
    let walletAvailableStars = 0;
    try {
      const rewards = await this.rewards(auth, studentId, client);
      const requests = await this.requests(auth, studentId, client);
      const balance = rewardBalance(earnedQuestionRewardStars(rewards), { requests });
      walletAvailableStars = balance.available;
    } catch {}
    return { town, materials, catalog, walletAvailableStars };
  }

  async townAnimals(auth, studentId, client = this.pool, { allowClassmate = false } = {}) {
    if (auth.role === 'student' && auth.studentId !== studentId && !allowClassmate) fail(404, 'Không tìm thấy học sinh.');
    const student = await this.one('SELECT * FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, studentId], client);
    if (!student) fail(404, 'Không tìm thấy học sinh.');
    const awardsRows = await this.rows('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 ORDER BY pack_id', [auth.workspaceId, studentId], client);
    const awards = awardsRows.map(row => parse(row.json));
    const prog = await this.summaryProgress(auth, student, client, awards);
    const completedWeeksCount = prog.weeks.filter(w => w.done || w.closed).length;
    const unlockedDefs = getUnlockedAnimals(completedWeeksCount);
    const rows = await this.rows('SELECT animal_id, name, arrived_at_week, created_at FROM bao_an.town_animals WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, studentId], client);
    const animals = unlockedDefs.map(def => {
      const saved = rows.find(r => r.animal_id === def.id);
      return {
        animalId: def.id,
        species: def.species,
        defaultName: def.defaultName,
        name: saved ? saved.name : def.defaultName,
        hasCustomName: !!saved,
        icon: def.icon,
        requiredWeeks: def.requiredWeeks,
        description: def.description,
        arrivedAtWeek: saved ? saved.arrived_at_week : def.requiredWeeks,
      };
    });
    return { animals, completedWeeksCount };
  }

  async nameTownAnimal(auth, studentId, input, client = this.pool) {
    shape(input, ['animalId', 'name']);
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    const student = await this.one('SELECT * FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, studentId], client);
    if (!student) fail(404, 'Không tìm thấy học sinh.');

    const validation = validateAnimalName(input.name);
    if (!validation.valid) fail(400, validation.error || 'Tên bạn nhỏ không hợp lệ.');

    const prog = await this.summaryProgress(auth, student, client);
    const completedWeeksCount = prog.weeks.filter(w => w.done || w.closed).length;
    const unlockedDefs = getUnlockedAnimals(completedWeeksCount);
    const def = unlockedDefs.find(d => d.id === input.animalId);
    if (!def) fail(400, 'Bạn động vật này chưa chuyển đến thị trấn.');

    const cleanName = validation.cleanName;
    await this.exec(`
      INSERT INTO bao_an.town_animals(workspace_id, student_id, animal_id, name, arrived_at_week, created_at)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(workspace_id, student_id, animal_id) DO UPDATE SET name=EXCLUDED.name
    `, [auth.workspaceId, studentId, def.id, cleanName, def.requiredWeeks, now()], client);

    return {
      ok: true,
      animal: {
        animalId: def.id,
        species: def.species,
        name: cleanName,
        arrivedAtWeek: def.requiredWeeks,
        icon: def.icon,
      }
    };
  }

  async classmatesTowns(auth, studentId, client = this.pool) {
    const student = await this.one('SELECT * FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, studentId], client);
    if (!student) fail(404, 'Không tìm thấy học sinh.');
    const classmates = await this.rows('SELECT id, name FROM bao_an.students WHERE workspace_id=$1 AND class_id=$2 AND active=true', [auth.workspaceId, student.class_id], client);

    const results = [];
    for (const c of classmates) {
      const townRow = await this.one('SELECT buildings_json FROM bao_an.town_states WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, c.id], client);
      const buildings = townRow ? parse(townRow.buildings_json || '[]') : [];
      const cheersRow = await this.one('SELECT count(*) as count FROM bao_an.town_cheers WHERE workspace_id=$1 AND to_student_id=$2', [auth.workspaceId, c.id], client);
      const animalsRow = await this.one('SELECT count(*) as count FROM bao_an.town_animals WHERE workspace_id=$1 AND student_id=$2', [auth.workspaceId, c.id], client);

      results.push({
        studentId: c.id,
        name: c.name, // Display name only, NEVER username
        buildingsCount: buildings.length,
        cheersCount: Number(cheersRow?.count || 0),
        animalsCount: Number(animalsRow?.count || 0),
        isSelf: c.id === studentId,
      });
    }
    return results;
  }

  async visitTown(auth, callerStudentId, targetStudentId, client = this.pool) {
    const caller = await this.one('SELECT * FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, callerStudentId], client);
    const target = await this.one('SELECT * FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, targetStudentId], client);
    if (!caller || !target) fail(404, 'Không tìm thấy học sinh.');

    if (caller.class_id !== target.class_id) {
      fail(403, 'Bạn chỉ có thể ghé thăm thị trấn của bạn cùng lớp!');
    }

    const town = await this.townState(auth, targetStudentId, client, { allowClassmate: true });
    const animalsData = await this.townAnimals(auth, targetStudentId, client, { allowClassmate: true });
    const cheersRow = await this.one('SELECT count(*) as count FROM bao_an.town_cheers WHERE workspace_id=$1 AND to_student_id=$2', [auth.workspaceId, targetStudentId], client);

    return {
      studentName: target.name, // Display name only
      town,
      animals: animalsData.animals,
      cheersCount: Number(cheersRow?.count || 0),
      isSelf: callerStudentId === targetStudentId,
    };
  }

  async cheerClassmate(auth, fromStudentId, targetStudentId, client = this.pool) {
    if (fromStudentId === targetStudentId) {
      fail(400, 'Không thể tự cổ vũ thị trấn của chính mình!');
    }

    const caller = await this.one('SELECT * FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, fromStudentId], client);
    const target = await this.one('SELECT * FROM bao_an.students WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, targetStudentId], client);
    if (!caller || !target) fail(404, 'Không tìm thấy học sinh.');

    if (caller.class_id !== target.class_id) {
      fail(403, 'Chỉ có thể cổ vũ bạn cùng lớp!');
    }

    const dayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const existing = await this.one('SELECT 1 FROM bao_an.town_cheers WHERE workspace_id=$1 AND from_student_id=$2 AND to_student_id=$3 AND day_key=$4', [auth.workspaceId, fromStudentId, targetStudentId, dayKey], client);

    if (!existing) {
      await this.exec('INSERT INTO bao_an.town_cheers(workspace_id, from_student_id, to_student_id, day_key, created_at) VALUES($1,$2,$3,$4,$5)', [
        auth.workspaceId, fromStudentId, targetStudentId, dayKey, now()
      ], client);
      const totalCheersRow = await this.one('SELECT count(*) as count FROM bao_an.town_cheers WHERE workspace_id=$1 AND to_student_id=$2', [auth.workspaceId, targetStudentId], client);
      const totalCheers = Number(totalCheersRow?.count || 1);
      await this.publishClassFeedEvent(auth, target.class_id, targetStudentId, target.name, 'cheer_received', {
        cheerCount: totalCheers,
      }, client);
    }

    const countRow = await this.one('SELECT count(*) as count FROM bao_an.town_cheers WHERE workspace_id=$1 AND to_student_id=$2', [auth.workspaceId, targetStudentId], client);
    return {
      ok: true,
      alreadyCheeredToday: !!existing,
      cheersCount: Number(countRow?.count || 0),
    };
  }

  async publishClassFeedEvent(auth, classId, studentId, studentName, eventType, details, client = this.pool) {
    try {
      const cls = await this.one('SELECT feed_enabled FROM bao_an.classes WHERE workspace_id=$1 AND id=$2', [auth.workspaceId, classId], client);
      if (!cls || cls.feed_enabled === false) return;

      const event = sanitizeClassFeedEvent({
        id: id(),
        classId,
        studentId,
        studentName,
        eventType,
        details,
        createdAt: now(),
      });

      if (!verifyPrivacyCompliance(event)) return;

      await this.exec('INSERT INTO bao_an.class_feed_events(workspace_id, class_id, id, student_id, student_name, event_type, details_json, created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)', [
        auth.workspaceId, classId, event.id, event.studentId, event.studentName, event.eventType, json(event.details), event.createdAt
      ], client);
    } catch {}
  }

  async classFeed(auth, classId, limit = 50, client = this.pool) {
    const cls = await this.class(auth, classId, client);
    const feedEnabled = cls.feed_enabled === undefined || cls.feed_enabled === null || cls.feed_enabled === true;
    if (!feedEnabled) {
      return { enabled: false, events: [] };
    }

    const rows = await this.rows('SELECT * FROM bao_an.class_feed_events WHERE workspace_id=$1 AND class_id=$2 ORDER BY created_at DESC LIMIT $3', [auth.workspaceId, classId, limit], client);
    const events = rows.map(r => sanitizeClassFeedEvent({
      id: r.id,
      classId: r.class_id,
      studentId: r.student_id,
      studentName: r.student_name,
      eventType: r.event_type,
      details: parse(r.details_json || '{}'),
      createdAt: r.created_at,
    })).filter(verifyPrivacyCompliance);

    return { enabled: true, events };
  }

  async purgeOldIntegrationEvents(maxAgeDays = 30, client = this.pool) {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000).toISOString();
    return this.exec('DELETE FROM bao_an.integration_events WHERE created_at < $1', [cutoff], client);
  }

  async recordIntegrationEvent(workspaceId, studentId, eventType, data, client = this.pool) {
    const eventId = id();
    const createdAt = now();
    await this.exec(`
      INSERT INTO bao_an.integration_events(id, workspace_id, student_id, event_type, data_json, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [eventId, workspaceId, studentId, eventType, json(data), createdAt], client);
    return { id: eventId, eventType, data, createdAt };
  }

  async listIntegrationEvents(workspaceId, { allowedStudentIds = null, afterCursor = 0, limit = 100 } = {}, client = this.pool) {
    await this.purgeOldIntegrationEvents(30, client);
    const maxLimit = Math.min(Math.max(1, limit), 200);
    let rows;
    if (Array.isArray(allowedStudentIds) && allowedStudentIds.length > 0) {
      rows = await this.rows(`
        SELECT id, student_id, event_type, data_json, created_at
        FROM bao_an.integration_events
        WHERE workspace_id = $1 AND student_id = ANY($2)
        ORDER BY created_at ASC, id ASC
        LIMIT $3
      `, [workspaceId, allowedStudentIds, maxLimit], client);
    } else {
      rows = await this.rows(`
        SELECT id, student_id, event_type, data_json, created_at
        FROM bao_an.integration_events
        WHERE workspace_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT $2
      `, [workspaceId, maxLimit], client);
    }
    const events = rows.map(r => ({
      id: r.id,
      studentId: r.student_id,
      type: r.event_type,
      data: parse(r.data_json),
      createdAt: r.created_at
    }));
    return { events, cursor: events.length > 0 ? events[events.length - 1].createdAt : afterCursor };
  }

  async getStudentTodayData(workspaceId, studentId, client = this.pool) {
    const student = await this.one(`
      SELECT s.id, s.user_id, s.name AS "displayName", s.class_id, c.name AS "className", c.grade
      FROM bao_an.students s
      JOIN bao_an.classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
      WHERE s.workspace_id = $1 AND s.id = $2 AND s.active = true
    `, [workspaceId, studentId], client);
    if (!student) return null;

    const auth = { workspaceId, studentId, id: student.user_id || studentId, role: 'student' };
    const { dateStr } = getVietnamTimeParts();

    // 1. Stars balance
    const rewards = await this.rewards(auth, studentId, client);
    const requests = await this.requests(auth, studentId, client);
    const balance = rewardBalance(earnedQuestionRewardStars(rewards), { requests });
    const stars = {
      available: balance.available,
      note: 'Chỉ đổi vật phẩm trên Kệ quà'
    };

    // 2. Streak
    const streakObj = await this.studentStreak(auth, studentId, undefined, client);
    const streakDays = streakObj?.currentStreak ?? streakObj?.days ?? 0;

    // 3. Parent Controls & Daily screen time limit
    const controls = await this.rawParentControls(workspaceId, studentId, client);
    const usedMinutes = await this.todayStudentStudyMinutes(auth, studentId, client);
    const allowedStartHour = controls?.allowedStartHour ?? 0;
    const allowedEndHour = controls?.allowedEndHour ?? 24;
    const maxMinutesPerDay = controls?.maxMinutesPerDay ?? 0;
    const baoAnLimit = {
      maxMinutesPerDay,
      usedMinutes,
      allowedStartHour,
      allowedEndHour
    };
    const curfew = checkCurfewHours(allowedStartHour, allowedEndHour);
    const isTimeLocked = !curfew.allowed || (maxMinutesPerDay > 0 && usedMinutes >= maxMinutesPerDay);

    // 4. Subjects progress
    const STANDARD_SUBJECTS = [
      { key: 'toan', label: 'Toán' },
      { key: 'tieng-viet', label: 'Tiếng Việt' },
      { key: 'tieng-anh', label: 'Tiếng Anh' },
      { key: 'tin-hoc', label: 'Tin học' }
    ];
    const progress = await this.summaryProgress(auth, student, client, rewards);
    let currentWeek = null;
    if (progress?.currentWeekSummary?.weekId) {
      currentWeek = progress.weeks.find(w => w.id === progress.currentWeekSummary.weekId);
    }
    if (!currentWeek && progress?.weeks?.length) {
      currentWeek = progress.weeks.find(w => !w.done) || progress.weeks[progress.weeks.length - 1];
    }

    const subjects = STANDARD_SUBJECTS.map(subj => {
      if (!currentWeek) {
        return {
          key: subj.key,
          label: subj.label,
          week: 0,
          packsPassed: 0,
          packsTotal: 0,
          state: 'none'
        };
      }
      const weekNum = currentWeek.position ?? 1;
      const matchingSets = (currentWeek.sets || []).filter(s => {
        const raw = s.subjectLabel || s.pack?.subjectLabel || s.pack?.subject;
        return normalizeIntegrationSubject(raw) === subj.key;
      });
      const packsTotal = matchingSets.length;
      const packsPassed = matchingSets.filter(s => (s.stars ?? 0) >= 2 || s.done).length;
      let state = 'todo';
      if (isTimeLocked) {
        state = 'locked';
      } else if (packsTotal === 0) {
        state = 'none';
      } else if (packsPassed >= packsTotal) {
        state = 'done';
      } else {
        state = 'todo';
      }
      return {
        key: subj.key,
        label: subj.label,
        week: weekNum,
        packsPassed,
        packsTotal,
        state
      };
    });

    // 5. Daily missions
    const missions = await this.studentDailyMissions(auth, studentId, undefined, client);
    const dailyMissions = missions.map(m => ({
      id: m.id,
      title: m.title,
      done: !!m.completed
    }));

    // 6. Contests
    const studentGrade = student.grade || 3;
    const presets = Object.values(CONTEST_PRESETS).filter(p => !p.grade || p.grade === studentGrade);
    const contests = await Promise.all(presets.map(async p => {
      const lastSession = await this.one(`
        SELECT score, max_score, submitted_at
        FROM bao_an.contest_sessions
        WHERE workspace_id = $1 AND student_id = $2 AND preset_id = $3 AND status IN ('submitted', 'timeout')
        ORDER BY created_at DESC LIMIT 1
      `, [workspaceId, studentId, p.id], client);
      return {
        presetId: p.id,
        title: p.title,
        subject: normalizeIntegrationSubject(p.subject),
        durationMinutes: Math.round(p.durationSeconds / 60),
        last: lastSession ? {
          score: lastSession.score,
          maxScore: lastSession.max_score,
          submittedAt: lastSession.submitted_at
        } : null
      };
    }));

    return {
      student: {
        id: student.id,
        displayName: student.displayName,
        className: student.className
      },
      date: dateStr,
      stars,
      streakDays,
      baoAnLimit,
      subjects,
      dailyMissions,
      contests
    };
  }

  async createIntegrationPairCode(workspaceId, allowedStudentIds, expiresInMinutes = 10, client = this.pool) {
    if (!Array.isArray(allowedStudentIds) || allowedStudentIds.length === 0) {
      fail(400, 'Cần chọn ít nhất một học sinh được phép kết nối.');
    }
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    const createdAt = now();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    await this.exec(`
      INSERT INTO bao_an.integration_pair_codes(code, workspace_id, allowed_student_ids, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [code, workspaceId, json(allowedStudentIds), createdAt, expiresAt], client);
    return { code, expiresAt, allowedStudentIds };
  }

  async findIntegrationPairCode(code, client = this.pool) {
    const row = await this.one('SELECT * FROM bao_an.integration_pair_codes WHERE code = $1', [code], client);
    if (!row) return null;
    return {
      ...row,
      allowed_student_ids: parse(row.allowed_student_ids)
    };
  }

  async consumeIntegrationPairCode(code, client = this.pool) {
    const row = await this.findIntegrationPairCode(code, client);
    if (!row) fail(404, 'Mã ghép đôi không tồn tại.');
    if (row.used_at) fail(400, 'Mã ghép đôi đã được sử dụng.');
    if (new Date(row.expires_at) <= new Date()) fail(400, 'Mã ghép đôi đã hết hạn (hiệu lực 10 phút).');
    const usedAt = now();
    await this.exec('UPDATE bao_an.integration_pair_codes SET used_at = $1 WHERE code = $2', [usedAt, code], client);
    return { ...row, used_at: usedAt };
  }

  async createIntegrationClient(workspaceId, { tokenHash, deviceId, deviceName, allowedStudentIds }, client = this.pool) {
    if (!tokenHash || !deviceId || !deviceName) fail(400, 'Thiếu thông tin thiết bị hoặc khóa kết nối.');
    const clientId = id();
    const createdAt = now();
    await this.exec(`
      INSERT INTO bao_an.integration_clients(id, workspace_id, token_hash, device_id, device_name, allowed_student_ids, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [clientId, workspaceId, tokenHash, deviceId, deviceName, json(allowedStudentIds || []), createdAt], client);
    return {
      id: clientId,
      workspace_id: workspaceId,
      token_hash: tokenHash,
      device_id: deviceId,
      device_name: deviceName,
      allowed_student_ids: allowedStudentIds || [],
      created_at: createdAt,
      last_used_at: null,
      revoked_at: null
    };
  }

  async findIntegrationClientByTokenHash(tokenHash, client = this.pool) {
    const row = await this.one('SELECT * FROM bao_an.integration_clients WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash], client);
    if (!row) return null;
    return {
      ...row,
      allowed_student_ids: parse(row.allowed_student_ids)
    };
  }

  async findIntegrationClientById(id, client = this.pool) {
    const row = await this.one('SELECT * FROM bao_an.integration_clients WHERE id = $1', [id], client);
    if (!row) return null;
    return {
      ...row,
      allowed_student_ids: parse(row.allowed_student_ids)
    };
  }

  async listIntegrationClients(workspaceId, client = this.pool) {
    const rows = await this.rows('SELECT * FROM bao_an.integration_clients WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId], client);
    return rows.map(r => ({
      ...r,
      allowed_student_ids: parse(r.allowed_student_ids)
    }));
  }

  async touchIntegrationClient(id, client = this.pool) {
    await this.exec('UPDATE bao_an.integration_clients SET last_used_at = $1 WHERE id = $2', [now(), id], client);
  }

  async revokeIntegrationClient(id, client = this.pool) {
    const revokedAt = now();
    await this.exec('UPDATE bao_an.integration_clients SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL', [revokedAt, id], client);
    await this.exec('UPDATE bao_an.integration_refresh_tokens SET revoked_at = $1 WHERE client_id = $2 AND revoked_at IS NULL', [revokedAt, id], client);
    return true;
  }

  async createIntegrationTicket(workspaceId, clientId, studentId, expiresInSeconds = 60, client = this.pool) {
    const ticket = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const createdAt = now();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    await this.exec(`
      INSERT INTO bao_an.integration_tickets(ticket, workspace_id, client_id, student_id, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [ticket, workspaceId, clientId, studentId, createdAt, expiresAt], client);
    return { ticket, expiresAt };
  }

  async consumeIntegrationTicket(ticket, client = this.pool) {
    const row = await this.one('SELECT * FROM bao_an.integration_tickets WHERE ticket = $1', [ticket], client);
    if (!row) fail(404, 'Vé SSO không tồn tại.');
    if (row.used_at) fail(400, 'Vé SSO đã được sử dụng.');
    if (new Date(row.expires_at) <= new Date()) fail(400, 'Vé SSO đã hết hạn (hiệu lực 60 giây).');
    const usedAt = now();
    await this.exec('UPDATE bao_an.integration_tickets SET used_at = $1 WHERE ticket = $2', [usedAt, ticket], client);
    return { ...row, used_at: usedAt };
  }

  async createIntegrationRefreshToken(workspaceId, clientId, studentId, expiresInDays = 30, client = this.pool) {
    const rawToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const createdAt = now();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
    await this.exec(`
      INSERT INTO bao_an.integration_refresh_tokens(token_hash, workspace_id, client_id, student_id, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [tokenHash, workspaceId, clientId, studentId, createdAt, expiresAt], client);
    return { rawToken, expiresAt };
  }

  async consumeIntegrationRefreshToken(rawToken, client = this.pool) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const row = await this.one('SELECT * FROM bao_an.integration_refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash], client);
    if (!row) fail(401, 'Mã làm mới không hợp lệ hoặc đã bị thu hồi.');
    if (new Date(row.expires_at) <= new Date()) fail(401, 'Mã làm mới đã hết hạn.');
    await this.exec('UPDATE bao_an.integration_refresh_tokens SET revoked_at = $1 WHERE token_hash = $2', [now(), tokenHash], client);
    return row;
  }

  async assertParentElevation(auth, studentId = null, parentToken = null, client = this.pool) {
    if (auth.role === 'admin') return true;
    if (auth.role === 'parent') {
      if (studentId) {
        const linked = await this.one('SELECT 1 FROM bao_an.parent_students WHERE workspace_id=$1 AND parent_user_id=$2 AND student_id=$3', [auth.workspaceId, auth.id, studentId], client);
        if (!linked) fail(403, 'Phụ huynh không có quyền quản lý học sinh này.');
      }
      return true;
    }
    if (auth.role === 'student') {
      const sId = studentId || auth.studentId;
      if (auth.studentId !== sId) fail(403, 'Không có quyền truy cập học sinh khác.');
      const currentRaw = await this.rawParentControls(auth.workspaceId, sId, client);
      if (currentRaw?.pinHash) {
        const tokenOk = parentToken && verifyParentElevationToken(parentToken, {
          userId: auth.id,
          studentId: sId,
          workspaceId: auth.workspaceId,
          pinHash: currentRaw.pinHash,
          sessionHash: auth.tokenHash
        });
        if (!tokenOk) fail(403, 'Chưa xác thực quyền phụ huynh.');
      }
      return true;
    }
    fail(403, 'Không có quyền thực hiện thao tác này.');
  }

  async isIntegrationEnabled(workspaceId, client = this.pool) {
    const hasPairCode = await this.one('SELECT 1 FROM bao_an.integration_pair_codes WHERE workspace_id = $1 LIMIT 1', [workspaceId], client);
    const hasClient = await this.one('SELECT 1 FROM bao_an.integration_clients WHERE workspace_id = $1 LIMIT 1', [workspaceId], client);
    if (!hasPairCode && !hasClient) return false;
    const toggleAudit = await this.one("SELECT target_id FROM bao_an.audit WHERE workspace_id = $1 AND action = 'integration.toggle' ORDER BY at DESC, id DESC LIMIT 1", [workspaceId], client);
    if (toggleAudit) {
      try {
        const parsed = parse(toggleAudit.target_id);
        if (typeof parsed?.enabled === 'boolean') return parsed.enabled;
      } catch {}
    }
    return true;
  }

  async parentSafetimeStatus(auth, studentId = null, parentToken = null, client = this.pool) {
    await this.assertParentElevation(auth, studentId, parentToken, client);
    const clients = await this.listIntegrationClients(auth.workspaceId, client);
    const activeClients = clients.filter(c => !c.revoked_at);
    const activePairCodeRow = await this.one(`
      SELECT * FROM bao_an.integration_pair_codes
      WHERE workspace_id = $1 AND used_at IS NULL AND expires_at > $2
      ORDER BY created_at DESC LIMIT 1
    `, [auth.workspaceId, now()], client);
    const activePairCode = activePairCodeRow ? {
      code: activePairCodeRow.code,
      expiresAt: activePairCodeRow.expires_at,
      allowedStudentIds: parse(activePairCodeRow.allowed_student_ids)
    } : null;

    let availableStudents = [];
    if (auth.role === 'admin') {
      availableStudents = await this.rows(`
        SELECT s.id, s.name, COALESCE(c.name, '') AS "className"
        FROM bao_an.students s
        LEFT JOIN bao_an.classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
        WHERE s.workspace_id = $1 AND s.active = true
        ORDER BY s.name ASC
      `, [auth.workspaceId], client);
    } else if (auth.role === 'parent') {
      availableStudents = await this.rows(`
        SELECT s.id, s.name, COALESCE(c.name, '') AS "className"
        FROM bao_an.students s
        JOIN bao_an.parent_students ps ON ps.workspace_id = s.workspace_id AND ps.student_id = s.id
        LEFT JOIN bao_an.classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
        WHERE s.workspace_id = $1 AND ps.parent_user_id = $2 AND s.active = true
        ORDER BY s.name ASC
      `, [auth.workspaceId, auth.id], client);
    } else if (auth.role === 'student') {
      availableStudents = await this.rows(`
        SELECT s.id, s.name, COALESCE(c.name, '') AS "className"
        FROM bao_an.students s
        LEFT JOIN bao_an.classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
        WHERE s.workspace_id = $1 AND s.id = $2
      `, [auth.workspaceId, auth.studentId], client);
    }

    return {
      enabled: await this.isIntegrationEnabled(auth.workspaceId, client),
      paired: activeClients.length > 0,
      clients: clients.map(c => ({
        id: c.id,
        deviceName: c.device_name,
        deviceId: c.device_id,
        allowedStudentIds: c.allowed_student_ids,
        createdAt: c.created_at,
        lastUsedAt: c.last_used_at,
        revokedAt: c.revoked_at
      })),
      activePairCode,
      availableStudents
    };
  }

  async parentCreatePairCode(auth, studentIds, parentToken = null, client = this.pool) {
    await this.assertParentElevation(auth, null, parentToken, client);
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      fail(400, 'Cần chọn ít nhất một học sinh được phép kết nối.');
    }
    const result = await this.createIntegrationPairCode(auth.workspaceId, studentIds, 10, client);
    await this.audit(auth, 'integration.pair_code_create', json({
      code: result.code,
      allowedStudentIds: studentIds,
      expiresAt: result.expiresAt
    }), client);
    return result;
  }

  async parentRevokeClient(auth, clientId, parentToken = null, client = this.pool) {
    await this.assertParentElevation(auth, null, parentToken, client);
    const clientRecord = await this.findIntegrationClientById(clientId, client);
    if (!clientRecord || clientRecord.workspace_id !== auth.workspaceId) {
      fail(404, 'Không tìm thấy thiết bị kết nối.');
    }
    await this.revokeIntegrationClient(clientId, client);
    await this.audit(auth, 'integration.client_revoke', json({
      clientId: clientRecord.id,
      deviceId: clientRecord.device_id,
      deviceName: clientRecord.device_name,
      source: 'parent'
    }), client);
    return { success: true, clientId };
  }

  async parentToggleIntegration(auth, enabled, parentToken = null, client = this.pool) {
    await this.assertParentElevation(auth, null, parentToken, client);
    const isEnabled = Boolean(enabled);
    await this.audit(auth, 'integration.toggle', json({ enabled: isEnabled }), client);
    return { success: true, enabled: isEnabled };
  }
}
