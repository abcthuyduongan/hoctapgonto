import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,scryptSync,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {OnlineError,fail,shape,text,integer} from './online-errors.mjs';
import {adminSummary,adminWeek,adminMedia,adminWeekCheck,adminExport} from './admin-data.mjs';
import {audioDurationMs} from './audio-duration.mjs';
import {createFailureReporter,createPerformanceReporter,measureApiSpan,measureApiSerialization,ONLINE_RUNTIME_VERSION} from './api-diagnostics.mjs';
import {readBuildIdentity} from './build-identity.mjs';
import {parseJsonBody} from './json-body.mjs';

const scrypt=promisify(scryptCallback),options={N:32768,r:8,p:1,maxmem:64*1024*1024};
const COOKIE='baoan_online_session',MAX_MEDIA=2*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a??'')).digest(),createHash('sha256').update(String(b??'')).digest());
const dummySalt=randomBytes(16).toString('hex'),dummyHash=`${dummySalt}:${scryptSync(secret(),dummySalt,64,options).toString('hex')}`;
export const privateHeaders={'X-Bao-An-Question-Protocol':'1','Cache-Control':'no-store, private','Netlify-CDN-Cache-Control':'no-store','Pragma':'no-cache','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};
export const cloudJson=(status,value,extra={})=>new Response(measureApiSerialization(()=>JSON.stringify(value)),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8',...extra}});
function username(value){const name=text(value,'Tên đăng nhập',60).toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(name))fail(400,'Tên đăng nhập cần 3–60 chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');return name;}
async function passwordHash(value){if(typeof value!=='string'||value.length<10||value.length>128)fail(400,'Mật khẩu cần từ 10–128 ký tự.');const salt=randomBytes(16).toString('hex');return`${salt}:${(await measureApiSpan('password',()=>scrypt(value,salt,64,options))).toString('hex')}`;}
async function verifyPassword(value,stored){if(typeof value!=='string'||value.length>128)return false;const[salt,expected]=(stored??dummyHash).split(':');return same((await measureApiSpan('password',()=>scrypt(value,salt,64,options))).toString('hex'),expected);}
async function body(request,max=2*1024*1024){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))fail(415,'Yêu cầu phải dùng dữ liệu JSON.');
  if(Number(request.headers.get('content-length')??0)>max)fail(413,'Gói dữ liệu vượt giới hạn kích thước.');
  const reader=request.body?.getReader();if(!reader)fail(400,'Thiếu dữ liệu gửi lên.');const chunks=[];let size=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'Gói dữ liệu vượt giới hạn kích thước.');}chunks.push(value);}}finally{reader.releaseLock();}
  return parseJsonBody(Buffer.concat(chunks),request.headers.get('content-encoding'),max);
}
export function validateCloudMedia(input){
  shape(input,['name','mime','base64']);const name=text(input.name,'Tên tệp',180);if(/[\\/]/.test(name))fail(400,'Tên tệp không được chứa đường dẫn.');
  if(typeof input.base64!=='string'||!input.base64.length||input.base64.length>Math.ceil(MAX_MEDIA/3)*4||input.base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))fail(400,'Tệp đính kèm không hợp lệ hoặc vượt 2 MB.');
  const bytes=Buffer.from(input.base64,'base64');if(bytes.length<12||bytes.length>MAX_MEDIA)fail(400,'Mỗi tệp hình/âm thanh cần từ 12 byte đến 2 MB.');
  let mime;
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
  else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
  else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')mime='image/webp';
  else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE')mime='audio/wav';
  else if(bytes.toString('ascii',0,4)==='OggS')mime='audio/ogg';
  else if(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&0xe0)===0xe0)mime='audio/mpeg';
  else fail(400,'Chỉ nhận ảnh PNG/JPEG/WebP và âm thanh MP3/WAV/OGG đúng định dạng thực.');
  if(input.mime!==mime)fail(400,'Loại tệp khai báo không khớp nội dung.');return{name,mime,bytes,sha256:hash(bytes)};
}

