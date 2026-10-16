import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,scryptSync,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {OnlineError,fail,shape,text} from './online-errors.mjs';

const scrypt=promisify(scryptCallback),options={N:32768,r:8,p:1,maxmem:64*1024*1024};
const COOKIE='baoan_online_session',MAX_MEDIA=2*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a??'')).digest(),createHash('sha256').update(String(b??'')).digest());
const dummySalt=randomBytes(16).toString('hex'),dummyHash=`${dummySalt}:${scryptSync(secret(),dummySalt,64,options).toString('hex')}`;
export const privateHeaders={'Cache-Control':'no-store, private','Netlify-CDN-Cache-Control':'no-store','Pragma':'no-cache','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};
export const cloudJson=(status,value,extra={})=>new Response(JSON.stringify(value),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8',...extra}});
function username(value){const name=text(value,'Tên đăng nhập',60).toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(name))fail(400,'Tên đăng nhập cần 3–60 chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');return name;}
async function passwordHash(value){if(typeof value!=='string'||value.length<10||value.length>128)fail(400,'Mật khẩu cần từ 10–128 ký tự.');const salt=randomBytes(16).toString('hex');return`${salt}:${(await scrypt(value,salt,64,options)).toString('hex')}`;}
async function verifyPassword(value,stored){if(typeof value!=='string'||value.length>128)return false;const[salt,expected]=(stored??dummyHash).split(':');return same((await scrypt(value,salt,64,options)).toString('hex'),expected);}
async function body(request,max=2*1024*1024){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))fail(415,'Yêu cầu phải dùng dữ liệu JSON.');
  if(Number(request.headers.get('content-length')??0)>max)fail(413,'Gói dữ liệu vượt giới hạn kích thước.');
  const reader=request.body?.getReader();if(!reader)fail(400,'Thiếu dữ liệu gửi lên.');const chunks=[];let size=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'Gói dữ liệu vượt giới hạn kích thước.');}chunks.push(value);}}finally{reader.releaseLock();}
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'Dữ liệu JSON không đọc được.');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Dữ liệu gửi lên cần là một đối tượng JSON.');return value;
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
export function createCloudApi({store,storage,publicOrigin,setupToken}){
  const canonical=new URL(publicOrigin);
  if(canonical.origin!==publicOrigin.replace(/\/$/,'')||canonical.username||canonical.password||!['http:','https:'].includes(canonical.protocol)||canonical.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(canonical.hostname))throw new Error('BAO_AN_PUBLIC_ORIGIN cần origin HTTPS chính xác.');
  const origin=canonical.origin;
  function role(auth,expected){if(auth.role!==expected)fail(403,expected==='admin'?'Chỉ quản lý được thực hiện thao tác này.':'Hãy dùng tài khoản học sinh để vào luyện tập.');}
  async function identity(auth){const workspace=await store.workspace(auth.workspaceId),{csrfToken,tokenHash,...user}=auth;void tokenHash;return{user,workspace:{id:workspace.id,name:workspace.name},csrfToken};}
  const userAuth=(row,csrfToken,tokenHash)=>({id:row.id,workspaceId:row.workspace_id,username:row.username,role:row.role,...(row.student_id?{studentId:row.student_id}:{}),csrfToken,...(tokenHash?{tokenHash}:{})});
  async function actor(request){const raw=(request.headers.get('cookie')??'').split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);if(!raw||raw.length>200)fail(401,'Hãy đăng nhập để tiếp tục.');const row=await store.findSession(hash(raw),Date.now());if(!row)fail(401,'Phiên đăng nhập đã hết hạn hoặc tài khoản đã được khóa.');return userAuth(row,row.csrf_token,row.token_hash);}
  function cookie(token,clear=false){return`${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear?0:43200}${canonical.protocol==='https:'?'; Secure':''}`;}
  async function login(user,status=200){const token=secret(),csrfToken=secret(),current=await store.createSession({tokenHash:hash(token),userId:user.id,csrfToken,expiresAt:Date.now()+43200000,passwordHash:user.password_hash});return cloudJson(status,await identity(userAuth(current,csrfToken)),{'Set-Cookie':cookie(token)});}
  async function limit(context,name){await store.consumeLoginLimit({addressHash:hash(`ip:${context.ip??'unknown'}`),userHash:hash(`user:${name}`),now:Date.now()});}
  return async(request,context={})=>{
    try{
      const url=new URL(request.url),method=request.method,route=url.pathname.slice('/api/online'.length),mutable=!['GET','HEAD','OPTIONS'].includes(method);
      if(url.origin!==origin)fail(421,'Địa chỉ máy chủ không đúng cấu hình.');
      if(request.url.length>4096)fail(414,'Đường dẫn quá dài.');
      if(!url.pathname.startsWith('/api/online/'))fail(404,'Không có API này.');
      if(method==='OPTIONS')fail(405,'API chỉ dùng cùng origin.');
      if(mutable&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'))fail(403,'Yêu cầu phải xuất phát từ chính website này.');
      if(method==='GET'&&route==='/status')return cloudJson(200,{available:true,configured:await store.configured(),mediaMaxBytes:MAX_MEDIA});
      if(method==='POST'&&route==='/setup'){
        const input=shape(await body(request),['token','name','username','password']);if(await store.configured())fail(409,'Máy chủ đã được khởi tạo. Hãy đăng nhập.');await limit(context,'bootstrap');
        if(!setupToken||setupToken.length<24||!same(input.token,setupToken))fail(403,'Mã khởi tạo không đúng. Lấy mã riêng từ quản trị máy chủ.');
        return await login(await store.createWorkspaceAdmin({name:text(input.name,'Tên đơn vị',120),username:username(input.username),passwordHash:await passwordHash(input.password)}),201);
      }
      if(method==='POST'&&route==='/login'){
        const input=shape(await body(request),['username','password']),name=username(input.username);await limit(context,name);const user=await store.findUserByUsername(name),correct=await verifyPassword(input.password,user?.password_hash);
        const current=user&&await store.findUserById(user.id);if(!correct||!current||!current.active||current.password_hash!==user.password_hash)fail(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
        const response=await login(current);await store.clearLoginUserLimit(hash(`user:${name}`));return response;
      }
      const auth=await actor(request);if(mutable&&!same(request.headers.get('x-csrf-token'),auth.csrfToken))fail(403,'Phiên xác thực của biểu mẫu đã thay đổi. Hãy tải lại.');
      if(method==='GET'&&route==='/me')return cloudJson(200,await identity(auth));
      if(method==='POST'&&route==='/logout'){shape(await body(request),[]);await store.revokeSession(auth.tokenHash);return cloudJson(200,{ok:true},{'Set-Cookie':cookie('',true)});}
      if(method==='GET'&&route==='/dashboard'){role(auth,'admin');return cloudJson(200,await store.dashboard(auth));}
      if(method==='GET'&&route==='/recovery'){role(auth,'admin');return cloudJson(200,{supported:false,reason:'Bản cloud dùng công cụ sao lưu và phục hồi PostgreSQL cùng Storage trong Supabase. Không khôi phục tệp SQLite trực tiếp vào môi trường này.'});}
      if(method==='GET'&&route==='/student'){role(auth,'student');return cloudJson(200,await store.studentState(auth));}
      if(method==='GET'&&route==='/media'){role(auth,'admin');return cloudJson(200,await store.listMedia(auth));}
      if(method==='POST'&&route==='/media'){
        role(auth,'admin');const input=validateCloudMedia(await body(request,3*1024*1024)),existing=(await store.listMedia(auth)).find(row=>row.name===input.name&&row.sha256===input.sha256);if(existing)return cloudJson(201,existing);
        const id=randomUUID(),objectPath=`${auth.workspaceId}/${id}`;await storage.upload(objectPath,input.bytes,input.mime);
        try{const asset=await store.addMedia(auth,{id,name:input.name,mime:input.mime,bytes:input.bytes,objectPath});if(asset.id!==id)await storage.remove(objectPath);return cloudJson(201,asset);}catch(error){await storage.remove(objectPath).catch(()=>{});throw error;}
      }
      const media=route.match(/^\/media\/([A-Za-z0-9-]{1,100})$/);
      if(['GET','HEAD'].includes(method)&&media){
        const asset=await store.getMedia(auth,media[1]);let start=0,end=asset.size-1,status=200;const range=request.headers.get('range');
        if(range){const matched=/^bytes=(\d*)-(\d*)$/.exec(range);if(!matched||!matched[1]&&!matched[2])return cloudJson(416,{error:'Khoảng dữ liệu không hợp lệ.'},{'Content-Range':`bytes */${asset.size}`});
          start=matched[1]?Number(matched[1]):Math.max(0,asset.size-Number(matched[2]));if(matched[1]&&matched[2])end=Math.min(end,Number(matched[2]));
          if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=asset.size)return cloudJson(416,{error:'Khoảng dữ liệu không hợp lệ.'},{'Content-Range':`bytes */${asset.size}`});status=206;
        }
        const headers={...privateHeaders,'Content-Type':asset.mime,'Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,...(status===206?{'Content-Range':`bytes ${start}-${end}/${asset.size}`}:{})};
        if(method==='HEAD')return new Response(null,{status,headers});const bytes=await storage.download(asset.object_path);
        if(bytes.length!==asset.size||hash(bytes)!==asset.sha256)fail(502,'Tệp tư liệu không khớp dữ liệu đã duyệt.');return new Response(bytes.subarray(start,end+1),{status,headers});
      }
      if(method==='POST'&&route==='/classes'){role(auth,'admin');return cloudJson(201,await store.createClass(auth,await body(request)));}
      if(method==='POST'&&route==='/students'){role(auth,'admin');const input=await body(request),name=username(input.username),password=input.password||randomBytes(12).toString('base64url'),student=await store.createStudent(auth,input,await passwordHash(password),name);return cloudJson(201,{student,credentials:{username:name,password}});}
      const student=route.match(/^\/students\/([^/]+)(?:\/(reset-password))?$/);
      if(student){role(auth,'admin');const id=decodeURIComponent(student[1]);if(method==='PATCH'&&!student[2])return cloudJson(200,await store.updateStudent(auth,id,await body(request)));if(method==='POST'&&student[2]){const input=shape(await body(request),['password']),password=input.password||randomBytes(12).toString('base64url'),row=await store.resetStudentPassword(auth,id,await passwordHash(password));return cloudJson(200,{username:row.username,password});}}
      if(method==='POST'&&route==='/weeks'){role(auth,'admin');return cloudJson(201,await store.publishWeek(auth,await body(request)));}
      if(method==='POST'&&route==='/wallet'){role(auth,'admin');return cloudJson(200,await store.configureWallet(auth,await body(request)));}
      if(method==='POST'&&route==='/play'){role(auth,'student');return cloudJson(201,await store.startPlay(auth,await body(request)));}
      const play=route.match(/^\/play\/([^/]+)\/(attempt|complete|abandon)$/);
      if(method==='POST'&&play){role(auth,'student');const input=await body(request),id=decodeURIComponent(play[1]);if(play[2]==='attempt')return cloudJson(200,await store.attempt(auth,id,input));shape(input,[]);return cloudJson(200,await store.finishPlay(auth,id,play[2]==='abandon'));}
      if(method==='POST'&&route==='/redemptions'){role(auth,'student');return cloudJson(201,await store.requestReward(auth,await body(request)));}
      const redemption=route.match(/^\/redemptions\/([^/]+)\/(transition|cancel)$/);
      if(method==='POST'&&redemption){role(auth,redemption[2]==='cancel'?'student':'admin');return cloudJson(200,await store.transitionReward(auth,decodeURIComponent(redemption[1]),await body(request),redemption[2]==='cancel'));}
      fail(404,'Không có thao tác API này.');
    }catch(error){return cloudJson(error instanceof OnlineError?error.status:error instanceof URIError?400:500,{error:error instanceof OnlineError?error.message:error instanceof URIError?'Đường dẫn không hợp lệ.':'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.'});}
  };
}
