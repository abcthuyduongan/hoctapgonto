import {prepareCloud} from './cloud-deployment.mjs';

try{
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--check'))throw new Error('Chỉ hỗ trợ tùy chọn --check. Xem docs/NETLIFY_SUPABASE.md.');
  const report=await prepareCloud({check:args.includes('--check')});
  console.log(JSON.stringify(report,null,2));
  console.log(report.mode==='check'?'Kiểm tra đạt. Không thay đổi dữ liệu hoặc bucket.':'Đã chuẩn bị SQL và bucket riêng tư. Không tạo tài khoản hoặc câu hỏi mẫu. Chạy cloud:check để kiểm tra URI runtime trước khi deploy.');
}catch(error){console.error(error.message);process.exitCode=1;}
