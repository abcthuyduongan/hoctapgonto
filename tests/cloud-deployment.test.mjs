import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {CLOUD_TABLES,CLOUD_MEDIA_OPTIONS,CloudDeploymentError,deploymentConfig,prepareCloud} from '../server/cloud-deployment.mjs';

const env=()=>({
  SUPABASE_DB_URL:'postgresql://runtime:private-db-password@pooler.example.test:6543/postgres',
  SUPABASE_MIGRATION_DB_URL:'postgresql://owner:private-owner-password@db.example.test:5432/postgres',
  SUPABASE_URL:'https://project.example.test',SUPABASE_SECRET_KEY:'sb_secret_private-test-fixture',
  BAO_AN_PUBLIC_ORIGIN:'https://bao-an.example.test',BAO_AN_SETUP_TOKEN:'private-bootstrap-token-fixture-2026',
});
const metadata=(options=CLOUD_MEDIA_OPTIONS)=>({id:'bao-an-media',public:options.public,file_size_limit:options.fileSizeLimit,allowed_mime_types:[...options.allowedMimeTypes]});

async function fixture(t,{bucket=null}={}){
  const db=new PGlite();await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  t.after(()=>db.close());
  const sql=[],storageCalls=[],connections=[];let current=bucket,endCalls=0;
  const storage={
    async getBucket(name){storageCalls.push({method:'getBucket',name});return current?{data:structuredClone(current),error:null}:{data:null,error:{statusCode:'404',message:'Not found'}};},
    async createBucket(name,options){storageCalls.push({method:'createBucket',name,options:structuredClone(options)});assert.equal(current,null);current=metadata(options);return{data:structuredClone(current),error:null};},
    async updateBucket(name,options){storageCalls.push({method:'updateBucket',name,options:structuredClone(options)});assert.ok(current);current=metadata(options);return{data:structuredClone(current),error:null};},
  };
  const createDatabase=options=>{connections.push(options);return{
    async connect(){},async end(){endCalls++;},
    async query(statement){sql.push(statement);return(await db.exec(statement)).at(-1)??{rows:[]};},
  };};
  return{db,sql,storageCalls,connections,get endCalls(){return endCalls;},run:options=>prepareCloud({env:env(),createDatabase,createStorage:()=>storage,...options})};
}
async function counts(db){const rows={};for(const table of CLOUD_TABLES)rows[table]=Number((await db.query(`SELECT count(*) AS n FROM bao_an.${table}`)).rows[0].n);return rows;}

test('cloud setup applies the real migration to sixteen empty private tables and creates only private bucket metadata',async t=>{
  const f=await fixture(t),report=await f.run();
  assert.deepEqual(report,{mode:'setup',schemaVersion:1,tables:16,rls:true,browserAccessBlocked:true,configured:false,privateBucket:true,mediaMaxBytes:2097152});
  const expected=Object.fromEntries(CLOUD_TABLES.map(name=>[name,name==='schema_version'?1:0]));assert.deepEqual(await counts(f.db),expected);
  assert.deepEqual(f.storageCalls.map(row=>row.method),['getBucket','createBucket','getBucket']);
  assert.deepEqual(f.storageCalls[1].options,CLOUD_MEDIA_OPTIONS);
  assert.equal(new URL(f.connections[0].connectionString).username,'owner');assert.equal(f.connections[0].ssl.rejectUnauthorized,true);
  assert.equal(f.connections[0].connectionTimeoutMillis,10000);assert.equal(f.connections[0].statement_timeout,30000);assert.equal(f.endCalls,1);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await f.db.query("SELECT has_schema_privilege($1,'bao_an','USAGE') AS allowed",[role])).rows[0].allowed,false);
});

