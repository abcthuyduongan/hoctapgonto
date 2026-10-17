import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {dirname,extname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const DEFAULT_PORT=4173;
export const MIME_TYPES=Object.freeze({
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon',
  '.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wasm':'application/wasm','.glb':'model/gltf-binary',
  '.gltf':'model/gltf+json','.bin':'application/octet-stream','.zip':'application/zip','.woff2':'font/woff2','.woff':'font/woff',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8',
});
const within=(root,path)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`));};

/** Decode before resolving. Reject ambiguous Windows paths and traversal even when URL normalization would hide it. */
export function releaseRequestPath(target){
  if(typeof target!=='string'||target.length>4096||!target.startsWith('/')||target.startsWith('//'))throw new Error('Invalid request path');
  let path=target.split('?')[0];
  for(let pass=0;pass<4;pass++){
    if(/[\\\u0000-\u001f\u007f:#]/.test(path)||/%(?:2f|5c|00)/i.test(path))throw new Error('Invalid request path');
    const parts=path.split('/');
    if(parts.some(part=>part==='..'||part==='.'||/[. ]$/.test(part)))throw new Error('Invalid request path');
    let next;try{next=decodeURIComponent(path);}catch{throw new Error('Invalid path encoding');}
    if(next===path)return path;
    path=next;
  }
  throw new Error('Nested path encoding is not supported');
}
function navigationRequest(request,path){
  if(extname(path)||/^\/(?:assets|audio|models|art|question-templates|api)(?:\/|$)/i.test(path))return false;
  return /(?:^|,)\s*text\/html(?:\s*[;,]|$)/i.test(request.headers.accept??'')&&
    (!request.headers['sec-fetch-mode']||request.headers['sec-fetch-mode']==='navigate');
}
function reply(response,status,message,method){
  response.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  response.end(method==='HEAD'?undefined:message);
}

/** Local static hosting only: the server has no persistence, authentication, payment or application API. */
export async function createReleaseServer({rootDir=resolve(dirname(fileURLToPath(import.meta.url)),'app')}={}){
  const root=await realpath(resolve(rootDir));
  if(!(await stat(root)).isDirectory())throw new Error('Thư mục app không hợp lệ.');
  return createServer(async(request,response)=>{
    response.setHeader('X-Content-Type-Options','nosniff');
    if(request.method!=='GET'&&request.method!=='HEAD'){
      response.setHeader('Allow','GET, HEAD');reply(response,405,'Method not allowed',request.method);return;
    }
    let path;try{path=releaseRequestPath(request.url);}catch{reply(response,400,'Invalid request path',request.method);return;}
    let target=resolve(root,`.${path==='/'?'/index.html':path}`);
    if(!within(root,target)){reply(response,400,'Invalid request path',request.method);return;}
    try{
      let details;
      try{details=await stat(target);}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}
      if(!details?.isFile()){
        if(path!=='/'&&navigationRequest(request,path)){target=resolve(root,'index.html');details=await stat(target);}
        else{reply(response,404,'Not found',request.method);return;}
      }
      if(!details.isFile()){reply(response,404,'Not found',request.method);return;}
      const actual=await realpath(target);
      if(!within(root,actual)){reply(response,403,'Forbidden',request.method);return;}
      response.writeHead(200,{'Content-Type':MIME_TYPES[extname(actual).toLowerCase()]??'application/octet-stream',
        'Content-Length':details.size,'Cache-Control':'no-cache','Cross-Origin-Resource-Policy':'same-origin'});
      if(request.method==='HEAD'){response.end();return;}
      const stream=createReadStream(actual);
      stream.on('error',()=>response.destroy());
      response.on('close',()=>stream.destroy());
      stream.pipe(response);
    }catch(error){
      if(!response.headersSent)reply(response,error.code==='ENOENT'?404:500,error.code==='ENOENT'?'Not found':'Unable to read file',request.method);
      else response.destroy();
    }
  });
}

export function parseServerArguments(args){
  let host='127.0.0.1',port=DEFAULT_PORT,help=false,open=false;const seen=new Set();
  for(let index=0;index<args.length;index++){
    const flag=args[index];if(flag==='--help'||flag==='-h'){help=true;continue;}
    if(flag==='--open'&&!seen.has(flag)){seen.add(flag);open=true;continue;}
    if(!['--host','--port'].includes(flag)||seen.has(flag))throw new Error(`Tùy chọn không hợp lệ: ${flag}`);
    seen.add(flag);const value=args[++index];
    if(flag==='--host'){if(!['127.0.0.1','0.0.0.0'].includes(value))throw new Error('--host chỉ nhận 127.0.0.1 hoặc 0.0.0.0.');host=value;}
    else{if(!/^\d{1,5}$/.test(value??'')||Number(value)<1||Number(value)>65535)throw new Error('--port phải từ 1 đến 65535.');port=Number(value);}
  }
  return {host,port,help,open};
}

export async function main(args=process.argv.slice(2)){
  let options;try{options=parseServerArguments(args);}catch(error){console.error(error.message);return 1;}
  if(options.help){console.log('node serve_release.mjs [--host 127.0.0.1|0.0.0.0] [--port 4173] [--open]\nChỉ phục vụ thư mục app cạnh script. --open mở trình duyệt mặc định trên Windows sau khi server sẵn sàng. Giữ cùng địa chỉ và cổng để dùng lại dữ liệu của trình duyệt.');return 0;}
  try{
    const server=await createReleaseServer();
    await new Promise((accept,reject)=>{server.once('error',reject);server.listen(options.port,options.host,accept);});
    console.log(`Bảo An Tự học: http://127.0.0.1:${options.port}/`);
    console.log('Giữ cửa sổ này trong lúc học. Ctrl+C để dừng. Dữ liệu nằm trong trình duyệt, nên xuất sao lưu định kỳ.');
    if(options.host==='0.0.0.0')console.log('Đã mở thử trong mạng LAN. Dùng HTTPS nếu cần PWA/offline trên máy khác; địa chỉ LAN tạo vùng dữ liệu riêng.');
    if(options.open&&process.platform==='win32'){
      // The command contains only a fixed loopback origin and the already validated integer port.
      const browser=spawn('cmd.exe',['/d','/s','/c',`start "" "http://127.0.0.1:${options.port}/"`],{windowsHide:true,stdio:'ignore'});
      browser.on('error',()=>console.log('Hãy mở địa chỉ trên bằng Edge hoặc Chrome.'));
      browser.unref();
    }
    process.once('SIGINT',()=>server.close());process.once('SIGTERM',()=>server.close());
    return 0;
  }catch(error){console.error(error.code==='EADDRINUSE'?`Cổng ${options.port} đang được dùng. Mở địa chỉ đang chạy nếu đó là Bảo An; kiểm tra cửa sổ trước khi thử lại.`:`Chưa mở được Bảo An: ${error.message}`);return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
