import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createOnlineServer} from './online-server.mjs';

const dataDir=resolve(process.env.BAO_AN_DATA_DIR||'.online');
await mkdir(dataDir,{recursive:true});
const tokenFile=join(dataDir,'bootstrap-token.txt');
let setupToken=process.env.BAO_AN_SETUP_TOKEN;
if(!setupToken){try{setupToken=(await readFile(tokenFile,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;setupToken=randomBytes(32).toString('base64url');await writeFile(tokenFile,setupToken+'\n',{flag:'wx',mode:0o600});}}
if(setupToken.length<24)throw new Error('Mã khởi tạo cần ít nhất 24 ký tự ngẫu nhiên.');
const host=process.env.BAO_AN_HOST||'127.0.0.1',port=Number(process.env.BAO_AN_PORT||4180);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('BAO_AN_PORT không hợp lệ.');
if(!['127.0.0.1','0.0.0.0','::1'].includes(host))throw new Error('BAO_AN_HOST không hợp lệ.');
if(host==='0.0.0.0'&&!process.env.BAO_AN_PUBLIC_ORIGIN)throw new Error('Khi mở truy cập ngoài máy, cần BAO_AN_PUBLIC_ORIGIN dùng HTTPS.');
const server=createOnlineServer({databasePath:join(dataDir,'bao-an.sqlite'),staticRoot:resolve(process.env.BAO_AN_STATIC_DIR||'dist'),publicOrigin:process.env.BAO_AN_PUBLIC_ORIGIN,setupToken});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Cổng ${port} đang được sử dụng. Hãy kiểm tra máy chủ đã mở.`:'Chưa khởi động được máy chủ online.');server.onlineClose();process.exitCode=1;});
server.listen(port,host,()=>{
  console.log(`Bảo An Online: ${process.env.BAO_AN_PUBLIC_ORIGIN||`http://127.0.0.1:${port}`}/?online=1`);
  console.log(`Dữ liệu máy chủ: ${join(dataDir,'bao-an.sqlite')}`);
  if(!server.onlineStore.configured())console.log(`Chưa có tài khoản. Lấy mã khởi tạo từ tệp riêng: ${tokenFile}`);
  console.log('Giữ tiến trình này chạy trong lúc sử dụng. Ctrl+C để dừng.');
});
let stopping=false;
function stop(){if(stopping)return;stopping=true;server.close(()=>server.onlineClose());server.closeIdleConnections();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
