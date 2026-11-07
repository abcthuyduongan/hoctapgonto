import {DatabaseSync} from 'node:sqlite';
import {BAO_AN_GIFT_PRESET,BAO_AN_GIFT_RATE_VND,BAO_AN_GIFT_PRESET_ID,presetGiftDetails} from '../src/core/gift-presets.ts';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
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
import {toVietnamDateString,getVietnamWeekKey,computeStreakState,registerDailyCorrectAnswer,buildDailyMissions,buildStudentBadgeStatuses,BADGE_CATALOG} from '../src/core/badges.ts';
import {getVietnamTimeParts,checkCurfewHours,checkDailyScreenTime,msToMinutes,MAX_PIN_FAILURES,PIN_LOCKOUT_MS} from '../src/core/parent-controls.ts';
import {buildParentWeeklyReport,hashParentPin,verifyParentPin,issueParentElevationToken,verifyParentElevationToken,revokeParentElevationToken,sanitizeParentControls} from './parent-data.mjs';
import {CONTEST_PRESETS,CONTESTANT_BADGE,sanitizeContestItem,evaluateContestSubmission,checkReadinessForExam,generateContestQuestions,buildReviewMistakesPack} from './contest-data.mjs';
import {TOWN_BUILDING_CATALOG,TOWN_BUILDING_MAP,resolveTownSubject,getMaterialForSubject,calculateEarnedMaterialsFromAwards,calculateTotalSpentMaterials,calculateAvailableMaterials,canAffordBuilding,defaultTownState,evaluateBuildingPlacement} from './town-data.mjs';
import {ANIMAL_CATALOG,ANIMAL_MAP,getUnlockedAnimals,validateAnimalName} from '../src/core/animal-neighbors.ts';
import {sanitizeClassFeedEvent,verifyPrivacyCompliance} from '../src/core/class-feed.ts';
import {normalizeIntegrationSubject} from './safetime-integration.mjs';

