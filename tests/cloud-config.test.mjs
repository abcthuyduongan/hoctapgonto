import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {build} from 'esbuild';
import {cloudPostgresOptions} from '../server/cloud-config.mjs';

test('cloud PostgreSQL always verifies TLS even if a copied URI tries to disable SSL or override its CA',()=>{
  const options=cloudPostgresOptions({SUPABASE_DB_URL:'postgresql://fixture:fake-password@db.example.test:6543/postgres?sslmode=disable&sslrootcert=bad.pem',SUPABASE_DB_CA:'line-one\\nline-two'});
  const client=new pg.Client(options);
  assert.equal(client.ssl.rejectUnauthorized,true);assert.equal(client.ssl.ca,'line-one\nline-two');assert.equal(client.host,'db.example.test');assert.equal(client.port,6543);
  assert.throws(()=>cloudPostgresOptions({SUPABASE_DB_URL:'https://db.example.test/'}));
  assert.equal(options.max,1);
});

test('cloud migration can use a separate owner URI and CA while runtime keeps its transaction-pooler settings',()=>{
  const env={SUPABASE_DB_URL:'postgresql://runtime:runtime-fixture@pooler.example.test:6543/postgres?sslmode=disable',SUPABASE_DB_CA:'runtime-one\\nline-two',SUPABASE_MIGRATION_DB_URL:'postgresql://owner:owner-fixture@db.example.test:5432/postgres?sslrootcert=untrusted.pem',SUPABASE_MIGRATION_DB_CA:'owner-one\\nline-two'};
  const runtime=cloudPostgresOptions(env),migration=cloudPostgresOptions(env,{migration:true});
  assert.equal(new URL(runtime.connectionString).username,'runtime');assert.equal(runtime.ssl.ca,'runtime-one\nline-two');
  assert.equal(new URL(migration.connectionString).username,'owner');assert.equal(migration.ssl.ca,'owner-one\nline-two');assert.equal(migration.ssl.rejectUnauthorized,true);assert.equal(migration.max,1);assert.equal(new URL(migration.connectionString).searchParams.has('sslrootcert'),false);
  assert.equal(cloudPostgresOptions({...env,SUPABASE_MIGRATION_DB_CA:''},{migration:true}).ssl.ca,runtime.ssl.ca);
  assert.equal(cloudPostgresOptions({...env,SUPABASE_MIGRATION_DB_URL:''},{migration:true}).connectionString,runtime.connectionString);
  for(const value of ['postgresql://db.example.test/postgres','postgresql://user@db.example.test/postgres','postgresql://user:pass@db.example.test/'])assert.throws(()=>cloudPostgresOptions({SUPABASE_DB_URL:value}),/URI PostgreSQL/);
});

test('bundled Netlify function has no SQLite dependency and returns a private configuration error before any external connection',async t=>{
  const root=resolve('test-results');await mkdir(root,{recursive:true});const folder=await mkdtemp(join(root,'cloud-bundle-'));
  t.after(async()=>{assert.equal(dirname(folder),root);await rm(folder,{recursive:true,force:true});});
  const result=await build({entryPoints:['netlify/functions/online.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true,external:['pg','@supabase/supabase-js'],logLevel:'silent'});
  assert.equal(Object.keys(result.metafile.inputs).some(path=>path.endsWith('online-store.mjs')),false);
  assert.equal(result.outputFiles[0].text.includes('node:sqlite'),false);
  const path=join(folder,'online.mjs');await writeFile(path,result.outputFiles[0].contents);
  const{default:handler,config}=await import(pathToFileURL(path).href);assert.equal(config.path,'/api/online/*');
  const fixture={SUPABASE_DB_URL:'postgresql://fixture:PRIVATE_DATABASE_PASSWORD@pooler.example.test:6543/postgres',SUPABASE_URL:'https://private-project.example.test',SUPABASE_SECRET_KEY:'sb_secret_PRIVATE_SERVER_KEY',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_LEGACY_ROLE_KEY',BAO_AN_PUBLIC_ORIGIN:'https://private-site.example.test',BAO_AN_SETUP_TOKEN:'PRIVATE_SETUP_TOKEN_2026_DO_NOT_EXPOSE'};
  const previous=Object.fromEntries(Object.keys(fixture).map(name=>[name,process.env[name]])),originalQuery=pg.Pool.prototype.query;
  let connections=0;
  pg.Pool.prototype.query=async()=>{connections++;throw new Error(Object.values(fixture).join(' '));};
  async function responseFor(input){
    for(const name of Object.keys(fixture)){if(input[name]===undefined)delete process.env[name];else process.env[name]=input[name];}
    const response=await handler(new Request('https://cloud.example.test/api/online/status'),{ip:'192.0.2.50'});
    assert.equal(response.status,503);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('netlify-cdn-cache-control'),'no-store');
    const text=await response.text();for(const value of Object.values(fixture))assert.ok(!text.includes(value),'configuration failures must never include environment values');
    const data=JSON.parse(text);assert.equal(data.available,false);return data;
  }
  try{
    const secretChoice='SUPABASE_SECRET_KEY (hoặc SUPABASE_SERVICE_ROLE_KEY)';
    assert.deepEqual((await responseFor({})).missingVariables,['SUPABASE_DB_URL','SUPABASE_URL','BAO_AN_PUBLIC_ORIGIN',secretChoice]);
    for(const name of ['SUPABASE_DB_URL','SUPABASE_URL','BAO_AN_PUBLIC_ORIGIN']){
      const data=await responseFor({...fixture,[name]:'   '});assert.deepEqual(data.missingVariables,[name]);assert.ok(data.error.includes(name));assert.match(data.error,/Functions/);assert.match(data.error,/redeploy/);
    }
    assert.deepEqual((await responseFor({...fixture,SUPABASE_SECRET_KEY:undefined,SUPABASE_SERVICE_ROLE_KEY:'   '})).missingVariables,[secretChoice]);
    assert.deepEqual((await responseFor({...fixture,SUPABASE_SECRET_KEY:undefined,BAO_AN_PUBLIC_ORIGIN:undefined})).missingVariables,['BAO_AN_PUBLIC_ORIGIN']);
    assert.equal(connections,0,'missing settings must be detected before opening a PostgreSQL connection');
    const failedConnection=await responseFor(fixture);assert.equal(failedConnection.missingVariables,undefined);assert.equal(connections,1);
    assert.deepEqual((await responseFor({...fixture,SUPABASE_DB_URL:undefined})).missingVariables,['SUPABASE_DB_URL']);assert.equal(connections,1);
  }
  finally{
    pg.Pool.prototype.query=originalQuery;
    for(const[name,value]of Object.entries(previous)){if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
});
