import pg from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {OnlineError,fail,shape,text,integer} from './online-errors.mjs';
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

const now=()=>new Date().toISOString(),id=()=>randomUUID(),json=JSON.stringify;
const parse=value=>typeof value==='string'?JSON.parse(value):value;
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
  }
  async ready(){const row=await this.one('SELECT max(version) AS version FROM bao_an.schema_version');if(row?.version!==1)fail(500,'Cần chạy migration dữ liệu online phiên bản 1.');return this;}
  async close(){if(this.ownsPool)await this.pool.end();}
  async rows(sql,values=[],client=this.pool){return(await client.query(sql,values)).rows;}
  async one(sql,values=[],client=this.pool){return(await this.rows(sql,values,client))[0];}
  async exec(sql,values=[],client=this.pool){return client.query(sql,values);}
  async transaction(action){
    for(let attempt=0;;attempt++){
      const client=await this.pool.connect();
      try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='15000ms'");await client.query("SET LOCAL lock_timeout='10000ms'");const result=await action(client);await client.query('COMMIT');return result;}
      catch(error){await client.query('ROLLBACK').catch(()=>{});if(attempt<2&&['40001','40P01'].includes(error?.code))continue;throw databaseError(error);}
      finally{client.release();}
    }
  }
  async activeActor(auth,client){
    const user=await this.one('SELECT * FROM bao_an.users WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[auth.workspaceId,auth.id],client);
    if(!user?.active||user.role!==auth.role||(user.student_id??undefined)!==(auth.studentId??undefined))fail(401,'Tài khoản hoặc quyền truy cập đã thay đổi. Hãy đăng nhập lại.');
    // HTTP actors carry their session; trusted in-process callers may omit it.
    // mutate holds the same workspace lock as logout/reset until commit.
    if(auth.tokenHash!==undefined&&!await this.one('SELECT token_hash FROM bao_an.auth_sessions WHERE token_hash=$1 AND user_id=$2 AND csrf_token=$3 AND expires_at>$4',[auth.tokenHash,auth.id,auth.csrfToken,Date.now()],client))fail(401,'Phiên đăng nhập đã hết hạn hoặc đã được thu hồi. Hãy đăng nhập lại.');
    if(user.role==='student'){const student=await this.one('SELECT active FROM bao_an.students WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,user.student_id],client);if(!student?.active)fail(401,'Tài khoản học sinh đã được khóa.');}
  }
  async mutate(auth,action){return this.transaction(async client=>{await this.workspace(auth.workspaceId,client,true);await this.activeActor(auth,client);return action(client);});}
  async audit(auth,action,target,client){await this.exec('INSERT INTO bao_an.audit(id,workspace_id,user_id,action,target_id,at) VALUES($1,$2,$3,$4,$5,$6)',[id(),auth.workspaceId,auth.id,action,target,now()],client);}
  async configured(client=this.pool){return!!await this.one("SELECT id FROM bao_an.users WHERE role='admin' LIMIT 1",[],client);}
  async workspace(workspaceId,client=this.pool,lock=false){return await this.one(`SELECT * FROM bao_an.workspaces WHERE id=$1${lock?' FOR UPDATE':''}`,[workspaceId],client)??fail(404,'Không tìm thấy đơn vị.');}
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
  async createSession({tokenHash,userId,csrfToken,expiresAt,passwordHash}){
    text(tokenHash,'Mã phiên',64);text(csrfToken,'Mã biểu mẫu',200);integer(expiresAt,'Hạn phiên',1,Number.MAX_SAFE_INTEGER);
    const snapshot=await this.findUserById(userId);if(!snapshot)fail(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
    return this.transaction(async client=>{
      await this.workspace(snapshot.workspace_id,client,true);const user=await this.one('SELECT * FROM bao_an.users WHERE id=$1 FOR UPDATE',[userId],client);
      if(!user?.active||typeof passwordHash!=='string'||user.password_hash!==passwordHash)fail(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
      await this.exec('DELETE FROM bao_an.auth_sessions WHERE expires_at<$1',[Date.now()],client);
      await this.exec('INSERT INTO bao_an.auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)',[tokenHash,userId,csrfToken,expiresAt],client);return user;
    });
  }
  async revokeSession(tokenHash){
    const session=await this.one('SELECT u.workspace_id FROM bao_an.auth_sessions s JOIN bao_an.users u ON u.id=s.user_id WHERE s.token_hash=$1',[tokenHash]);
    if(!session)return;
    await this.transaction(async client=>{await this.workspace(session.workspace_id,client,true);await this.exec('DELETE FROM bao_an.auth_sessions WHERE token_hash=$1',[tokenHash],client);});
  }
  async consumeLoginLimit({addressHash,userHash,now:time=Date.now(),purpose='login'}){
    const entries=[{key:addressHash,max:100},{key:userHash,max:12}].sort((a,b)=>a.key.localeCompare(b.key));
    for(const entry of entries)text(entry.key,'Mã giới hạn đăng nhập',100);
    await this.transaction(async client=>{for(const entry of entries){
      await this.exec('INSERT INTO bao_an.login_limits(key,count,reset_at) VALUES($1,0,$2) ON CONFLICT(key) DO NOTHING',[entry.key,time+900000],client);
      const row=await this.one('SELECT count,reset_at FROM bao_an.login_limits WHERE key=$1 FOR UPDATE',[entry.key],client),count=Number(row.reset_at)>time?row.count:0;
      if(count>=entry.max)fail(429,purpose==='password'?'Đã thử đổi mật khẩu quá nhiều lần. Hãy đợi 15 phút rồi thử lại.':'Đã thử đăng nhập quá nhiều lần. Hãy đợi 15 phút rồi thử lại.');
      await this.exec('UPDATE bao_an.login_limits SET count=$2,reset_at=$3 WHERE key=$1',[entry.key,count+1,Number(row.reset_at)>time?Number(row.reset_at):time+900000],client);
    }});
  }
  async clearLoginUserLimit(userHash){await this.exec('DELETE FROM bao_an.login_limits WHERE key=$1',[userHash]);}
  async class(auth,classId,client=this.pool){return await this.one('SELECT * FROM bao_an.classes WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,classId],client)??fail(404,'Không tìm thấy lớp học.');}
  async student(auth,studentId,client=this.pool){
    if(auth.role==='student'&&auth.studentId!==studentId)fail(404,'Không tìm thấy học sinh.');
    return await this.one('SELECT s.*,u.username FROM bao_an.students s JOIN bao_an.users u ON u.id=s.user_id AND u.workspace_id=s.workspace_id WHERE s.workspace_id=$1 AND s.id=$2',[auth.workspaceId,studentId],client)??fail(404,'Không tìm thấy học sinh.');
  }
  publicClass(row){return{id:row.id,name:row.name,grade:row.grade,createdAt:row.created_at};}
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
  async hasMediaAccess(auth,mediaId,client=this.pool){
    const row=await this.one('SELECT id FROM bao_an.media WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,mediaId],client);if(!row)return false;
    if(auth.role==='admin')return true;const student=await this.student(auth,auth.studentId,client),ref="(EXISTS(SELECT 1 FROM jsonb_array_elements(p.json->'items') item WHERE item#>>'{media,imageId}'=$3 OR item#>>'{media,audioId}'=$3 OR item->>'audioId'=$3) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.json->'media') asset WHERE asset->>'mediaId'=$3))";
    if(await this.one(`SELECT 1 FROM bao_an.weeks w JOIN bao_an.week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE w.workspace_id=$1 AND w.class_id=$2 AND ${ref} LIMIT 1`,[auth.workspaceId,student.class_id,mediaId],client))return true;
    return!!await this.one(`SELECT 1 FROM bao_an.plays s JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.json->>'packId' AND p.version=(s.json->>'contentVersion')::integer WHERE s.workspace_id=$1 AND s.student_id=$2 AND s.json->>'profileId'=$2 AND s.json->>'status' IN ('active','completed') AND ${ref} LIMIT 1`,[auth.workspaceId,student.id,mediaId],client);
  }
  async getMedia(auth,mediaId){if(!await this.hasMediaAccess(auth,mediaId))fail(404,'Không tìm thấy tệp hình/âm thanh.');return this.one('SELECT * FROM bao_an.media WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,mediaId]);}
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
        if(!set.pack||typeof set.pack!=='object'||!['quiz','pairs','sentences','learning'].includes(set.pack.kind))fail(400,`Bộ ${index+1}: dạng câu chưa có trò chơi phù hợp.`);
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
    const markers=(await this.rows("SELECT target_id FROM bao_an.audit WHERE workspace_id=$1 AND user_id=$2 AND action IN ('student.journey.init','student.journey.advance')",[auth.workspaceId,student.user_id],client)).flatMap(row=>{try{const marker=parse(row.target_id);return marker?.studentId===student.id&&marker.classId===student.class_id?[marker]:[];}catch{return[];}});
    return markers.sort((a,b)=>b.position-a.position)[0]??null;
  }
  async progress(auth,student,client=this.pool,awards){return journeyProgress(await this.weeks(auth,student.class_id,client),awards??await this.rewards(auth,student.id,client),await this.journeyMarker(auth,student,client));}
  async studentState(auth,client=this.pool){role(auth,'student');const student=await this.student(auth,auth.studentId,client),cls=await this.class(auth,student.class_id,client),workspace=await this.workspace(auth.workspaceId,client),rewards=await this.rewards(auth,student.id,client),requests=await this.requests(auth,student.id,client),progress=await this.progress(auth,student,client,rewards),balance=rewardBalance(earnedQuestionRewardStars(rewards),{requests});
    return{student:this.studentRecord(student,progress.current,balance),profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,rewards,balance,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests};
  }
  async summaryProgress(auth,student,client=this.pool,awards){
    const rows=await this.rows(`SELECT w.id AS week_id,w.class_id,w.title AS week_title,w.position AS week_position,w.created_at,p.subject_label,
      CASE WHEN p.pack_id IS NOT NULL THEN jsonb_build_object('id',p.pack_id,'version',p.version,'title',p.json->>'title','kind',p.json->>'kind','subject',p.json->>'subject','grade',(p.json->>'grade')::int,'itemCount',jsonb_array_length(p.json->'items'),'questionIds',(SELECT jsonb_agg(item->>'id') FROM jsonb_array_elements(p.json->'items') item)) END AS summary
      FROM bao_an.weeks w LEFT JOIN bao_an.week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id LEFT JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE w.workspace_id=$1 AND w.class_id=$2 ORDER BY w.position,s.position`,[auth.workspaceId,student.class_id],client);
    return journeyProgress(summaryWeeks(rows),awards??await this.rewards(auth,student.id,client),await this.journeyMarker(auth,student,client));
  }
  async studentSummary(auth,cursor='0',client=this.pool){role(auth,'student');
    const student=await this.student(auth,auth.studentId,client),cls=await this.class(auth,student.class_id,client),workspace=await this.workspace(auth.workspaceId,client),rewards=await this.rewards(auth,student.id,client),requests=await this.requests(auth,student.id,client),progress=summaryPage(await this.summaryProgress(auth,student,client,rewards),cursor),balance=rewardBalance(earnedQuestionRewardStars(rewards),{requests});
    const keys=progress.current?[progress.current.pack]:[];
    const values=[auth.workspaceId,...keys.flatMap(p=>[p.id,p.version])],games=new Map(keys.length?(await this.rows(`SELECT * FROM bao_an.packs WHERE workspace_id=$1 AND (${keys.map((_,i)=>`(pack_id=$${2+i*2} AND version=$${3+i*2})`).join(' OR ')})`,values,client)).map(row=>[`${row.pack_id}@${row.version}`,this.packRecord(row).games]):[]);
    const decorate=set=>({...set,games:games.get(`${set.pack.id}@${set.pack.version}`)??[]});progress.weeks=progress.weeks.map(w=>({...w,sets:w.sets.map(decorate)}));if(progress.current)progress.current=decorate(progress.current);
    return{student:this.studentRecord(student,progress.current,balance),profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,balance,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests};
  }
  async pinJourney(auth,student,client){
    let marker=await this.journeyMarker(auth,student,client);if(marker)return marker;
    const progress=await this.summaryProgress(auth,student,client);if(!progress.journey)return null;
    marker={studentId:student.id,classId:student.class_id,...progress.journey};await this.audit(auth,'student.journey.init',json(marker),client);return marker;
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
  async assignedPack(auth,packId,version,client=this.pool){
    const student=await this.student(auth,auth.studentId,client),progress=await this.summaryProgress(auth,student,client),assigned=progress.weeks.filter(week=>week.unlocked).flatMap(week=>week.sets).find(set=>set.pack.id===packId&&set.pack.version===version);
    if(!assigned)fail(403,'Con chỉ được học bộ câu hỏi thuộc tuần hiện tại. Tuần đã đóng và tuần chưa mở không thể chơi.');return this.packRecord(await this.one('SELECT * FROM bao_an.packs WHERE workspace_id=$1 AND pack_id=$2 AND version=$3',[auth.workspaceId,packId,version],client));
  }
  async packGames(auth,packId,version){role(auth,'student');return{packId,contentVersion:version,games:(await this.assignedPack(auth,packId,version)).games};}
  async dashboard(auth){role(auth,'admin');const classes=(await this.rows('SELECT * FROM bao_an.classes WHERE workspace_id=$1 ORDER BY created_at,id',[auth.workspaceId])).map(row=>this.publicClass(row)),students=[],weeks=[];
    for(const row of await this.rows('SELECT s.*,u.username FROM bao_an.students s JOIN bao_an.users u ON u.id=s.user_id AND u.workspace_id=s.workspace_id WHERE s.workspace_id=$1 ORDER BY s.created_at,s.id',[auth.workspaceId]))students.push(await this.publicStudent(auth,row));
    for(const cls of classes)weeks.push(...await this.weeks(auth,cls.id));
    const redemptions=(await this.rows('SELECT r.json,s.id AS student_id,s.name,s.class_id FROM bao_an.redemptions r JOIN bao_an.students s ON s.workspace_id=r.workspace_id AND s.id=r.student_id WHERE r.workspace_id=$1 ORDER BY r.created_order DESC',[auth.workspaceId])).map(row=>({...parse(row.json),studentId:row.student_id,studentName:row.name,classId:row.class_id})),workspace=await this.workspace(auth.workspaceId);
    return{classes,students,weeks,redemptions,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},stats:{students:students.length,classes:classes.length,questions:(await this.rows('SELECT json FROM bao_an.packs WHERE workspace_id=$1',[auth.workspaceId])).reduce((sum,row)=>sum+parse(row.json).items.length,0),pendingRequests:redemptions.filter(row=>['pending','approved'].includes(rewardStatus(row))).length}};
  }
  async play(auth,playId,client=this.pool){const row=await this.one('SELECT * FROM bao_an.plays WHERE workspace_id=$1 AND id=$2 AND student_id=$3',[auth.workspaceId,playId,auth.studentId],client);if(!row)fail(404,'Không tìm thấy lượt chơi.');const session=parse(row.json);
    const packed=await this.one('SELECT * FROM bao_an.packs WHERE workspace_id=$1 AND pack_id=$2 AND version=$3',[auth.workspaceId,session.packId,session.contentVersion],client);if(!packed)fail(409,'Bộ câu hỏi của lượt chơi không còn sẵn sàng.');return{session,pack:parse(packed.json)};
  }
  async abandonActive(auth,studentId,client){
    if(!client)return this.mutate(auth,async owned=>{await this.student(auth,studentId,owned);await this.abandonActive(auth,studentId,owned);await this.audit(auth,'play.abandon-active',studentId,owned);});
    for(const row of await this.rows('SELECT id,json FROM bao_an.plays WHERE workspace_id=$1 AND student_id=$2',[auth.workspaceId,studentId],client)){
    const session=parse(row.json);if(session.status==='active'){session.status='abandoned';session.endedAt=now();await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,row.id,json(session)],client);}
  }}
  async startPlay(auth,input,compact=false,secure=false){role(auth,'student');shape(input,compact?['requestId','moduleId','packId','contentVersion','reviewItemIds']:['requestId','moduleId','packId','contentVersion']);const requestId=text(input.requestId,'Mã lượt chơi',100),moduleId=text(input.moduleId,'Trò chơi',80),packId=text(input.packId,'Mã bộ',80),version=integer(input.contentVersion,'Phiên bản');
    return this.mutate(auth,async client=>{
      const student=await this.student(auth,auth.studentId,client),marker=await this.pinJourney(auth,student,client);
      const prior=await this.one('SELECT id FROM bao_an.plays WHERE workspace_id=$1 AND student_id=$2 AND request_id=$3',[auth.workspaceId,auth.studentId,requestId],client);
      const choice=await this.assignedPack(auth,packId,version,client);if(!choice.games.some(game=>game.id===moduleId))fail(400,'Dạng câu của bộ này chưa phù hợp với trò chơi đã chọn.');
      const presentation=onlinePresentation(moduleId,choice.pack),requiredItemIds=compact?selectReviewItems(input.reviewItemIds,choice.pack,presentation):undefined;
      if(prior){const value=await this.play(auth,prior.id,client);if(secure&&value.session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(value.session.packId!==packId||value.session.contentVersion!==version||value.session.moduleId!==moduleId||value.session.journeyWeekId&&value.session.journeyWeekId!==marker?.weekId||compact&&(value.session.rewardPolicyVersion!==2||json(value.session.requiredItemIds)!==json(requiredItemIds)))fail(409,'Mã lượt chơi đã dùng cho nội dung khác.');if(value.session.status==='abandoned')fail(409,'Lượt chơi đã thoát. Hãy mở lượt mới.');const result={...value,presentation:filterPlayPresentation(value.session,value.pack,onlinePresentation(moduleId,value.pack))};return compact||secure?compactPlay(result):result;}
      await this.abandonActive(auth,student.id,client);
      const session={sessionId:id(),profileId:student.id,packId,contentVersion:version,moduleId,moduleVersion:getGame(moduleId).version,startedAt:now(),status:'active',rewardPolicyVersion:compact?2:1,presentationVersion:1,journeyWeekId:marker?.weekId,...(compact?{requiredItemIds,questionClocks:{}}:{}),...(secure?{questionProtocolVersion:1,questionClocks:{},questionHints:{},audioReceipts:{}}:{})};
      await this.exec('INSERT INTO bao_an.plays(id,workspace_id,student_id,request_id,json) VALUES($1,$2,$3,$4,$5::jsonb)',[session.sessionId,auth.workspaceId,student.id,requestId,json(session)],client);const result={session,pack:choice.pack,presentation:filterPlayPresentation(session,choice.pack,presentation)};return compact||secure?compactPlay(result):result;
    });
  }
  async assertCurrentPlay(auth,session,client){
    const student=await this.student(auth,auth.studentId,client),marker=await this.journeyMarker(auth,student,client);
    if(marker){if(session.journeyWeekId&&session.journeyWeekId!==marker.weekId)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');const assigned=await this.one('SELECT s.version FROM bao_an.week_sets s JOIN bao_an.weeks w ON w.workspace_id=s.workspace_id AND w.id=s.week_id WHERE s.workspace_id=$1 AND s.week_id=$2 AND w.class_id=$3 AND s.pack_id=$4',[auth.workspaceId,marker.weekId,student.class_id,session.packId],client);if(!assigned)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');if(session.rewardPolicyVersion===2&&assigned.version!==session.contentVersion)fail(409,'Bộ câu hỏi vừa được cập nhật. Thoát rồi mở lại bài; sao đã lưu vẫn được giữ nguyên.');return;}
    const progress=await this.summaryProgress(auth,student,client);if(session.journeyWeekId&&session.journeyWeekId!==progress.journey?.weekId)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');const assigned=progress.weeks.find(week=>week.current)?.sets.find(set=>set.pack.id===session.packId);if(!assigned)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');if(session.rewardPolicyVersion===2&&assigned.pack.version!==session.contentVersion)fail(409,'Bộ câu hỏi vừa được cập nhật. Thoát rồi mở lại bài; sao đã lưu vẫn được giữ nguyên.');
  }
  async questionHint(auth,playId,input){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');shape(input,['itemId']);const itemId=text(input.itemId,'Mã câu',80);return this.mutate(auth,async client=>{const{session,pack}=await this.play(auth,playId,client);await this.assertCurrentPlay(auth,session,client);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');const result=protocolHint(session,pack,await this.#playEvents(auth,playId,client),itemId);await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);return result;});}
  async recordAudioDelivery(auth,playId,itemId,mediaId,durationMs){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');text(playId,'Mã lượt',100);text(itemId,'Mã câu',80);return this.mutate(auth,async client=>{const{session,pack}=await this.play(auth,playId,client);await this.assertCurrentPlay(auth,session,client);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');protocolAudioDelivery(session,pack,await this.#playEvents(auth,playId,client),itemId,mediaId,durationMs);await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);});}
  async openQuestion(auth,playId,input,requireProtocol=false){role(auth,'student');shape(input,['itemId']);const itemId=text(input.itemId,'Mã câu',80);
    return this.mutate(auth,async client=>{
      const{session,pack}=await this.play(auth,playId,client);await this.assertCurrentPlay(auth,session,client);
      if(session.status!=='active'||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã kết thúc hoặc quá hạn.');
      if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');
      if(session.questionProtocolVersion===1){const receipt=openProtocolQuestion(session,pack,await this.#playEvents(auth,playId,client),itemId);await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);return receipt;}
      const presentation=onlinePresentation(session.moduleId,pack),item=presentation?.items.find(item=>item.id===itemId);
      if(!timedQuestion(session,presentation)||!item||!session.requiredItemIds?.includes(itemId))fail(400,'Câu hỏi không dùng bộ đếm thời gian của lượt chơi này.');
      const clock=session.questionClocks??{},openedAt=Object.hasOwn(clock,itemId)?clock[itemId]:now();if(!Object.hasOwn(clock,itemId)){
        Object.defineProperty(clock,itemId,{value:openedAt,enumerable:true,writable:true,configurable:true});session.questionClocks=clock;await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(session)],client);
      }
      return{openedAt,serverNow:now(),...questionRewardThresholds(item)};
    });
  }
  async #playEvents(auth,playId,client){return(await this.rows('SELECT json FROM bao_an.attempts WHERE workspace_id=$1 AND play_id=$2 ORDER BY sequence',[auth.workspaceId,playId],client)).map(row=>parse(row.json));}
  async events(auth,playId,client=this.pool){if(auth.role==='student')await this.play(auth,playId,client);return this.#playEvents(auth,playId,client);}
  async attempt(auth,playId,input,requireProtocol=false){role(auth,'student');shape(input,['attemptKey','itemId','response','hintsUsed','elapsedMs']);const key=text(input.attemptKey,'Mã lần trả lời',120);if(!/^[a-zA-Z0-9._:-]+$/.test(key))fail(400,'Mã lần trả lời không hợp lệ.');const itemId=text(input.itemId,'Mã câu',80),hintsUsed=integer(input.hintsUsed??0,'Số gợi ý',0,20);
    const hash=digest({key,itemId,response:input.response,hintsUsed});
    return this.mutate(auth,async client=>{
      const{session,pack}=await this.play(auth,playId,client);await this.assertCurrentPlay(auth,session,client);if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');const prior=await this.one('SELECT payload_hash,json FROM bao_an.attempts WHERE workspace_id=$1 AND play_id=$2 AND attempt_key=$3',[auth.workspaceId,playId,key],client);
      if(prior){if(prior.payload_hash!==hash)fail(409,'Lần trả lời đã được lưu với đáp án khác.');if(session.status==='abandoned')fail(409,'Lượt chơi đã thoát.');const event=parse(prior.json);let questionRewards;if(session.rewardPolicyVersion===2){questionRewards={gained:0,questions:[]};if(event.correct){const previous=await this.one('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3',[auth.workspaceId,auth.studentId,pack.id],client),reward=previous?parse(previous.json):null,touched=onlineScoreResponse(pack,session.moduleId,event.itemId,event.response).touchedItemIds;questionRewards.questions=questionRewardProgress(pack,reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0)).questions.filter(q=>touched.includes(q.itemId));}}return{event,duplicate:true,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};}
      if(session.status!=='active')fail(409,'Lượt chơi đã kết thúc hoặc được thay bằng lượt mới ở thiết bị khác.');if(Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã quá hạn. Hãy mở lượt mới.');
      const events=await this.#playEvents(auth,playId,client);if(events.length>=5000)fail(400,'Lượt chơi đã đạt giới hạn số lần thử.');const item=pack.items.find(row=>row.id===itemId);if(!item)fail(400,'Câu hỏi không thuộc lượt chơi.');let outcome;try{outcome=onlineScoreResponse(pack,session.moduleId,itemId,input.response);}catch(error){fail(400,error.message);}
      if(session.rewardPolicyVersion===2&&outcome.touchedItemIds.some(id=>!session.requiredItemIds?.includes(id)))fail(400,'Câu trả lời nằm ngoài các câu đã chọn cho lượt học lại.');
      const occurredAt=now();let elapsedMs=input.elapsedMs;if(timedQuestion(session,onlinePresentation(session.moduleId,pack))){const openedAt=session.questionClocks&&Object.hasOwn(session.questionClocks,itemId)&&session.questionClocks[itemId];if(!openedAt)fail(400,'Cần mở câu hỏi trước khi trả lời.');elapsedMs=Date.parse(occurredAt)-Date.parse(openedAt);}
      else if(session.rewardPolicyVersion===2)elapsedMs=0;
      if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>14400000)fail(400,'Thời gian trả lời không hợp lệ.');
      const event={eventId:`${session.sessionId}:${key}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:pack.version,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId,objectiveId:item.objectiveId,correct:outcome.correct,hintsUsed:session.questionProtocolVersion===1?(Object.hasOwn(session.questionHints??{},itemId)?session.questionHints[itemId].used:0):hintsUsed,elapsedMs,occurredAt,response:input.response,gameSequence:events.length+1};
      const errors=onlineEvidenceErrors(session,[...events,event],pack);if(errors.length)fail(400,errors[0]);await this.exec('INSERT INTO bao_an.attempts(workspace_id,play_id,attempt_key,payload_hash,json,sequence) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[auth.workspaceId,playId,key,hash,json(event),event.gameSequence],client);
      let questionRewards;if(session.rewardPolicyVersion===2){questionRewards={gained:0,questions:[]};if(outcome.correct){const previous=await this.one('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3',[auth.workspaceId,auth.studentId,pack.id],client),reward=previous?parse(previous.json):null;
        const result=applyQuestionRewardCandidates(reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0),questionRewardCandidates(session,[...events,event],pack)),progress=questionRewardProgress(pack,result.ledger),tier=Math.max(1,progress.bestTier);
        if(!reward||json(reward.questionLedger)!==json(result.ledger)){const award={...(reward??{profileId:auth.studentId,packId:pack.id,sessionId:session.sessionId,completedAt:event.occurredAt,totalItems:pack.items.length,firstTryCorrect:0}),starTier:tier,questionLedger:result.ledger};await this.exec('INSERT INTO bao_an.awards(workspace_id,student_id,pack_id,tier,json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json',[auth.workspaceId,auth.studentId,pack.id,tier,json(award)],client);}
        questionRewards={gained:result.gained,questions:progress.questions.filter(q=>outcome.touchedItemIds.includes(q.itemId))};}
      }return{event,duplicate:false,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};
    });
  }
  async finishPlay(auth,playId,abandon=false,compact=false,requireProtocol=false){role(auth,'student');return this.mutate(auth,async client=>{
    const{session,pack}=await this.play(auth,playId,client);if(!abandon)await this.assertCurrentPlay(auth,session,client);if(!abandon&&requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(session.status==='abandoned'){if(abandon)return{};fail(409,'Lượt chơi đã thoát.');}
    if(session.status==='completed')return{state:compact?await this.studentSummary(auth,'current',client):await this.studentState(auth,client),gained:0,tier:(await this.rewards(auth,auth.studentId,client)).find(row=>row.packId===pack.id)?.starTier??0};
    const completed={...session,status:abandon?'abandoned':'completed',endedAt:now()},events=await this.#playEvents(auth,playId,client);let gained=0,tier=0;
    if(!abandon){const errors=session.rewardPolicyVersion===2?v2QuestionCompletionErrors(completed,events,pack):onlineEvidenceErrors(completed,events,pack,true);if(errors.length)fail(400,errors[0]);const previous=await this.one('SELECT json FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3',[auth.workspaceId,auth.studentId,pack.id],client),prior=previous?parse(previous.json):null;
      if(session.rewardPolicyVersion===2){tier=questionRewardProgress(pack,prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0)).bestTier;}
      else{const award=onlineAward(completed,events,pack);if(!award)fail(400,'Chưa đủ dữ liệu để xác nhận sao.');const legacyStars=Math.max(award.starTier,prior?.questionLedger?.legacyStars??prior?.starTier??0),result=applyQuestionRewardCandidates(prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0),[],legacyStars);gained=result.gained;tier=legacyStars;
        const value={...award,starTier:Math.max(1,questionRewardProgress(pack,result.ledger).bestTier),questionLedger:result.ledger};await this.exec('INSERT INTO bao_an.awards(workspace_id,student_id,pack_id,tier,json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json',[auth.workspaceId,auth.studentId,pack.id,value.starTier,json(value)],client);
      }
    }
    await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(completed)],client);await this.audit(auth,abandon?'play.abandon':'play.complete',playId,client);return abandon?{}:{state:compact?await this.studentSummary(auth,'current',client):await this.studentState(auth,client),gained,tier};
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
  async transitionReward(auth,requestId,input,cancel=false){role(auth,cancel?'student':'admin');shape(input,cancel?[]:['status','note']);return this.mutate(auth,async client=>{
    const row=await this.one('SELECT * FROM bao_an.redemptions WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,requestId],client);if(!row||cancel&&row.student_id!==auth.studentId)fail(404,'Không tìm thấy yêu cầu đổi sao.');const status=cancel?'cancelled':input.status;
    if(!['approved','rejected','fulfilled','cancelled'].includes(status)||!cancel&&status==='cancelled')fail(400,'Trạng thái đổi thưởng không hợp lệ.');let request;try{request=changeRewardRequest(parse(row.json),status,now(),input.note);}catch(error){fail(409,error.message);}
    await this.exec('UPDATE bao_an.redemptions SET status=$3,json=$4::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,requestId,status,json(request)],client);await this.audit(auth,`redemption.${status}`,requestId,client);return request;
  });}
}
