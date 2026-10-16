import {DatabaseSync,backup} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,chmodSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,renameSync,rmSync,unlinkSync,writeFileSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {resolve,dirname,join,basename} from 'node:path';
import {OnlineStore,OnlineError} from './online-store.mjs';
import {validatePack} from '../src/core/validation.ts';
import {onlineAward,onlineEvidenceErrors} from '../src/core/online-exercises.ts';
import {rewardBalance,validateRewardWallet,rewardStatus} from '../src/core/reward-wallet.ts';

export const MAX_RECOVERY_UPLOAD_BYTES=32*1024*1024;
export const MAX_RECOVERY_FILE_BYTES=512*1024*1024;
const fail=(status,message)=>{throw new OnlineError(status,message);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row);
const schema=db=>db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all().map(row=>({...row,sql:row.sql?.trim().replace(/\s+/g,' ')}));
const expectedSchema=(()=>{const store=new OnlineStore(':memory:');try{return canonical(schema(store.db));}finally{store.close();}})();
function regular(file){const info=lstatSync(file);if(!info.isFile()||info.isSymbolicLink())fail(400,'Cần chọn tệp SQLite thường, không dùng liên kết.');return info;}
function safeTemporary(folder,databasePath){const absolute=resolve(folder),parent=dirname(resolve(databasePath));if(dirname(absolute)!==parent||!basename(absolute).startsWith('.bao-an-recovery-'))throw new Error('Thư mục phục hồi không hợp lệ.');
  if(existsSync(absolute)){const info=lstatSync(absolute);if(!info.isDirectory()||info.isSymbolicLink())throw new Error('Thư mục phục hồi không được dùng liên kết.');}return absolute;}
function cleanup(folder,databasePath){rmSync(safeTemporary(folder,databasePath),{recursive:true,force:true});}
function syncFile(file){const fd=openSync(file,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}}
function removeSidecars(databasePath){for(const suffix of['-wal','-shm']){const file=databasePath+suffix;if(existsSync(file)){regular(file);unlinkSync(file);}}}

/** A sidecar excludes another app server or CLI restore from the same local database. */
export function acquireOnlineDatabaseLock(databasePath,kind='server'){
  if(databasePath===':memory:')return()=>{};
  const file=resolve(databasePath)+'.operation.lock';mkdirSync(dirname(file),{recursive:true});const token=randomUUID();
  for(let attempt=0;attempt<2;attempt++){
    try{writeFileSync(file,JSON.stringify({pid:process.pid,token,kind}),{flag:'wx',mode:0o600});return()=>{try{if(JSON.parse(readFileSync(file,'utf8')).token===token)unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}};}
    catch(error){if(error.code!=='EEXIST')throw error;regular(file);let prior;try{prior=JSON.parse(readFileSync(file,'utf8'));}catch{fail(409,'Khóa dữ liệu không đọc được. Hãy kiểm tra máy chủ đã dừng trước khi phục hồi.');}
      let alive=true;if(Number.isSafeInteger(prior.pid)&&prior.pid>0){try{process.kill(prior.pid,0);}catch(problem){if(problem.code==='ESRCH')alive=false;}}
      if(alive)fail(409,'Dữ liệu đang được máy chủ hoặc công cụ phục hồi sử dụng. Hãy dừng tiến trình đó trước.');
      if(JSON.parse(readFileSync(file,'utf8')).token!==prior.token)fail(409,'Một tiến trình khác vừa mở dữ liệu. Hãy thử lại.');unlinkSync(file);
    }
  }
  fail(409,'Chưa khóa được dữ liệu để phục hồi.');
}

