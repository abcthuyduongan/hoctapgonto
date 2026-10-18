/** Verify the delivered ZIP from a fresh OS temp folder without repository node_modules. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join,dirname,basename,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {unzipSync} from 'fflate';
import {waveFixture} from '../tests/helpers/media-fixture.mjs';

const version=JSON.parse(await readFile('package.json','utf8')).version;
const zipPath=resolve(process.argv[2]??`releases/bao-an-learning-${version}.zip`),archive=await readFile(zipPath),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const prefix=`bao-an-learning-${version}/`,files=unzipSync(archive),manifest=JSON.parse(Buffer.from(files[prefix+'release.json']).toString('utf8'));
assert.equal(manifest.version,version);assert.equal(manifest.releaseReady,false);
for(const file of manifest.files){const bytes=files[prefix+file.path];assert.equal(bytes?.length,file.bytes);assert.equal(sha(bytes),file.sha256);}
const tempParent=resolve(tmpdir()),temporary=await mkdtemp(join(tempParent,'bao-an-rc12-smoke-')),root=join(temporary,'app-release'),setupToken=randomUUID();
let child;
try{
 for(const [name,bytes] of Object.entries(files)){
  assert.ok(name.startsWith(prefix));const target=resolve(root,name.slice(prefix.length)),rel=relative(root,target);assert.ok(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`));await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
 }
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));const origin=`http://127.0.0.1:${port}`;
 child=spawn(process.execPath,[join(root,'online-local.mjs')],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,BAO_AN_PUBLIC_ORIGIN:'',BAO_AN_HOST:'127.0.0.1',BAO_AN_PORT:String(port),BAO_AN_DATA_DIR:join(temporary,'data'),BAO_AN_STATIC_DIR:join(root,'app'),BAO_AN_SETUP_TOKEN:setupToken}});
 let status;for(let i=0;i<100;i++){try{const response=await fetch(origin+'/api/online/status',{signal:AbortSignal.timeout(1000)});if(response.ok){status=await response.json();break;}}catch{}await delay(100);}assert.equal(status?.runtimeVersion,version);assert.equal(status.configured,false);
 let cookie='',csrf='';async function post(route,data){const response=await fetch(origin+'/api/online'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-CSRF-Token':csrf}:{})},body:JSON.stringify(data)});assert.ok(response.ok,`Smoke ${route}: ${response.status}`);if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const value=await response.json();if(value.csrfToken)csrf=value.csrfToken;return value;}
 const password='Smoke-'+randomUUID();await post('/setup',{token:setupToken,name:'Isolated ZIP smoke',username:'smoke.admin',password});
 const cls=await post('/classes',{name:'Smoke class',grade:3});await post('/students',{classId:cls.id,name:'Smoke student',username:'smoke.child',password});
 const media=await post('/media',{name:'smoke.wav',mime:'audio/wav',base64:waveFixture().toString('base64')});assert.equal(media.kind,'audio');
 const dashboard=await(await fetch(origin+'/api/online/dashboard',{headers:{Cookie:cookie}})).json();assert.equal(dashboard.stats.questions,0);assert.equal(dashboard.stats.students,1);
 const home=await fetch(origin+'/?online=1');assert.equal(home.status,200);assert.match(await home.text(),/assets\/index-/);assert.equal((await fetch(origin+'/question-templates/bo-mau-day-du.zip')).status,200);
 await post('/logout',{});assert.equal((await fetch(origin+'/api/online/me',{headers:{Cookie:cookie}})).status,401);
 console.log(JSON.stringify({version,zipSha256:sha(archive),verifiedFiles:manifest.files.length,standaloneOutsideWorkspace:true,configuredEmptyDatabase:true,questionCount:0,mediaDecoderVerified:true,logoutVerified:true,passed:true}));
}finally{
 if(child?.exitCode===null){const stopped=once(child,'exit');child.kill();await Promise.race([stopped,delay(5000)]);}
 const rel=relative(tempParent,resolve(temporary));if(isAbsolute(rel)||rel==='..'||rel.startsWith(`..${sep}`)||!basename(temporary).startsWith('bao-an-rc12-smoke-'))throw new Error('Unsafe smoke cleanup');await rm(temporary,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
