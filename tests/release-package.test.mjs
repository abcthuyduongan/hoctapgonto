import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {request} from 'node:http';
import {lstat,mkdir,readFile,readdir,rmdir,unlink,writeFile} from 'node:fs/promises';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync,zipSync} from 'fflate';
import {createReleaseServer,DEFAULT_PORT,parseServerArguments,releaseRequestPath} from '../tools/serve_release.mjs';
import {packageRelease,RELEASE_VERSION,RELEASE_STORAGE_SCHEMAS} from '../tools/package_release.mjs';

const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function removeFixtureTree(root,path=root){
  const rel=relative(root,path);assert.ok(rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'));
  for(const entry of await readdir(path,{withFileTypes:true})){
    const child=join(path,entry.name);if(entry.isDirectory()&&!entry.isSymbolicLink())await removeFixtureTree(root,child);else await unlink(child);
  }
  await rmdir(path);
}
async function fixture(t){
  const root=join(workspace,'test-results',`release-package-${randomUUID()}`,'Mẫu thử gói Windows');
  const dist=join(root,'dist'),output=join(root,'releases');await mkdir(join(dist,'assets'),{recursive:true});
  t.after(async()=>{await removeFixtureTree(dirname(root));});
  const content={
    'index.html':'<!doctype html><html lang="vi"><title>Bảo An</title><main>Học lớp 3</main></html>',
    'sw.js':'const BUILD_ID="0123456789abcdef";\nself.addEventListener("fetch",()=>{});',
    'manifest.webmanifest':'{"name":"Bảo An Tự học","start_url":"/"}',
    'assets/main.js':'export const example="Bảo An";',
    'assets/main.css':'body{color:green}',
    'assets/nghe.wav':Buffer.from([0x52,0x49,0x46,0x46,0x00]),
    'assets/model.glb':Buffer.from([0x67,0x6c,0x54,0x46]),
    'assets/module.wasm':Buffer.from([0,0x61,0x73,0x6d]),
    'assets/mau.xlsx':Buffer.from([0x50,0x4b,0x03,0x04]),
  };
  for(const [path,value] of Object.entries(content))await writeFile(join(dist,...path.split('/')),value);
  await writeFile(join(root,'secret.txt'),'outside-app-secret');
  return {root,dist,output,content};
}
async function listening(t,dist){
  const server=await createReleaseServer({rootDir:dist});
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
  t.after(()=>new Promise((done,reject)=>server.close(error=>error?reject(error):done())));
  return server.address().port;
}
function http(port,path,headers={},method='GET'){
  return new Promise((done,reject)=>{
    const call=request({host:'127.0.0.1',port,path,headers,method},response=>{
      const parts=[];response.on('data',bytes=>parts.push(bytes));response.on('end',()=>done({status:response.statusCode,headers:response.headers,body:Buffer.concat(parts)}));
    });call.on('error',reject);call.end();
  });
}

test('Release server defaults preserve the local origin; CLI accepts only bounded explicit options',()=>{
  assert.equal(DEFAULT_PORT,4173);assert.deepEqual(parseServerArguments([]),{host:'127.0.0.1',port:4173,help:false,open:false});
  assert.deepEqual(parseServerArguments(['--host','0.0.0.0','--port','4174','--open']),{host:'0.0.0.0',port:4174,help:false,open:true});
  for(const args of [['--port','0'],['--port','65536'],['--port','4173;whoami'],['--host','example.com'],['--root','C:/'],['--open','--open'],['--port','4173','--port','4174']])assert.throws(()=>parseServerArguments(args));
});
test('Request boundary rejects traversal, nested encoding, NUL and Windows path ambiguities before resolution',()=>{
  assert.equal(releaseRequestPath('/assets/t%E1%BB%87p.wav?v=1'),'/assets/tệp.wav');
  for(const path of ['/../secret.txt','/a/../secret.txt','/%2e%2e/secret.txt','/%252e%252e/secret.txt','/%25252e%25252e/secret.txt','/%00index.html','/%2500index.html','/assets%2f..%2fsecret','/a\\..\\secret','/C:/Windows','//example.com/file','/a./file','/a%20/file','/%zz','http://other/file'])
    assert.throws(()=>releaseRequestPath(path),path);
});
test('Static HTTP serves only app bytes with required media MIME, HEAD and no-cache headers',async t=>{
  const {dist,content}=await fixture(t),port=await listening(t,dist);
  const cases=[['/','text/html'],['/assets/main.js','text/javascript'],['/assets/main.css','text/css'],['/manifest.webmanifest','application/manifest+json'],['/assets/nghe.wav','audio/wav'],['/assets/model.glb','model/gltf-binary'],['/assets/module.wasm','application/wasm'],['/assets/mau.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']];
  for(const [path,type] of cases){const response=await http(port,path);assert.equal(response.status,200,path);assert.ok(response.headers['content-type'].startsWith(type),path);assert.equal(response.headers['x-content-type-options'],'nosniff');assert.equal(response.headers['cache-control'],'no-cache');const key=path==='/'?'index.html':path.slice(1);assert.deepEqual(response.body,Buffer.from(content[key]));}
  const head=await http(port,'/assets/nghe.wav',{},'HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),content['assets/nghe.wav'].length);
});
test('SPA fallback is limited to HTML navigation; missing assets, API, other methods and traversal never become index HTML',async t=>{
  const {dist,content}=await fixture(t),port=await listening(t,dist);
  const page=await http(port,'/bai-hoc/toan',{accept:'text/html,application/xhtml+xml','sec-fetch-mode':'navigate'});
  assert.equal(page.status,200);assert.equal(page.body.toString(),content['index.html']);
  for(const [path,headers] of [['/bai-hoc/toan',{accept:'application/json'}],['/bai-hoc/toan',{accept:'text/html','sec-fetch-mode':'cors'}],['/assets/not-found',{accept:'text/html'}],['/missing.js',{accept:'text/html'}],['/api/learner',{accept:'text/html'}],['/secret.txt',{}]]){
    const response=await http(port,path,headers);assert.equal(response.status,404,path);assert.equal(response.body.toString(),'Not found');
  }
  for(const path of ['/../secret.txt','/%2e%2e/secret.txt','/%252e%252e/secret.txt','/%00index.html','/a\\..\\secret.txt'])assert.equal((await http(port,path)).status,400,path);
  const post=await http(port,'/',{},'POST');assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
});
test('Pilot package is a bounded dist snapshot with standalone Unicode-safe Windows entrypoint and verified ZIP/manifest hashes',async t=>{
  const {dist,output,content}=await fixture(t),result=await packageRelease({distDir:dist,outputRoot:output});
  assert.equal(result.reused,false);assert.equal(result.manifest.version,RELEASE_VERSION);assert.equal(result.manifest.pilot,true);assert.equal(result.manifest.releaseReady,false);assert.equal(result.manifest.humanPilotStatus,'UNVERIFIED');
  assert.equal(result.manifest.databaseSchemaVersion,1);assert.deepEqual(result.manifest.storageSchemas,{localSqlite:1,cloudPostgres:1});assert.deepEqual(result.manifest.storageSchemas,RELEASE_STORAGE_SCHEMAS);assert.equal(result.manifest.buildId,'0123456789abcdef');assert.equal(result.manifest.assetCount,Object.keys(content).length);
  const archive=unzipSync(await readFile(result.zipPath)),prefix=`bao-an-learning-${RELEASE_VERSION}/`;
  assert.equal(Object.keys(archive).length,result.manifest.files.length+1);assert.deepEqual(JSON.parse(Buffer.from(archive[`${prefix}release.json`]).toString('utf8')),result.manifest);
  assert.equal(result.manifest.files.some(row=>row.path.includes('secret')),false);
  for(const file of result.manifest.files){const bytes=await readFile(join(result.folder,...file.path.split('/')));assert.equal(bytes.length,file.bytes);assert.equal(digest(bytes),file.sha256);assert.deepEqual(new Uint8Array(bytes),archive[`${prefix}${file.path}`]);}
  const cmd=await readFile(join(result.folder,'MO_BAO_AN.cmd'),'utf8');assert.match(cmd,/call "%~dp0MO_QUAN_LY\.cmd"/);assert.doesNotMatch(cmd,/npm |file:\/\//);
  const guide=await readFile(join(result.folder,'HUONG_DAN_SU_DUNG.html'),'utf8');assert.match(guide,/máy tính Windows/);assert.match(guide,/1 sao = 1\.000 đồng/);assert.match(guide,/năm game/);assert.match(guide,/releaseReady: false/);
  const reused=await packageRelease({distDir:dist,outputRoot:output});assert.equal(reused.reused,true);assert.deepEqual(reused.manifest,result.manifest);
});
test('Same version refuses a different build or any changed packaged bytes without replacing prior files',async t=>{
  const {dist,output}=await fixture(t),result=await packageRelease({distDir:dist,outputRoot:output});
  const original=await readFile(join(result.folder,'release.json'));
  await writeFile(join(dist,'sw.js'),'const BUILD_ID="fedcba9876543210";');
  await assert.rejects(packageRelease({distDir:dist,outputRoot:output}),/Không ghi đè/);
  assert.deepEqual(await readFile(join(result.folder,'release.json')),original);
  await writeFile(join(dist,'sw.js'),'const BUILD_ID="0123456789abcdef";\nself.addEventListener("fetch",()=>{});');
  await writeFile(join(result.folder,'app','index.html'),'changed after packaging');
  await assert.rejects(packageRelease({distDir:dist,outputRoot:output}),/đã bị thay đổi/);
  assert.equal((await readFile(join(result.folder,'app','index.html'),'utf8')),'changed after packaging');
});
test('Windows rename refusal falls back to an exclusive verified copy and preserves immutable artifacts',async t=>{
  const {dist,output}=await fixture(t),refuse=async()=>{const error=new Error('fixture filesystem refuses rename');error.code='EPERM';throw error;};
  const result=await packageRelease({distDir:dist,outputRoot:output,finalizeArtifact:refuse});
  const archive=unzipSync(await readFile(result.zipPath)),prefix=`bao-an-learning-${RELEASE_VERSION}/`;
  for(const file of result.manifest.files){const bytes=await readFile(join(result.folder,...file.path.split('/')));assert.equal(digest(bytes),file.sha256);assert.deepEqual(new Uint8Array(bytes),archive[prefix+file.path]);}
  const manifestBytes=await readFile(join(result.folder,'release.json'));assert.deepEqual(new Uint8Array(manifestBytes),archive[prefix+'release.json']);
  assert.equal((await packageRelease({distDir:dist,outputRoot:output,finalizeArtifact:refuse})).reused,true);
  await writeFile(join(dist,'index.html'),'new bytes must not overwrite the release');
  await assert.rejects(packageRelease({distDir:dist,outputRoot:output,finalizeArtifact:refuse}),/Không ghi đè/);
  assert.deepEqual(await readFile(join(result.folder,'release.json')),manifestBytes);
});

test('A modified ZIP or incomplete pre-existing package cannot be silently reused',async t=>{
  const {dist,output}=await fixture(t),result=await packageRelease({distDir:dist,outputRoot:output});
  const archive=unzipSync(await readFile(result.zipPath));archive[`bao-an-learning-${RELEASE_VERSION}/app/index.html`]=new TextEncoder().encode('tampered zip');
  await writeFile(result.zipPath,zipSync(archive));
  await assert.rejects(packageRelease({distDir:dist,outputRoot:output}),/ZIP đích/);
  await unlink(result.zipPath);
  await assert.rejects(packageRelease({distDir:dist,outputRoot:output}),/thiếu ZIP/);
});
test('Packaging rejects absent PWA build markers, overlapping output and output outside workspace',async t=>{
  const {dist,output}=await fixture(t);
  await assert.rejects(packageRelease({distDir:dist,outputRoot:join(dist,'release')}),/tách biệt/);
  await assert.rejects(packageRelease({distDir:dist,outputRoot:resolve(workspace,'..','release-escape')}),/workspace/);
  await writeFile(join(dist,'sw.js'),'// worker without build marker');
  await assert.rejects(packageRelease({distDir:dist,outputRoot:output}),/build ID/);
  await unlink(join(dist,'manifest.webmanifest'));
  await assert.rejects(packageRelease({distDir:dist,outputRoot:output}),/PWA đầy đủ/);
  const info=await lstat(dist);assert.equal(info.isDirectory(),true);
});