/** Read-only validation, including the exact application schema and raw reward evidence. */
export function inspectOnlineBackup(file,{maxBytes=MAX_RECOVERY_FILE_BYTES,workspaceId}={}){
  let db;
  try{
    const info=regular(file);if(info.size<512||info.size>maxBytes)fail(400,`Bản sao cần là SQLite hợp lệ, tối đa ${Math.floor(maxBytes/1024/1024)} MB.`);
    const bytes=readFileSync(file);if(bytes.subarray(0,16).toString('binary')!=='SQLite format 3\u0000')fail(400,'Tệp không phải bản sao SQLite của ứng dụng.');
    db=new DatabaseSync(file,{readOnly:true,allowExtension:false});db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
    if(canonical(schema(db))!==expectedSchema)fail(400,'Cấu trúc bản sao không đúng phiên bản SQLite được hỗ trợ.');
    const versions=db.prepare('SELECT version FROM schema_version').all();if(versions.length!==1||versions[0].version!==1)fail(400,'Chỉ hỗ trợ bản sao SQLite schema 1.');
    if(db.prepare('PRAGMA integrity_check').all().some(row=>Object.values(row)[0]!=='ok')||db.prepare('PRAGMA foreign_key_check').all().length)fail(400,'Bản sao hỏng hoặc có liên kết dữ liệu không hợp lệ.');
    const workspaces=db.prepare('SELECT id,name,rate_vnd FROM workspaces ORDER BY id').all();
    if(!workspaces.length||workspaceId&&(workspaces.length!==1||workspaces[0].id!==workspaceId))fail(400,'Bản sao không thuộc đơn vị đang đăng nhập. Dùng công cụ phục hồi khi máy chủ đã dừng để chuyển sang kho khác.');
    if(!db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get())fail(400,'Bản sao không có tài khoản quản lý còn hoạt động.');
    if(db.prepare('SELECT s.id FROM students s LEFT JOIN users u ON u.id=s.user_id WHERE u.id IS NULL OR u.workspace_id IS NOT s.workspace_id OR u.student_id IS NOT s.id OR u.role IS NOT \'student\' OR u.active IS NOT s.active LIMIT 1').get())fail(400,'Liên kết tài khoản và học sinh không hợp lệ.');
    const counts={};for(const name of['classes','students','weeks','packs','plays','attempts','awards','redemptions','media'])counts[name]=db.prepare(`SELECT count(*) AS n FROM ${name}`).get().n;
    counts.questions=0;const packs=new Map(),media=new Map();
    for(const row of db.prepare('SELECT id,workspace_id,kind,size,sha256,bytes FROM media').iterate()){
      if(row.bytes.length!==row.size||hash(row.bytes)!==row.sha256)fail(400,'Tệp hình hoặc âm thanh trong bản sao đã bị thay đổi.');
      media.set(JSON.stringify([row.workspace_id,row.id]),{kind:row.kind,sha256:row.sha256});
    }
    for(const row of db.prepare('SELECT workspace_id,pack_id,version,json FROM packs').iterate()){
      const pack=JSON.parse(row.json);if(pack.id!==row.pack_id||pack.version!==row.version||validatePack(pack).length)fail(400,'Học liệu trong bản sao không hợp lệ.');
      for(const item of pack.items)for(const[mediaId,kind]of[[item.media?.imageId,'image'],[item.media?.audioId,'audio'],['audioId'in item?item.audioId:undefined,'audio']])if(mediaId&&media.get(JSON.stringify([row.workspace_id,mediaId]))?.kind!==kind)fail(400,'Học liệu tham chiếu tư liệu không còn hoặc không đúng loại.');
      for(const catalog of pack.media??[]){const asset=media.get(JSON.stringify([row.workspace_id,catalog.mediaId]));if(!asset||asset.kind!=='audio'||asset.sha256!==catalog.sha256)fail(400,'Catalog âm thanh không khớp tư liệu trong bản sao.');}
      packs.set(JSON.stringify([row.workspace_id,pack.id,pack.version]),pack);counts.questions+=pack.items.length;
    }
    const events=new Map();for(const row of db.prepare('SELECT workspace_id,play_id,attempt_key,json FROM attempts').iterate()){
      const event=JSON.parse(row.json);if(event.eventId!==`${row.play_id}:${row.attempt_key}`||event.sessionId!==row.play_id)fail(400,'Lượt trả lời trong bản sao không khớp khóa lưu.');const key=JSON.stringify([row.workspace_id,row.play_id]),rows=events.get(key)??[];rows.push(event);events.set(key,rows);
    }
    const best=new Map(),awardsBySession=new Map(),awardTimelines=new Map();let activePlays=0;
    for(const row of db.prepare('SELECT id,workspace_id,student_id,json FROM plays').iterate()){
      const session=JSON.parse(row.json),pack=packs.get(JSON.stringify([row.workspace_id,session.packId,session.contentVersion])),rows=events.get(JSON.stringify([row.workspace_id,row.id]))??[];
      if(session.sessionId!==row.id||session.profileId!==row.student_id||!['active','completed','abandoned'].includes(session.status)||!pack||onlineEvidenceErrors(session,rows,pack,session.status==='completed').length)fail(400,'Phiên chơi hoặc đáp án trong bản sao không hợp lệ.');
      if(session.status==='active')activePlays++;const award=onlineAward(session,rows,pack);if(award){const key=JSON.stringify([row.workspace_id,row.student_id,pack.id]),prior=best.get(key);if(!prior||award.starTier>prior.starTier)best.set(key,award);
        awardsBySession.set(JSON.stringify([row.workspace_id,row.id]),award);const owner=JSON.stringify([row.workspace_id,row.student_id]),timeline=awardTimelines.get(owner)??[];timeline.push(award);awardTimelines.set(owner,timeline);}
    }
    const earned=new Map();let awardRows=0;for(const row of db.prepare('SELECT workspace_id,student_id,pack_id,tier,json FROM awards').iterate()){
      const key=JSON.stringify([row.workspace_id,row.student_id,row.pack_id]),expected=best.get(key),award=JSON.parse(row.json);
      // Equal-tier sessions may keep either immutable, valid completion.
      const pinned=awardsBySession.get(JSON.stringify([row.workspace_id,award.sessionId]));
      if(!expected||row.tier!==expected.starTier||canonical(pinned)!==canonical(award))fail(400,'Số sao không khớp bằng chứng học tập trong bản sao.');
      const owner=JSON.stringify([row.workspace_id,row.student_id]);earned.set(owner,(earned.get(owner)??0)+row.tier);awardRows++;
    }
    if(awardRows!==best.size)fail(400,'Bản sao thiếu sổ sao của kết quả hoàn tất.');
    for(const workspace of workspaces)for(const student of db.prepare('SELECT id FROM students WHERE workspace_id=?').all(workspace.id)){
      const requests=db.prepare('SELECT status,json FROM redemptions WHERE workspace_id=? AND student_id=? ORDER BY rowid').all(workspace.id,student.id).map(row=>{const request=JSON.parse(row.json);if(rewardStatus(request)!==row.status)fail(400,'Trạng thái đổi thưởng không khớp lịch sử.');return request;});
      const updatedAt=requests.flatMap(request=>request.history.map(step=>step.at)).reduce((latest,at)=>at>latest?at:latest,new Date().toISOString()),wallet={schemaVersion:1,enabled:true,rateVnd:workspace.rate_vnd,updatedAt,requests};
      if(validateRewardWallet(wallet).length||rewardBalance(earned.get(JSON.stringify([workspace.id,student.id]))??0,wallet).available<0)fail(400,'Lịch sử đổi thưởng hoặc số sao giữ chỗ không hợp lệ.');
      const awards=(awardTimelines.get(JSON.stringify([workspace.id,student.id]))??[]).sort((a,b)=>a.completedAt.localeCompare(b.completedAt)),groups=new Map();let next=0,availableEarned=0,held=0;
      const history=requests.flatMap((request,order)=>request.history.map((step,index)=>({request,step,order,index}))).sort((a,b)=>a.step.at.localeCompare(b.step.at)||a.order-b.order||a.index-b.index);
      for(const{request,step,index}of history){while(next<awards.length&&awards[next].completedAt<=step.at){const award=awards[next++],old=groups.get(award.packId)??0,tier=Math.max(old,award.starTier);groups.set(award.packId,tier);availableEarned+=tier-old;}
        if(index===0)held+=request.stars;else if(['cancelled','rejected'].includes(step.status))held-=request.stars;if(held>availableEarned)fail(400,'Yêu cầu đổi thưởng dùng sao trước thời điểm học sinh đạt được.');}
    }
    return{sha256:hash(bytes),bytes:info.size,schemaVersion:1,counts,workspaceNames:workspaces.map(row=>row.name),workspaceIds:workspaces.map(row=>row.id),activePlays,sessionsToRevoke:db.prepare('SELECT count(*) AS n FROM auth_sessions').get().n};
  }catch(error){if(error instanceof OnlineError)throw error;fail(400,'Không đọc được bản sao hoặc dữ liệu SQLite không hợp lệ.');}
  finally{db?.close();}
}

