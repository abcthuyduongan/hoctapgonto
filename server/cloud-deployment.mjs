import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {cloudPostgresOptions} from './cloud-config.mjs';

export const CLOUD_TABLES=Object.freeze(['schema_version','workspaces','users','auth_sessions','login_limits','classes','students','packs','weeks','week_sets','plays','attempts','awards','redemptions','audit','media']);
export const CLOUD_MEDIA_OPTIONS=Object.freeze({public:false,fileSizeLimit:2097152,allowedMimeTypes:['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','audio/ogg']});
export class CloudDeploymentError extends Error{}
const fail=message=>{throw new CloudDeploymentError(message);};

export function deploymentConfig(env=process.env){
  const required=['SUPABASE_DB_URL','SUPABASE_URL','BAO_AN_PUBLIC_ORIGIN','BAO_AN_SETUP_TOKEN'];
  const missing=required.filter(name=>!env[name]?.trim());
  if(!(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY)?.trim())missing.push('SUPABASE_SECRET_KEY (hoặc SUPABASE_SERVICE_ROLE_KEY)');
  if(missing.length)fail(`Thiếu cấu hình: ${missing.join(', ')}. Điền .env.cloud.local theo .env.cloud.example.`);
  for(const name of ['SUPABASE_URL','BAO_AN_PUBLIC_ORIGIN']){
    let url;try{url=new URL(env[name]);}catch{fail(`${name} cần origin HTTPS hợp lệ.`);}
    if(url.protocol!=='https:'||url.username||url.password||url.origin!==env[name].replace(/\/$/,''))fail(`${name} cần origin HTTPS, không có đường dẫn hoặc thông tin đăng nhập.`);
  }
  if(env.BAO_AN_SETUP_TOKEN.length<24)fail('BAO_AN_SETUP_TOKEN cần chuỗi ngẫu nhiên ít nhất 24 ký tự.');
  const bucket=env.BAO_AN_MEDIA_BUCKET||'bao-an-media';
  if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket))fail('BAO_AN_MEDIA_BUCKET cần 3–63 chữ thường, số hoặc dấu gạch ngang.');
  const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  if(key.startsWith('sb_publishable_'))fail('Dùng khóa Supabase secret/service_role dành cho máy chủ, không dùng publishable key.');
  if(key.split('.').length===3){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='service_role')fail('JWT Supabase phải là service_role, không dùng anon key.');}catch(error){if(error instanceof CloudDeploymentError)throw error;fail('Khóa Supabase JWT không đọc được.');}}
  try{cloudPostgresOptions(env);cloudPostgresOptions(env,{migration:true});}catch(error){fail(error.message);}
  return{bucket,key,url:env.SUPABASE_URL};
}

