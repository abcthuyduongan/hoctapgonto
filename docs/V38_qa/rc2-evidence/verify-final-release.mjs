import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute,sep} from 'node:path';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {unzipSync} from 'fflate';

const root=resolve('.'),version=JSON.parse(await readFile('package.json','utf8')).version;
const zipPath=join(root,'releases',`bao-an-learning-${version}.zip`),zip=await readFile(zipPath);
const prefix=`bao-an-learning-${version}/`,archive=unzipSync(zip);
const fixture=join(root,'test-results',`rc2-release-verify-${randomUUID()}`);
const extract=join(fixture,'Giải nén sạch có dấu');await mkdir(extract,{recursive:true});
let child,output='';
const inside=(parent,target)=>{const rel=relative(parent,target);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};
try{
  for(const [name,bytes] of Object.entries(archive)){
    assert.ok(name.startsWith(prefix));const destination=resolve(extract,...name.slice(prefix.length).split('/'));
    assert.ok(inside(extract,destination));await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
  }
  const manifest=JSON.parse(await readFile(join(extract,'release.json'),'utf8'));
  assert.equal(manifest.version,version);assert.equal(manifest.releaseReady,false);assert.equal(manifest.humanPilotStatus,'UNVERIFIED');
  assert.deepEqual(manifest.storageSchemas,{localSqlite:1,cloudPostgres:1});
  assert.equal(Object.keys(archive).length,manifest.files.length+1);
  for(const file of manifest.files){const bytes=await readFile(join(extract,...file.path.split('/')));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
  assert.deepEqual(manifest.files.filter(f=>f.path.startsWith('app/question-templates/')).map(f=>f.path).sort(),['app/question-templates/online-week.docx','app/question-templates/online-week.xlsx']);
  assert.ok(!manifest.files.some(f=>/\.sqlite(?:-|$)|bootstrap-token|MO_HO_SO_CU|app\/audio\//.test(f.path)));
  const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;
  await new Promise(done=>socket.close(done));const origin=`http://127.0.0.1:${port}`;
  const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('BAO_AN_')||['NODE_PATH','NODE_OPTIONS'].includes(key))delete env[key];
  Object.assign(env,{BAO_AN_HOST:'127.0.0.1',BAO_AN_PORT:String(port),BAO_AN_STATIC_DIR:'app',BAO_AN_DATA_DIR:'data',NODE_PATH:''});
  child=spawn(process.execPath,[join(extract,'online-local.mjs')],{cwd:extract,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  for(const pipe of [child.stdout,child.stderr])pipe.on('data',chunk=>{output=(output+chunk).slice(-8192);});
  let status;for(let attempt=0;attempt<150;attempt++){assert.equal(child.exitCode,null,output);try{const response=await fetch(origin+'/api/online/status',{signal:AbortSignal.timeout(500)});if(response.ok){status=await response.json();break;}}catch{}await delay(100);}
  assert.deepEqual(status,{available:true,configured:false});
  const page=await fetch(origin+'/?online=0');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy')??'',/script-src/);
  const html=await page.text(),entry=html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];assert.ok(entry);
  const response=await fetch(origin+entry);assert.equal(response.status,200);
  for(const url of ['/data/bao-an.sqlite','/data/bootstrap-token.txt','/online-local.mjs'])assert.equal((await fetch(origin+url)).status,404);
  const db=new DatabaseSync(join(extract,'data','bao-an.sqlite'),{readOnly:true});let counts;
  try{counts=Object.fromEntries(['workspaces','users','classes','students','weeks','packs','plays','attempts','awards'].map(table=>[table,db.prepare(`SELECT count(*) n FROM ${table}`).get().n]));for(const count of Object.values(counts))assert.equal(count,0);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
  const report={version,buildId:manifest.buildId,zip:relative(root,zipPath).replaceAll('\\','/'),zipBytes:zip.length,zipSha256:createHash('sha256').update(zip).digest('hex'),manifestFiles:manifest.files.length,storageSchemas:manifest.storageSchemas,actualZipHashesVerified:true,extractedUnicodeFolderBooted:true,emptyDatabase:counts,onlyWordExcelTemplates:true,privateFilesBlocked:true,releaseReady:manifest.releaseReady,humanPilotStatus:manifest.humanPilotStatus};
  await writeFile(join(root,'docs/V38_qa/RC2_RELEASE_VERIFICATION_2026-10-16.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{
  if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}
  assert.equal(dirname(fixture),join(root,'test-results'));assert.match(fixture.split(sep).at(-1),/^rc2-release-verify-[a-f0-9-]+$/);assert.ok(inside(root,fixture));await rm(fixture,{recursive:true,force:true});
}
