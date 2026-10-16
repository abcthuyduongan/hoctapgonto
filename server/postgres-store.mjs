import pg from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {OnlineError,fail,shape,text,integer} from './online-errors.mjs';
import {parseContentImport} from '../src/core/content-io.ts';
import {GAME_REGISTRY,getGame} from '../src/core/registry.ts';
import {validatePack} from '../src/core/validation.ts';
import {onlinePresentation,onlineEvidenceErrors,onlineScoreResponse,onlineAward} from '../src/core/online-exercises.ts';
import {makeRewardRequest,changeRewardRequest,rewardStatus,rewardBalance} from '../src/core/reward-wallet.ts';
import {onlineImmutablePackIdentity,onlinePackQuestionKind,onlineSemanticPackIdentity,onlineWeekIdentity,onlineIdentityText,onlineRevisionOrder} from '../src/core/online-import-identity.ts';

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
    if(user.role==='student'){const student=await this.one('SELECT active FROM bao_an.students WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,user.student_id],client);if(!student?.active)fail(401,'Tài khoản học sinh đã được khóa.');}
  }
  async mutate(auth,action){return this.transaction(async client=>{await this.workspace(auth.workspaceId,client,true);await this.activeActor(auth,client);return action(client);});}
  async audit(auth,action,target,client){await this.exec('INSERT INTO bao_an.audit(id,workspace_id,user_id,action,target_id,at) VALUES($1,$2,$3,$4,$5,$6)',[id(),auth.workspaceId,auth.id,action,target,now()],client);}
  async configured(client=this.pool){return!!await this.one("SELECT id FROM bao_an.users WHERE role='admin' LIMIT 1",[],client);}
  async workspace(workspaceId,client=this.pool,lock=false){return await this.one(`SELECT * FROM bao_an.workspaces WHERE id=$1${lock?' FOR UPDATE':''}`,[workspaceId],client)??fail(404,'Không tìm thấy đơn vị.');}
  async findUserByUsername(name){return this.one('SELECT * FROM bao_an.users WHERE username=$1',[name]);}
  async findUserById(userId){return this.one('SELECT * FROM bao_an.users WHERE id=$1',[userId]);}
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
  async revokeSession(tokenHash){await this.exec('DELETE FROM bao_an.auth_sessions WHERE token_hash=$1',[tokenHash]);}
  async consumeLoginLimit({addressHash,userHash,now:time=Date.now()}){
    const entries=[{key:addressHash,max:100},{key:userHash,max:12}].sort((a,b)=>a.key.localeCompare(b.key));
    for(const entry of entries)text(entry.key,'Mã giới hạn đăng nhập',100);
    await this.transaction(async client=>{for(const entry of entries){
      await this.exec('INSERT INTO bao_an.login_limits(key,count,reset_at) VALUES($1,0,$2) ON CONFLICT(key) DO NOTHING',[entry.key,time+900000],client);
      const row=await this.one('SELECT count,reset_at FROM bao_an.login_limits WHERE key=$1 FOR UPDATE',[entry.key],client),count=Number(row.reset_at)>time?row.count:0;
      if(count>=entry.max)fail(429,'Đã thử đăng nhập quá nhiều lần. Hãy đợi 15 phút rồi thử lại.');
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
  async addMedia(auth,{id:mediaId,name,mime,bytes,objectPath}){
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
    return this.mutate(auth,async client=>{
      const prior=await this.one('SELECT * FROM bao_an.media WHERE workspace_id=$1 AND name=$2 AND sha256=$3',[auth.workspaceId,name,sha256],client);if(prior)return this.publicMedia(prior);
      const used=await this.one('SELECT coalesce(sum(size),0) AS used FROM bao_an.media WHERE workspace_id=$1',[auth.workspaceId],client);if(Number(used.used)+bytes.length>256*1024*1024)fail(400,'Kho hình/âm thanh đã đạt giới hạn 256 MB của bản này.');
      const row=await this.one('INSERT INTO bao_an.media(id,workspace_id,name,mime,kind,size,sha256,object_path,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[mediaId,auth.workspaceId,name,detected,kind,bytes.length,sha256,objectPath,now()],client);
      await this.audit(auth,'media.upload',mediaId,client);return this.publicMedia(row);
    });
  }
  referencedMedia(pack){return new Set([...(pack.media??[]).map(asset=>asset.mediaId),...pack.items.flatMap(item=>[item.media?.imageId,item.media?.audioId,...('audioId'in item?[item.audioId]:[])])].filter(Boolean));}
  async hasMediaAccess(auth,mediaId,client=this.pool){
    const row=await this.one('SELECT id FROM bao_an.media WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,mediaId],client);if(!row)return false;
    if(auth.role==='admin')return true;const student=await this.student(auth,auth.studentId,client),weeks=await this.weeks(auth,student.class_id,client);
    if(weeks.some(week=>week.sets.some(set=>this.referencedMedia(set.pack).has(mediaId))))return true;
    const pinned=await this.rows("SELECT DISTINCT p.json FROM bao_an.plays s JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.json->>'packId' AND p.version=(s.json->>'contentVersion')::integer WHERE s.workspace_id=$1 AND s.student_id=$2 AND s.json->>'profileId'=$2 AND s.json->>'status' IN ('active','completed')",[auth.workspaceId,student.id],client);
    return pinned.some(pack=>this.referencedMedia(parse(pack.json)).has(mediaId));
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
  async balance(auth,studentId,client=this.pool){return rewardBalance((await this.rewards(auth,studentId,client)).reduce((sum,row)=>sum+row.starTier,0),{requests:await this.requests(auth,studentId,client)});}
  async publicStudent(auth,row,client=this.pool){const current=(await this.progress(auth,row,client)).current;return{id:row.id,classId:row.class_id,name:row.name,username:row.username,active:!!row.active,createdAt:row.created_at,balance:await this.balance(auth,row.id,client),...(current?{currentWeek:current.weekTitle}:{})};}
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
  async weeks(auth,classId,client=this.pool){const rows=await this.rows('SELECT * FROM bao_an.weeks WHERE workspace_id=$1 AND class_id=$2 ORDER BY position',[auth.workspaceId,classId],client),result=[];
    for(const row of rows){const sets=await this.rows('SELECT p.* FROM bao_an.week_sets s JOIN bao_an.packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE s.workspace_id=$1 AND s.week_id=$2 ORDER BY s.position',[auth.workspaceId,row.id],client);result.push({id:row.id,classId:row.class_id,title:row.title,position:row.position,createdAt:row.created_at,sets:sets.map(set=>this.packRecord(set))});}return result;
  }
  async publishWeek(auth,input){role(auth,'admin');shape(input,['requestId','title','classId','sets','replaceWeekId']);const requestId=text(input.requestId,'Mã lần nạp',100),title=text(input.title,'Tên tuần',100),classId=text(input.classId,'Lớp học',100),replaceWeekId=input.replaceWeekId===undefined?undefined:text(input.replaceWeekId,'Tuần cần cập nhật',100);
    if(!Array.isArray(input.sets)||input.sets.length<1||input.sets.length>30)fail(400,'Mỗi tuần cần từ 1–30 bộ câu hỏi.');const hash=digest(input);
    return this.mutate(auth,async client=>{
      const cls=await this.class(auth,classId,client),seen=new Set(),sets=[];
      for(const[ index,set]of input.sets.entries()){
        shape(set,['subjectLabel','pack']);const label=set.subjectLabel===undefined||set.subjectLabel===''?'':text(set.subjectLabel,'Tên môn/chủ đề',120);
        if(!set.pack||typeof set.pack!=='object'||!['quiz','pairs','sentences','learning'].includes(set.pack.kind))fail(400,`Bộ ${index+1}: dạng câu chưa có trò chơi phù hợp.`);
        let pack;try{pack=parseContentImport(json({schema:'baoan-learning-content',formatVersion:set.pack.kind==='learning'?2:1,packs:[{...set.pack,grade:cls.grade,subject:'thinking'}]}))[0];}catch(error){fail(400,`Bộ ${index+1}: ${error.message}`);}await this.validateMedia(auth,pack,client);
        if(seen.has(pack.id))fail(400,'Một tuần không được lặp lại mã bộ câu hỏi gốc.');seen.add(pack.id);
        sets.push({subjectLabel:label,pack});
      }
      const mediaHashes=Object.fromEntries((await this.rows('SELECT id,sha256 FROM bao_an.media WHERE workspace_id=$1',[auth.workspaceId],client)).map(row=>[row.id,row.sha256]));
      const incomingIdentity=onlineWeekIdentity({title,sets},mediaHashes),weeks=await this.weeks(auth,classId,client),revisionHash=digest({classId,replaceWeekId,content:incomingIdentity,sources:sets.map(set=>`${set.pack.id}@${set.pack.version}`).sort()});
      const marker=(await this.rows("SELECT target_id FROM bao_an.audit WHERE workspace_id=$1 AND action='week.revise'",[auth.workspaceId],client)).map(row=>{try{return parse(row.target_id);}catch{return null;}}).find(row=>row?.requestId===requestId);
      if(marker){if(marker.weekId!==replaceWeekId||marker.payloadHash!==revisionHash)fail(409,'Mã lần cập nhật đã dùng cho nội dung khác.');return weeks.find(week=>week.id===marker.weekId)??fail(404,'Không tìm thấy tuần gốc.');}
      const prior=await this.one('SELECT id,payload_hash,class_id FROM bao_an.weeks WHERE workspace_id=$1 AND request_id=$2',[auth.workspaceId,requestId],client);
      if(prior){const priorWeek=prior.class_id===classId?weeks.find(week=>week.id===prior.id):undefined;
        if(priorWeek&&(prior.payload_hash===hash||onlineWeekIdentity(priorWeek,mediaHashes)===incomingIdentity))return priorWeek;
        fail(409,'Mã lần nạp đã được dùng cho nội dung khác.');}
      const replay=replaceWeekId?undefined:weeks.find(week=>onlineWeekIdentity(week,mediaHashes)===incomingIdentity);if(replay)return replay;
      const catalog=(await this.rows('SELECT * FROM bao_an.packs WHERE workspace_id=$1',[auth.workspaceId],client)).map(row=>({...row,pack:parse(row.json)}));
      let revision;
      if(replaceWeekId){const original=weeks.find(week=>week.id===replaceWeekId)??fail(404,'Không tìm thấy tuần cần cập nhật trong lớp này.');
        try{revision=onlineRevisionOrder(original,{title,sets},mediaHashes);}catch(error){fail(409,error.message);}if(revision.unchanged)return original;
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
      for(const set of sets){const existing=catalog.find(row=>row.pack_id===set.pack.id&&row.version===set.pack.version);
        if(existing)set.pack=existing.pack;else await this.exec('INSERT INTO bao_an.packs(workspace_id,pack_id,version,subject_label,json,content_hash) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[auth.workspaceId,set.pack.id,set.pack.version,set.subjectLabel,json(set.pack),contentIdentity(set.pack)],client);}
      if(revision){for(const[index,set]of sets.entries())await this.exec('UPDATE bao_an.week_sets SET version=$1 WHERE workspace_id=$2 AND week_id=$3 AND position=$4 AND pack_id=$5',[set.pack.version,auth.workspaceId,replaceWeekId,index+1,set.pack.id],client);
        await this.exec('UPDATE bao_an.weeks SET title=$1 WHERE workspace_id=$2 AND id=$3 AND class_id=$4',[title,auth.workspaceId,replaceWeekId,classId],client);
        await this.audit(auth,'week.revise',json({weekId:replaceWeekId,requestId,payloadHash:revisionHash}),client);return(await this.weeks(auth,classId,client)).find(week=>week.id===replaceWeekId);}
      const weekId=id(),position=(await this.one('SELECT coalesce(max(position),0)+1 AS p FROM bao_an.weeks WHERE workspace_id=$1 AND class_id=$2',[auth.workspaceId,classId],client)).p;
      await this.exec('INSERT INTO bao_an.weeks(id,workspace_id,class_id,title,position,request_id,payload_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[weekId,auth.workspaceId,classId,title,position,requestId,hash,now()],client);
      for(const[index,set]of sets.entries())await this.exec('INSERT INTO bao_an.week_sets(workspace_id,week_id,position,pack_id,version) VALUES($1,$2,$3,$4,$5)',[auth.workspaceId,weekId,index+1,set.pack.id,set.pack.version],client);
      await this.audit(auth,'week.publish',weekId,client);return(await this.weeks(auth,classId,client)).find(week=>week.id===weekId);
    });
  }
  async progress(auth,student,client=this.pool){const rewards=new Map((await this.rewards(auth,student.id,client)).map(row=>[row.packId,row.starTier]));let previous=true,current=null;
    const weeks=(await this.weeks(auth,student.class_id,client)).map(week=>{const sets=week.sets.map(set=>({...set,stars:rewards.get(set.pack.id)??0,done:(rewards.get(set.pack.id)??0)>=2})),done=sets.every(set=>set.done),unlocked=previous;
      if(unlocked&&!current){const next=sets.find(set=>!set.done);if(next)current={weekId:week.id,weekTitle:week.title,...next};}previous=previous&&done;return{...week,sets,done,unlocked};});return{weeks,current};
  }
  async studentState(auth,client=this.pool){role(auth,'student');const student=await this.student(auth,auth.studentId,client),cls=await this.class(auth,student.class_id,client),workspace=await this.workspace(auth.workspaceId,client),progress=await this.progress(auth,student,client);
    return{student:await this.publicStudent(auth,student,client),profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,rewards:await this.rewards(auth,student.id,client),balance:await this.balance(auth,student.id,client),wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests:await this.requests(auth,student.id,client)};
  }
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
  async startPlay(auth,input){role(auth,'student');shape(input,['requestId','moduleId','packId','contentVersion']);const requestId=text(input.requestId,'Mã lượt chơi',100),moduleId=text(input.moduleId,'Trò chơi',80),packId=text(input.packId,'Mã bộ',80),version=integer(input.contentVersion,'Phiên bản');
    return this.mutate(auth,async client=>{
      const prior=await this.one('SELECT id FROM bao_an.plays WHERE workspace_id=$1 AND student_id=$2 AND request_id=$3',[auth.workspaceId,auth.studentId,requestId],client);
      if(prior){const value=await this.play(auth,prior.id,client);if(value.session.packId!==packId||value.session.contentVersion!==version||value.session.moduleId!==moduleId)fail(409,'Mã lượt chơi đã dùng cho nội dung khác.');return{...value,presentation:onlinePresentation(moduleId,value.pack)};}
      const student=await this.student(auth,auth.studentId,client),progress=await this.progress(auth,student,client),choice=progress.weeks.filter(week=>week.unlocked).flatMap(week=>week.sets).find(set=>set.pack.id===packId&&set.pack.version===version);
      if(!choice)fail(403,'Bộ câu hỏi chưa được giao hoặc tuần trước chưa đạt đủ 2 sao cho từng bộ.');if(!choice.games.some(game=>game.id===moduleId))fail(400,'Dạng câu của bộ này chưa phù hợp với trò chơi đã chọn.');await this.abandonActive(auth,student.id,client);
      const session={sessionId:id(),profileId:student.id,packId,contentVersion:version,moduleId,moduleVersion:getGame(moduleId).version,startedAt:now(),status:'active',rewardPolicyVersion:1,presentationVersion:1};
      await this.exec('INSERT INTO bao_an.plays(id,workspace_id,student_id,request_id,json) VALUES($1,$2,$3,$4,$5::jsonb)',[session.sessionId,auth.workspaceId,student.id,requestId,json(session)],client);return{session,pack:choice.pack,presentation:onlinePresentation(moduleId,choice.pack)};
    });
  }
  async events(auth,playId,client=this.pool){if(auth.role==='student')await this.play(auth,playId,client);return(await this.rows('SELECT json FROM bao_an.attempts WHERE workspace_id=$1 AND play_id=$2 ORDER BY sequence',[auth.workspaceId,playId],client)).map(row=>parse(row.json));}
  async attempt(auth,playId,input){role(auth,'student');shape(input,['attemptKey','itemId','response','hintsUsed','elapsedMs']);const key=text(input.attemptKey,'Mã lần trả lời',120);if(!/^[a-zA-Z0-9._:-]+$/.test(key))fail(400,'Mã lần trả lời không hợp lệ.');const itemId=text(input.itemId,'Mã câu',80),hintsUsed=integer(input.hintsUsed??0,'Số gợi ý',0,20);
    if(!Number.isFinite(input.elapsedMs)||input.elapsedMs<0||input.elapsedMs>14400000)fail(400,'Thời gian trả lời không hợp lệ.');const hash=digest({key,itemId,response:input.response,hintsUsed});
    return this.mutate(auth,async client=>{
      const{session,pack}=await this.play(auth,playId,client),prior=await this.one('SELECT payload_hash,json FROM bao_an.attempts WHERE workspace_id=$1 AND play_id=$2 AND attempt_key=$3',[auth.workspaceId,playId,key],client);
      if(prior){if(prior.payload_hash!==hash)fail(409,'Lần trả lời đã được lưu với đáp án khác.');return{event:parse(prior.json),duplicate:true};}
      if(session.status!=='active')fail(409,'Lượt chơi đã kết thúc hoặc được thay bằng lượt mới ở thiết bị khác.');if(Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã quá hạn. Hãy mở lượt mới.');
      const events=await this.events(auth,playId,client);if(events.length>=5000)fail(400,'Lượt chơi đã đạt giới hạn số lần thử.');const item=pack.items.find(row=>row.id===itemId);if(!item)fail(400,'Câu hỏi không thuộc lượt chơi.');let outcome;try{outcome=onlineScoreResponse(pack,session.moduleId,itemId,input.response);}catch(error){fail(400,error.message);}
      const event={eventId:`${session.sessionId}:${key}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:pack.version,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId,objectiveId:item.objectiveId,correct:outcome.correct,hintsUsed,elapsedMs:input.elapsedMs,occurredAt:now(),response:input.response,gameSequence:events.length+1};
      const errors=onlineEvidenceErrors(session,[...events,event],pack);if(errors.length)fail(400,errors[0]);await this.exec('INSERT INTO bao_an.attempts(workspace_id,play_id,attempt_key,payload_hash,json,sequence) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[auth.workspaceId,playId,key,hash,json(event),event.gameSequence],client);return{event,duplicate:false};
    });
  }
  async finishPlay(auth,playId,abandon=false){role(auth,'student');return this.mutate(auth,async client=>{
    const{session,pack}=await this.play(auth,playId,client);if(session.status==='abandoned'){if(abandon)return{};fail(409,'Lượt chơi đã thoát.');}
    if(session.status==='completed')return{state:await this.studentState(auth,client),gained:0,tier:(await this.rewards(auth,auth.studentId,client)).find(row=>row.packId===pack.id)?.starTier??0};
    const completed={...session,status:abandon?'abandoned':'completed',endedAt:now()},events=await this.events(auth,playId,client);let gained=0,tier=0;
    if(!abandon){const errors=onlineEvidenceErrors(completed,events,pack,true);if(errors.length)fail(400,errors[0]);const award=onlineAward(completed,events,pack);if(!award)fail(400,'Chưa đủ dữ liệu để xác nhận sao.');const prior=await this.one('SELECT tier FROM bao_an.awards WHERE workspace_id=$1 AND student_id=$2 AND pack_id=$3',[auth.workspaceId,auth.studentId,pack.id],client);tier=Math.max(award.starTier,prior?.tier??0);gained=tier-(prior?.tier??0);
      if(gained)await this.exec('INSERT INTO bao_an.awards(workspace_id,student_id,pack_id,tier,json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json',[auth.workspaceId,auth.studentId,pack.id,tier,json(award)],client);
    }
    await this.exec('UPDATE bao_an.plays SET json=$3::jsonb WHERE workspace_id=$1 AND id=$2',[auth.workspaceId,playId,json(completed)],client);await this.audit(auth,abandon?'play.abandon':'play.complete',playId,client);return abandon?{}:{state:await this.studentState(auth,client),gained,tier};
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
