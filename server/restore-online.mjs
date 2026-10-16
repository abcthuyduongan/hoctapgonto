import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectOnlineBackup,restoreOnlineDatabase,MAX_RECOVERY_FILE_BYTES} from './online-recovery.mjs';

/** File recovery is explicit and works in a clean data directory with the server stopped. */
export async function main(args=process.argv.slice(2)){
  try{
    const options={};
    for(let index=0;index<args.length;index++){
      const key=args[index];if(!['--file','--data-dir','--confirm'].includes(key)||!args[index+1]||args[index+1].startsWith('--')||key in options)throw new Error('Dùng --file <bản-sao.sqlite> [--data-dir <thư-mục>] [--confirm <sha256-đã-xem>].');
      options[key]=args[++index];
    }
    if(!options['--file'])throw new Error('Chọn bản sao bằng --file <bản-sao.sqlite>. Lần đầu chỉ xem trước, chưa thay dữ liệu.');
    const backupPath=resolve(options['--file']),databasePath=join(resolve(options['--data-dir']||process.env.BAO_AN_DATA_DIR||'.online'),'bao-an.sqlite');
    const preview=inspectOnlineBackup(backupPath,{maxBytes:MAX_RECOVERY_FILE_BYTES}),{workspaceIds,...safe}=preview;void workspaceIds;
    if(!options['--confirm']){
      console.log(JSON.stringify({mode:'PREVIEW_ONLY',...safe,next:'Dừng máy chủ, kiểm tra các số liệu rồi chạy lại cùng --file và --confirm bằng sha256 đã hiển thị. Tài khoản đăng nhập và lượt đang chơi sẽ bị đóng; lịch sử chỉ tới thời điểm của bản sao.'},null,2));return 0;
    }
    if(!/^[a-f0-9]{64}$/.test(options['--confirm'])||options['--confirm']!==preview.sha256)throw new Error('Mã xác nhận không khớp tệp đã chọn. Hãy xem trước lại, không thay dữ liệu.');
    const result=await restoreOnlineDatabase({databasePath,backupPath,expectedSha256:options['--confirm']});console.log(JSON.stringify({...result,next:'Mở lại máy chủ và đăng nhập bằng tài khoản trong bản sao. Kiểm tra lịch sử đổi thưởng sau mốc sao lưu trước khi trao quà.'},null,2));return 0;
  }catch(error){console.error(error.message||'Chưa phục hồi được dữ liệu.');return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