/** Netlify Request/Response adapter. PostgreSQL and private Storage are injected for local tests. */
export function createCloudApi({store,storage,publicOrigin,setupToken,performanceReporter=createPerformanceReporter()}){
  const canonical=new URL(publicOrigin);
  if(canonical.origin!==publicOrigin.replace(/\/$/,'')||canonical.username||canonical.password||!['http:','https:'].includes(canonical.protocol)||canonical.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(canonical.hostname))throw new Error('BAO_AN_PUBLIC_ORIGIN cần origin HTTPS chính xác.');
  const origin=canonical.origin;
  function role(auth,expected){
    const allowed=Array.isArray(expected)?expected:[expected];
    if(!allowed.includes(auth.role))fail(403,allowed.includes('admin')?'Chỉ quản lý hoặc phụ huynh được thực hiện thao tác này.':'Hãy dùng tài khoản học sinh để vào luyện tập.');
  }
  async function identity(auth,currentWorkspace){const workspace=currentWorkspace??await store.workspace(auth.workspaceId),{csrfToken,tokenHash,...user}=auth;void tokenHash;return{user,workspace:{id:workspace.id,name:workspace.name},csrfToken};}
  const userAuth=(row,csrfToken,tokenHash)=>({id:row.id,workspaceId:row.workspace_id,username:row.username,role:row.role,...(row.student_id?{studentId:row.student_id}:{}),csrfToken,...(tokenHash?{tokenHash}:{})});
  async function actor(request){const raw=(request.headers.get('cookie')??'').split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);if(!raw||raw.length>200)fail(401,'Hãy đăng nhập để tiếp tục.');const row=await store.findSession(hash(raw),Date.now());if(!row)fail(401,'Phiên đăng nhập đã hết hạn hoặc tài khoản đã được khóa.');return userAuth(row,row.csrf_token,row.token_hash);}
  function cookie(token,clear=false){return`${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear?0:43200}${canonical.protocol==='https:'?'; Secure':''}`;}
  async function login(user,status=200){const token=secret(),csrfToken=secret(),current=await store.createSession({tokenHash:hash(token),userId:user.id,workspaceId:user.workspace_id,csrfToken,expiresAt:Date.now()+43200000,passwordHash:user.password_hash});return cloudJson(status,await identity(userAuth(current,csrfToken),current.session_workspace),{'Set-Cookie':cookie(token)});}
  async function limit(context,name){await store.consumeLoginLimit({addressHash:hash(`ip:${context.ip??'unknown'}`),userHash:hash(`user:${name}`),now:Date.now()});}
  const reportFailure=createFailureReporter();
  const handle=async(request,context={})=>{
    const started=performance.now();
    try{
      const url=new URL(request.url),method=request.method,route=url.pathname.slice('/api/online'.length),mutable=!['GET','HEAD','OPTIONS'].includes(method);
      if(url.origin!==origin)fail(421,'Địa chỉ máy chủ không đúng cấu hình.');
      if(request.url.length>4096)fail(414,'Đường dẫn quá dài.');
      if(!url.pathname.startsWith('/api/online/'))fail(404,'Không có API này.');
      if(method==='OPTIONS')fail(405,'API chỉ dùng cùng origin.');
      if(mutable&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'))fail(403,'Yêu cầu phải xuất phát từ chính website này.');
      if(method==='GET'&&route==='/status')return cloudJson(200,{available:true,configured:await store.configured(),mediaMaxBytes:MAX_MEDIA,runtimeVersion:ONLINE_RUNTIME_VERSION,questionProtocolVersion:1,mediaUploadEncoding:'gzip',build:await readBuildIdentity()});
      if(method==='GET'&&route==='/contest/presets')return cloudJson(200,await store.contestPresets());
      if(method==='POST'&&route==='/setup'){
        const input=shape(await body(request),['token','name','username','password']);if(await store.configured())fail(409,'Máy chủ đã được khởi tạo. Hãy đăng nhập.');await limit(context,'bootstrap');
        if(!setupToken||setupToken.length<24||!same(input.token,setupToken))fail(403,'Mã khởi tạo không đúng. Lấy mã riêng từ quản trị máy chủ.');
        return await login(await store.createWorkspaceAdmin({name:text(input.name,'Tên đơn vị',120),username:username(input.username),passwordHash:await passwordHash(input.password)}),201);
      }
      if(method==='POST'&&route==='/login'){
        const input=shape(await body(request),['username','password']),name=username(input.username);await limit(context,name);const user=await store.findUserByUsername(name),correct=await verifyPassword(input.password,user?.password_hash);
        if(!correct||!user)fail(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
        const response=await login(user);await store.clearLoginUserLimit(hash(`user:${name}`));return response;
      }
      const auth=await actor(request);if(mutable&&!same(request.headers.get('x-csrf-token'),auth.csrfToken))fail(403,'Phiên xác thực của biểu mẫu đã thay đổi. Hãy tải lại.');
      if(method==='GET'&&route==='/me')return cloudJson(200,await identity(auth));
      if(method==='POST'&&route==='/logout'){shape(await body(request),[]);await store.revokeSession(auth.tokenHash);return cloudJson(200,{ok:true},{'Set-Cookie':cookie('',true)});}
      if(method==='POST'&&route==='/account/password'){
        role(auth,'student');const input=shape(await body(request),['currentPassword','newPassword']);
        await store.consumeLoginLimit({addressHash:hash(`password-ip:${context.ip??'unknown'}`),userHash:hash(`password-user:${auth.id}`),now:Date.now(),purpose:'password'});
        for(const value of [input.currentPassword,input.newPassword])if(typeof value!=='string'||value.length<10||value.length>128)fail(400,'Mật khẩu cần từ 10–128 ký tự.');
        if(same(input.currentPassword,input.newPassword))fail(400,'Mật khẩu mới cần khác mật khẩu hiện tại.');
        const user=await store.findUserById(auth.id);if(!await verifyPassword(input.currentPassword,user?.password_hash))fail(400,'Mật khẩu hiện tại chưa đúng.');
        const result=await store.changeOwnPassword(auth,user.password_hash,await passwordHash(input.newPassword));return cloudJson(200,result,{'Set-Cookie':cookie('',true)});
      }
      if(method==='GET'&&route==='/admin/summary')return cloudJson(200,await adminSummary(store,auth,Object.fromEntries(url.searchParams)));
      const adminWeekMatch=route.match(/^\/admin\/weeks\/([^/]+)$/);
      if(method==='GET'&&adminWeekMatch)return cloudJson(200,await adminWeek(store,auth,decodeURIComponent(adminWeekMatch[1])));
      if(method==='GET'&&route==='/admin/media')return cloudJson(200,await adminMedia(store,auth,Object.fromEntries(url.searchParams)));
      const exportMatch=route.match(/^\/admin\/export\/weeks\/([^/]+)$/);
      if(method==='GET'&&exportMatch)return cloudJson(200,await adminExport(store,auth,decodeURIComponent(exportMatch[1])));
      if(method==='POST'&&route==='/admin/media/lookup')return cloudJson(200,await adminMedia(store,auth,await body(request)));
      if(method==='POST'&&route==='/admin/week-check')return cloudJson(200,await adminWeekCheck(store,auth,await body(request)));
      if(method==='GET'&&route==='/dashboard'){role(auth,'admin');return cloudJson(200,await store.dashboard(auth));}
      if(method==='GET'&&route==='/recovery'){role(auth,'admin');return cloudJson(200,{supported:false,reason:'Bản cloud dùng công cụ sao lưu và phục hồi PostgreSQL cùng Storage trong Supabase. Không khôi phục tệp SQLite trực tiếp vào môi trường này.'});}
      if(method==='GET'&&route==='/student'){role(auth,'student');if(request.headers.get('x-bao-an-question-protocol')!=='1')fail(409,'Ứng dụng đã được cập nhật. Hãy tải lại trang; sao đã lưu vẫn được giữ.');return cloudJson(200,await store.studentSummary(auth));}
      if(method==='GET'&&route==='/student/map'){role(auth,'student');const query=Object.fromEntries(url.searchParams.entries());return cloudJson(200,await store.studentMap(auth,query));}
      if(method==='GET'&&route==='/student/summary'){role(auth,'student');return cloudJson(200,await store.studentSummary(auth,url.searchParams.get('cursor')??'0'));}
      if(method==='POST'&&route==='/student/journey'){role(auth,'student');return cloudJson(200,await store.ensureJourney(auth,await body(request)));}
      if(method==='POST'&&route==='/student/advance-week'){role(auth,'student');return cloudJson(200,await store.advanceWeek(auth,await body(request)));}
      if(method==='POST'&&route==='/student/discovery/view'){role(auth,'student');const b=await body(request);return cloudJson(200,await store.viewDiscovery(auth,b.packId));}
      const gamesMatch=route.match(/^\/student\/pack\/([^/]+)\/(\d+)\/games$/);
      if(method==='GET'&&gamesMatch){role(auth,'student');return cloudJson(200,await store.packGames(auth,text(decodeURIComponent(gamesMatch[1]),'Mã bộ',80),integer(Number(gamesMatch[2]),'Phiên bản')));}
      if(method==='GET'&&route==='/media'){role(auth,'admin');return cloudJson(200,await store.listMedia(auth));}
      if(method==='POST'&&route==='/media/batch'){
        role(auth,'admin');const input=shape(await body(request,3*1024*1024),['files']);
        if(!Array.isArray(input.files)||input.files.length<1||input.files.length>24)fail(400,'Mỗi đợt tải cần 1–24 tệp.');
        const files=input.files.map(validateCloudMedia);
        if(files.reduce((n,file)=>n+file.bytes.length,0)>MAX_MEDIA)fail(400,'Mỗi đợt tải tối đa 2 MB.');
        for(const file of files)if(file.mime.startsWith('audio/'))await audioDurationMs(file.bytes,file.mime);
        const existing=await store.listMedia(auth),uploaded=[],pending=[];
        for(const file of files)if(!existing.some(row=>row.name===file.name&&row.sha256===file.sha256)&&!pending.some(row=>row.name===file.name&&row.sha256===file.sha256)){
          const id=randomUUID();pending.push({...file,id,objectPath:`${auth.workspaceId}/${id}`});
        }
        if(!pending.length)return cloudJson(201,files.map(file=>existing.find(row=>row.name===file.name&&row.sha256===file.sha256)));
        let assets;
        try{
          // Bound Storage concurrency; the database commits the entire batch once.
          for(let offset=0;offset<pending.length;offset+=3){
            const results=await Promise.allSettled(pending.slice(offset,offset+3).map(async file=>{await measureApiSpan('storage',()=>storage.upload(file.objectPath,file.bytes,file.mime));uploaded.push(file);return file;}));
            const failed=results.find(row=>row.status==='rejected');if(failed)throw failed.reason;
          }
          assets=await store.addMediaBatch(auth,pending);
        }catch(error){await Promise.allSettled(uploaded.map(file=>storage.remove(file.objectPath)));throw error;}
        // Cleanup after commit must never remove objects referenced by committed rows.
        const used=new Set(assets.map(row=>row.id));await Promise.allSettled(uploaded.filter(file=>!used.has(file.id)).map(file=>storage.remove(file.objectPath)));
        return cloudJson(201,files.map(file=>assets.find(row=>row.name===file.name&&row.sha256===file.sha256)??existing.find(row=>row.name===file.name&&row.sha256===file.sha256)));
      }
      if(method==='POST'&&route==='/media'){
        role(auth,'admin');const input=validateCloudMedia(await body(request,3*1024*1024));if(input.mime.startsWith('audio/'))await audioDurationMs(input.bytes,input.mime);const existing=(await store.listMedia(auth)).find(row=>row.name===input.name&&row.sha256===input.sha256);if(existing)return cloudJson(201,existing);
        const id=randomUUID(),objectPath=`${auth.workspaceId}/${id}`;await measureApiSpan('storage',()=>storage.upload(objectPath,input.bytes,input.mime));
        try{const asset=await store.addMedia(auth,{id,name:input.name,mime:input.mime,bytes:input.bytes,objectPath});if(asset.id!==id)await storage.remove(objectPath);return cloudJson(201,asset);}catch(error){await storage.remove(objectPath).catch(()=>{});throw error;}
      }
      const media=route.match(/^\/media\/([A-Za-z0-9-]{1,100})$/);
      if(['GET','HEAD'].includes(method)&&media){
        const asset=await store.getMedia(auth,media[1]);let start=0,end=asset.size-1,status=200;const range=request.headers.get('range');
        if(range){const matched=/^bytes=(\d*)-(\d*)$/.exec(range);if(!matched||!matched[1]&&!matched[2])return cloudJson(416,{error:'Khoảng dữ liệu không hợp lệ.'},{'Content-Range':`bytes */${asset.size}`});
          start=matched[1]?Number(matched[1]):Math.max(0,asset.size-Number(matched[2]));if(matched[1]&&matched[2])end=Math.min(end,Number(matched[2]));
          if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=asset.size)return cloudJson(416,{error:'Khoảng dữ liệu không hợp lệ.'},{'Content-Range':`bytes */${asset.size}`});status=206;
        }
        // Images are immutable (random id, write-once object): the viewer's own browser may keep them.
        // Audio stays no-store because every listening question needs its own delivery receipt.
        const etag=`"${asset.sha256}"`,image=asset.kind==='image';
        const cache=image?{'Cache-Control':'private, max-age=31536000, immutable','ETag':etag,'Pragma':''}:{};
        if(image&&method==='GET'&&!range&&(request.headers.get('if-none-match')??'').split(',').map(value=>value.trim().replace(/^W\//,'')).includes(etag)){const notModified={...privateHeaders,...cache};delete notModified.Pragma;return new Response(null,{status:304,headers:notModified});}
        const headers={...privateHeaders,...cache,'Content-Type':asset.mime,'Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,...(status===206?{'Content-Range':`bytes ${start}-${end}/${asset.size}`}:{})};
        if(image)delete headers.Pragma;
        if(method==='HEAD')return new Response(null,{status,headers});const bytes=await measureApiSpan('storage',()=>storage.download(asset.object_path,asset.sha256));
        if(bytes.length!==asset.size||hash(bytes)!==asset.sha256)fail(502,'Tệp tư liệu không khớp dữ liệu đã duyệt.');if(auth.role==='student'&&asset.kind==='audio'&&url.searchParams.has('playId')&&start===0&&end===asset.size-1)await store.recordAudioDelivery(auth,url.searchParams.get('playId'),url.searchParams.get('itemId'),media[1],await audioDurationMs(bytes,asset.mime));return new Response(bytes.subarray(start,end+1),{status,headers});
      }
      if(method==='POST'&&route==='/classes'){role(auth,'admin');return cloudJson(201,await store.createClass(auth,await body(request)));}
      if(method==='POST'&&route==='/students'){role(auth,'admin');const input=await body(request),name=username(input.username),password=input.password||randomBytes(12).toString('base64url'),student=await store.createStudent(auth,input,await passwordHash(password),name);return cloudJson(201,{student,credentials:{username:name,password}});}
      const student=route.match(/^\/students\/([^/]+)(?:\/(reset-password))?$/);
      if(student){role(auth,'admin');const id=decodeURIComponent(student[1]);if(method==='PATCH'&&!student[2])return cloudJson(200,await store.updateStudent(auth,id,await body(request)));if(method==='POST'&&student[2]){const input=shape(await body(request),['password']),password=input.password||randomBytes(12).toString('base64url'),row=await store.resetStudentPassword(auth,id,await passwordHash(password));return cloudJson(200,{username:row.username,password});}}
      if(method==='POST'&&route==='/weeks'){role(auth,'admin');return cloudJson(201,await store.publishWeek(auth,await body(request)));}
      if(method==='POST'&&route==='/wallet'){role(auth,'admin');return cloudJson(200,await store.configureWallet(auth,await body(request)));}
      if(method==='POST'&&['/play','/play/compact'].includes(route)){role(auth,'student');if(request.headers.get('x-bao-an-question-protocol')!=='1')fail(409,'Ứng dụng đã được cập nhật. Hãy tải lại trang trước khi mở trò chơi; sao đã lưu vẫn được giữ.');return cloudJson(201,await store.startPlay(auth,await body(request),route==='/play/compact',true));}
      const play=route.match(/^\/play\/([^/]+)\/(attempt|question-open|question-hint|complete|complete-compact|abandon)$/);
      if(method==='POST'&&play){role(auth,'student');const input=await body(request),id=decodeURIComponent(play[1]);if(play[2]==='attempt')return cloudJson(200,await store.attempt(auth,id,input,true));if(play[2]==='question-hint')return cloudJson(200,await store.questionHint(auth,id,input));if(play[2]==='question-open')return cloudJson(200,await store.openQuestion(auth,id,input,true));shape(input,[]);return cloudJson(200,await store.finishPlay(auth,id,play[2]==='abandon',true,true));}
      if(method==='POST'&&route==='/redemptions'){role(auth,'student');return cloudJson(201,await store.requestReward(auth,await body(request)));}
      const redemption=route.match(/^\/redemptions\/([^/]+)\/(transition|cancel)$/);
      if(method==='POST'&&redemption){role(auth,redemption[2]==='cancel'?'student':['admin','parent']);return cloudJson(200,await store.transitionReward(auth,decodeURIComponent(redemption[1]),await body(request),redemption[2]==='cancel'));}
      if(method==='GET'&&route==='/gifts'){return cloudJson(200,await store.gifts(auth,url.searchParams.get('classId')));}
      if(method==='POST'&&route==='/gifts'){role(auth,'admin');return cloudJson(201,await store.createGift(auth,await body(request)));}
      const giftMatch=route.match(/^\/gifts\/([^/]+)$/);
      if(giftMatch&&(method==='PATCH'||method==='PUT'||method==='POST')){role(auth,'admin');return cloudJson(200,await store.updateGift(auth,decodeURIComponent(giftMatch[1]),await body(request)));}
      if(method==='GET'&&route==='/student/goal'){role(auth,'student');return cloudJson(200,await store.studentGoal(auth));}
      if(method==='POST'&&route==='/student/goal'){role(auth,'student');const input=await body(request);return cloudJson(200,await store.setStudentGoal(auth,input.giftId));}
      if(method==='POST'&&route==='/student/redeem-gift'){role(auth,'student');return cloudJson(201,await store.redeemGift(auth,await body(request)));}
      const confirmMatch=route.match(/^\/student\/redemptions\/([^/]+)\/confirm-received$/);
      if(method==='POST'&&confirmMatch){role(auth,'student');return cloudJson(200,await store.confirmReceived(auth,decodeURIComponent(confirmMatch[1]))); }
      if(method==='GET'&&route==='/student/badges'){role(auth,'student');return cloudJson(200,await store.studentBadges(auth));}
      if(method==='GET'&&route==='/student/streak'){role(auth,'student');return cloudJson(200,await store.studentStreak(auth));}
      if(method==='GET'&&route==='/student/daily-missions'){role(auth,'student');return cloudJson(200,await store.studentDailyMissions(auth));}
      if(method==='POST'&&route==='/student/daily-riddle/answer'){role(auth,'student');return cloudJson(200,await store.answerDailyRiddle(auth,await body(request)));}
      if(method==='POST'&&route==='/parent/setup-pin'){
        role(auth,['student','admin']);
        const input=await body(request);
        const studentId=auth.role==='student'?auth.studentId:input.studentId;
        return cloudJson(200,await store.setupParentPin(auth,studentId,input));
      }
      if(method==='POST'&&route==='/parent/verify-pin'){
        role(auth,'student');
        const input=await body(request);
        return cloudJson(200,await store.verifyParentPin(auth,auth.studentId,input.pin));
      }
      if(method==='GET'&&route==='/parent/dashboard'){
        role(auth,['student','admin','parent']);
        const studentId=auth.role==='student'?auth.studentId:(url.searchParams.get('studentId')||auth.studentId);
        const weekId=url.searchParams.get('weekId')||undefined;
        return cloudJson(200,await store.parentDashboard(auth,studentId,weekId));
      }
      if(method==='POST'&&route==='/parent/settings'){
        role(auth,['student','admin','parent']);
        const input=await body(request);
        const studentId=auth.role==='student'?auth.studentId:input.studentId;
        return cloudJson(200,await store.updateParentSettings(auth,studentId,input));
      }
      if(method==='GET'&&route==='/parent/students'){
        role(auth,'parent');
        return cloudJson(200,await store.parentStudents(auth));
      }
      if(method==='POST'&&route==='/parents'){
        role(auth,'admin');
        const input=await body(request);
        const uname=username(input.username);
        const password=input.password||randomBytes(12).toString('base64url');
        const hash=await passwordHash(password);
        const created=await store.createParent(auth,input,hash,uname);
        return cloudJson(201,{parent:created,credentials:{username:uname,password}});
      }
      if(method==='GET'&&route==='/contest/presets'){
        role(auth,['student','admin','parent']);
        return cloudJson(200,await store.contestPresets(auth));
      }
      if(method==='POST'&&route==='/contest/start'){
        role(auth,'student');
        const input=await body(request);
        return cloudJson(200,await store.startContest(auth,input));
      }
      if(method==='GET'&&route==='/contest/active'){
        role(auth,'student');
        return cloudJson(200,await store.activeContest(auth));
      }
      if(method==='POST'&&/^\/contest\/([^/]+)\/save$/.test(route)){
        role(auth,'student');
        const sessionId=decodeURIComponent(route.match(/^\/contest\/([^/]+)\/save$/)[1]);
        const input=await body(request);
        return cloudJson(200,await store.saveContestProgress(auth,sessionId,input));
      }
      if(method==='POST'&&/^\/contest\/([^/]+)\/submit$/.test(route)){
        role(auth,'student');
        const sessionId=decodeURIComponent(route.match(/^\/contest\/([^/]+)\/submit$/)[1]);
        const input=await body(request);
        return cloudJson(200,await store.submitContest(auth,sessionId,input));
      }
      if(method==='GET'&&route==='/contest/history'){
        role(auth,['student','admin','parent']);
        const studentId=auth.role==='student'?auth.studentId:(url.searchParams.get('studentId')||auth.studentId);
        const presetId=url.searchParams.get('presetId')||undefined;
        return cloudJson(200,await store.contestHistory(auth,studentId,presetId));
      }
      if(method==='POST'&&/^\/contest\/([^/]+)\/review-pack$/.test(route)){
        role(auth,'student');
        const sessionId=decodeURIComponent(route.match(/^\/contest\/([^/]+)\/review-pack$/)[1]);
        return cloudJson(200,await store.contestReviewPack(auth,sessionId));
      }
      if(method==='GET'&&route==='/town'){
        const studentId=auth.role==='student'?auth.studentId:url.searchParams.get('studentId');
        if(!studentId)fail(400,'Thiếu mã học sinh.');
        return cloudJson(200,await store.townSummary(auth,studentId));
      }
      if(method==='POST'&&route==='/town/build'){
        role(auth,'student');
        const input=await body(request);
        return cloudJson(200,await store.placeBuilding(auth,auth.studentId,input));
      }
      if(method==='POST'&&route==='/town/recalculate'){
        const input=await body(request);
        const studentId=auth.role==='student'?auth.studentId:(input.studentId||url.searchParams.get('studentId'));
        if(!studentId)fail(400,'Thiếu mã học sinh.');
        return cloudJson(200,await store.recalculateMaterials(auth,studentId));
      }
      if(method==='GET'&&route==='/town/animals'){
        const studentId=auth.role==='student'?auth.studentId:url.searchParams.get('studentId');
        if(!studentId)fail(400,'Thiếu mã học sinh.');
        return cloudJson(200,await store.townAnimals(auth,studentId));
      }
      if(method==='POST'&&route==='/town/animals/name'){
        role(auth,'student');
        const input=await body(request);
        return cloudJson(200,await store.nameTownAnimal(auth,auth.studentId,input));
      }
      if(method==='GET'&&route==='/town/classmates'){
        role(auth,'student');
        return cloudJson(200,await store.classmatesTowns(auth,auth.studentId));
      }
      if(method==='GET'&&route==='/town/visit'){
        role(auth,'student');
        const targetStudentId=url.searchParams.get('studentId');
        if(!targetStudentId)fail(400,'Thiếu mã học sinh cần ghé thăm.');
        return cloudJson(200,await store.visitTown(auth,auth.studentId,targetStudentId));
      }
      if(method==='POST'&&route==='/town/cheer'){
        role(auth,'student');
        const input=await body(request);
        if(!input.targetStudentId)fail(400,'Thiếu mã học sinh được cổ vũ.');
        return cloudJson(200,await store.cheerClassmate(auth,auth.studentId,input.targetStudentId));
      }
      if(method==='GET'&&route==='/class-feed'){
        const student=auth.role==='student'?await store.student(auth,auth.studentId):null;
        const classId=student?student.class_id:url.searchParams.get('classId');
        if(!classId)fail(400,'Thiếu mã lớp học.');
        return cloudJson(200,await store.classFeed(auth,classId));
      }
      if(method==='POST'&&/^\/classes\/[^/]+\/feed-toggle$/.test(route)){
        role(auth,'admin');
        const classId=decodeURIComponent(route.match(/^\/classes\/([^/]+)\/feed-toggle$/)[1]);
        const input=await body(request);
        return cloudJson(200,await store.updateClassSettings(auth,classId,input));
      }
      fail(404,'Không có thao tác API này.');
    }catch(error){const status=error instanceof OnlineError?error.status:error instanceof URIError?400:500,supportId=reportFailure(new URL(request.url).pathname,request.method,status,performance.now()-started,error);return cloudJson(status,{error:error instanceof OnlineError?error.message:error instanceof URIError?'Đường dẫn không hợp lệ.':'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.',...(supportId?{supportId}:{})});}
  };
  return(request,context)=>performanceReporter(new URL(request.url).pathname,request.method,()=>handle(request,context));
}