export async function snapshotOnlineDatabase(database,outputPath){
  if(existsSync(outputPath))fail(409,'Tệp sao lưu đã tồn tại; không ghi đè.');mkdirSync(dirname(outputPath),{recursive:true});await backup(database,outputPath);
  chmodSync(outputPath,0o600);const standalone=new DatabaseSync(outputPath,{allowExtension:false});try{standalone.exec('PRAGMA trusted_schema=OFF; PRAGMA journal_mode=DELETE;');}finally{standalone.close();}
  syncFile(outputPath);return inspectOnlineBackup(outputPath);
}

function sanitizeCandidate(file){
  const db=new DatabaseSync(file,{allowExtension:false});try{
    db.exec('PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; BEGIN IMMEDIATE; DELETE FROM auth_sessions; DELETE FROM login_limits;');
    for(const row of db.prepare('SELECT id,workspace_id,json FROM plays').all()){
      const session=JSON.parse(row.json);if(session.status==='active'){const latest=db.prepare('SELECT json FROM attempts WHERE workspace_id=? AND play_id=?').all(row.workspace_id,row.id).map(event=>JSON.parse(event.json).occurredAt).reduce((at,next)=>next>at?next:at,session.startedAt);
        session.status='abandoned';session.endedAt=latest>new Date().toISOString()?latest:new Date().toISOString();db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(JSON.stringify(session),row.workspace_id,row.id);}
    }
    db.exec('COMMIT;');
  }catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{db.close();}syncFile(file);
}

