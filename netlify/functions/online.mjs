import {PostgresStore} from '../../server/postgres-store.mjs';
import {createCloudApi,cloudJson} from '../../server/cloud-api.mjs';
import {createPrivateStorage} from '../../server/supabase-storage.mjs';
import {cloudPostgresOptions} from '../../server/cloud-config.mjs';

let handler;
async function initialize(){
  const env=process.env;
  if(!env.SUPABASE_DB_URL||!env.SUPABASE_URL||!(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY)||!env.BAO_AN_PUBLIC_ORIGIN)return null;
  const store=new PostgresStore(cloudPostgresOptions(env));
  try{await store.ready();return createCloudApi({store,storage:createPrivateStorage({url:env.SUPABASE_URL,key:env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY,bucket:env.BAO_AN_MEDIA_BUCKET||'bao-an-media'}),publicOrigin:env.BAO_AN_PUBLIC_ORIGIN,setupToken:env.BAO_AN_SETUP_TOKEN});}catch(error){await store.close();throw error;}
}
export default async(request,context)=>{
  try{if(!handler)handler=initialize().catch(error=>{handler=undefined;throw error;});const ready=await handler;if(!ready){handler=undefined;return cloudJson(503,{available:false,error:'Chưa cấu hình Supabase cho máy chủ. Quản trị viên cần đặt biến môi trường riêng và chạy migration theo hướng dẫn triển khai.'});}return await ready(request,context);}
  catch{return cloudJson(503,{available:false,error:'Máy chủ chưa nối được dữ liệu. Kiểm tra cấu hình PostgreSQL, migration và kho tư liệu trong Supabase.'});}
};
export const config={path:'/api/online/*'};