import {OnlineError,fail,text,integer,shape} from './online-errors.mjs';
export {OnlineError,fail,text,integer,shape};
const id=()=>randomUUID();
const now=()=>new Date().toISOString();
const role=(auth,expected)=>{
  if(Array.isArray(expected)){
    if(!expected.includes(auth.role))fail(403,'Không có quyền thực hiện thao tác này.');
  }else if(auth.role!==expected){
    fail(403,expected==='admin'?'Chỉ quản lý được thực hiện thao tác này.':'Hãy dùng tài khoản học sinh để vào luyện tập.');
  }
};
const json=JSON.stringify;
const parse=JSON.parse;
const stable=value=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row);
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
const contentIdentity=pack=>{const{publishedAt,source,...content}=pack;void publishedAt;void source;return digest(content);};
export class OnlineStore{
  constructor(databasePath){
    if(databasePath!==':memory:')mkdirSync(dirname(databasePath),{recursive:true});
    this.db=new DatabaseSync(databasePath);
    try {
      const tables = new Set(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
      if (tables.has('users_upgrade_v4')) {
        this.db.exec('PRAGMA foreign_keys=OFF;');
        if (!tables.has('users')) {
          this.db.exec('ALTER TABLE users_upgrade_v4 RENAME TO users;');
        } else {
          const usersCount = this.db.prepare('SELECT count(*) AS n FROM users').get().n;
          const upgradeCount = this.db.prepare('SELECT count(*) AS n FROM users_upgrade_v4').get().n;
          if (usersCount === 0 && upgradeCount > 0) {
            this.db.exec('DROP TABLE users; ALTER TABLE users_upgrade_v4 RENAME TO users;');
          } else {
            this.db.exec('DROP TABLE IF EXISTS users_upgrade_v4;');
          }
        }
      }
      const userTableSql = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || '';
      if (userTableSql && !userTableSql.includes("'parent'")) {
        this.db.exec('PRAGMA foreign_keys=OFF;');
        this.db.exec('DROP TABLE IF EXISTS users_upgrade_v4;');
        this.db.exec(`
          BEGIN IMMEDIATE;
          CREATE TABLE users_upgrade_v4(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student','parent')),student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
          INSERT INTO users_upgrade_v4(id, workspace_id, username, password_hash, role, student_id, active, created_at)
            SELECT id, workspace_id, username, password_hash, role, student_id, active, created_at FROM users;
          DROP TABLE users;
          ALTER TABLE users_upgrade_v4 RENAME TO users;
          COMMIT;
        `);
        const fkCheck = this.db.prepare('PRAGMA foreign_key_check').all();
        if (fkCheck && fkCheck.length > 0) {
          throw new Error('Nâng cấp bảng users làm hỏng ràng buộc khóa ngoại.');
        }
      }
    } catch (err) {
      try { this.db.exec('ROLLBACK;'); } catch {}
      throw new Error(`Lỗi nâng cấp cấu trúc bảng users: ${err.message}`);
    }
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO schema_version VALUES(2);
      CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,wallet_enabled INTEGER NOT NULL DEFAULT 0,rate_vnd INTEGER NOT NULL DEFAULT 1000,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student','parent')),student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS login_limit_expiry ON login_limits(reset_at,key);
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
      CREATE TABLE IF NOT EXISTS gift_catalog(workspace_id TEXT NOT NULL,id TEXT NOT NULL,class_id TEXT,title TEXT NOT NULL,image_media_id TEXT,price_stars INTEGER NOT NULL,kind TEXT NOT NULL,weekly_limit INTEGER NOT NULL DEFAULT 0,stock INTEGER NOT NULL DEFAULT -1,unlock_after_week INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id) REFERENCES workspaces(id));
      CREATE TABLE IF NOT EXISTS student_goals(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,gift_id TEXT NOT NULL,pinned_at TEXT NOT NULL,PRIMARY KEY(workspace_id,student_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS badge_awards(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,badge_id TEXT NOT NULL,unlocked_at TEXT NOT NULL,json TEXT NOT NULL DEFAULT '{}',PRIMARY KEY(workspace_id,student_id,badge_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS student_streaks(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,current_streak INTEGER NOT NULL DEFAULT 0,longest_streak INTEGER NOT NULL DEFAULT 0,last_active_date TEXT,freeze_used_week TEXT,today_correct_count INTEGER NOT NULL DEFAULT 0,today_date TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(workspace_id,student_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS daily_missions(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,date TEXT NOT NULL,mission_id TEXT NOT NULL,mission_type TEXT NOT NULL,target_count INTEGER NOT NULL DEFAULT 1,progress_count INTEGER NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,completed_at TEXT,json TEXT NOT NULL DEFAULT '{}',PRIMARY KEY(workspace_id,student_id,date,mission_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS parent_controls(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,pin_hash TEXT,pin_salt TEXT,pin_failed_count INTEGER NOT NULL DEFAULT 0,pin_locked_until TEXT,max_minutes_per_day INTEGER NOT NULL DEFAULT 0,allowed_start_hour INTEGER NOT NULL DEFAULT 0,allowed_end_hour INTEGER NOT NULL DEFAULT 24,updated_at TEXT NOT NULL,PRIMARY KEY(workspace_id,student_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS parent_students(workspace_id TEXT NOT NULL,parent_user_id TEXT NOT NULL,student_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,parent_user_id,student_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS contest_sessions(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,session_id TEXT PRIMARY KEY,request_id TEXT,preset_id TEXT NOT NULL,title TEXT NOT NULL,subject TEXT NOT NULL,grade INTEGER NOT NULL,duration_seconds INTEGER NOT NULL,started_at TEXT NOT NULL,deadline_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',items_json TEXT NOT NULL,submitted_at TEXT,score INTEGER DEFAULT 0,max_score INTEGER DEFAULT 0,correct_count INTEGER DEFAULT 0,total_items INTEGER DEFAULT 0,answers_json TEXT DEFAULT '{}',skipped_keys TEXT DEFAULT '[]',created_at TEXT NOT NULL,FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS town_states(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,grid_width INTEGER NOT NULL DEFAULT 10,grid_height INTEGER NOT NULL DEFAULT 10,revision INTEGER NOT NULL DEFAULT 1,buildings_json TEXT NOT NULL DEFAULT '[]',updated_at TEXT NOT NULL,PRIMARY KEY(workspace_id,student_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS materials_ledger(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,id TEXT PRIMARY KEY,pack_id TEXT,material_type TEXT NOT NULL CHECK(material_type IN ('stone', 'wood', 'fish', 'component')),delta INTEGER NOT NULL,reason TEXT NOT NULL,request_id TEXT,created_at TEXT NOT NULL,FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS town_animals(workspace_id TEXT NOT NULL,student_id TEXT NOT NULL,animal_id TEXT NOT NULL,name TEXT NOT NULL,arrived_at_week INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,student_id,animal_id),FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS town_cheers(workspace_id TEXT NOT NULL,from_student_id TEXT NOT NULL,to_student_id TEXT NOT NULL,day_key TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,from_student_id,to_student_id,day_key),FOREIGN KEY(workspace_id,from_student_id) REFERENCES students(workspace_id,id),FOREIGN KEY(workspace_id,to_student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS class_feed_events(workspace_id TEXT NOT NULL,class_id TEXT NOT NULL,id TEXT NOT NULL,student_id TEXT NOT NULL,student_name TEXT NOT NULL,event_type TEXT NOT NULL,details_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,class_id,id),FOREIGN KEY(workspace_id,class_id) REFERENCES classes(workspace_id,id));
      CREATE INDEX IF NOT EXISTS town_states_student ON town_states(workspace_id,student_id);
      CREATE INDEX IF NOT EXISTS materials_student ON materials_ledger(workspace_id,student_id);
      CREATE INDEX IF NOT EXISTS materials_request ON materials_ledger(workspace_id,student_id,request_id);
      CREATE INDEX IF NOT EXISTS town_animals_student ON town_animals(workspace_id,student_id);
      CREATE INDEX IF NOT EXISTS town_cheers_target ON town_cheers(workspace_id,to_student_id);
      CREATE INDEX IF NOT EXISTS class_feed_lookup ON class_feed_events(workspace_id,class_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS contest_sessions_student ON contest_sessions(workspace_id,student_id,created_at);
      CREATE INDEX IF NOT EXISTS contest_sessions_request ON contest_sessions(workspace_id,student_id,request_id);
      CREATE INDEX IF NOT EXISTS parent_controls_student ON parent_controls(workspace_id,student_id);
      CREATE INDEX IF NOT EXISTS parent_students_parent ON parent_students(workspace_id,parent_user_id);
      CREATE INDEX IF NOT EXISTS plays_student ON plays(workspace_id,student_id); CREATE INDEX IF NOT EXISTS redemption_student ON redemptions(workspace_id,student_id);
      CREATE INDEX IF NOT EXISTS gift_workspace_active ON gift_catalog(workspace_id,active,sort_order);
      CREATE INDEX IF NOT EXISTS student_goal_gift ON student_goals(workspace_id,gift_id);
      CREATE INDEX IF NOT EXISTS badge_awards_student ON badge_awards(workspace_id,student_id);
      CREATE INDEX IF NOT EXISTS daily_missions_date ON daily_missions(workspace_id,student_id,date);
      CREATE INDEX IF NOT EXISTS auth_expiry ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS integration_clients(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),token_hash TEXT NOT NULL UNIQUE,device_id TEXT NOT NULL,device_name TEXT NOT NULL,allowed_student_ids TEXT NOT NULL,created_at TEXT NOT NULL,last_used_at TEXT,revoked_at TEXT);
      CREATE TABLE IF NOT EXISTS integration_pair_codes(code TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),allowed_student_ids TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT);
      CREATE TABLE IF NOT EXISTS integration_tickets(ticket TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),client_id TEXT NOT NULL REFERENCES integration_clients(id),student_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT,FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS integration_refresh_tokens(token_hash TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),client_id TEXT NOT NULL REFERENCES integration_clients(id),student_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT,FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE TABLE IF NOT EXISTS integration_events(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),student_id TEXT NOT NULL,event_type TEXT NOT NULL,data_json TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(workspace_id,student_id) REFERENCES students(workspace_id,id));
      CREATE INDEX IF NOT EXISTS integration_clients_token ON integration_clients(token_hash);
      CREATE INDEX IF NOT EXISTS integration_pair_codes_expiry ON integration_pair_codes(expires_at);
      CREATE INDEX IF NOT EXISTS integration_tickets_lookup ON integration_tickets(ticket,expires_at);
      CREATE INDEX IF NOT EXISTS integration_refresh_lookup ON integration_refresh_tokens(token_hash,expires_at);
      CREATE INDEX IF NOT EXISTS integration_events_lookup ON integration_events(workspace_id,student_id,created_at);
      INSERT OR REPLACE INTO schema_version VALUES(2);`);
    try { this.db.prepare('ALTER TABLE classes ADD COLUMN feed_enabled INTEGER NOT NULL DEFAULT 1').run(); } catch {}
    this.db.function('baoan_fold',{deterministic:true},value=>typeof value==='string'?value.normalize('NFC').toLocaleLowerCase('vi'):value);
    if(this.db.prepare('SELECT max(version) AS version FROM schema_version').get().version!==2)fail(500,'Phiên bản dữ liệu online chưa được hỗ trợ.');
    this.lastCorrectPositions = new Map();
  }
  lastQuestionCorrectPosition(workspaceId, studentId, itemId, version, packId) {
    try {
      let query = `
        SELECT CAST(json_extract(json, '$."questionPresentations"."' || replace(?, '"', '\"') || '".displayedCorrectIndex') AS INTEGER) AS pos
        FROM plays
        WHERE workspace_id=? AND student_id=?
          AND json_extract(json, '$."questionPresentations"."' || replace(?, '"', '\"') || '".displayedCorrectIndex') IS NOT NULL
      `;
      const params = [itemId, workspaceId, studentId, itemId];
      if (packId) {
        query += ` AND json_extract(json, '$.packId') = ?`;
        params.push(packId);
      }
      if (version) {
        query += ` AND json_extract(json, '$.contentVersion') = ?`;
        params.push(version);
      }
      query += ` ORDER BY json_extract(json, '$.startedAt') DESC LIMIT 1`;
      const row = this.db.prepare(query).get(...params);
      if (row && Number.isInteger(row.pos)) {
        return row.pos;
      }
    } catch {}
    return null;
  }
  recordQuestionCorrectPosition(workspaceId, studentId, itemId, version, pos) {}
  close(){this.db.close();}
  tx(action){
    if(this._inTx) return action();
    this._inTx=true;
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const result=action();
      this.db.exec('COMMIT');
      return result;
    }catch(error){
      this.db.exec('ROLLBACK');
      throw error;
    }finally{
      this._inTx=false;
    }
  }
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
  publicClass(row){return{id:row.id,name:row.name,grade:row.grade,feedEnabled:row.feed_enabled===undefined||row.feed_enabled===null?true:!!row.feed_enabled,createdAt:row.created_at};}
  updateClassSettings(auth,classId,input){
    role(auth,'admin');
    shape(input,['feedEnabled']);
    const cls=this.class(auth,classId);
    const feedEnabled=input.feedEnabled===undefined?true:!!input.feedEnabled;
    this.db.prepare('UPDATE classes SET feed_enabled=? WHERE workspace_id=? AND id=?').run(feedEnabled?1:0,auth.workspaceId,classId);
    return this.publicClass({...cls,feed_enabled:feedEnabled?1:0});
  }
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
      const row={id:id(),name,grade,created_at:now()};this.db.prepare('INSERT INTO classes(id,workspace_id,name,grade,created_at) VALUES(?,?,?,?,?)').run(row.id,auth.workspaceId,name,grade,row.created_at);this.audit(auth,'class.create',row.id);return this.publicClass(row);});}
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
        if(!set.pack||typeof set.pack!=='object'||!['quiz','pairs','sentences','learning','compare','categorize'].includes(set.pack.kind))fail(400,`Bộ ${index+1}: dạng câu chưa có trò chơi phù hợp.`);
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
      CASE WHEN p.pack_id IS NOT NULL THEN json_object('id',p.pack_id,'version',p.version,'title',json_extract(p.json,'$.title'),'kind',json_extract(p.json,'$.kind'),'subject',json_extract(p.json,'$.subject'),'grade',json_extract(p.json,'$.grade'),'itemCount',json_array_length(p.json,'$.items'),'discovery',case when json_extract(p.json,'$.discovery') is not null then json(json_extract(p.json,'$.discovery')) else null end,'questionIds',json((SELECT json_group_array(json_extract(item.value,'$.id')) FROM json_each(p.json,'$.items') item))) END AS summary
      FROM weeks w LEFT JOIN week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id LEFT JOIN packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE w.workspace_id=? AND w.class_id=? ORDER BY w.position,s.position`).all(auth.workspaceId,student.class_id);
    return journeyProgress(summaryWeeks(rows),awards,this.journeyMarker(auth,student));
  }
  studentSummary(auth,cursor='0'){
    if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');
    const student=this.student(auth,auth.studentId),cls=this.class(auth,student.class_id),workspace=this.workspace(auth.workspaceId),rewards=this.rewards(auth,student.id),requests=this.requests(auth,student.id),progress=summaryPage(this.summaryProgress(auth,student,rewards),cursor),balance=rewardBalance(earnedQuestionRewardStars(rewards),{requests});
    const keys=progress.current?[progress.current.pack]:[];
    const games=new Map(keys.length?this.db.prepare(`SELECT * FROM packs WHERE workspace_id=? AND (${keys.map(()=>'(pack_id=? AND version=?)').join(' OR ')})`).all(auth.workspaceId,...keys.flatMap(p=>[p.id,p.version])).map(row=>[`${row.pack_id}@${row.version}`,this.packRecord(row).games]):[]);
    const decorate=set=>({...set,games:games.get(`${set.pack.id}@${set.pack.version}`)??[]});progress.weeks=progress.weeks.map(w=>({...w,sets:w.sets.map(decorate)}));if(progress.current)progress.current=decorate(progress.current);
    const viewedRows=this.db.prepare("SELECT target_id FROM audit WHERE workspace_id=? AND user_id=? AND action='student.discovery.view'").all(auth.workspaceId,auth.id);
    const viewedDiscoveryPacks=[...new Set(viewedRows.map(r=>r.target_id))];
    const gifts=this.gifts(auth,student.class_id);
    const goal=this.studentGoal(auth,student.id);
    const streak=this.studentStreak(auth,student.id);
    const badges=this.studentBadges(auth,student.id);
    const dailyMissions=this.studentDailyMissions(auth,student.id);
    const dailyRiddle=this.studentDailyRiddle(auth,student.id,student.class_id);
    const parentCtrl=this.parentControls(auth,student.id);
    const todayStudyMinutes=this.todayStudentStudyMinutes(auth,student.id);
    return{student:{id:student.id,classId:student.class_id,name:student.name,username:student.username,active:!!student.active,createdAt:student.created_at,balance,...(progress.current?{currentWeek:progress.current.weekTitle}:{})},profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,balance,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests,viewedDiscoveryPacks,gifts,goal,streak,badges,dailyMissions,dailyRiddle,todayStudyMinutes,hasParentPin:!!parentCtrl.pinHash};
  }
  viewDiscovery(auth,packId){
    if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để ghi nhận khám phá.');
    if(typeof packId!=='string'||!packId.trim()||packId.length>100)fail(400,'Mã bộ câu hỏi không hợp lệ.');
    const existing=this.db.prepare("SELECT 1 FROM audit WHERE workspace_id=? AND user_id=? AND action='student.discovery.view' AND target_id=? LIMIT 1").get(auth.workspaceId,auth.id,packId);
    if(!existing)this.audit(auth,'student.discovery.view',packId);
    return{ok:true,packId};
  }
  studentMap(auth,query={}){
    if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để xem bản đồ.');
    const student=this.student(auth,auth.studentId);
    const progress=this.summaryProgress(auth,student);
    return projectStudentMap(progress,query);
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
      this.abandonActive(auth,student.id);this.audit(auth,'student.journey.advance',json({studentId:student.id,classId:student.class_id,weekId:next.id,position:next.position,fromWeekId:weekId,requestId,masteredPacks}));
      try {
        const completedWeek = progress.weeks.find(w => w.id === weekId);
        if (completedWeek) {
          const weekNum = completedWeek.position || 1;
          const subjects = new Set();
          for (const set of completedWeek.sets || []) {
            const subj = normalizeIntegrationSubject(set.subjectLabel || set.pack?.subjectLabel || completedWeek.title);
            subjects.add(subj);
          }
          if (subjects.size === 0) subjects.add('toan');
          for (const subj of subjects) {
            this.recordIntegrationEvent(auth.workspaceId, student.id, 'week_completed', {
              subject: subj,
              week: weekNum
            });
          }
        }
      } catch {}
      return this.studentSummary(auth,'current');
    });
  }
  assignedPack(auth,packId,version){
    const student=this.student(auth,auth.studentId);
    const progress=this.summaryProgress(auth,student);
    const assigned=progress.weeks.filter(week=>week.unlocked).flatMap(week=>week.sets).find(set=>set.pack.id===packId&&set.pack.version===version);
    if(assigned){
      const packed=this.db.prepare('SELECT * FROM packs WHERE workspace_id=? AND pack_id=? AND version=?').get(auth.workspaceId,packId,version);
      if(!packed)fail(404,'Không tìm thấy bộ câu hỏi.');
      return this.packRecord(packed);
    }
    const packed = this.db.prepare('SELECT * FROM packs WHERE workspace_id=? AND pack_id=? AND version=?').get(auth.workspaceId, packId, version);
    if (packed) {
      const packObj = parse(packed.json);
      if (packObj.ownerStudentId) {
        if (packObj.ownerStudentId !== auth.studentId) fail(403, 'Con chỉ được học gói ôn tập của chính mình.');
        return this.packRecord(packed);
      }
      const cleanSessionId = packId.replace(/^review-/, '');
      const contestRow = this.db.prepare('SELECT student_id FROM contest_sessions WHERE workspace_id=? AND session_id LIKE ?').get(auth.workspaceId, `${cleanSessionId}%`);
      if (contestRow) {
        if (contestRow.student_id !== auth.studentId) fail(403, 'Con chỉ được học gói ôn tập của chính mình.');
        return this.packRecord(packed);
      }
    }
    fail(403,'Con chỉ được học bộ câu hỏi thuộc tuần hiện tại. Tuần đã đóng và tuần chưa mở không thể chơi.');
  }
  packGames(auth,packId,version){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');return{packId,contentVersion:version,games:this.assignedPack(auth,packId,version).games};}
  studentState(auth){const student=this.student(auth,auth.studentId),cls=this.class(auth,student.class_id),workspace=this.workspace(auth.workspaceId),progress=this.progress(auth,student);
    return{student:this.publicStudent(auth,student),profile:{profileId:student.id,name:student.name,avatar:'fox',grade:cls.grade,colorTheme:'teal',createdAt:student.created_at,updatedAt:student.created_at},className:cls.name,...progress,rewards:this.rewards(auth,student.id),balance:this.balance(auth,student.id),wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},requests:this.requests(auth,student.id)};}
  dashboard(auth){const classes=this.db.prepare('SELECT * FROM classes WHERE workspace_id=? ORDER BY created_at').all(auth.workspaceId).map(row=>this.publicClass(row));
    const students=this.db.prepare('SELECT s.*,u.username FROM students s JOIN users u ON u.id=s.user_id WHERE s.workspace_id=? ORDER BY s.created_at').all(auth.workspaceId).map(row=>this.publicStudent(auth,row));
    const weeks=classes.flatMap(cls=>this.weeks(auth,cls.id)),redemptions=this.db.prepare('SELECT r.json,s.id AS student_id,s.name,s.class_id FROM redemptions r JOIN students s ON s.workspace_id=r.workspace_id AND s.id=r.student_id WHERE r.workspace_id=? ORDER BY r.rowid DESC').all(auth.workspaceId).map(row=>({...parse(row.json),studentId:row.student_id,studentName:row.name,classId:row.class_id})),workspace=this.workspace(auth.workspaceId);
    return{classes,students,weeks,redemptions,wallet:{enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd},gifts:this.gifts(auth),stats:{students:students.length,classes:classes.length,questions:this.db.prepare('SELECT json FROM packs WHERE workspace_id=?').all(auth.workspaceId).reduce((sum,row)=>sum+parse(row.json).items.length,0),pendingRequests:redemptions.filter(row=>['pending','approved'].includes(rewardStatus(row))).length}};}
  play(auth,playId){const row=this.db.prepare('SELECT * FROM plays WHERE workspace_id=? AND id=? AND student_id=?').get(auth.workspaceId,playId,auth.studentId);if(!row)fail(404,'Không tìm thấy lượt chơi.');const session=parse(row.json);
    const packed=this.db.prepare('SELECT * FROM packs WHERE workspace_id=? AND pack_id=? AND version=?').get(auth.workspaceId,session.packId,session.contentVersion);if(!packed)fail(409,'Bộ câu hỏi của lượt chơi không còn sẵn sàng.');return{session,pack:parse(packed.json)};}
  abandonActive(auth,studentId){for(const row of this.db.prepare('SELECT * FROM plays WHERE workspace_id=? AND student_id=?').all(auth.workspaceId,studentId)){const session=parse(row.json);if(session.status==='active'){session.status='abandoned';session.endedAt=now();this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,session.sessionId);}}}
  startPlay(auth,input,compact=false,secure=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,compact?['requestId','moduleId','packId','contentVersion','reviewItemIds']:['requestId','moduleId','packId','contentVersion']);const requestId=text(input.requestId,'Mã lượt chơi',100),moduleId=text(input.moduleId,'Trò chơi',80),packId=text(input.packId,'Mã bộ',80),version=integer(input.contentVersion,'Phiên bản');
    return this.tx(()=>{const student=this.student(auth,auth.studentId);
      this.assertStudentScreenTimeAllowed(auth, student.id);
      const marker=this.pinJourney(auth,student),prior=this.db.prepare('SELECT id FROM plays WHERE workspace_id=? AND student_id=? AND request_id=?').get(auth.workspaceId,auth.studentId,requestId);
      const choice=this.assignedPack(auth,packId,version);if(!choice.games.some(game=>game.id===moduleId))fail(400,'Dạng câu của bộ này chưa phù hợp với trò chơi đã chọn.');
      const presentation=onlinePresentation(moduleId,choice.pack),requiredItemIds=compact?selectReviewItems(input.reviewItemIds,choice.pack,presentation):undefined;
      if(prior){const value=this.play(auth,prior.id);if(secure&&value.session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(value.session.packId!==packId||value.session.contentVersion!==version||value.session.moduleId!==moduleId||value.session.journeyWeekId&&value.session.journeyWeekId!==marker?.weekId||compact&&(value.session.rewardPolicyVersion!==2||json(value.session.requiredItemIds)!==json(requiredItemIds)))fail(409,'Mã lượt chơi đã dùng cho nội dung khác.');if(value.session.status==='abandoned')fail(409,'Lượt chơi đã thoát. Hãy mở lượt mới.');const result={...value,presentation:filterPlayPresentation(value.session,value.pack,onlinePresentation(moduleId,value.pack))};return compact||secure?compactPlay(result):{...result,session:publicSession(result.session)};}
      this.abandonActive(auth,student.id);
      const session={sessionId:id(),profileId:student.id,packId,contentVersion:version,moduleId,moduleVersion:getGame(moduleId).version,startedAt:now(),status:'active',rewardPolicyVersion:compact?2:1,presentationVersion:1,journeyWeekId:marker?.weekId,...(compact?{requiredItemIds,questionClocks:{}}:{}),...(secure?{questionProtocolVersion:1,questionClocks:{},questionHints:{},audioReceipts:{}}:{})};
      this.db.prepare('INSERT INTO plays VALUES(?,?,?,?,?)').run(session.sessionId,auth.workspaceId,student.id,requestId,json(session));const result={session,pack:choice.pack,presentation:filterPlayPresentation(session,choice.pack,presentation)};return compact||secure?compactPlay(result):{...result,session:publicSession(result.session)};
    });}
  assertCurrentPlay(auth,session){
    if (session.packId.startsWith('review-')) {
      const packed = this.db.prepare('SELECT json FROM packs WHERE workspace_id=? AND pack_id=? AND version=?').get(auth.workspaceId, session.packId, session.contentVersion);
      if (packed) {
        const pObj = parse(packed.json);
        if (pObj.ownerStudentId && pObj.ownerStudentId !== auth.studentId) {
          fail(403, 'Con chỉ được học gói ôn tập của chính mình.');
        }
      }
      return;
    }
    const student=this.student(auth,auth.studentId),marker=this.journeyMarker(auth,student)??this.pinJourney(auth,student);
    if(session.journeyWeekId&&session.journeyWeekId!==marker?.weekId||!marker)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');
    const assigned=this.db.prepare('SELECT s.version FROM weeks w JOIN week_sets s ON s.workspace_id=w.workspace_id AND s.week_id=w.id WHERE w.workspace_id=? AND w.class_id=? AND w.id=? AND s.pack_id=?').get(auth.workspaceId,student.class_id,marker.weekId,session.packId);
    if(!assigned)fail(403,'Tuần của lượt chơi này đã đóng hoặc chưa được mở.');
    if(session.rewardPolicyVersion===2&&assigned.version!==session.contentVersion)fail(409,'Bộ câu hỏi vừa được cập nhật. Thoát rồi mở lại bài; sao đã lưu vẫn được giữ nguyên.');
  }
  questionHint(auth,playId,input){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');shape(input,['itemId']);const itemId=text(input.itemId,'Mã câu',80);return this.tx(()=>{const{session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');const result=protocolHint(session,pack,this.events(auth,playId),itemId);this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);return result;});}
  recordAudioDelivery(auth,playId,itemId,mediaId,durationMs){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh.');text(playId,'Mã lượt',100);text(itemId,'Mã câu',80);return this.tx(()=>{const{session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);if(session.status!=='active'||session.questionProtocolVersion!==1||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi cần được mở lại.');protocolAudioDelivery(session,pack,this.events(auth,playId),itemId,mediaId,durationMs);this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);});}
  openQuestion(auth,playId,input,requireProtocol=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,['itemId','openedAt']);const itemId=text(input.itemId,'Mã câu',80);
    const openedTime=input.openedAt?Date.parse(input.openedAt):Date.now();
    return this.tx(()=>{
      const{session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);
      if(session.status!=='active'||Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã kết thúc hoặc quá hạn.');
      if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');
      if(session.questionProtocolVersion===1){
        const item = pack.items?.find(row => row.id === itemId);
        const hasOptions = Array.isArray(item?.options) && item.options.length > 1;
        const lastPos = hasOptions
          ? (session.questionPresentations?.[itemId]?.displayedCorrectIndex ?? this.lastQuestionCorrectPosition(auth.workspaceId, auth.studentId, itemId, pack.version, session.packId))
          : null;
        const receipt=openProtocolQuestion(session,pack,this.events(auth,playId),itemId,openedTime,lastPos);
        const currentPos = session.questionPresentations?.[itemId]?.displayedCorrectIndex;
        if (Number.isInteger(currentPos)) {
          this.recordQuestionCorrectPosition(auth.workspaceId, auth.studentId, itemId, pack.version, currentPos);
        }
        session.presentationsById ??= {};
        if (session.questionPresentations?.[itemId]) {
          session.presentationsById[session.questionPresentations[itemId].presentationId] = session.questionPresentations[itemId];
        }
        this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);
        return receipt;
      }
      const presentation=onlinePresentation(session.moduleId,pack),item=presentation?.items.find(item=>item.id===itemId);
      if(!timedQuestion(session,presentation)||!item||!session.requiredItemIds?.includes(itemId))fail(400,'Câu hỏi không dùng bộ đếm thời gian của lượt chơi này.');
      const clock=session.questionClocks??{},openedAt=Object.hasOwn(clock,itemId)?clock[itemId]:(input.openedAt||now());if(!Object.hasOwn(clock,itemId)){
        Object.defineProperty(clock,itemId,{value:openedAt,enumerable:true,writable:true,configurable:true});session.questionClocks=clock;this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(session),auth.workspaceId,playId);
      }
      return{openedAt,serverNow:now(),...questionRewardThresholds(item)};
    });
  }
  events(auth,playId){return this.db.prepare('SELECT json FROM attempts WHERE workspace_id=? AND play_id=? ORDER BY rowid').all(auth.workspaceId,playId).map(row=>parse(row.json));}
  attempt(auth,playId,input,requireProtocol=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');shape(input,['attemptKey','itemId','response','hintsUsed','elapsedMs','presentationId']);const key=text(input.attemptKey,'Mã lần trả lời',120);if(!/^[a-zA-Z0-9._:-]+$/.test(key))fail(400,'Mã lần trả lời không hợp lệ.');
    const itemId=text(input.itemId,'Mã câu',80),hintsUsed=integer(input.hintsUsed??0,'Số gợi ý',0,20),hash=digest({key,itemId,response:input.response,hintsUsed});
    return this.tx(()=>{const {session,pack}=this.play(auth,playId);this.assertCurrentPlay(auth,session);if(requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');const prior=this.db.prepare('SELECT payload_hash,json FROM attempts WHERE workspace_id=? AND play_id=? AND attempt_key=?').get(auth.workspaceId,playId,key);
      if(prior){if(prior.payload_hash!==hash)fail(409,'Lần trả lời đã được lưu với đáp án khác.');if(session.status==='abandoned')fail(409,'Lượt chơi đã thoát.');const event=parse(prior.json);let questionRewards;
        if(session.rewardPolicyVersion===2){let questions=[];if(event.correct){const row=this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? AND pack_id=?').get(auth.workspaceId,auth.studentId,pack.id),reward=row?parse(row.json):null,touched=new Set(onlineScoreResponse(pack,session.moduleId,event.itemId,event.response).touchedItemIds);questions=questionRewardProgress(pack,reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0)).questions.filter(question=>touched.has(question.itemId));}questionRewards={gained:0,questions};}
        return{event:{...event,response:input.response},duplicate:true,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};}
      if(session.status!=='active')fail(409,'Lượt chơi đã kết thúc hoặc được thay bằng lượt mới ở thiết bị khác.');
      if(Date.now()-Date.parse(session.startedAt)>86400000)fail(409,'Lượt chơi đã quá hạn. Hãy mở lượt mới.');
      const events=this.events(auth,playId);if(events.length>=5000)fail(400,'Lượt chơi đã đạt giới hạn số lần thử.');
      const item=pack.items.find(row=>row.id===itemId);if(!item)fail(400,'Câu hỏi không thuộc lượt chơi.');
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
      this.db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?)').run(auth.workspaceId,playId,key,hash,json(event));
      this.onAttemptRecorded(auth, session, event, pack);
      let questionRewards=session.rewardPolicyVersion===2?{gained:0,questions:[]}:undefined;if(session.rewardPolicyVersion===2&&outcome.correct){const previous=this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? AND pack_id=?').get(auth.workspaceId,auth.studentId,pack.id),reward=previous?parse(previous.json):null;
        const result=applyQuestionRewardCandidates(reward?.questionLedger??initializeQuestionRewardLedger(pack.id,reward?.starTier??0),questionRewardCandidates(session,[...events,event],pack)),progress=questionRewardProgress(pack,result.ledger),tier=Math.max(1,progress.bestTier);
        if(!reward||json(reward.questionLedger)!==json(result.ledger)){const award={...(reward??{profileId:auth.studentId,packId:pack.id,sessionId:session.sessionId,completedAt:event.occurredAt,totalItems:pack.items.length,firstTryCorrect:0}),starTier:tier,questionLedger:result.ledger};this.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json').run(auth.workspaceId,auth.studentId,pack.id,tier,json(award));}
        const touched=new Set(outcome.touchedItemIds);questionRewards={gained:result.gained,questions:progress.questions.filter(question=>touched.has(question.itemId))};
      }return{event:{...event,response:input.response},duplicate:false,...(session.questionProtocolVersion===1&&event.correct?{feedback:answerFeedback(pack,session,event)}:{}),...(questionRewards?{questionRewards}:{})};
    });}
  finishPlay(auth,playId,abandon=false,compact=false,requireProtocol=false){if(auth.role!=='student')fail(403,'Hãy dùng tài khoản học sinh để vào luyện tập.');return this.tx(()=>{const{session,pack}=this.play(auth,playId);if(!abandon)this.assertCurrentPlay(auth,session);if(!abandon&&requireProtocol&&session.questionProtocolVersion!==1)fail(409,'Lượt cũ cần mở lại trên ứng dụng mới. Sao đã lưu vẫn được giữ.');if(session.status==='abandoned'){if(abandon)return{};fail(409,'Lượt chơi đã thoát.');}
    if(session.status==='completed')return{state:compact?this.studentSummary(auth,'current'):this.studentState(auth),gained:0,tier:this.rewards(auth,auth.studentId).find(row=>row.packId===pack.id)?.starTier??0};
    const completed={...session,status:abandon?'abandoned':'completed',endedAt:now()},events=this.events(auth,playId);let gained=0,tier=0;
    if(!abandon){const errors=session.rewardPolicyVersion===2?v2QuestionCompletionErrors(completed,events,pack):onlineEvidenceErrors(completed,events,pack,true);if(errors.length)fail(400,errors[0]);const previous=this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? AND pack_id=?').get(auth.workspaceId,auth.studentId,pack.id),prior=previous?parse(previous.json):null;
      if(session.rewardPolicyVersion===2){tier=questionRewardProgress(pack,prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0)).bestTier;}
      else{const award=onlineAward(completed,events,pack);if(!award)fail(400,'Chưa đủ dữ liệu để xác nhận sao.');const legacyStars=Math.max(award.starTier,prior?.questionLedger?.legacyStars??prior?.starTier??0),result=applyQuestionRewardCandidates(prior?.questionLedger??initializeQuestionRewardLedger(pack.id,prior?.starTier??0),[],legacyStars);gained=result.gained;tier=legacyStars;
        const value={...award,starTier:Math.max(1,questionRewardProgress(pack,result.ledger).bestTier),questionLedger:result.ledger};this.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,student_id,pack_id) DO UPDATE SET tier=excluded.tier,json=excluded.json').run(auth.workspaceId,auth.studentId,pack.id,value.starTier,json(value));this.syncAwardMaterial(auth,auth.studentId,pack.id,value.starTier);
      }
    }
    this.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(json(completed),auth.workspaceId,playId);this.audit(auth,abandon?'play.abandon':'play.complete',playId);
    if(!abandon){
      this.onPlayCompleted(auth, session, pack, events, completed.endedAt);
    }
    return abandon?{}:{state:compact?this.studentSummary(auth,'current'):this.studentState(auth),gained,tier};
  });}
  configureWallet(auth,input){shape(input,['enabled','rateVnd']);if(typeof input.enabled!=='boolean')fail(400,'Trạng thái đổi sao không hợp lệ.');const rate=integer(input.rateVnd,'Giá trị mỗi sao',1,1000000);
    return this.tx(()=>{this.db.prepare('UPDATE workspaces SET wallet_enabled=?,rate_vnd=? WHERE id=?').run(Number(input.enabled),rate,auth.workspaceId);this.audit(auth,'wallet.configure',auth.workspaceId);return{enabled:input.enabled,rateVnd:rate};});}
  requestReward(auth,input){shape(input,['requestId','title','goalVnd']);text(input.requestId,'Mã yêu cầu',100);text(input.title,'Tên phần thưởng',120);integer(input.goalVnd,'Mục tiêu',1,100000000);return this.tx(()=>{this.student(auth,auth.studentId);const workspace=this.workspace(auth.workspaceId),prior=this.db.prepare('SELECT student_id FROM redemptions WHERE workspace_id=? AND id=?').get(auth.workspaceId,input.requestId);if(prior&&prior.student_id!==auth.studentId)fail(409,'Mã yêu cầu không thể sử dụng.');
    const wallet={schemaVersion:1,enabled:!!workspace.wallet_enabled,rateVnd:workspace.rate_vnd,updatedAt:now(),requests:this.requests(auth,auth.studentId)};let request;
    try{request=makeRewardRequest(wallet,this.balance(auth,auth.studentId).earned,input,now());}catch(error){fail(400,error.message);}
    this.db.prepare('INSERT OR IGNORE INTO redemptions VALUES(?,?,?,?,?)').run(auth.workspaceId,request.requestId,auth.studentId,rewardStatus(request),json(request));this.audit(auth,'redemption.request',request.requestId);return request;
  });}
  publicGift(row){
    return{id:row.id,workspaceId:row.workspace_id,classId:row.class_id,title:row.title,imageMediaId:row.image_media_id,priceStars:row.price_stars,kind:row.kind,weeklyLimit:row.weekly_limit,stock:row.stock,unlockAfterWeek:row.unlock_after_week,active:!!row.active,sortOrder:row.sort_order,createdAt:row.created_at,...presetGiftDetails(row.id)};
  }
  installGiftPreset(auth,input){
    role(auth,'admin');shape(input,[]);
    return this.tx(()=>{
      let created=0;const at=now();
      for(const [index,item] of BAO_AN_GIFT_PRESET.entries()){
        if(this.db.prepare('SELECT 1 FROM gift_catalog WHERE workspace_id=? AND id=?').get(auth.workspaceId,item.id))continue;
        this.db.prepare('INSERT INTO gift_catalog(workspace_id,id,class_id,title,image_media_id,price_stars,kind,weekly_limit,stock,unlock_after_week,active,sort_order,created_at) VALUES(?,?,NULL,?,NULL,?,\'item\',0,-1,0,1,?,?)').run(auth.workspaceId,item.id,item.title,item.priceStars,index,at);created++;
      }
      this.db.prepare('UPDATE workspaces SET rate_vnd=? WHERE id=?').run(BAO_AN_GIFT_RATE_VND,auth.workspaceId);
      this.audit(auth,'gift.preset.install',BAO_AN_GIFT_PRESET_ID);
      return{created,kept:BAO_AN_GIFT_PRESET.length-created,rateVnd:BAO_AN_GIFT_RATE_VND};
    });
  }
  gifts(auth,classId=null){
    if(auth.role==='student'){
      const student=this.student(auth,auth.studentId);
      return this.db.prepare('SELECT * FROM gift_catalog WHERE workspace_id=? AND active=1 AND (class_id IS NULL OR class_id=?) ORDER BY sort_order ASC, created_at DESC').all(auth.workspaceId,student.class_id).map(r=>this.publicGift(r));
    }
    const query=classId?'SELECT * FROM gift_catalog WHERE workspace_id=? AND (class_id IS NULL OR class_id=?) ORDER BY sort_order ASC, created_at DESC':'SELECT * FROM gift_catalog WHERE workspace_id=? ORDER BY sort_order ASC, created_at DESC';
    const params=classId?[auth.workspaceId,classId]:[auth.workspaceId];
    return this.db.prepare(query).all(...params).map(r=>this.publicGift(r));
  }
  createGift(auth,input){
    if(auth.role!=='admin')fail(403,'Chỉ quản trị viên mới có quyền tạo phần thưởng.');
    shape(input,['title','priceStars','kind','classId','imageMediaId','weeklyLimit','stock','unlockAfterWeek','active','sortOrder']);
    const title=text(input.title,'Tên phần thưởng',120),priceStars=integer(input.priceStars,'Giá sao',1,100000),kind=['item','experience','privilege','saving'].includes(input.kind)?input.kind:'item';
    const classId=input.classId?text(input.classId,'Lớp',100):null;if(classId)this.class(auth,classId);
    const imageMediaId=input.imageMediaId?text(input.imageMediaId,'Ảnh phần thưởng',100):null;
    const weeklyLimit=(input.weeklyLimit!==undefined&&input.weeklyLimit!==null)?integer(input.weeklyLimit,'Giới hạn tuần',0,100):0;
    const stock=(input.stock!==undefined&&input.stock!==null)?integer(input.stock,'Tồn kho',-1,1000000):-1;
    const unlockAfterWeek=(input.unlockAfterWeek!==undefined&&input.unlockAfterWeek!==null)?integer(input.unlockAfterWeek,'Mở sau tuần',0,100):0;
    const active=input.active!==undefined?(input.active?1:0):1;
    const sortOrder=(input.sortOrder!==undefined&&input.sortOrder!==null)?integer(input.sortOrder,'Thứ tự',-1000,1000):0;
    const giftId=id(),createdAt=now();
    this.db.prepare('INSERT INTO gift_catalog(workspace_id,id,class_id,title,image_media_id,price_stars,kind,weekly_limit,stock,unlock_after_week,active,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(auth.workspaceId,giftId,classId,title,imageMediaId,priceStars,kind,weeklyLimit,stock,unlockAfterWeek,active,sortOrder,createdAt);
    this.audit(auth,'gift.create',giftId);
    return this.publicGift({workspace_id:auth.workspaceId,id:giftId,class_id:classId,title,image_media_id:imageMediaId,price_stars:priceStars,kind,weekly_limit:weeklyLimit,stock,unlock_after_week:unlockAfterWeek,active,sort_order:sortOrder,created_at:createdAt});
  }
  updateGift(auth,giftId,input){
    if(auth.role!=='admin')fail(403,'Chỉ quản trị viên mới có quyền cập nhật phần thưởng.');
    text(giftId,'Mã phần thưởng',100);
    const existing=this.db.prepare('SELECT * FROM gift_catalog WHERE workspace_id=? AND id=?').get(auth.workspaceId,giftId);
    if(!existing)fail(404,'Không tìm thấy phần thưởng.');
    const title=input.title!==undefined?text(input.title,'Tên phần thưởng',120):existing.title;
    const priceStars=input.priceStars!==undefined?integer(input.priceStars,'Giá sao',1,100000):existing.price_stars;
    const kind=input.kind!==undefined?(['item','experience','privilege','saving'].includes(input.kind)?input.kind:existing.kind):existing.kind;
    const classId=input.classId!==undefined?(input.classId?text(input.classId,'Lớp',100):null):existing.class_id;
    if(classId)this.class(auth,classId);
    const imageMediaId=input.imageMediaId!==undefined?(input.imageMediaId?text(input.imageMediaId,'Ảnh phần thưởng',100):null):existing.image_media_id;
    const weeklyLimit=(input.weeklyLimit!==undefined&&input.weeklyLimit!==null)?integer(input.weeklyLimit,'Giới hạn tuần',0,100):(input.weeklyLimit===null?0:existing.weekly_limit);
    const stock=(input.stock!==undefined&&input.stock!==null)?integer(input.stock,'Tồn kho',-1,1000000):(input.stock===null?-1:existing.stock);
    const unlockAfterWeek=(input.unlockAfterWeek!==undefined&&input.unlockAfterWeek!==null)?integer(input.unlockAfterWeek,'Mở sau tuần',0,100):(input.unlockAfterWeek===null?0:existing.unlock_after_week);
    const active=input.active!==undefined?(input.active?1:0):existing.active;
    const sortOrder=(input.sortOrder!==undefined&&input.sortOrder!==null)?integer(input.sortOrder,'Thứ tự',-1000,1000):(input.sortOrder===null?0:existing.sort_order);
    this.db.prepare('UPDATE gift_catalog SET class_id=?,title=?,image_media_id=?,price_stars=?,kind=?,weekly_limit=?,stock=?,unlock_after_week=?,active=?,sort_order=? WHERE workspace_id=? AND id=?').run(classId,title,imageMediaId,priceStars,kind,weeklyLimit,stock,unlockAfterWeek,active,sortOrder,auth.workspaceId,giftId);
    this.audit(auth,'gift.update',giftId);
    return this.publicGift({workspace_id:auth.workspaceId,id:giftId,class_id:classId,title,image_media_id:imageMediaId,price_stars:priceStars,kind,weekly_limit:weeklyLimit,stock,unlock_after_week:unlockAfterWeek,active,sort_order:sortOrder,created_at:existing.created_at});
  }
  studentGoal(auth,studentId=auth.studentId){
    const row=this.db.prepare('SELECT * FROM student_goals WHERE workspace_id=? AND student_id=?').get(auth.workspaceId,studentId);
    if(!row)return null;
    const giftRow=this.db.prepare('SELECT * FROM gift_catalog WHERE workspace_id=? AND id=?').get(auth.workspaceId,row.gift_id);
    return{studentId:row.student_id,giftId:row.gift_id,pinnedAt:row.pinned_at,gift:giftRow?this.publicGift(giftRow):undefined};
  }
  setStudentGoal(auth,giftId){
    if(auth.role!=='student')fail(403,'Chỉ học sinh mới có thể ghim mục tiêu.');
    text(giftId,'Mã phần thưởng',100);
    const student=this.student(auth,auth.studentId);
    const gift=this.db.prepare('SELECT * FROM gift_catalog WHERE workspace_id=? AND id=? AND active=1 AND (class_id IS NULL OR class_id=?)').get(auth.workspaceId,giftId,student.class_id);
    if(!gift)fail(404,'Không tìm thấy phần thưởng khả dụng.');
    const pinnedAt=now();
    this.db.prepare('INSERT INTO student_goals(workspace_id,student_id,gift_id,pinned_at) VALUES(?,?,?,?) ON CONFLICT(workspace_id,student_id) DO UPDATE SET gift_id=excluded.gift_id,pinned_at=excluded.pinned_at').run(auth.workspaceId,student.id,giftId,pinnedAt);
    this.audit(auth,'student.goal.pin',giftId);
    return{studentId:student.id,giftId,pinnedAt,gift:this.publicGift(gift)};
  }
  redeemGift(auth,input){
    if(auth.role!=='student')fail(403,'Chỉ học sinh mới có thể đổi quà.');
    shape(input,['requestId','giftId']);
    const requestId=text(input.requestId,'Mã yêu cầu',100),giftId=text(input.giftId,'Mã quà tặng',100);
    return this.tx(()=>{
      const student=this.student(auth,auth.studentId);
      const prior=this.db.prepare('SELECT student_id FROM redemptions WHERE workspace_id=? AND id=?').get(auth.workspaceId,requestId);
      if(prior){
        if(prior.student_id!==auth.studentId)fail(409,'Mã yêu cầu không thể sử dụng.');
        return parse(this.db.prepare('SELECT json FROM redemptions WHERE workspace_id=? AND id=?').get(auth.workspaceId,requestId).json);
      }
      const gift=this.db.prepare('SELECT * FROM gift_catalog WHERE workspace_id=? AND id=? AND active=1 AND (class_id IS NULL OR class_id=?)').get(auth.workspaceId,giftId,student.class_id);
      if(!gift)fail(404,'Món quà không tồn tại hoặc đã ngừng áp dụng.');
      if(gift.stock===0)fail(409,'Món quà đã hết hàng trong kho.');
      if(gift.unlock_after_week>0){
        const marker=this.journeyMarker(auth,student);
        const currentPos=marker?marker.position:1;
        if(currentPos<gift.unlock_after_week)fail(403,`Món quà này mở khóa sau khi hoàn thành tuần ${gift.unlock_after_week}.`);
      }
      if(gift.weekly_limit>0){
        const studentRequests=this.requests(auth,auth.studentId);
        const oneWeekAgo=new Date(Date.now()-7*86400000).toISOString();
        const countInWeek=studentRequests.filter(r=>r.giftId===giftId&&r.requestedAt>=oneWeekAgo&&['pending','approved','fulfilled'].includes(rewardStatus(r))).length;
        if(countInWeek>=gift.weekly_limit)fail(400,`Con đã đạt giới hạn đổi món quà này (${gift.weekly_limit} lần/tuần).`);
      }
      const balance=this.balance(auth,auth.studentId);
      if(balance.available<gift.price_stars)fail(400,`Con cần ${gift.price_stars} sao nhưng chỉ có ${balance.available} sao khả dụng.`);
      if(gift.stock>0){
        this.db.prepare('UPDATE gift_catalog SET stock=stock-1 WHERE workspace_id=? AND id=?').run(auth.workspaceId,giftId);
      }
      const workspace=this.workspace(auth.workspaceId),currentTime=now();
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
      this.db.prepare('INSERT INTO redemptions(workspace_id,id,student_id,status,json) VALUES(?,?,?,?,?)').run(auth.workspaceId,requestId,auth.studentId,'pending',json(request));
      this.audit(auth,'redemption.request',requestId);
      return request;
    });
  }
  confirmReceived(auth,requestId){
    if(auth.role!=='student')fail(403,'Chỉ học sinh mới có thể xác nhận đã nhận quà.');
    text(requestId,'Mã yêu cầu',100);
    return this.tx(()=>{
      const row=this.db.prepare('SELECT * FROM redemptions WHERE workspace_id=? AND id=? AND student_id=?').get(auth.workspaceId,requestId,auth.studentId);
      if(!row)fail(404,'Không tìm thấy yêu cầu đổi thưởng.');
      const request=parse(row.json);
      if(request.receivedAt)return request;
      const status=rewardStatus(request);
      if(status!=='fulfilled'&&status!=='approved')fail(400,'Chỉ có thể xác nhận khi quà đã được trao hoặc duyệt.');
      request.receivedAt=now();
      this.db.prepare('UPDATE redemptions SET json=? WHERE workspace_id=? AND id=?').run(json(request),auth.workspaceId,requestId);
      this.audit(auth,'redemption.received',requestId);
      return request;
    });
  }
  transitionReward(auth,requestId,input,cancel=false,parentToken=null){shape(input,cancel?[]:['status','note']);return this.tx(()=>{const row=this.db.prepare('SELECT * FROM redemptions WHERE workspace_id=? AND id=?').get(auth.workspaceId,requestId);if(!row||cancel&&row.student_id!==auth.studentId)fail(404,'Không tìm thấy yêu cầu đổi sao.');
    if(cancel&&auth.role!=='student')fail(403,'Chỉ học sinh được hủy yêu cầu của mình.');
    if(auth.role==='parent'){
      const linked=this.db.prepare('SELECT 1 FROM parent_students WHERE workspace_id=? AND parent_user_id=? AND student_id=?').get(auth.workspaceId,auth.id,row.student_id);
      if(!linked)fail(403,'Phụ huynh chỉ có thể duyệt quà cho con của mình.');
    }else if(auth.role==='student'&&!cancel){
      const raw=this.rawParentControls(auth.workspaceId,row.student_id);
      if(auth.studentId!==row.student_id||!raw.pinHash||!parentToken||!verifyParentElevationToken(parentToken,{userId:auth.id,studentId:row.student_id,workspaceId:auth.workspaceId,pinHash:raw.pinHash,sessionHash:auth.tokenHash}))fail(403,'Vui lòng xác thực mã PIN phụ huynh của học sinh này trước.');
    }else if(auth.role!=='admin'&&!cancel)fail(403,'Chỉ giáo viên hoặc phụ huynh mới có quyền duyệt quà.');
    const status=cancel?'cancelled':input.status;if(!['approved','rejected','fulfilled','cancelled'].includes(status)||!cancel&&status==='cancelled')fail(400,'Trạng thái đổi thưởng không hợp lệ.');
    const previous=parse(row.json);
    if(rewardStatus(previous)===status)return previous;
    let request;try{request=changeRewardRequest(previous,status,now(),input.note);}catch(error){fail(409,error.message);}
    if(['cancelled','rejected'].includes(status)&&previous.giftId){
      const gift=this.db.prepare('SELECT stock FROM gift_catalog WHERE workspace_id=? AND id=?').get(auth.workspaceId,previous.giftId);
      if(gift&&gift.stock>=0){
        this.db.prepare('UPDATE gift_catalog SET stock=stock+1 WHERE workspace_id=? AND id=?').run(auth.workspaceId,previous.giftId);
      }
    }
    this.db.prepare('UPDATE redemptions SET status=?,json=? WHERE workspace_id=? AND id=?').run(status,json(request),auth.workspaceId,requestId);
    this.audit(auth,`redemption.${status}`,requestId);
    if (status === 'fulfilled') {
      try {
        const giftTitle = previous?.title || request?.title || 'Quà tặng';
        this.recordIntegrationEvent(auth.workspaceId, row.student_id, 'gift_delivered', {
          giftTitle
        });
      } catch {}
    }
    return request;
  });}
  studentStreak(auth, studentId = auth.studentId, nowIso = now()){
    const row = this.db.prepare('SELECT * FROM student_streaks WHERE workspace_id=? AND student_id=?').get(auth.workspaceId, studentId);
    return computeStreakState(row, nowIso);
  }
  recordDailyActivity(auth, studentId, wasCorrect, nowIso = now()){
    const row = this.db.prepare('SELECT * FROM student_streaks WHERE workspace_id=? AND student_id=?').get(auth.workspaceId, studentId);
    const {newStreakRecord, streakIncreased} = registerDailyCorrectAnswer(row, wasCorrect, nowIso);
    this.db.prepare(`
      INSERT INTO student_streaks(workspace_id, student_id, current_streak, longest_streak, last_active_date, freeze_used_week, today_correct_count, today_date, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(workspace_id, student_id) DO UPDATE SET
        current_streak=excluded.current_streak,
        longest_streak=excluded.longest_streak,
        last_active_date=excluded.last_active_date,
        freeze_used_week=excluded.freeze_used_week,
        today_correct_count=excluded.today_correct_count,
        today_date=excluded.today_date,
        updated_at=excluded.updated_at
    `).run(
      auth.workspaceId,
      studentId,
      newStreakRecord.current_streak,
      newStreakRecord.longest_streak,
      newStreakRecord.last_active_date,
      newStreakRecord.freeze_used_week,
      newStreakRecord.today_correct_count,
      newStreakRecord.today_date,
      nowIso
    );
    if(streakIncreased){
      this.audit(auth, 'student.streak.increase', json({studentId, streak: newStreakRecord.current_streak}));
    }
    return newStreakRecord;
  }
  studentDailyMissions(auth, studentId = auth.studentId, nowIso = now()){
    const today = toVietnamDateString(nowIso);
    let rows = this.db.prepare('SELECT * FROM daily_missions WHERE workspace_id=? AND student_id=? AND date=?').all(auth.workspaceId, studentId, today);
    if(!rows.length){
      const defaults = buildDailyMissions(today);
      for(const m of defaults){
        this.db.prepare('INSERT OR IGNORE INTO daily_missions VALUES(?,?,?,?,?,?,?,?,?,?)').run(
          auth.workspaceId, studentId, today, m.id, m.type, m.targetCount, 0, 0, null, '{}'
        );
      }
      rows = this.db.prepare('SELECT * FROM daily_missions WHERE workspace_id=? AND student_id=? AND date=?').all(auth.workspaceId, studentId, today);
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
  updateDailyMissionProgress(auth, studentId, missionType, delta = 1, nowIso = now()){
    const today = toVietnamDateString(nowIso);
    this.studentDailyMissions(auth, studentId, nowIso);
    const row = this.db.prepare('SELECT * FROM daily_missions WHERE workspace_id=? AND student_id=? AND date=? AND mission_type=?').get(auth.workspaceId, studentId, today, missionType);
    if(row && !row.completed){
      const progress = row.progress_count + delta;
      const completed = progress >= row.target_count ? 1 : 0;
      const completedAt = completed ? nowIso : null;
      this.db.prepare('UPDATE daily_missions SET progress_count=?, completed=?, completed_at=? WHERE workspace_id=? AND student_id=? AND date=? AND mission_type=?').run(
        progress, completed, completedAt, auth.workspaceId, studentId, today, missionType
      );
      if(completed){
        this.audit(auth, 'student.mission.complete', json({studentId, missionType, date: today}));
      }
    }
  }
  studentDailyRiddle(auth, studentId = auth.studentId, classId = null, nowIso = now()){
    const targetStudent = this.student(auth, studentId);
    const targetClassId = classId || targetStudent.class_id;
    const today = toVietnamDateString(nowIso);
    const packRows = this.db.prepare(`
      SELECT p.json FROM week_sets s
      JOIN weeks w ON w.workspace_id=s.workspace_id AND w.id=s.week_id
      JOIN packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version
      WHERE s.workspace_id=? AND w.class_id=?
      ORDER BY w.position, s.position
    `).all(auth.workspaceId, targetClassId);
    if(!packRows.length) return null;
    const allItems = [];
    for(const row of packRows){
      let pack;
      try { pack = parse(row.json); } catch { continue; }
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
    if(!allItems.length) return null;
    const seed = `${today}:${targetClassId}`;
    let hashVal = 0;
    for(let i=0; i<seed.length; i++){
      hashVal = ((hashVal << 5) - hashVal) + seed.charCodeAt(i);
      hashVal |= 0;
    }
    const chosen = allItems[Math.abs(hashVal) % allItems.length];
    const missionRow = this.db.prepare('SELECT completed FROM daily_missions WHERE workspace_id=? AND student_id=? AND date=? AND mission_type=?').get(auth.workspaceId, studentId, today, 'daily_riddle');
    return {
      packId: chosen.packId,
      packTitle: chosen.packTitle,
      itemId: chosen.item.id,
      prompt: chosen.item.prompt || chosen.item.title || 'Câu hỏi đố vui',
      options: chosen.item.options || [],
      correctIndex: chosen.item.correctIndex ?? 0,
      explanation: chosen.item.explanation || 'Rất chính xác!',
      alreadySolved: !!missionRow?.completed
    };
  }
  answerDailyRiddle(auth, input, nowIso = now()){
    if(auth.role!=='student') fail(403, 'Hãy dùng tài khoản học sinh để trả lời câu đố.');
    shape(input, ['chosenIndex']);
    const chosenIndex = integer(input.chosenIndex, 'Đáp án lựa chọn', 0, 10);
    return this.tx(()=>{
      const student = this.student(auth, auth.studentId);
      const riddle = this.studentDailyRiddle(auth, student.id, student.class_id, nowIso);
      if(!riddle) fail(404, 'Hôm nay chưa có câu đố ngày.');
      const correct = chosenIndex === riddle.correctIndex;
      if(correct){
        this.updateDailyMissionProgress(auth, student.id, 'daily_riddle', 1, nowIso);
        this.recordDailyActivity(auth, student.id, true, nowIso);
        this.evaluateAndAwardBadges(auth, student.id, nowIso);
      }
      return {
        correct,
        alreadySolved: correct || riddle.alreadySolved,
        streak: this.studentStreak(auth, student.id, nowIso),
        missions: this.studentDailyMissions(auth, student.id, nowIso)
      };
    });
  }
  awardBadge(auth, studentId, badgeId, metadata = {}, nowIso = now()){
    const exists = this.db.prepare('SELECT 1 FROM badge_awards WHERE workspace_id=? AND student_id=? AND badge_id=?').get(auth.workspaceId, studentId, badgeId);
    if(exists) return false;
    this.db.prepare('INSERT OR IGNORE INTO badge_awards VALUES(?,?,?,?,?)').run(
      auth.workspaceId, studentId, badgeId, nowIso, json(metadata)
    );
    this.audit(auth, 'student.badge.award', json({studentId, badgeId}));
    try {
      const badgeDef = BADGE_CATALOG.find(b => b.id === badgeId);
      const title = metadata?.title || badgeDef?.title || (badgeId === CONTESTANT_BADGE?.id ? CONTESTANT_BADGE.title : badgeId);
      this.recordIntegrationEvent(auth.workspaceId, studentId, 'badge_unlocked', {
        badgeId,
        title
      });
    } catch {}
    return true;
  }
  studentBadges(auth, studentId = auth.studentId, nowIso = now()){
    const earnedRows = this.db.prepare('SELECT badge_id, unlocked_at, json FROM badge_awards WHERE workspace_id=? AND student_id=?').all(auth.workspaceId, studentId);
    const earnedBadges = earnedRows.map(r=>({badgeId: r.badge_id, unlockedAt: r.unlocked_at, json: r.json}));
    const metrics = this.computeStudentMetrics(auth, studentId, nowIso);
    const evaluated = buildStudentBadgeStatuses(earnedBadges, metrics);
    for(const b of evaluated){
      if(b.currentProgress >= b.targetCount && !earnedBadges.some(e=>e.badgeId === b.id)){
        this.awardBadge(auth, studentId, b.id, {progress: b.currentProgress}, nowIso);
        b.unlocked = true;
        b.unlockedAt = nowIso;
        b.missingRequirement = 'Đã mở khóa huy hiệu!';
      }
    }
    return evaluated;
  }
  computeStudentMetrics(auth, studentId, nowIso = now()){
    const streak = this.studentStreak(auth, studentId, nowIso);
    const attemptRows = this.db.prepare(`
      SELECT a.json AS json FROM attempts a
      JOIN plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id
      WHERE p.workspace_id=? AND p.student_id=?
      ORDER BY a.play_id, a.attempt_key
    `).all(auth.workspaceId, studentId);
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
    const playRows = this.db.prepare('SELECT id, json FROM plays WHERE workspace_id=? AND student_id=?').all(auth.workspaceId, studentId);
    const completedPlays = playRows.map(r=>{try{return {id: r.id, ...parse(r.json)};}catch{return null;}}).filter(p=>p && p.status==='completed');
    const completedPacksCount = completedPlays.length;
    const distinctGamesPlayed = new Set(completedPlays.map(p=>p.moduleId)).size;
    let perfectMemoryCount = 0;
    for(const p of completedPlays){
      if(p.moduleId === 'memory-match' && p.id){
        const pEvents = this.db.prepare('SELECT json FROM attempts WHERE workspace_id=? AND play_id=?').all(auth.workspaceId, p.id).map(r=>{try{return parse(r.json);}catch{return null;}}).filter(Boolean);
        const wrongMoves = pEvents.filter(e=>!e.correct);
        if(wrongMoves.length === 0 && pEvents.length > 0){
          perfectMemoryCount++;
        }
      }
    }
    const awardRows = this.db.prepare('SELECT pack_id, tier, json FROM awards WHERE workspace_id=? AND student_id=?').all(auth.workspaceId, studentId);
    let mathPacks3Star = 0;
    let vietnamesePacks3Star = 0;
    let englishPacks3Star = 0;
    const packSubjects = new Map();
    const packRows = this.db.prepare('SELECT pack_id, json FROM packs WHERE workspace_id=?').all(auth.workspaceId);
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
    const student = this.student(auth, studentId);
    const weekRows = this.db.prepare('SELECT id FROM weeks WHERE workspace_id=? AND class_id=?').all(auth.workspaceId, student.class_id);
    const weekSetRows = this.db.prepare('SELECT week_id, pack_id FROM week_sets WHERE workspace_id=?').all(auth.workspaceId);
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
  onAttemptRecorded(auth, session, event, pack){
    const studentId = session.profileId || auth.studentId;
    this.recordDailyActivity(auth, studentId, !!event.correct, event.occurredAt);
    if(event.correct){
      const priorFail = this.db.prepare(`
        SELECT 1 FROM attempts a
        JOIN plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id
        WHERE p.workspace_id=? AND p.student_id=? AND json_extract(a.json, '$.itemId')=? AND json_extract(a.json, '$.correct')=0
        LIMIT 1
      `).get(auth.workspaceId, studentId, event.itemId);
      if(priorFail){
        this.updateDailyMissionProgress(auth, studentId, 'review_error', 1, event.occurredAt);
      }
    }
    this.evaluateAndAwardBadges(auth, studentId, event.occurredAt);
  }
  onPlayCompleted(auth, session, pack, events, completedAt = now()){
    const studentId = session.profileId || auth.studentId;
    this.updateDailyMissionProgress(auth, studentId, 'new_lesson', 1, completedAt);
    if(session.moduleId === 'memory-match'){
      const wrongMoves = events.filter(e=>!e.correct);
      if(wrongMoves.length === 0 && events.length > 0){
        this.awardBadge(auth, studentId, 'perfect_memory', {earnedAt: completedAt}, completedAt);
      }
    }
    this.evaluateAndAwardBadges(auth, studentId, completedAt);

    // BAO-12: record daily study event if study minutes increased
    try {
      const todayMinutes = this.todayStudentStudyMinutes(auth, studentId);
      if (todayMinutes > 0) {
        const { dateStr } = getVietnamTimeParts();
        const lastEvent = this.db.prepare(`
          SELECT data_json FROM integration_events
          WHERE workspace_id = ? AND student_id = ? AND event_type = 'daily_study'
          ORDER BY rowid DESC LIMIT 1
        `).get(auth.workspaceId, studentId);
        let prevMins = -1;
        if (lastEvent) {
          try {
            const parsed = parse(lastEvent.data_json);
            if (parsed.date === dateStr) prevMins = parsed.minutes;
          } catch {}
        }
        if (todayMinutes > prevMins) {
          this.recordIntegrationEvent(auth.workspaceId, studentId, 'daily_study', {
            date: dateStr,
            minutes: todayMinutes
          });
        }
      }
    } catch {}
  }
  evaluateAndAwardBadges(auth, studentId, nowIso = now()){
    this.studentBadges(auth, studentId, nowIso);
  }
  assertStudentScreenTimeAllowed(auth, studentId){
    const controls = this.rawParentControls(auth.workspaceId, studentId);
    if (!controls) return;
    const curfew = checkCurfewHours(controls.allowedStartHour, controls.allowedEndHour);
    if (!curfew.allowed) fail(403, curfew.reason);
    if (controls.maxMinutesPerDay > 0) {
      const todayMinutes = this.todayStudentStudyMinutes(auth, studentId);
      const limit = checkDailyScreenTime(todayMinutes, controls.maxMinutesPerDay);
      if (!limit.allowed) fail(403, limit.reason);
    }
  }
  todayStudentStudyMinutes(auth, studentId){
    const { dateStr } = getVietnamTimeParts();
    const rows = this.db.prepare('SELECT a.json FROM attempts a JOIN plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id WHERE a.workspace_id=? AND p.student_id=?').all(auth.workspaceId, studentId);
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
  rawParentControls(workspaceId, studentId){
    text(studentId, 'Mã học sinh', 100);
    const row = this.db.prepare('SELECT * FROM parent_controls WHERE workspace_id=? AND student_id=?').get(workspaceId, studentId);
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
  parentControls(auth, studentId){
    return sanitizeParentControls(this.rawParentControls(auth.workspaceId, studentId));
  }
  setupParentPin(auth, studentId, input, parentToken = null){
    shape(input, ['pin', 'oldPin', 'studentId', 'parentToken']);
    const pin = text(input.pin, 'Mã PIN mới', 10);
    if (!/^\d{4,6}$/.test(pin)) fail(400, 'Mã PIN phụ huynh phải gồm từ 4 đến 6 chữ số.');
    this.student(auth, studentId);
    const current = this.rawParentControls(auth.workspaceId, studentId);
    if (auth.role === 'parent') {
      const linked = this.db.prepare('SELECT 1 FROM parent_students WHERE workspace_id=? AND parent_user_id=? AND student_id=?').get(auth.workspaceId, auth.id, studentId);
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
            this.db.prepare('UPDATE parent_controls SET pin_failed_count=?, pin_locked_until=? WHERE workspace_id=? AND student_id=?')
              .run(newFailed, lockedUntil, auth.workspaceId, studentId);
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
    this.db.prepare(`
      INSERT INTO parent_controls(workspace_id, student_id, pin_hash, pin_salt, pin_failed_count, pin_locked_until, max_minutes_per_day, allowed_start_hour, allowed_end_hour, updated_at)
      VALUES(?,?,?,?,0,NULL,?,?,?,?)
      ON CONFLICT(workspace_id, student_id) DO UPDATE SET
        pin_hash=excluded.pin_hash,
        pin_salt=excluded.pin_salt,
        pin_failed_count=0,
        pin_locked_until=NULL,
        updated_at=excluded.updated_at
    `).run(auth.workspaceId, studentId, pinHash, pinSalt, current.maxMinutesPerDay, current.allowedStartHour, current.allowedEndHour, updatedAt);
    revokeParentElevationToken(`${auth.id}:${studentId}`);
    const elevationToken = issueParentElevationToken({
      userId: auth.id,
      studentId,
      workspaceId: auth.workspaceId,
      pinHash,
      sessionHash: auth.tokenHash
    });
    this.audit(auth, 'parent.setup_pin', studentId);
    return { success: true, parentToken: elevationToken };
  }
  verifyParentPin(auth, studentId, pin){
    this.student(auth, studentId);
    if (auth.role === 'student' && auth.studentId !== studentId) fail(403, 'Không có quyền truy cập học sinh khác.');
    if (auth.role === 'parent') {
      const linked = this.db.prepare('SELECT 1 FROM parent_students WHERE workspace_id=? AND parent_user_id=? AND student_id=?').get(auth.workspaceId, auth.id, studentId);
      if (!linked) fail(403, 'Phụ huynh không có quyền truy cập học sinh này.');
    }
    const controls = this.rawParentControls(auth.workspaceId, studentId);
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
      this.db.prepare('UPDATE parent_controls SET pin_failed_count=?, pin_locked_until=? WHERE workspace_id=? AND student_id=?')
        .run(newFailed, lockedUntil, auth.workspaceId, studentId);
      if (lockedUntil) {
        fail(429, 'Bạn đã nhập sai PIN 5 lần. Mã PIN bị tạm khóa 15 phút để bảo vệ tài khoản.');
      }
      fail(403, `Sai mã PIN phụ huynh. Bạn còn ${MAX_PIN_FAILURES - newFailed} lần thử.`);
    }
    this.db.prepare('UPDATE parent_controls SET pin_failed_count=0, pin_locked_until=NULL WHERE workspace_id=? AND student_id=?')
      .run(auth.workspaceId, studentId);
    const parentToken = issueParentElevationToken({
      userId: auth.id,
      studentId,
      workspaceId: auth.workspaceId,
      pinHash: controls.pinHash,
      sessionHash: auth.tokenHash
    });
    this.audit(auth, 'parent.verify_pin', studentId);
    return { success: true, parentToken, studentId };
  }
  updateParentSettings(auth, studentId, input, parentToken = null){
    shape(input, ['maxMinutesPerDay', 'allowedStartHour', 'allowedEndHour', 'studentId', 'parentToken']);
    this.student(auth, studentId);
    if (auth.role === 'parent') {
      const linked = this.db.prepare('SELECT 1 FROM parent_students WHERE workspace_id=? AND parent_user_id=? AND student_id=?').get(auth.workspaceId, auth.id, studentId);
      if (!linked) fail(403, 'Phụ huynh không có quyền thay đổi cài đặt cho học sinh này.');
    } else if (auth.role === 'student') {
      if (auth.studentId !== studentId) fail(403, 'Không có quyền truy cập học sinh khác.');
      const currentRaw = this.rawParentControls(auth.workspaceId, studentId);
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
    const current = this.rawParentControls(auth.workspaceId, studentId);
    const updatedAt = now();
    this.db.prepare(`
      INSERT INTO parent_controls(workspace_id, student_id, pin_hash, pin_salt, pin_failed_count, pin_locked_until, max_minutes_per_day, allowed_start_hour, allowed_end_hour, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(workspace_id, student_id) DO UPDATE SET
        max_minutes_per_day=excluded.max_minutes_per_day,
        allowed_start_hour=excluded.allowed_start_hour,
        allowed_end_hour=excluded.allowed_end_hour,
        updated_at=excluded.updated_at
    `).run(auth.workspaceId, studentId, current.pinHash, current.pinSalt, current.pinFailedCount, current.pinLockedUntil, maxMinutes, startHour, endHour, updatedAt);
    this.audit(auth, 'parent.update_settings', studentId);
    return this.parentControls(auth, studentId);
  }
  createParent(auth, input, passwordHash, username){
    shape(input, ['name', 'username', 'password', 'studentIds']);
    const name = text(input.name, 'Tên phụ huynh', 100);
    const studentIds = input.studentIds;
    if (!Array.isArray(studentIds) || studentIds.length < 1 || studentIds.length > 3) {
      fail(400, 'Tài khoản phụ huynh cần gắn với từ 1 đến 3 học sinh.');
    }
    return this.tx(() => {
      const userId = id(), createdAt = now();
      this.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)')
        .run(userId, auth.workspaceId, username, passwordHash, 'parent', createdAt);
      for (const sId of studentIds) {
        const student = this.student(auth, sId);
        this.db.prepare('INSERT INTO parent_students(workspace_id, parent_user_id, student_id, created_at) VALUES(?,?,?,?)')
          .run(auth.workspaceId, userId, student.id, createdAt);
      }
      return { id: userId, username, name, studentIds };
    });
  }
  parentStudents(auth){
    if (auth.role !== 'parent') fail(403, 'Chỉ phụ huynh mới dùng hàm này.');
    const rows = this.db.prepare('SELECT s.*, c.name AS class_name FROM parent_students ps JOIN students s ON s.workspace_id=ps.workspace_id AND s.id=ps.student_id JOIN classes c ON c.workspace_id=s.workspace_id AND c.id=s.class_id WHERE ps.workspace_id=? AND ps.parent_user_id=?').all(auth.workspaceId, auth.id);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      className: r.class_name,
      grade: r.grade,
      active: !!r.active
    }));
  }
  parentDashboard(auth, studentId, weekId, parentToken = null){
    text(studentId, 'Mã học sinh', 100);
    this.student(auth, studentId);
    if (auth.role === 'parent') {
      const linked = this.db.prepare('SELECT 1 FROM parent_students WHERE workspace_id=? AND parent_user_id=? AND student_id=?').get(auth.workspaceId, auth.id, studentId);
      if (!linked) fail(403, 'Phụ huynh không có quyền xem thông tin học sinh này.');
    } else if (auth.role === 'student') {
      if (auth.studentId !== studentId) fail(403, 'Không có quyền truy cập.');
      const raw = this.rawParentControls(auth.workspaceId, studentId);
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
    const student = this.student(auth, studentId);
    const cls = this.class(auth, student.class_id);
    const controls = this.parentControls(auth, studentId);
    const todayMinutes = this.todayStudentStudyMinutes(auth, studentId);

    let week;
    if (weekId) {
      week = this.db.prepare('SELECT * FROM weeks WHERE workspace_id=? AND id=?').get(auth.workspaceId, weekId);
    }
    if (!week) {
      const marker = this.journeyMarker(auth, student) ?? this.pinJourney(auth, student);
      if (marker) {
        week = this.db.prepare('SELECT * FROM weeks WHERE workspace_id=? AND id=?').get(auth.workspaceId, marker.weekId);
      }
    }
    if (!week) {
      week = this.db.prepare('SELECT * FROM weeks WHERE workspace_id=? AND class_id=? ORDER BY position DESC LIMIT 1').get(auth.workspaceId, student.class_id);
    }

    let weekSets = [];
    if (week) {
      weekSets = this.db.prepare('SELECT s.position, p.* FROM week_sets s JOIN packs p ON p.workspace_id=s.workspace_id AND p.pack_id=s.pack_id AND p.version=s.version WHERE s.workspace_id=? AND s.week_id=? ORDER BY s.position').all(auth.workspaceId, week.id).map(r => ({
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

    const attemptRows = this.db.prepare(`
      SELECT a.json FROM attempts a
      JOIN plays p ON p.workspace_id=a.workspace_id AND p.id=a.play_id
      WHERE a.workspace_id=? AND p.student_id=?
    `).all(auth.workspaceId, studentId);
    const events = attemptRows.map(r => {
      try { return parse(r.json); } catch { return null; }
    }).filter(Boolean);

    const badgeRows = this.db.prepare('SELECT * FROM badge_awards WHERE workspace_id=? AND student_id=?').all(auth.workspaceId, studentId);
    const redRows = this.db.prepare('SELECT * FROM redemptions WHERE workspace_id=? AND student_id=?').all(auth.workspaceId, studentId);

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
      children = this.parentStudents(auth);
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

  startContest(auth, input){
    role(auth, 'student');
    shape(input, ['presetId', 'requestId']);
    const presetId = text(input.presetId, 'Mã ma trận đề', 80);
    const requestId = input.requestId ? text(input.requestId, 'Mã yêu cầu', 100) : null;
    const preset = CONTEST_PRESETS[presetId];
    if (!preset) fail(404, 'Không tìm thấy ma trận đề thi này.');

    this.assertStudentScreenTimeAllowed(auth, auth.studentId);

    return this.tx(() => {
      if (requestId) {
        const prior = this.db.prepare('SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND request_id=?').get(auth.workspaceId, auth.studentId, requestId);
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

      const active = this.db.prepare("SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND preset_id=? AND status='active' ORDER BY created_at DESC LIMIT 1").get(auth.workspaceId, auth.studentId, presetId);
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
          this.submitContest(auth, active.session_id, { answers: parse(active.answers_json || '{}') });
        }
      }

      const sessionId = id();
      const startedAt = now();
      const deadlineAt = new Date(Date.now() + preset.durationSeconds * 1000).toISOString();

      const student = this.student(auth, auth.studentId);
      const weekRows = this.db.prepare('SELECT ws.pack_id, ws.version, p.json FROM week_sets ws JOIN weeks w ON w.workspace_id=ws.workspace_id AND w.id=ws.week_id JOIN packs p ON p.workspace_id=ws.workspace_id AND p.pack_id=ws.pack_id AND p.version=ws.version WHERE ws.workspace_id=? AND w.class_id=?').all(auth.workspaceId, student.class_id);
      const assignedPacks = weekRows.map(r => {
        try { return parse(r.json); } catch { return null; }
      }).filter(Boolean);

      const items = generateContestQuestions(preset, auth.studentId, sessionId, assignedPacks);

      this.db.prepare('INSERT INTO contest_sessions(workspace_id, student_id, session_id, request_id, preset_id, title, subject, grade, duration_seconds, started_at, deadline_at, status, items_json, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
        auth.workspaceId, auth.studentId, sessionId, requestId, presetId, preset.title, preset.subject, preset.grade, preset.durationSeconds, startedAt, deadlineAt, 'active', json(items), startedAt
      );

      this.audit(auth, 'contest.start', json({ sessionId, presetId }));

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

  activeContest(auth){
    role(auth, 'student');
    const row = this.db.prepare("SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND status='active' ORDER BY created_at DESC LIMIT 1").get(auth.workspaceId, auth.studentId);
    if (!row) return { active: false };

    const remainingSeconds = Math.max(0, Math.floor((Date.parse(row.deadline_at) - Date.now()) / 1000));
    if (remainingSeconds <= 0) {
      const res = this.submitContest(auth, row.session_id, { answers: parse(row.answers_json || '{}') });
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

  saveContestProgress(auth, sessionId, input){
    role(auth, 'student');
    text(sessionId, 'Mã lượt thi', 100);
    shape(input, ['answers', 'skippedKeys', 'revision', 'seq']);
    return this.tx(() => {
      const row = this.db.prepare("SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND session_id=? AND status='active'").get(auth.workspaceId, auth.studentId, sessionId);
      if (!row) fail(404, 'Không tìm thấy lượt thi đang làm.');

      const remainingSeconds = Math.max(0, Math.floor((Date.parse(row.deadline_at) - Date.now()) / 1000));
      if (remainingSeconds <= 0) {
        return this.submitContest(auth, sessionId, { answers: input.answers ?? parse(row.answers_json || '{}') });
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
      this.db.prepare('UPDATE contest_sessions SET answers_json=?, skipped_keys=? WHERE workspace_id=? AND session_id=?').run(answersToStore, skipped, auth.workspaceId, sessionId);
      return { success: true, remainingSeconds, answers: mergedAnswers };
    });
  }

  submitContest(auth, sessionId, input = {}){
    role(auth, 'student');
    text(sessionId, 'Mã lượt thi', 100);
    return this.tx(() => {
      const row = this.db.prepare('SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND session_id=?').get(auth.workspaceId, auth.studentId, sessionId);
      if (!row) fail(404, 'Không tìm thấy lượt thi.');

      const preset = CONTEST_PRESETS[row.preset_id];
      const items = parse(row.items_json);

      if (row.status !== 'active') {
        const historyRows = this.db.prepare("SELECT score, max_score, status FROM contest_sessions WHERE workspace_id=? AND student_id=? AND preset_id=? AND status IN ('submitted', 'timeout') ORDER BY created_at DESC").all(auth.workspaceId, auth.studentId, row.preset_id);
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

      this.db.prepare(`
        UPDATE contest_sessions SET
          status=?,
          submitted_at=?,
          score=?,
          max_score=?,
          correct_count=?,
          total_items=?,
          answers_json=?
        WHERE workspace_id=? AND session_id=?
      `).run(finishReason, submittedAt, evaluation.score, evaluation.maxScore, evaluation.correctCount, evaluation.totalItems, json(answers), auth.workspaceId, sessionId);

      try {
        this.recordIntegrationEvent(auth.workspaceId, auth.studentId, 'contest_submitted', {
          sessionId,
          presetId: row.preset_id,
          title: row.title,
          subject: normalizeIntegrationSubject(row.subject),
          score: evaluation.score,
          maxScore: evaluation.maxScore,
          correctCount: evaluation.correctCount,
          totalItems: evaluation.totalItems,
          startedAt: row.started_at,
          submittedAt,
          status: finishReason
        });
      } catch {}

      let badgeAwarded = false;
      const existingBadge = this.db.prepare('SELECT 1 FROM badge_awards WHERE workspace_id=? AND student_id=? AND badge_id=?').get(auth.workspaceId, auth.studentId, CONTESTANT_BADGE.id);
      if (!existingBadge) {
        this.awardBadge(auth, auth.studentId, CONTESTANT_BADGE.id, { title: CONTESTANT_BADGE.title, unlockedAt: submittedAt }, submittedAt);
        badgeAwarded = true;
      }

      this.audit(auth, 'contest.submit', json({ sessionId, score: evaluation.score, maxScore: evaluation.maxScore, finishReason }));

      const historyRows = this.db.prepare("SELECT score, max_score, status FROM contest_sessions WHERE workspace_id=? AND student_id=? AND preset_id=? AND status IN ('submitted', 'timeout') ORDER BY created_at DESC").all(auth.workspaceId, auth.studentId, row.preset_id);
      const readiness = checkReadinessForExam(historyRows.map(r => ({ percent: r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0, passed: (r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0) >= preset.passPercent })));

      return {
        sessionId,
        ...evaluation,
        readyForExam: readiness.readyForExam,
        consecutivePasses: readiness.consecutiveCount,
        badgeAwarded
      };
    });
  }

  contestHistory(auth, studentId = auth.studentId, presetId = null){
    if (auth.role === 'student' && auth.studentId !== studentId) fail(403, 'Không có quyền truy cập.');
    text(studentId, 'Mã học sinh', 100);
    const sql = presetId
      ? "SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND preset_id=? AND status IN ('submitted', 'timeout') ORDER BY created_at DESC"
      : "SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND status IN ('submitted', 'timeout') ORDER BY created_at DESC";
    const params = presetId ? [auth.workspaceId, studentId, presetId] : [auth.workspaceId, studentId];
    const rows = this.db.prepare(sql).all(...params);

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

  contestReviewPack(auth, sessionId){
    role(auth, 'student');
    text(sessionId, 'Mã lượt thi', 100);
    const row = this.db.prepare('SELECT * FROM contest_sessions WHERE workspace_id=? AND student_id=? AND session_id=?').get(auth.workspaceId, auth.studentId, sessionId);
    if (!row) fail(404, 'Không tìm thấy lượt thi.');
    const items = parse(row.items_json);
    const answers = parse(row.answers_json || '{}');
    const preset = CONTEST_PRESETS[row.preset_id];
    const evaluation = evaluateContestSubmission(items, answers, preset, 0, row.status);
    const pack = buildReviewMistakesPack({ sessionId: row.session_id, studentId: row.student_id, workspaceId: auth.workspaceId, title: row.title, subject: row.subject, grade: row.grade }, evaluation.mistakes);
    this.db.prepare('INSERT OR REPLACE INTO packs(workspace_id, pack_id, version, subject_label, json, content_hash) VALUES(?,?,?,?,?,?)').run(
      auth.workspaceId, pack.id, pack.version, pack.subject, json(pack), contentIdentity(pack)
    );
    return pack;
  }

  resolvePackSubject(auth, packId) {
    const row = this.db.prepare('SELECT subject_label, json FROM packs WHERE workspace_id=? AND pack_id=? ORDER BY version DESC LIMIT 1').get(auth.workspaceId, packId);
    if (!row) return 'math';
    try {
      const p = parse(row.json);
      return resolveTownSubject(p.subject || row.subject_label);
    } catch {
      return resolveTownSubject(row.subject_label);
    }
  }

  syncAwardMaterial(auth, studentId, packId, stars) {
    if (!stars || stars <= 0) return;
    try {
      const subject = this.resolvePackSubject(auth, packId);
      const material = getMaterialForSubject(subject);
      const existingEarned = this.db.prepare("SELECT coalesce(sum(delta), 0) as total FROM materials_ledger WHERE workspace_id=? AND student_id=? AND pack_id=? AND delta > 0").get(auth.workspaceId, studentId, packId)?.total || 0;
      const gained = stars - existingEarned;
      if (gained > 0) {
        this.db.prepare('INSERT INTO materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(
          auth.workspaceId, studentId, id(), packId, material, gained, 'award', `award:${packId}:${stars}`, now()
        );
      }
    } catch (e) {
      // Ignore background sync errors
    }
  }

  townState(auth, studentId, { allowClassmate = false } = {}) {
    if (auth.role === 'student' && auth.studentId !== studentId && !allowClassmate) fail(404, 'Không tìm thấy học sinh.');
    let row = this.db.prepare('SELECT * FROM town_states WHERE workspace_id=? AND student_id=?').get(auth.workspaceId, studentId);
    if (!row) {
      const initial = defaultTownState(studentId, now());
      this.db.prepare('INSERT INTO town_states(workspace_id, student_id, grid_width, grid_height, revision, buildings_json, updated_at) VALUES(?,?,?,?,?,?,?)').run(
        auth.workspaceId, studentId, initial.gridWidth, initial.gridHeight, initial.revision, json(initial.buildings), initial.updatedAt
      );
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

  materials(auth, studentId) {
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    const count = this.db.prepare('SELECT count(*) as c FROM materials_ledger WHERE workspace_id=? AND student_id=?').get(auth.workspaceId, studentId)?.c || 0;
    if (count === 0) {
      return this.recalculateMaterials(auth, studentId);
    }
    const rows = this.db.prepare('SELECT material_type, coalesce(sum(delta), 0) as balance FROM materials_ledger WHERE workspace_id=? AND student_id=? GROUP BY material_type').all(auth.workspaceId, studentId);
    const balances = { stone: 0, wood: 0, fish: 0, component: 0 };
    for (const r of rows) {
      if (r.material_type in balances) {
        balances[r.material_type] = Math.max(0, Number(r.balance));
      }
    }
    return balances;
  }

  recalculateMaterials(auth, studentId) {
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    return this.tx(() => {
      this.db.prepare('DELETE FROM materials_ledger WHERE workspace_id=? AND student_id=?').run(auth.workspaceId, studentId);

      const awards = this.db.prepare('SELECT pack_id, tier, json FROM awards WHERE workspace_id=? AND student_id=?').all(auth.workspaceId, studentId).map(r => ({
        packId: r.pack_id,
        tier: r.tier,
        ...parse(r.json)
      }));

      const packRows = this.db.prepare('SELECT pack_id, subject_label, json FROM packs WHERE workspace_id=?').all(auth.workspaceId);
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
          this.db.prepare('INSERT INTO materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(
            auth.workspaceId, studentId, id(), null, mat, amount, 'award', `recalc:${studentId}:${mat}:${amount}`, currentTime
          );
        }
      }

      const town = this.townState(auth, studentId);
      for (const placed of town.buildings) {
        const item = TOWN_BUILDING_MAP.get(placed.buildingId);
        if (!item) continue;
        for (const [mat, cost] of Object.entries(item.cost)) {
          if (cost && cost > 0) {
            this.db.prepare('INSERT INTO materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(
              auth.workspaceId, studentId, id(), null, mat, -cost, 'build', `spend:${placed.id}:${mat}`, currentTime
            );
          }
        }
      }

      const spent = calculateTotalSpentMaterials(town.buildings);
      return calculateAvailableMaterials(earned, spent);
    });
  }

  placeBuilding(auth, studentId, input) {
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    shape(input, ['buildingId', 'x', 'y', 'expectedRevision', 'requestId', 'studentId']);
    text(input.buildingId, 'Mã công trình', 64);
    let requestId = input.requestId || id();

    return this.tx(() => {
      const existingTx = this.db.prepare("SELECT 1 FROM materials_ledger WHERE workspace_id=? AND student_id=? AND request_id=? AND reason='build' LIMIT 1").get(auth.workspaceId, studentId, requestId);
      if (existingTx) {
        const currentTown = this.townState(auth, studentId);
        const currentMaterials = this.materials(auth, studentId);
        return { ok: true, town: currentTown, materials: currentMaterials, duplicate: true };
      }

      const currentTown = this.townState(auth, studentId);
      const currentMaterials = this.materials(auth, studentId);
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
          this.db.prepare('INSERT INTO materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(
            auth.workspaceId, studentId, id(), null, mat, -amount, 'build', requestId, currentTime
          );
        }
      }

      this.db.prepare('UPDATE town_states SET revision=?, buildings_json=?, updated_at=? WHERE workspace_id=? AND student_id=?').run(
        updatedTownState.revision, json(updatedTownState.buildings), updatedTownState.updatedAt, auth.workspaceId, studentId
      );

      const updatedMaterials = calculateAvailableMaterials(
        currentMaterials,
        calculateTotalSpentMaterials([placedBuilding])
      );

      try {
        const student = this.db.prepare('SELECT class_id, name FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, studentId);
        if (student) {
          this.publishClassFeedEvent(auth, student.class_id, studentId, student.name, 'building_built', {
            buildingId: placedBuilding.buildingId,
            buildingName: placedBuilding.name,
            buildingIcon: placedBuilding.icon,
          });
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

  townSummary(auth, studentId) {
    const town = this.townState(auth, studentId);
    const materials = this.materials(auth, studentId);
    const catalog = TOWN_BUILDING_CATALOG;
    let walletAvailableStars = 0;
    try {
      const rewards = this.rewards(auth, studentId);
      const requests = this.requests(auth, studentId);
      const balance = rewardBalance(earnedQuestionRewardStars(rewards), { requests });
      walletAvailableStars = balance.available;
    } catch {}
    return { town, materials, catalog, walletAvailableStars };
  }

  townAnimals(auth, studentId, { allowClassmate = false } = {}) {
    if (auth.role === 'student' && auth.studentId !== studentId && !allowClassmate) fail(404, 'Không tìm thấy học sinh.');
    const student = this.db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, studentId);
    if (!student) fail(404, 'Không tìm thấy học sinh.');
    const awards = this.db.prepare('SELECT json FROM awards WHERE workspace_id=? AND student_id=? ORDER BY pack_id').all(auth.workspaceId, studentId).map(row => parse(row.json));
    const prog = this.summaryProgress(auth, student, awards);
    const completedWeeksCount = prog.weeks.filter(w => w.done || w.closed).length;
    const unlockedDefs = getUnlockedAnimals(completedWeeksCount);
    const rows = this.db.prepare('SELECT animal_id, name, arrived_at_week, created_at FROM town_animals WHERE workspace_id=? AND student_id=?').all(auth.workspaceId, studentId);
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

  nameTownAnimal(auth, studentId, input) {
    shape(input, ['animalId', 'name']);
    if (auth.role === 'student' && auth.studentId !== studentId) fail(404, 'Không tìm thấy học sinh.');
    const student = this.db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, studentId);
    if (!student) fail(404, 'Không tìm thấy học sinh.');

    const validation = validateAnimalName(input.name);
    if (!validation.valid) fail(400, validation.error || 'Tên bạn nhỏ không hợp lệ.');

    const prog = this.summaryProgress(auth, student);
    const completedWeeksCount = prog.weeks.filter(w => w.done || w.closed).length;
    const unlockedDefs = getUnlockedAnimals(completedWeeksCount);
    const def = unlockedDefs.find(d => d.id === input.animalId);
    if (!def) fail(400, 'Bạn động vật này chưa chuyển đến thị trấn.');

    const cleanName = validation.cleanName;
    this.db.prepare(`
      INSERT INTO town_animals(workspace_id, student_id, animal_id, name, arrived_at_week, created_at)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(workspace_id, student_id, animal_id) DO UPDATE SET name=excluded.name
    `).run(auth.workspaceId, studentId, def.id, cleanName, def.requiredWeeks, now());

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

  classmatesTowns(auth, studentId) {
    const student = this.db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, studentId);
    if (!student) fail(404, 'Không tìm thấy học sinh.');
    const classmates = this.db.prepare('SELECT id, name FROM students WHERE workspace_id=? AND class_id=? AND active=1').all(auth.workspaceId, student.class_id);

    return classmates.map(c => {
      const townRow = this.db.prepare('SELECT buildings_json FROM town_states WHERE workspace_id=? AND student_id=?').get(auth.workspaceId, c.id);
      const buildings = townRow ? parse(townRow.buildings_json || '[]') : [];
      const cheersCount = this.db.prepare('SELECT count(*) as count FROM town_cheers WHERE workspace_id=? AND to_student_id=?').get(auth.workspaceId, c.id)?.count || 0;
      const animalsCount = this.db.prepare('SELECT count(*) as count FROM town_animals WHERE workspace_id=? AND student_id=?').get(auth.workspaceId, c.id)?.count || 0;

      return {
        studentId: c.id,
        name: c.name, // Display name only, NEVER username
        buildingsCount: buildings.length,
        cheersCount,
        animalsCount,
        isSelf: c.id === studentId,
      };
    });
  }

  visitTown(auth, callerStudentId, targetStudentId) {
    const caller = this.db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, callerStudentId);
    const target = this.db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, targetStudentId);
    if (!caller || !target) fail(404, 'Không tìm thấy học sinh.');

    if (caller.class_id !== target.class_id) {
      fail(403, 'Bạn chỉ có thể ghé thăm thị trấn của bạn cùng lớp!');
    }

    const town = this.townState(auth, targetStudentId, { allowClassmate: true });
    const animalsData = this.townAnimals(auth, targetStudentId, { allowClassmate: true });
    const cheersCount = this.db.prepare('SELECT count(*) as count FROM town_cheers WHERE workspace_id=? AND to_student_id=?').get(auth.workspaceId, targetStudentId)?.count || 0;

    return {
      studentName: target.name, // Display name only
      town,
      animals: animalsData.animals,
      cheersCount,
      isSelf: callerStudentId === targetStudentId,
    };
  }

  cheerClassmate(auth, fromStudentId, targetStudentId) {
    if (fromStudentId === targetStudentId) {
      fail(400, 'Không thể tự cổ vũ thị trấn của chính mình!');
    }

    const caller = this.db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, fromStudentId);
    const target = this.db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(auth.workspaceId, targetStudentId);
    if (!caller || !target) fail(404, 'Không tìm thấy học sinh.');

    if (caller.class_id !== target.class_id) {
      fail(403, 'Chỉ có thể cổ vũ bạn cùng lớp!');
    }

    const dayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const existing = this.db.prepare('SELECT 1 FROM town_cheers WHERE workspace_id=? AND from_student_id=? AND to_student_id=? AND day_key=?').get(auth.workspaceId, fromStudentId, targetStudentId, dayKey);

    if (!existing) {
      this.db.prepare('INSERT INTO town_cheers(workspace_id, from_student_id, to_student_id, day_key, created_at) VALUES(?,?,?,?,?)').run(
        auth.workspaceId, fromStudentId, targetStudentId, dayKey, now()
      );
      const totalCheers = this.db.prepare('SELECT count(*) as count FROM town_cheers WHERE workspace_id=? AND to_student_id=?').get(auth.workspaceId, targetStudentId)?.count || 1;
      this.publishClassFeedEvent(auth, target.class_id, targetStudentId, target.name, 'cheer_received', {
        cheerCount: totalCheers,
      });
    }

    const count = this.db.prepare('SELECT count(*) as count FROM town_cheers WHERE workspace_id=? AND to_student_id=?').get(auth.workspaceId, targetStudentId)?.count || 0;
    return {
      ok: true,
      alreadyCheeredToday: !!existing,
      cheersCount: count,
    };
  }

  publishClassFeedEvent(auth, classId, studentId, studentName, eventType, details) {
    try {
      const cls = this.db.prepare('SELECT feed_enabled FROM classes WHERE workspace_id=? AND id=?').get(auth.workspaceId, classId);
      if (!cls || cls.feed_enabled === 0) return;

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

      this.db.prepare('INSERT INTO class_feed_events(workspace_id, class_id, id, student_id, student_name, event_type, details_json, created_at) VALUES(?,?,?,?,?,?,?,?)').run(
        auth.workspaceId, classId, event.id, event.studentId, event.studentName, event.eventType, json(event.details), event.createdAt
      );
    } catch {}
  }

  classFeed(auth, classId, limit = 50) {
    const cls = this.class(auth, classId);
    const feedEnabled = cls.feed_enabled === undefined || cls.feed_enabled === null || cls.feed_enabled === 1;
    if (!feedEnabled) {
      return { enabled: false, events: [] };
    }

    const rows = this.db.prepare('SELECT * FROM class_feed_events WHERE workspace_id=? AND class_id=? ORDER BY created_at DESC LIMIT ?').all(auth.workspaceId, classId, limit);
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

  // ==========================================
  // CỔNG KẾT NỐI SAFETIME (GĐ3B: BAO-04, BAO-14)
  // ==========================================

  createIntegrationPairCode(workspaceId, allowedStudentIds, expiresInMinutes = 10) {
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
    this.db.prepare(`
      INSERT INTO integration_pair_codes(code, workspace_id, allowed_student_ids, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, workspaceId, json(allowedStudentIds), createdAt, expiresAt);
    return { code, expiresAt, allowedStudentIds };
  }

  findIntegrationPairCode(code) {
    const row = this.db.prepare('SELECT * FROM integration_pair_codes WHERE code = ?').get(code);
    if (!row) return null;
    return {
      ...row,
      allowed_student_ids: parse(row.allowed_student_ids)
    };
  }

  consumeIntegrationPairCode(code) {
    const row = this.findIntegrationPairCode(code);
    if (!row) fail(404, 'Mã ghép đôi không tồn tại.');
    if (row.used_at) fail(400, 'Mã ghép đôi đã được sử dụng.');
    if (new Date(row.expires_at) <= new Date()) fail(400, 'Mã ghép đôi đã hết hạn (hiệu lực 10 phút).');
    const usedAt = now();
    this.db.prepare('UPDATE integration_pair_codes SET used_at = ? WHERE code = ?').run(usedAt, code);
    return { ...row, used_at: usedAt };
  }

  createIntegrationClient(workspaceId, { tokenHash, deviceId, deviceName, allowedStudentIds }) {
    if (!tokenHash || !deviceId || !deviceName) fail(400, 'Thiếu thông tin thiết bị hoặc khóa kết nối.');
    const clientId = id();
    const createdAt = now();
    this.db.prepare(`
      INSERT INTO integration_clients(id, workspace_id, token_hash, device_id, device_name, allowed_student_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(clientId, workspaceId, tokenHash, deviceId, deviceName, json(allowedStudentIds || []), createdAt);
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

  findIntegrationClientByTokenHash(tokenHash) {
    const row = this.db.prepare('SELECT * FROM integration_clients WHERE token_hash = ? AND revoked_at IS NULL').get(tokenHash);
    if (!row) return null;
    return {
      ...row,
      allowed_student_ids: parse(row.allowed_student_ids)
    };
  }

  findIntegrationClientById(id) {
    const row = this.db.prepare('SELECT * FROM integration_clients WHERE id = ?').get(id);
    if (!row) return null;
    return {
      ...row,
      allowed_student_ids: parse(row.allowed_student_ids)
    };
  }

  listIntegrationClients(workspaceId) {
    const rows = this.db.prepare('SELECT * FROM integration_clients WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
    return rows.map(r => ({
      ...r,
      allowed_student_ids: parse(r.allowed_student_ids)
    }));
  }

  touchIntegrationClient(id) {
    this.db.prepare('UPDATE integration_clients SET last_used_at = ? WHERE id = ?').run(now(), id);
  }

  revokeIntegrationClient(id) {
    const revokedAt = now();
    this.db.prepare('UPDATE integration_clients SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(revokedAt, id);
    this.db.prepare('UPDATE integration_refresh_tokens SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL').run(revokedAt, id);
    return true;
  }

  createIntegrationTicket(workspaceId, clientId, studentId, expiresInSeconds = 60) {
    const ticket = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const createdAt = now();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    this.db.prepare(`
      INSERT INTO integration_tickets(ticket, workspace_id, client_id, student_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ticket, workspaceId, clientId, studentId, createdAt, expiresAt);
    return { ticket, expiresAt };
  }

  consumeIntegrationTicket(ticket) {
    const row = this.db.prepare('SELECT * FROM integration_tickets WHERE ticket = ?').get(ticket);
    if (!row) fail(404, 'Vé SSO không tồn tại.');
    if (row.used_at) fail(400, 'Vé SSO đã được sử dụng.');
    if (new Date(row.expires_at) <= new Date()) fail(400, 'Vé SSO đã hết hạn (hiệu lực 60 giây).');
    const client=this.findIntegrationClientById(row.client_id);
    if(!client||client.revoked_at||client.workspace_id!==row.workspace_id||!this.isIntegrationEnabled(row.workspace_id))fail(400,'Kết nối của vé SSO đã bị tắt hoặc thu hồi.');
    if(client.allowed_student_ids?.length&&!client.allowed_student_ids.includes(row.student_id))fail(400,'Học sinh không thuộc thiết bị của vé SSO.');
    const usedAt = now();
    this.db.prepare('UPDATE integration_tickets SET used_at = ? WHERE ticket = ?').run(usedAt, ticket);
    return { ...row, used_at: usedAt };
  }

  createIntegrationRefreshToken(workspaceId, clientId, studentId, expiresInDays = 30) {
    const rawToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const createdAt = now();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
    this.db.prepare(`
      INSERT INTO integration_refresh_tokens(token_hash, workspace_id, client_id, student_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tokenHash, workspaceId, clientId, studentId, createdAt, expiresAt);
    return { rawToken, expiresAt };
  }

  consumeIntegrationRefreshToken(rawToken) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const row = this.db.prepare('SELECT * FROM integration_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL').get(tokenHash);
    if (!row) fail(401, 'Mã làm mới không hợp lệ hoặc đã bị thu hồi.');
    if (new Date(row.expires_at) <= new Date()) fail(401, 'Mã làm mới đã hết hạn.');
    this.db.prepare('UPDATE integration_refresh_tokens SET revoked_at = ? WHERE token_hash = ?').run(now(), tokenHash);
    return row;
  }

  purgeOldIntegrationEvents(maxAgeDays = 30) {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000).toISOString();
    return this.db.prepare('DELETE FROM integration_events WHERE created_at < ?').run(cutoff);
  }

  recordIntegrationEvent(workspaceId, studentId, eventType, data) {
    const eventId = id();
    const createdAt = now();
    this.db.prepare(`
      INSERT INTO integration_events(id, workspace_id, student_id, event_type, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(eventId, workspaceId, studentId, eventType, json(data), createdAt);
    return { id: eventId, eventType, data, createdAt };
  }

  recordWeekCompleted(workspaceId, studentId, subject, week) {
    return this.recordIntegrationEvent(workspaceId, studentId, 'week_completed', {
      subject: normalizeIntegrationSubject(subject),
      week: Number(week) || 1
    });
  }

  recordDailyStudy(workspaceId, studentId, dateStr, minutes) {
    return this.recordIntegrationEvent(workspaceId, studentId, 'daily_study', {
      date: dateStr,
      minutes: Math.round(Number(minutes) || 0)
    });
  }

  listIntegrationEvents(workspaceId, { allowedStudentIds = null, afterCursor = 0, limit = 100 } = {}) {
    this.purgeOldIntegrationEvents(30);
    const maxLimit = Math.min(Math.max(1, limit), 200);
    const numericCursor = Number(afterCursor) || 0;
    let rows;
    if (Array.isArray(allowedStudentIds) && allowedStudentIds.length > 0) {
      const placeholders = allowedStudentIds.map(() => '?').join(',');
      rows = this.db.prepare(`
        SELECT rowid, id, student_id, event_type, data_json, created_at
        FROM integration_events
        WHERE workspace_id = ? AND rowid > ? AND student_id IN (${placeholders})
        ORDER BY rowid ASC
        LIMIT ?
      `).all(workspaceId, numericCursor, ...allowedStudentIds, maxLimit);
    } else {
      rows = this.db.prepare(`
        SELECT rowid, id, student_id, event_type, data_json, created_at
        FROM integration_events
        WHERE workspace_id = ? AND rowid > ?
        ORDER BY rowid ASC
        LIMIT ?
      `).all(workspaceId, numericCursor, maxLimit);
    }
    const events = rows.map(r => ({
      id: r.id,
      studentId: r.student_id,
      type: r.event_type,
      data: parse(r.data_json),
      createdAt: r.created_at
    }));
    const nextCursor = rows.length > 0 ? rows[rows.length - 1].rowid : numericCursor;
    return { events, cursor: nextCursor };
  }

  getStudentTodayData(workspaceId, studentId) {
    const student = this.db.prepare(`
      SELECT s.id, s.user_id, s.name AS displayName, s.class_id, c.name AS className, c.grade
      FROM students s
      JOIN classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
      WHERE s.workspace_id = ? AND s.id = ? AND s.active = 1
    `).get(workspaceId, studentId);
    if (!student) return null;

    const auth = { workspaceId, studentId, id: student.user_id || studentId, role: 'student' };
    const { dateStr } = getVietnamTimeParts();

    // 1. Stars balance (read-only per BAO-11, BAO-13)
    const rewards = this.rewards(auth, studentId);
    const requests = this.requests(auth, studentId);
    const balance = rewardBalance(earnedQuestionRewardStars(rewards), { requests });
    const stars = {
      available: balance.available,
      note: 'Chỉ đổi vật phẩm trên Kệ quà'
    };

    // 2. Streak
    const streakObj = this.studentStreak(auth, studentId);
    const streakDays = streakObj?.currentStreak ?? streakObj?.days ?? 0;

    // 3. Parent Controls & Daily screen time limit
    const controls = this.rawParentControls(workspaceId, studentId);
    const usedMinutes = this.todayStudentStudyMinutes(auth, studentId);
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
    const progress = this.summaryProgress(auth, student, rewards);
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
    const missions = this.studentDailyMissions(auth, studentId);
    const dailyMissions = missions.map(m => ({
      id: m.id,
      title: m.title,
      done: !!m.completed
    }));

    // 6. Contests
    const studentGrade = student.grade || 3;
    const presets = Object.values(CONTEST_PRESETS).filter(p => !p.grade || p.grade === studentGrade);
    const contests = presets.map(p => {
      const lastSession = this.db.prepare(`
        SELECT score, max_score, submitted_at
        FROM contest_sessions
        WHERE workspace_id = ? AND student_id = ? AND preset_id = ? AND status IN ('submitted', 'timeout')
        ORDER BY created_at DESC LIMIT 1
      `).get(workspaceId, studentId, p.id);
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
    });

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

  assertParentElevation(auth, studentId = null, parentToken = null) {
    if (auth.role === 'admin') return true;
    if (auth.role === 'parent') {
      if (studentId) {
        const linked = this.db.prepare('SELECT 1 FROM parent_students WHERE workspace_id=? AND parent_user_id=? AND student_id=?').get(auth.workspaceId, auth.id, studentId);
        if (!linked) fail(403, 'Phụ huynh không có quyền quản lý học sinh này.');
      }
      return true;
    }
    if (auth.role === 'student') {
      const sId = studentId || auth.studentId;
      if (auth.studentId !== sId) fail(403, 'Không có quyền truy cập học sinh khác.');
      const currentRaw = this.rawParentControls(auth.workspaceId, sId);
      if(!currentRaw?.pinHash)fail(403,'Cần thiết lập và xác thực PIN phụ huynh trước khi quản lý kết nối.');
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

  isIntegrationEnabled(workspaceId) {
    const hasPairCode = this.db.prepare('SELECT 1 FROM integration_pair_codes WHERE workspace_id = ? LIMIT 1').get(workspaceId);
    const hasClient = this.db.prepare('SELECT 1 FROM integration_clients WHERE workspace_id = ? LIMIT 1').get(workspaceId);
    if (!hasPairCode && !hasClient) return false;
    const toggleAudit = this.db.prepare("SELECT target_id FROM audit WHERE workspace_id = ? AND action = 'integration.toggle' ORDER BY rowid DESC LIMIT 1").get(workspaceId);
    if (toggleAudit) {
      try {
        const parsed = parse(toggleAudit.target_id);
        if (typeof parsed?.enabled === 'boolean') return parsed.enabled;
      } catch {}
    }
    return true;
  }

  parentSafetimeStatus(auth, studentId = null, parentToken = null) {
    this.assertParentElevation(auth, studentId, parentToken);
    const clients = this.listIntegrationClients(auth.workspaceId);
    const activeClients = clients.filter(c => !c.revoked_at);
    const activePairCodeRow = this.db.prepare(`
      SELECT * FROM integration_pair_codes
      WHERE workspace_id = ? AND used_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(auth.workspaceId, now());
    const activePairCode = activePairCodeRow ? {
      code: activePairCodeRow.code,
      expiresAt: activePairCodeRow.expires_at,
      allowedStudentIds: parse(activePairCodeRow.allowed_student_ids)
    } : null;

    let availableStudents = [];
    if (auth.role === 'admin') {
      availableStudents = this.db.prepare(`
        SELECT s.id, s.name, COALESCE(c.name, '') AS className
        FROM students s
        LEFT JOIN classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
        WHERE s.workspace_id = ? AND s.active = 1
        ORDER BY s.name ASC
      `).all(auth.workspaceId);
    } else if (auth.role === 'parent') {
      availableStudents = this.db.prepare(`
        SELECT s.id, s.name, COALESCE(c.name, '') AS className
        FROM students s
        JOIN parent_students ps ON ps.workspace_id = s.workspace_id AND ps.student_id = s.id
        LEFT JOIN classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
        WHERE s.workspace_id = ? AND ps.parent_user_id = ? AND s.active = 1
        ORDER BY s.name ASC
      `).all(auth.workspaceId, auth.id);
    } else if (auth.role === 'student') {
      availableStudents = this.db.prepare(`
        SELECT s.id, s.name, COALESCE(c.name, '') AS className
        FROM students s
        LEFT JOIN classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
        WHERE s.workspace_id = ? AND s.id = ?
      `).all(auth.workspaceId, auth.studentId);
    }

    const allowed=new Set(availableStudents.map(s=>s.id));
    const visible=ids=>auth.role==='admin'||Array.isArray(ids)&&ids.length>0&&ids.every(id=>allowed.has(id));
    const visibleClients=clients.filter(c=>visible(c.allowed_student_ids));
    return {
      canManageWorkspace:auth.role==='admin',
      enabled: this.isIntegrationEnabled(auth.workspaceId),
      paired: visibleClients.some(c=>!c.revoked_at),
      clients: visibleClients.map(c => ({
        id: c.id,
        deviceName: c.device_name,
        deviceId: c.device_id,
        allowedStudentIds: c.allowed_student_ids,
        createdAt: c.created_at,
        lastUsedAt: c.last_used_at,
        revokedAt: c.revoked_at
      })),
      activePairCode:activePairCode&&visible(activePairCode.allowedStudentIds)?activePairCode:null,
      availableStudents
    };
  }

  parentCreatePairCode(auth, studentIds, parentToken = null) {
    const status=this.parentSafetimeStatus(auth,null,parentToken);
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      fail(400, 'Cần chọn ít nhất một học sinh được phép kết nối.');
    }
    const allowed=new Set(status.availableStudents.map(s=>s.id));
    if(studentIds.length>100||studentIds.some(id=>!allowed.has(id)))fail(403,'Không có quyền ghép đôi học sinh được chọn.');
    studentIds=[...new Set(studentIds)];
    const result = this.createIntegrationPairCode(auth.workspaceId, studentIds, 10);
    this.audit(auth, 'integration.pair_code_create', json({
      code: result.code,
      allowedStudentIds: studentIds,
      expiresAt: result.expiresAt
    }));
    return result;
  }

  parentRevokeClient(auth, clientId, parentToken = null) {
    const status=this.parentSafetimeStatus(auth,null,parentToken);
    const client = this.findIntegrationClientById(clientId);
    if (!client || client.workspace_id !== auth.workspaceId) {
      fail(404, 'Không tìm thấy thiết bị kết nối.');
    }
    if(!status.clients.some(c=>c.id===client.id))fail(403,'Không có quyền quản lý thiết bị của học sinh khác.');
    this.revokeIntegrationClient(clientId);
    this.audit(auth, 'integration.client_revoke', json({
      clientId: client.id,
      deviceId: client.device_id,
      deviceName: client.device_name,
      source: 'parent'
    }));
    return { success: true, clientId };
  }

  parentToggleIntegration(auth, enabled, parentToken = null) {
    this.assertParentElevation(auth, null, parentToken);
    if(auth.role!=='admin')fail(403,'Chỉ quản trị viên được bật hoặc tắt kết nối cho toàn bộ không gian.');
    const isEnabled = Boolean(enabled);
    this.audit(auth, 'integration.toggle', json({ enabled: isEnabled }));
    return { success: true, enabled: isEnabled };
  }
}
