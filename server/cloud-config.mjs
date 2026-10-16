/** Never let sslmode in a pasted connection URI replace certificate verification. */
export function cloudPostgresOptions(env=process.env,{migration=false}={}){
  const variable=migration&&env.SUPABASE_MIGRATION_DB_URL?'SUPABASE_MIGRATION_DB_URL':'SUPABASE_DB_URL';
  let url;try{url=new URL(env[variable]);}catch{throw new Error(`${variable} cần URI PostgreSQL hợp lệ.`);}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.password||url.pathname.length<2||url.hash)throw new Error(`${variable} cần URI PostgreSQL đủ máy chủ, tài khoản, mật khẩu và tên cơ sở dữ liệu.`);
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
  const ca=migration&&env.SUPABASE_MIGRATION_DB_URL?(env.SUPABASE_MIGRATION_DB_CA||env.SUPABASE_DB_CA):env.SUPABASE_DB_CA;
  return{connectionString:url.toString(),max:1,ssl:{rejectUnauthorized:true,...(ca?{ca:ca.replace(/\\n/g,'\n')}:{})}};
}
