import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,realpath,readFile} from 'node:fs/promises';
import {resolve,relative,extname,sep,isAbsolute} from 'node:path';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,scryptSync,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {OnlineStore,OnlineError,fail,shape,text} from './online-store.mjs';
import {MAX_RECOVERY_UPLOAD_BYTES,acquireOnlineDatabaseLock,recoverInterruptedOnlineRestore,inspectOnlineBackup,snapshotOnlineDatabase,restoreOnlineDatabase,createRecoveryTemporary,createRecoveryUpload} from './online-recovery.mjs';

const scrypt=promisify(scryptCallback),scryptOptions={N:32768,r:8,p:1,maxmem:64*1024*1024};
const COOKIE='baoan_online_session',MAX_BODY=2*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const sameSecret=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a??'')).digest(),createHash('sha256').update(String(b??'')).digest());
const dummySalt=randomBytes(16).toString('hex'),dummyHash=`${dummySalt}:${scryptSync(secret(),dummySalt,64,scryptOptions).toString('hex')}`;
const within=(root,file)=>{const value=relative(root,file);return value===''||(!isAbsolute(value)&&value!=='..'&&!value.startsWith(`..${sep}`));};
function username(value){const result=text(value,'Tên đăng nhập',60).toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(result))fail(400,'Tên đăng nhập cần 3–60 chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');return result;}
async function passwordHash(value){if(typeof value!=='string'||value.length<10||value.length>128)fail(400,'Mật khẩu cần từ 10–128 ký tự.');const salt=randomBytes(16).toString('hex'),result=await scrypt(value,salt,64,scryptOptions);return`${salt}:${result.toString('hex')}`;}
async function verifyPassword(value,stored){const[salt,expected]=(stored??dummyHash).split(':');if(typeof value!=='string'||value.length>128)return false;const result=await scrypt(value,salt,64,scryptOptions);return sameSecret(result.toString('hex'),expected);}
async function body(req,maxBytes=MAX_BODY){if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))fail(415,'Yêu cầu phải dùng dữ liệu JSON.');
  if(Number(req.headers['content-length']??0)>maxBytes)fail(413,'Gói dữ liệu vượt giới hạn kích thước.');const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>maxBytes)fail(413,'Gói dữ liệu vượt giới hạn kích thước.');chunks.push(chunk);}
  let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'Dữ liệu JSON không đọc được.');}if(!result||typeof result!=='object'||Array.isArray(result))fail(400,'Dữ liệu gửi lên cần là một đối tượng JSON.');return result;
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.wav':'audio/wav','.mp3':'audio/mpeg','.wasm':'application/wasm','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.csv':'text/csv; charset=utf-8','.woff2':'font/woff2'};