function safeFailure(error,stage){
  if(error instanceof CloudDeploymentError)return error;
  const code=error?.code;
  if(['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code))return new CloudDeploymentError('Chưa xác minh được chứng chỉ PostgreSQL. Kiểm tra SUPABASE_DB_CA/SUPABASE_MIGRATION_DB_CA; giữ bật xác minh TLS.');
  if(['28P01','28000'].includes(code))return new CloudDeploymentError('PostgreSQL từ chối tài khoản hoặc mật khẩu. Kiểm tra URI và mã hóa ký tự đặc biệt trong mật khẩu.');
  if(['ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EHOSTUNREACH','ENETUNREACH'].includes(code))return new CloudDeploymentError('Chưa kết nối được PostgreSQL. Kiểm tra dự án có đang hoạt động, URI Connect, pooler và mạng.');
  return new CloudDeploymentError(`Chưa hoàn tất bước ${stage}. Kiểm tra quyền và cấu hình theo docs/NETLIFY_SUPABASE.md.`);
}

async function verifyDatabase(database){
  const versions=(await database.query('SELECT version FROM bao_an.schema_version ORDER BY version')).rows;
  if(versions.length!==1||versions[0].version!==1)fail('Schema bao_an chưa đúng phiên bản 1. Chạy cloud:setup trước.');
  const tables=(await database.query("SELECT c.relname AS name,c.relrowsecurity AS rls, (r.rolsuper OR r.rolbypassrls OR pg_has_role(c.relowner,'USAGE')) AS bypass, has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT') AND has_table_privilege(current_user,c.oid,'UPDATE') AND has_table_privilege(current_user,c.oid,'DELETE') AS writable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.rolname=current_user WHERE n.nspname='bao_an' AND c.relkind='r'")).rows;
  for(const name of CLOUD_TABLES){const table=tables.find(row=>row.name===name);if(!table||!table.rls||!table.bypass||!table.writable)fail('Schema thiếu bảng/RLS hoặc tài khoản PostgreSQL của ứng dụng chưa đủ quyền. Chạy cloud:setup và kiểm tra đúng URI server.');}
  const browser=(await database.query("SELECT rolname FROM pg_roles r WHERE rolname IN ('anon','authenticated','service_role') AND (has_schema_privilege(r.oid,'bao_an','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bao_an' AND c.relkind IN ('r','p') AND (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bao_an' AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='bao_an' AND has_function_privilege(r.oid,p.oid,'EXECUTE')))")).rows;
  if(browser.length)fail('Role trình duyệt còn quyền vào bao_an. Áp dụng lại migration thu hồi quyền trước khi triển khai.');
  const publicAccess=(await database.query("SELECT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='bao_an' AND a.grantee=0) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::\"char\" ELSE 'r'::\"char\" END,c.relowner))) a WHERE n.nspname='bao_an' AND c.relkind IN ('r','p','S') AND a.grantee=0) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='bao_an' AND a.grantee=0) AS allowed")).rows[0]?.allowed;
  if(publicAccess)fail('PUBLIC còn quyền vào schema hoặc đối tượng bao_an. Áp dụng lại migration trước khi triển khai.');
  const configured=(await database.query("SELECT EXISTS(SELECT 1 FROM bao_an.users WHERE role='admin') AS configured")).rows[0]?.configured===true;
  return{schemaVersion:1,tables:CLOUD_TABLES.length,rls:true,browserAccessBlocked:true,configured};
}

/** Setup is explicit; check never writes schema, buckets, accounts, or fixtures. */
export async function prepareCloud({env=process.env,check=false,createDatabase=options=>new pg.Client(options),createStorage=config=>createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}}).storage,loadMigration=()=>readFile(new URL('../supabase/migrations/202610150001_online.sql',import.meta.url),'utf8')}={}){
  const config=deploymentConfig(env),{max,...connection}=cloudPostgresOptions(env,{migration:!check});void max;
  const database=createDatabase({...connection,connectionTimeoutMillis:10000,statement_timeout:30000});
  let stage='kết nối PostgreSQL',inTransaction=false;
  try{
    await database.connect();
    const storage=createStorage(config);
    stage='kiểm tra Storage';
    const{data:existing,error:bucketError}=await storage.getBucket(config.bucket);
    if(bucketError&&String(bucketError.statusCode??bucketError.status)!=='404')fail('Chưa đọc được bucket. Kiểm tra SUPABASE_URL và khóa secret/service_role cùng dự án.');
    if(existing?.public)fail('Bucket đang công khai. Chọn bucket riêng mới; công cụ không tự thay bucket công khai đang dùng.');
    if(!check){
      stage='migration SQL';await database.query('BEGIN');inTransaction=true;
      await database.query("SET LOCAL lock_timeout='10000ms'");
      await database.query(await loadMigration());await database.query('COMMIT');inTransaction=false;
      stage='thiết lập bucket riêng tư';
      const result=existing?await storage.updateBucket(config.bucket,CLOUD_MEDIA_OPTIONS):await storage.createBucket(config.bucket,CLOUD_MEDIA_OPTIONS);
      if(result.error)fail('SQL đã hoàn tất nhưng chưa đặt được bucket riêng tư/giới hạn tệp. Kiểm tra quyền Storage rồi chạy lại cloud:setup.');
    }
    stage='xác minh schema và quyền';const databaseReport=await verifyDatabase(database);
    stage='xác minh bucket';const{data:bucket,error:verifyError}=await storage.getBucket(config.bucket);
    if(verifyError||!bucket||bucket.public||Number(bucket.file_size_limit)!==CLOUD_MEDIA_OPTIONS.fileSizeLimit||!Array.isArray(bucket.allowed_mime_types)||bucket.allowed_mime_types.length!==CLOUD_MEDIA_OPTIONS.allowedMimeTypes.length||!CLOUD_MEDIA_OPTIONS.allowedMimeTypes.every(mime=>bucket.allowed_mime_types.includes(mime)))fail('Bucket chưa riêng tư hoặc chưa đúng giới hạn 2 MB/định dạng. Chạy cloud:setup rồi cloud:check lại.');
    return{mode:check?'check':'setup',...databaseReport,privateBucket:true,mediaMaxBytes:CLOUD_MEDIA_OPTIONS.fileSizeLimit};
  }catch(error){if(inTransaction)await database.query('ROLLBACK').catch(()=>{});throw safeFailure(error,stage);}
  finally{await database.end().catch(()=>{});}
}