/** Startup recovers the prior database if a process stopped in the middle of the rename pair. */
export function recoverInterruptedOnlineRestore(databasePath){
  if(databasePath===':memory:')return;const target=resolve(databasePath),journal=target+'.restore-journal.json';if(!existsSync(journal))return;
  regular(journal);let record;try{record=JSON.parse(readFileSync(journal,'utf8'));}catch{fail(503,'Nhật ký phục hồi không đọc được. Giữ nguyên dữ liệu và liên hệ quản lý.');}
  const folder=safeTemporary(record.folder,target),rollback=join(folder,'previous.sqlite'),staged=join(folder,'candidate.sqlite');
  if(record.target!==target||typeof record.hadOriginal!=='boolean')fail(503,'Nhật ký phục hồi không hợp lệ.');
  if(existsSync(rollback)){removeSidecars(target);if(existsSync(target)){regular(target);renameSync(target,join(folder,'interrupted.sqlite'));}renameSync(rollback,target);}
  else if(!existsSync(target)){if(record.hadOriginal||!existsSync(staged))fail(503,'Thiếu tệp dữ liệu trong phiên phục hồi bị gián đoạn.');renameSync(staged,target);}
  inspectOnlineBackup(target);unlinkSync(journal);cleanup(folder,target);
}

/** Called only after preview approval; API holds its server lock and blocks requests during this operation. */
export async function restoreOnlineDatabase({databasePath,backupPath,expectedSha256,workspaceId,maxBytes=MAX_RECOVERY_FILE_BYTES,database,closeDatabase,reopenDatabase,lockAlreadyHeld=false,beforeInstall}={}){
  const target=resolve(databasePath);if(databasePath===':memory:'||resolve(backupPath)===target)fail(400,'Cần đường dẫn bản sao riêng với dữ liệu đang sử dụng.');
  mkdirSync(dirname(target),{recursive:true});const release=lockAlreadyHeld?()=>{}:acquireOnlineDatabaseLock(target,'restore');
  let folder,source,closed=false,moved=false,installed=false,completed=false;
  const journal=target+'.restore-journal.json';
  try{
    recoverInterruptedOnlineRestore(target);folder=mkdtempSync(join(dirname(target),'.bao-an-recovery-'));const candidate=join(folder,'candidate.sqlite'),rollback=join(folder,'previous.sqlite');
    if(regular(backupPath).size>maxBytes)fail(400,'Bản sao vượt giới hạn kích thước phục hồi.');copyFileSync(backupPath,candidate,1);chmodSync(candidate,0o600);const preview=inspectOnlineBackup(candidate,{maxBytes,workspaceId});
    if(typeof expectedSha256!=='string'||expectedSha256!==preview.sha256)fail(409,'Bản sao đã thay đổi từ lúc xem trước. Hãy chọn và kiểm tra lại.');
    sanitizeCandidate(candidate);inspectOnlineBackup(candidate,{maxBytes,workspaceId});
    const hadOriginal=existsSync(target);let preBackupPath;
    if(hadOriginal){regular(target);source=database??new DatabaseSync(target,{allowExtension:false});
      preBackupPath=join(dirname(target),'backups',`before-restore-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}.sqlite`);await snapshotOnlineDatabase(source,preBackupPath);source.exec('PRAGMA wal_checkpoint(TRUNCATE);');}
    writeFileSync(journal,JSON.stringify({target,folder,hadOriginal}),{flag:'wx',mode:0o600});syncFile(journal);
    if(closeDatabase){closeDatabase();closed=true;}else{source?.close();source=undefined;closed=true;}
    removeSidecars(target);if(hadOriginal){renameSync(target,rollback);moved=true;}beforeInstall?.();renameSync(candidate,target);installed=true;
    reopenDatabase?.();completed=true;unlinkSync(journal);cleanup(folder,target);
    return{restored:true,reauthenticate:true,schemaVersion:1,counts:preview.counts,preBackupCreated:!!preBackupPath,preBackupPath};
  }catch(error){
    try{
      if(closed&&!completed){if(installed){closeDatabase?.();removeSidecars(target);if(existsSync(target))renameSync(target,join(folder,'failed.sqlite'));}if(moved&&existsSync(join(folder,'previous.sqlite')))renameSync(join(folder,'previous.sqlite'),target);if(reopenDatabase&&existsSync(target))reopenDatabase();}
      if(existsSync(journal))unlinkSync(journal);if(folder)cleanup(folder,target);
    }catch{fail(503,'Phục hồi bị gián đoạn. Giữ nguyên thư mục dữ liệu, đóng rồi mở lại máy chủ để khôi phục an toàn; bản sao trước phục hồi vẫn được giữ.');}
    throw error instanceof OnlineError?error:new OnlineError(500,'Chưa phục hồi được bản sao. Dữ liệu trước phục hồi đã được giữ nguyên.');
  }finally{if(source&&!database)source.close();release();}
}

export function createRecoveryTemporary(databasePath,name='snapshot.sqlite'){
  if(!['snapshot.sqlite','upload.sqlite'].includes(name))throw new Error('Tên tệp tạm không hợp lệ.');
  const folder=mkdtempSync(join(dirname(resolve(databasePath)),'.bao-an-recovery-'));
  return{folder,file:join(folder,name),remove:()=>cleanup(folder,databasePath)};
}
export function createRecoveryUpload(databasePath,base64){
  if(typeof base64!=='string'||!base64.length||base64.length>Math.ceil(MAX_RECOVERY_UPLOAD_BYTES/3)*4||base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))fail(400,'Tệp bản sao không hợp lệ hoặc vượt giới hạn 32 MB.');
  const bytes=Buffer.from(base64,'base64');if(bytes.length>MAX_RECOVERY_UPLOAD_BYTES)fail(413,'Bản sao vượt giới hạn phục hồi qua giao diện. Dùng công cụ phục hồi tệp khi máy chủ đã dừng.');
  const temporary=createRecoveryTemporary(databasePath,'upload.sqlite');writeFileSync(temporary.file,bytes,{flag:'wx',mode:0o600});return temporary;
}
