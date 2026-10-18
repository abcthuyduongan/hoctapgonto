import {PostgresStore} from '../../server/postgres-store.mjs';
import {createCloudApi,cloudJson} from '../../server/cloud-api.mjs';
import {createPrivateStorage} from '../../server/supabase-storage.mjs';
import {cloudPostgresOptions} from '../../server/cloud-config.mjs';
import {createFailureReporter} from '../../server/api-diagnostics.mjs';

let handler;
const reportFailure=createFailureReporter();
function missingConfiguration(env){
  const missing=['SUPABASE_DB_URL','SUPABASE_URL','BAO_AN_PUBLIC_ORIGIN'].filter(name=>!env[name]?.trim());
  if(!env.SUPABASE_SECRET_KEY?.trim()&&!env.SUPABASE_SERVICE_ROLE_KEY?.trim())missing.push('SUPABASE_SECRET_KEY (hoặc SUPABASE_SERVICE_ROLE_KEY)');
  return missing;
}
async function initialize(){
  const env=process.env;
  const store=new PostgresStore(cloudPostgresOptions(env));
  try{await store.ready();return createCloudApi({store,storage:createPrivateStorage({url:env.SUPABASE_URL,key:env.SUPABASE_SECRET_KEY?.trim()||env.SUPABASE_SERVICE_ROLE_KEY?.trim(),bucket:env.BAO_AN_MEDIA_BUCKET||'bao-an-media'}),publicOrigin:env.BAO_AN_PUBLIC_ORIGIN,setupToken:env.BAO_AN_SETUP_TOKEN});}catch(error){await store.close();throw error;}
}
export default async(request,context)=>{
  const started=performance.now();
  const missing=missingConfiguration(process.env);
  if(missing.length)return cloudJson(503,{available:false,missingVariables:missing,error:`Chưa cấu hình Supabase cho máy chủ. Thiếu biến: ${missing.join(', ')}. Thêm các biến này vào Environment variables của Netlify với phạm vi Functions (hoặc All scopes), rồi triển khai lại (redeploy).`});
  try{if(!handler)handler=initialize().catch(error=>{handler=undefined;throw error;});const ready=await handler;return await ready(request,context);}
  catch{const supportId=reportFailure(new URL(request.url).pathname,request.method,503,performance.now()-started);return cloudJson(503,{available:false,error:'Máy chủ chưa nối được dữ liệu. Kiểm tra cấu hình PostgreSQL, migration và kho tư liệu trong Supabase.',...(supportId?{supportId}:{})});}
};
export const config={path:'/api/online/*'};