test('reapplying setup preserves real accounts and classes, and check uses runtime URI with SELECT and bucket reads only',async t=>{
  const f=await fixture(t);await f.run();
  await f.db.exec("INSERT INTO bao_an.workspaces(id,name,created_at) VALUES('school','School','2026-10-16'); INSERT INTO bao_an.users(id,workspace_id,username,password_hash,role,created_at) VALUES('manager','school','manager','salt:existing-hash','admin','2026-10-16'); INSERT INTO bao_an.classes(id,workspace_id,name,grade,created_at) VALUES('class','school','Class 3',3,'2026-10-16');");
  const before=await counts(f.db),account=await f.db.query('SELECT * FROM bao_an.users');
  assert.equal((await f.run()).configured,true);assert.deepEqual(await counts(f.db),before);assert.deepEqual(await f.db.query('SELECT * FROM bao_an.users'),account);
  assert.deepEqual(f.storageCalls.filter(row=>row.method!=='getBucket').map(row=>row.method),['createBucket','updateBucket']);
  f.sql.length=0;f.storageCalls.length=0;
  const checked=await f.run({check:true,loadMigration(){assert.fail('check must not load or execute a migration');}});
  assert.equal(checked.mode,'check');assert.equal(checked.configured,true);
  assert.ok(f.sql.length>=4);assert.ok(f.sql.every(statement=>/^SELECT\b/i.test(statement.trim())));
  assert.deepEqual(f.storageCalls.map(row=>row.method),['getBucket','getBucket']);assert.equal(new URL(f.connections.at(-1).connectionString).username,'runtime');
  assert.deepEqual(await counts(f.db),before);assert.equal(f.endCalls,3);
});

test('check does not initialize an empty database or fix a missing or misconfigured bucket',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.run({check:true}),CloudDeploymentError);
  assert.ok(f.sql.every(statement=>/^SELECT\b/i.test(statement.trim())));assert.deepEqual(f.storageCalls.map(row=>row.method),['getBucket']);
  assert.equal((await f.db.query("SELECT count(*) AS n FROM pg_namespace WHERE nspname='bao_an'")).rows[0].n,0);
  await f.run();f.storageCalls.length=0;
  await assert.rejects(f.run({check:true,createStorage:()=>({async getBucket(){return{data:{...metadata(),file_size_limit:8388608},error:null};}})}),/2 MB/);
  assert.equal(f.storageCalls.length,0);
});

test('an existing public bucket is refused before SQL mutation or storage update',async t=>{
  const f=await fixture(t,{bucket:{...metadata(),public:true}});
  await assert.rejects(f.run(),/Bucket đang công khai/);
  assert.deepEqual(f.sql,[]);assert.deepEqual(f.storageCalls.map(row=>row.method),['getBucket']);assert.equal(f.endCalls,1);
  assert.equal((await f.db.query("SELECT count(*) AS n FROM pg_namespace WHERE nspname='bao_an'")).rows[0].n,0);
});

test('read-only check detects service-role, schema, column, sequence, function and PUBLIC privilege drift',async t=>{
  const f=await fixture(t);await f.run();
  await f.db.exec("CREATE FUNCTION bao_an.fixture_private_fn() RETURNS integer LANGUAGE SQL AS 'SELECT 1'; REVOKE ALL ON FUNCTION bao_an.fixture_private_fn() FROM PUBLIC;");
  for(const[grant,revoke]of [
    ['GRANT USAGE ON SCHEMA bao_an TO service_role; GRANT SELECT ON bao_an.users TO service_role;','REVOKE ALL ON SCHEMA bao_an FROM service_role; REVOKE ALL ON bao_an.users FROM service_role;'],
    ['GRANT CREATE ON SCHEMA bao_an TO authenticated;','REVOKE ALL ON SCHEMA bao_an FROM authenticated;'],
    ['GRANT SELECT(username) ON bao_an.users TO authenticated;','REVOKE SELECT(username) ON bao_an.users FROM authenticated;'],
    ['GRANT USAGE ON SEQUENCE bao_an.redemptions_created_order_seq TO anon;','REVOKE ALL ON SEQUENCE bao_an.redemptions_created_order_seq FROM anon;'],
    ['GRANT EXECUTE ON FUNCTION bao_an.fixture_private_fn() TO authenticated;','REVOKE ALL ON FUNCTION bao_an.fixture_private_fn() FROM authenticated;'],
    ['GRANT SELECT ON bao_an.users TO PUBLIC;','REVOKE ALL ON bao_an.users FROM PUBLIC;'],
  ]){
    await f.db.exec(grant);f.sql.length=0;f.storageCalls.length=0;
    await assert.rejects(f.run({check:true}),error=>error instanceof CloudDeploymentError&&/quyền/.test(error.message));
    assert.ok(f.sql.every(statement=>/^SELECT\b/i.test(statement.trim())));assert.ok(f.storageCalls.every(row=>row.method==='getBucket'));
    await f.db.exec(revoke);
    assert.equal((await f.run({check:true})).browserAccessBlocked,true);
  }
});