/** Same-origin API + static app. Only a manager-created student account can mint play evidence. */
export function createOnlineServer({databasePath,staticRoot=resolve('dist'),publicOrigin,setupToken,secureCookies}={}){
  if(!databasePath)throw new Error('Cần đường dẫn cơ sở dữ liệu riêng của máy chủ.');
  const root=resolve(staticRoot);if(databasePath!==':memory:'&&within(root,resolve(databasePath)))throw new Error('Cơ sở dữ liệu phải nằm ngoài thư mục web công khai.');
  let configuredOrigin;
  if(publicOrigin){const url=new URL(publicOrigin);if(url.origin!==publicOrigin.replace(/\/$/,'')||url.username||url.password||!['http:','https:'].includes(url.protocol))throw new Error('BAO_AN_PUBLIC_ORIGIN cần là origin HTTP/HTTPS chính xác.');
    if(url.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Website công khai cần HTTPS.');configuredOrigin=url.origin;}
  const releaseDatabaseLock=acquireOnlineDatabaseLock(databasePath);let store,db;
  try{recoverInterruptedOnlineRestore(databasePath);store=new OnlineStore(databasePath);db=store.db;}catch(error){releaseDatabaseLock();throw error;}
  let closed=false,recoveryBusy=false,backupRunning=false;
  const recoveryPreviews=new Map();
  const available=()=>{if(recoveryBusy)fail(503,'Máy chủ đang phục hồi dữ liệu. Hãy đợi hoàn tất rồi đăng nhập lại.');if(!store||!db)fail(503,'Phục hồi bị gián đoạn. Giữ nguyên dữ liệu, đóng rồi mở lại máy chủ để khôi phục an toàn.');};
  function recoveryOwner(auth){role(auth,'admin');if(databasePath===':memory:')fail(409,'Kho tạm trong bộ nhớ không hỗ trợ sao lưu hoặc phục hồi tệp.');
    const workspaces=db.prepare('SELECT id FROM workspaces').all();if(workspaces.length!==1||workspaces[0].id!==auth.workspaceId)fail(409,'Phục hồi toàn máy cần kho cục bộ của một đơn vị. Dùng công cụ phục hồi khi máy chủ đã dừng.');
  }
  function clearExpiredPreviews(){for(const[token,preview]of recoveryPreviews)if(preview.expires<=Date.now()){preview.temporary.remove();recoveryPreviews.delete(token);}}
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Pragma':'no-cache','Vary':'Cookie'});res.end(JSON.stringify(value));};
  function originFor(req){const host=req.headers.host??'';
    if(configuredOrigin){if(host!==new URL(configuredOrigin).host)fail(421,'Địa chỉ máy chủ không đúng cấu hình.');return configuredOrigin;}
    if(!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(host))fail(421,'Cần cấu hình origin trước khi truy cập ngoài máy chủ.');return`http://${host}`;
  }
  function actor(req){available();const raw=(req.headers.cookie??'').split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);if(!raw||raw.length>200)fail(401,'Hãy đăng nhập để tiếp tục.');
    const row=db.prepare('SELECT u.*,s.csrf_token,s.token_hash FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(hash(raw),Date.now());if(!row)fail(401,'Phiên đăng nhập đã hết hạn hoặc tài khoản đã được khóa.');
    return{id:row.id,workspaceId:row.workspace_id,username:row.username,role:row.role,...(row.student_id?{studentId:row.student_id}:{}),csrfToken:row.csrf_token,tokenHash:row.token_hash};
  }
  function identity(auth){const workspace=store.workspace(auth.workspaceId),{csrfToken,tokenHash,...user}=auth;void tokenHash;return{user,workspace:{id:workspace.id,name:workspace.name},csrfToken};}
  function cookie(res,token,origin,clear=false){const secure=secureCookies??origin.startsWith('https:');res.setHeader('Set-Cookie',`${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear?0:43200}${secure?'; Secure':''}`);}
  function login(res,user,origin){const token=secret(),csrfToken=secret();db.prepare('DELETE FROM auth_sessions WHERE expires_at<?').run(Date.now());db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').run(hash(token),user.id,csrfToken,Date.now()+43200000);cookie(res,token,origin);
    return identity({id:user.id,workspaceId:user.workspace_id,username:user.username,role:user.role,...(user.student_id?{studentId:user.student_id}:{}),csrfToken});}
  function role(auth,expected){if(auth.role!==expected)fail(403,expected==='admin'?'Chỉ quản lý được thực hiện thao tác này.':'Hãy dùng tài khoản học sinh để vào luyện tập.');}
  function authenticatedActor(req,expectedRole){const auth=actor(req);
    if(!sameSecret(req.headers['x-csrf-token'],auth.csrfToken))fail(403,'Phiên xác thực của biểu mẫu đã thay đổi. Hãy tải lại.');
    if(expectedRole)role(auth,expectedRole);return auth;
  }
  /** A request can stay open while its cookie is revoked or its account is locked. */
  async function authenticatedBody(req,expectedRole,maxBytes=MAX_BODY){const input=await body(req,maxBytes);return{input,auth:authenticatedActor(req,expectedRole)};}
  function rateLimit(req,name){const address=req.socket.remoteAddress??'local',keys=[hash(`ip:${address}`),hash(`user:${name}`)],time=Date.now();
    store.tx(()=>{for(const [index,key]of keys.entries()){const row=db.prepare('SELECT * FROM login_limits WHERE key=?').get(key),count=row&&row.reset_at>time?row.count:0;
      if(count>=(index===0?100:12))fail(429,'Đã thử đăng nhập quá nhiều lần. Hãy đợi 15 phút rồi thử lại.');
      db.prepare('INSERT INTO login_limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,reset_at=excluded.reset_at').run(key,count+1,row&&row.reset_at>time?row.reset_at:time+900000);
    }});
    return()=>db.prepare('DELETE FROM login_limits WHERE key=?').run(keys[1]);
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
    try{
      if((req.url??'').length>4096)fail(414,'Đường dẫn quá dài.');const origin=originFor(req),url=new URL(req.url,origin),path=url.pathname,method=req.method??'GET';
      if(path.startsWith('/api/')){
        available();
        if(!path.startsWith('/api/online/'))fail(404,'Không có API này.');
        const mutable=!['GET','HEAD','OPTIONS'].includes(method);
        if(mutable&&(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'))fail(403,'Yêu cầu phải xuất phát từ chính website này.');
        if(method==='OPTIONS')fail(405,'API chỉ dùng cùng origin.');
        const route=path.slice('/api/online'.length);
        if(method==='GET'&&route==='/status')return json(res,200,{available:true,configured:store.configured()});
        if(method==='POST'&&route==='/setup'){
          const input=shape(await body(req),['token','name','username','password']);available();if(store.configured())fail(409,'Máy chủ đã được khởi tạo. Hãy đăng nhập.');
          rateLimit(req,'bootstrap');if(!setupToken||!sameSecret(input.token,setupToken))fail(403,'Mã khởi tạo không đúng. Lấy mã riêng từ quản trị máy chủ.');
          const name=text(input.name,'Tên đơn vị',120),nameUser=username(input.username),password=await passwordHash(input.password),created=new Date().toISOString();
          const user=store.tx(()=>{if(store.configured())fail(409,'Máy chủ đã được khởi tạo.');const workspaceId=randomUUID(),userId=randomUUID();db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,name,created);db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(userId,workspaceId,nameUser,password,'admin',created);return db.prepare('SELECT * FROM users WHERE id=?').get(userId);});
          return json(res,201,login(res,user,origin));
        }
        if(method==='POST'&&route==='/login'){
          const input=shape(await body(req),['username','password']);available();const name=username(input.username),clear=rateLimit(req,name),user=db.prepare('SELECT * FROM users WHERE username=?').get(name),correct=await verifyPassword(input.password,user?.password_hash);
          available();
          const current=user&&db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
          if(!correct||!current||!current.active||current.password_hash!==user.password_hash)fail(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');clear();return json(res,200,login(res,current,origin));
        }
        const auth=actor(req);if(mutable&&!sameSecret(req.headers['x-csrf-token'],auth.csrfToken))fail(403,'Phiên xác thực của biểu mẫu đã thay đổi. Hãy tải lại.');
        if(method==='GET'&&route==='/recovery'){role(auth,'admin');let supported=true,reason;try{recoveryOwner(auth);}catch(error){supported=false;reason=error.message;}return json(res,200,{supported,maxUploadBytes:MAX_RECOVERY_UPLOAD_BYTES,previewMinutes:10,...(reason?{reason}:{})});}
        if(method==='POST'&&route==='/backup'){
          role(auth,'admin');const{input,auth:current}=await authenticatedBody(req,'admin');shape(input,[]);recoveryOwner(current);if(backupRunning)fail(409,'Một bản sao lưu khác đang được tạo. Hãy đợi hoàn tất.');
          const temporary=createRecoveryTemporary(databasePath);backupRunning=true;
          try{const info=await snapshotOnlineDatabase(db,temporary.file);authenticatedActor(req,'admin');const bytes=await readFile(temporary.file);authenticatedActor(req,'admin');
            res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Disposition':`attachment; filename="bao-an-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite"`,'Content-Length':bytes.length,'Cache-Control':'no-store, private','Pragma':'no-cache','Vary':'Cookie','X-Backup-SHA256':info.sha256});res.end(bytes);return;
          }finally{backupRunning=false;temporary.remove();}
        }
        if(method==='POST'&&route==='/restore/preview'){
          role(auth,'admin');const{input,auth:current}=await authenticatedBody(req,'admin',Math.ceil(MAX_RECOVERY_UPLOAD_BYTES/3)*4+1024);shape(input,['base64']);recoveryOwner(current);clearExpiredPreviews();
          for(const[token,prior]of recoveryPreviews)if(prior.userId===current.id){prior.temporary.remove();recoveryPreviews.delete(token);}if(recoveryPreviews.size>=5)fail(409,'Đã có nhiều bản xem trước đang mở. Hãy đóng hoặc chờ bản cũ hết hạn.');
          const temporary=createRecoveryUpload(databasePath,input.base64);
          try{const info=inspectOnlineBackup(temporary.file,{maxBytes:MAX_RECOVERY_UPLOAD_BYTES,workspaceId:current.workspaceId}),restoreToken=secret(),expires=Date.now()+600000;
            recoveryPreviews.set(restoreToken,{temporary,info,expires,userId:current.id,workspaceId:current.workspaceId,session:current.tokenHash});const{workspaceIds,...safe}=info;void workspaceIds;
            return json(res,200,{...safe,restoreToken,expiresAt:new Date(expires).toISOString()});
          }catch(error){temporary.remove();throw error;}
        }
        if(method==='POST'&&route==='/restore/commit'){
          role(auth,'admin');const{input,auth:current}=await authenticatedBody(req,'admin');shape(input,['restoreToken','sha256','confirm']);recoveryOwner(current);clearExpiredPreviews();
          if(input.confirm!==true)fail(400,'Cần xem trước và xác nhận rõ trước khi thay dữ liệu.');const preview=recoveryPreviews.get(input.restoreToken);
          if(!preview)fail(409,'Bản xem trước đã hết hạn hoặc không còn. Hãy chọn bản sao và xem lại.');
          if(preview.userId!==current.id||preview.workspaceId!==current.workspaceId||preview.session!==current.tokenHash)fail(403,'Bản xem trước thuộc phiên đăng nhập khác.');
          if(input.sha256!==preview.info.sha256)fail(409,'Mã kiểm tra không khớp bản đã xem. Hãy xem trước lại.');if(backupRunning)fail(409,'Đang tạo bản sao lưu. Hãy thử phục hồi sau khi tải xong.');
          recoveryPreviews.delete(input.restoreToken);recoveryBusy=true;
          try{const result=await restoreOnlineDatabase({databasePath,backupPath:preview.temporary.file,expectedSha256:preview.info.sha256,workspaceId:current.workspaceId,maxBytes:MAX_RECOVERY_UPLOAD_BYTES,database:db,lockAlreadyHeld:true,
              closeDatabase:()=>{store?.close();store=undefined;db=undefined;},reopenDatabase:()=>{store=new OnlineStore(databasePath);db=store.db;server.onlineStore=store;}});
            cookie(res,'',origin,true);const{preBackupPath,...safe}=result;void preBackupPath;return json(res,200,safe);
          }finally{recoveryBusy=false;preview.temporary.remove();}
        }
        if(method==='GET'&&route==='/me')return json(res,200,identity(auth));
        if(method==='POST'&&route==='/logout'){const{input,auth:current}=await authenticatedBody(req);shape(input,[]);db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(current.tokenHash);cookie(res,'',origin,true);return json(res,200,{ok:true});}
        if(method==='GET'&&route==='/dashboard'){role(auth,'admin');return json(res,200,store.dashboard(auth));}
        if(method==='GET'&&route==='/media'){role(auth,'admin');return json(res,200,store.listMedia(auth));}
        if(method==='POST'&&route==='/media'){role(auth,'admin');const{input,auth:current}=await authenticatedBody(req,'admin',12*1024*1024);return json(res,201,store.uploadMedia(current,input));}
        const mediaMatch=route.match(/^\/media\/([A-Za-z0-9-]{1,100})$/);
        if(['GET','HEAD'].includes(method)&&mediaMatch){const asset=store.readMedia(auth,mediaMatch[1]),bytes=Buffer.from(asset.bytes);let start=0,end=bytes.length-1,status=200;
          if(req.headers.range){const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!range||!range[1]&&!range[2]){res.setHeader('Content-Range',`bytes */${bytes.length}`);fail(416,'Khoảng dữ liệu không hợp lệ.');}
            if(!range[1])start=Math.max(0,bytes.length-Number(range[2]));else start=Number(range[1]);if(range[2]&&range[1])end=Math.min(end,Number(range[2]));
            if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=bytes.length){res.setHeader('Content-Range',`bytes */${bytes.length}`);fail(416,'Khoảng dữ liệu không hợp lệ.');}status=206;
          }
          res.writeHead(status,{'Content-Type':asset.mime,'Cache-Control':'no-store, private','Vary':'Cookie','Accept-Ranges':'bytes','Content-Length':end-start+1,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,...(status===206?{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}:{})});res.end(method==='HEAD'?undefined:bytes.subarray(start,end+1));return;
        }
        if(method==='GET'&&route==='/student'){role(auth,'student');return json(res,200,store.studentState(auth));}
        if(method==='POST'&&route==='/classes'){role(auth,'admin');const{input,auth:current}=await authenticatedBody(req,'admin');return json(res,201,store.createClass(current,input));}
        if(method==='POST'&&route==='/students'){
          role(auth,'admin');const{input}=await authenticatedBody(req,'admin'),name=username(input.username),password=input.password||randomBytes(12).toString('base64url'),hashed=await passwordHash(password);
          const current=authenticatedActor(req,'admin'),student=store.createStudent(current,input,hashed,name);return json(res,201,{student,credentials:{username:name,password}});
        }
        const studentMatch=route.match(/^\/students\/([^/]+)(?:\/(reset-password))?$/);
        if(studentMatch){role(auth,'admin');const studentId=decodeURIComponent(studentMatch[1]);
          if(method==='PATCH'&&!studentMatch[2]){const{input,auth:current}=await authenticatedBody(req,'admin');return json(res,200,store.updateStudent(current,studentId,input));}
          if(method==='POST'&&studentMatch[2]){const{input:raw}=await authenticatedBody(req,'admin'),input=shape(raw,['password']),password=input.password||randomBytes(12).toString('base64url'),hashed=await passwordHash(password);
            const currentAuth=authenticatedActor(req,'admin');const row=store.tx(()=>{const current=store.student(currentAuth,studentId);db.prepare('UPDATE users SET password_hash=? WHERE id=? AND workspace_id=?').run(hashed,current.user_id,currentAuth.workspaceId);db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(current.user_id);store.abandonActive(currentAuth,studentId);store.audit(currentAuth,'student.reset-password',studentId);return current;});return json(res,200,{username:row.username,password});}
        }
        if(method==='POST'&&route==='/weeks'){role(auth,'admin');const{input,auth:current}=await authenticatedBody(req,'admin');return json(res,201,store.publishWeek(current,input));}
        if(method==='POST'&&route==='/wallet'){role(auth,'admin');const{input,auth:current}=await authenticatedBody(req,'admin');return json(res,200,store.configureWallet(current,input));}
        if(method==='POST'&&route==='/play'){role(auth,'student');const{input,auth:current}=await authenticatedBody(req,'student');return json(res,201,store.startPlay(current,input));}
        const playMatch=route.match(/^\/play\/([^/]+)\/(attempt|complete|abandon)$/);
        if(method==='POST'&&playMatch){role(auth,'student');const{input,auth:current}=await authenticatedBody(req,'student'),playId=decodeURIComponent(playMatch[1]);
          if(playMatch[2]==='attempt')return json(res,200,store.attempt(current,playId,input));shape(input,[]);return json(res,200,store.finishPlay(current,playId,playMatch[2]==='abandon'));
        }
        if(method==='POST'&&route==='/redemptions'){role(auth,'student');const{input,auth:current}=await authenticatedBody(req,'student');return json(res,201,store.requestReward(current,input));}
        const redemption=route.match(/^\/redemptions\/([^/]+)\/(transition|cancel)$/);
        if(method==='POST'&&redemption){const expected=redemption[2]==='cancel'?'student':'admin';role(auth,expected);const{input,auth:current}=await authenticatedBody(req,expected);return json(res,200,store.transitionReward(current,decodeURIComponent(redemption[1]),input,redemption[2]==='cancel'));}
        fail(404,'Không có thao tác API này.');
      }
      if(!['GET','HEAD'].includes(method))fail(405,'Phương thức không được hỗ trợ.');
      if(path==='/'&&!url.searchParams.has('online')){res.writeHead(302,{Location:'/?online=1','Cache-Control':'no-store'});res.end();return;}
      let decoded;try{decoded=decodeURIComponent(path);}catch{fail(400,'Đường dẫn không hợp lệ.');}if(/[\\\u0000-\u001f]/.test(decoded)||decoded.split('/').some(part=>part==='..'||part.startsWith('.')))fail(404,'Không tìm thấy tệp.');
      let file=resolve(root,`.${decoded==='/'?'/index.html':decoded}`);if(!within(root,file))fail(404,'Không tìm thấy tệp.');
      let info;try{file=await realpath(file);if(!within(root,file))fail(404,'Không tìm thấy tệp.');info=await stat(file);if(!info.isFile())fail(404,'Không tìm thấy tệp.');}catch(error){if(error instanceof OnlineError)throw error;if(req.headers.accept?.includes('text/html')&&!extname(decoded)){file=resolve(root,'index.html');info=await stat(file);}else fail(404,'Không tìm thấy tệp.');}
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      res.writeHead(200,{'Content-Type':MIME[extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':/[/\\]assets[/\\]/.test(file)?'public, max-age=31536000, immutable':'no-cache'});
      if(method==='HEAD')res.end();else{const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);}
    }catch(error){if(res.headersSent){res.destroy();return;}json(res,error instanceof OnlineError?error.status:error instanceof URIError?400:500,{error:error instanceof OnlineError?error.message:error instanceof URIError?'Đường dẫn không hợp lệ.':'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.'});}
  });
  server.requestTimeout=30000;server.headersTimeout=15000;server.maxHeadersCount=80;
  server.onlineStore=store;server.onlineClose=()=>{if(!closed){closed=true;try{store?.close();}finally{for(const preview of recoveryPreviews.values())preview.temporary.remove();recoveryPreviews.clear();releaseDatabaseLock();}}};return server;
}