test('deployment validation refuses missing settings and browser keys before opening any connection',async()=>{
  for(const name of ['SUPABASE_DB_URL','SUPABASE_URL','BAO_AN_PUBLIC_ORIGIN','BAO_AN_SETUP_TOKEN','SUPABASE_SECRET_KEY']){
    const input=env();delete input[name];
    await assert.rejects(prepareCloud({env:input,createDatabase(){assert.fail('invalid configuration must not connect');}}),error=>error instanceof CloudDeploymentError&&/Thiếu cấu hình/.test(error.message));
  }
  const jwt=role=>`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role})).toString('base64url')}.private-signature`;
  for(const key of ['sb_publishable_browser-fixture',jwt('anon'),jwt('authenticated')])assert.throws(()=>deploymentConfig({...env(),SUPABASE_SECRET_KEY:key}),CloudDeploymentError);
  const legacy=env();delete legacy.SUPABASE_SECRET_KEY;legacy.SUPABASE_SERVICE_ROLE_KEY=jwt('service_role');assert.equal(deploymentConfig(legacy).key,legacy.SUPABASE_SERVICE_ROLE_KEY);
  for(const changes of [{SUPABASE_URL:'http://project.example.test'},{BAO_AN_PUBLIC_ORIGIN:'https://bao-an.example.test/path'},{BAO_AN_MEDIA_BUCKET:'Public Bucket'},{BAO_AN_SETUP_TOKEN:'short'}])assert.throws(()=>deploymentConfig({...env(),...changes}),CloudDeploymentError);
});

test('migration failure rolls back all SQL changes, leaves Storage untouched, and hides raw secret-bearing errors',async t=>{
  const f=await fixture(t),privateValue='PRIVATE_MIGRATION_ERROR_SECRET';
  await assert.rejects(f.run({loadMigration:()=>`CREATE SCHEMA failed_cloud_setup; CREATE TABLE failed_cloud_setup.rows(id integer); INSERT INTO failed_cloud_setup.rows VALUES(1); SELECT ${privateValue};`}),error=>error instanceof CloudDeploymentError&&/migration SQL/.test(error.message)&&!error.message.includes(privateValue));
  assert.ok(f.sql.includes('BEGIN'));assert.ok(f.sql.includes('ROLLBACK'));assert.equal(f.sql.includes('COMMIT'),false);
  assert.equal((await f.db.query("SELECT count(*) AS n FROM pg_namespace WHERE nspname='failed_cloud_setup'")).rows[0].n,0);
  assert.deepEqual(f.storageCalls.map(row=>row.method),['getBucket']);assert.equal(f.endCalls,1);
});

test('connection failures explain TLS, login and network problems without exposing URI, keys or raw error messages',async()=>{
  for(const[code,expected]of [['CERT_HAS_EXPIRED',/chứng chỉ/],['28P01',/tài khoản hoặc mật khẩu/],['ENOTFOUND',/Chưa kết nối/],['XX000',/kết nối PostgreSQL/]]){
    const input=env(),raw=`${input.SUPABASE_DB_URL} ${input.SUPABASE_SECRET_KEY} ${input.BAO_AN_SETUP_TOKEN}`;let ended=0;
    await assert.rejects(prepareCloud({env:input,createDatabase:()=>({async connect(){throw Object.assign(new Error(raw),{code});},async end(){ended++;}}),createStorage(){assert.fail('a failed connection must not access Storage');}}),error=>error instanceof CloudDeploymentError&&expected.test(error.message)&&!error.message.includes('private-')&&!error.message.includes('sb_secret_'));
    assert.equal(ended,1);
  }
});
