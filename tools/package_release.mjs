import {createHash,randomUUID} from 'node:crypto';
import {lstat,mkdir,readFile,readdir,realpath,rename,stat,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {unzipSync,zipSync} from 'fflate';
import {build} from 'esbuild';
import {setTimeout as delay} from 'node:timers/promises';

export const RELEASE_VERSION='3.8.0-rc.2';
export const RELEASE_STORAGE_SCHEMAS=Object.freeze({localSqlite:1,cloudPostgres:1});
const PROJECT_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const MAX_FILES=3000,MAX_FILE_BYTES=64*1024*1024,MAX_TOTAL_BYTES=256*1024*1024;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const within=(root,path)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`));};
const portable=path=>path.split(sep).join('/');
async function exists(path){try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function finalizeRename(source,destination){
  for(let attempt=0;;attempt++){
    if(await exists(destination))throw new Error('Đích đóng gói vừa được tạo; không ghi đè.');
    try{await rename(source,destination);return;}
    catch(error){if(attempt>=19||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;await delay(500);}
  }
}
async function boundedFiles(directory){
  const files=[];let bytes=0;
  async function walk(folder){
    for(const entry of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const path=join(folder,entry.name);
      if(entry.isSymbolicLink())throw new Error(`Không đóng gói symbolic link: ${entry.name}`);
      if(entry.isDirectory())await walk(path);
      else if(entry.isFile()){
        const info=await stat(path);bytes+=info.size;
        if(info.size>MAX_FILE_BYTES||bytes>MAX_TOTAL_BYTES||files.length>=MAX_FILES)throw new Error('Bản build vượt giới hạn đóng gói (3000 tệp, 64 MB/tệp, 256 MB tổng).');
        files.push(path);
      }else throw new Error(`Loại tệp không hỗ trợ: ${entry.name}`);
    }
  }
  await walk(directory);return files;
}
async function buildPayload(distDir){
  const files=await boundedFiles(distDir),payload=new Map();
  let total=0;
  for(const path of files){const bytes=await readFile(path);total+=bytes.length;if(bytes.byteLength>MAX_FILE_BYTES||total>MAX_TOTAL_BYTES)throw new Error('Tệp build thay đổi hoặc vượt giới hạn.');payload.set(`app/${portable(relative(distDir,path))}`,bytes);}
  const index=payload.get('app/index.html'),worker=payload.get('app/sw.js');
  if(!index||!worker||!payload.has('app/manifest.webmanifest'))throw new Error('Cần bản build PWA đầy đủ: index.html, sw.js và manifest.webmanifest.');
  const buildId=worker.toString('utf8').match(/\bconst BUILD_ID="([a-f0-9]{16})";/)?.[1];
  if(!buildId)throw new Error('Không tìm thấy build ID do công cụ offline tạo.');
  for(const [name,source] of [['serve_release.mjs','serve_release.mjs'],['MO_BAO_AN.cmd','release-files/MO_BAO_AN.cmd'],['MO_QUAN_LY.cmd','release-files/MO_QUAN_LY.cmd'],['SAO_LUU_QUAN_LY.cmd','release-files/SAO_LUU_QUAN_LY.cmd'],['HUONG_DAN_SU_DUNG.html','release-files/HUONG_DAN_SU_DUNG.html']])
    payload.set(name,await readFile(join(PROJECT_ROOT,'tools',source)));
  const serverBundle=await build({absWorkingDir:PROJECT_ROOT,entryPoints:['server/run-online.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',write:false,logLevel:'silent'});
  payload.set('online-local.mjs',Buffer.from(serverBundle.outputFiles[0].contents));
  const restoreBundle=await build({absWorkingDir:PROJECT_ROOT,entryPoints:['server/restore-online.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',write:false,logLevel:'silent'});
  payload.set('restore-online.mjs',Buffer.from(restoreBundle.outputFiles[0].contents));
  payload.set('backup-online.mjs',await readFile(join(PROJECT_ROOT,'server/backup-online.mjs')));
  payload.set('QUAN_LY_CUC_BO.md',await readFile(join(PROJECT_ROOT,'docs/QUAN_LY_CUC_BO.md')));
  payload.set('NGHIEM_THU_CUC_BO_RC2.md',await readFile(join(PROJECT_ROOT,'docs/NGHIEM_THU_CUC_BO_RC2.md')));
  const assetCount=files.length;
  const entries=[...payload].sort(([a],[b])=>a.localeCompare(b)).map(([path,bytes])=>({path,bytes:bytes.byteLength,sha256:hash(bytes)}));
  return {payload,buildId,assetCount,entries,payloadHash:hash(Buffer.from(JSON.stringify(entries)))};
}
async function checkExisting(folder,zipPath,expected){
  if((await lstat(folder)).isSymbolicLink()||!(await stat(folder)).isDirectory())throw new Error('Gói đích không phải thư mục thường; không ghi đè.');
  const raw=await readFile(join(folder,'release.json'),'utf8');let manifest;try{manifest=JSON.parse(raw);}catch{throw new Error('Gói đích đã tồn tại nhưng manifest không hợp lệ; không ghi đè.');}
  if(manifest.schemaVersion!==1||manifest.version!==RELEASE_VERSION||manifest.buildId!==expected.buildId||manifest.payloadSha256!==expected.payloadHash||
    manifest.databaseSchemaVersion!==1||JSON.stringify(manifest.storageSchemas)!==JSON.stringify(RELEASE_STORAGE_SCHEMAS)||manifest.assetCount!==expected.assetCount||manifest.humanPilotStatus!=='UNVERIFIED'||
    manifest.pilot!==true||manifest.releaseReady!==false||JSON.stringify(manifest.files)!==JSON.stringify(expected.entries))
    throw new Error('Đích đã có gói khác build/nội dung. Không ghi đè; dùng phiên bản phát hành mới.');
  for(const item of manifest.files){const bytes=await readFile(join(folder,...item.path.split('/')));if(bytes.length!==item.bytes||hash(bytes)!==item.sha256)throw new Error(`Gói đích đã bị thay đổi: ${item.path}; không ghi đè.`);}
  if(!(await exists(zipPath)))throw new Error('Thư mục gói đã tồn tại nhưng thiếu ZIP; không ghi đè.');
  if((await lstat(zipPath)).isSymbolicLink()||(await stat(zipPath)).size>MAX_TOTAL_BYTES+1024*1024)throw new Error('ZIP đích không hợp lệ; không ghi đè.');
  const prefix=`bao-an-learning-${RELEASE_VERSION}/`,expectedSizes=new Map([...expected.entries.map(entry=>[`${prefix}${entry.path}`,entry.bytes]),[`${prefix}release.json`,Buffer.byteLength(raw)]]);
  const archive=unzipSync(await readFile(zipPath),{filter(entry){
    if(!expectedSizes.has(entry.name)||entry.originalSize!==expectedSizes.get(entry.name))throw new Error('ZIP đích có tệp ngoài manifest hoặc sai kích thước; không ghi đè.');
    return true;
  }});
  if(Object.keys(archive).length!==expected.entries.length+1)throw new Error('ZIP đích khác danh sách tệp; không ghi đè.');
  for(const entry of expected.entries){const bytes=archive[`${prefix}${entry.path}`];if(!bytes||bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw new Error(`ZIP đích đã bị thay đổi: ${entry.path}; không ghi đè.`);}
  if(Buffer.from(archive[`${prefix}release.json`]??[]).toString('utf8')!==raw)throw new Error('Manifest trong ZIP đã bị thay đổi; không ghi đè.');
  return manifest;
}

/** Snapshot dist without invoking a build. Production output is fixed below releases; tests may use a contained fixture. */
export async function packageRelease({distDir=join(PROJECT_ROOT,'dist'),outputRoot=join(PROJECT_ROOT,'releases'),finalizeArtifact=finalizeRename}={}){
  const project=await realpath(PROJECT_ROOT),dist=await realpath(resolve(distDir)),output=resolve(outputRoot);
  if(!within(project,dist)||!within(project,output)||output===project||within(dist,output)||within(output,dist))throw new Error('Nguồn và đích đóng gói phải là các thư mục tách biệt trong workspace.');
  if((await lstat(resolve(distDir))).isSymbolicLink())throw new Error('Không đóng gói thư mục nguồn qua symbolic link.');
  await mkdir(output,{recursive:true});
  if(!within(project,await realpath(output)))throw new Error('Đích đóng gói ra ngoài workspace.');
  const name=`bao-an-learning-${RELEASE_VERSION}`,folder=join(output,name),zipPath=join(output,`${name}.zip`);
  const expected=await buildPayload(dist);
  if(await exists(folder))return {folder,zipPath,reused:true,manifest:await checkExisting(folder,zipPath,expected)};
  if(await exists(zipPath))throw new Error('ZIP đích đã tồn tại mà không có thư mục tương ứng; không ghi đè.');
  const temporary=join(output,`.${name}.${process.pid}.${randomUUID()}.pending`),temporaryZip=`${temporary}.zip`;
  await mkdir(temporary);
  const manifest={schemaVersion:1,version:RELEASE_VERSION,pilot:true,releaseReady:false,
    humanPilotStatus:'UNVERIFIED',humanPilotTarget:'Quản lý và học sinh, Windows Edge/Chrome: Word/Excel, tám dạng câu, năm game, đổi sao, sao lưu và khôi phục',
    createdAt:new Date().toISOString(),buildId:expected.buildId,databaseSchemaVersion:1,storageSchemas:RELEASE_STORAGE_SCHEMAS,
    assetCount:expected.assetCount,payloadSha256:expected.payloadHash,files:expected.entries};
  const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8');
  try{
    for(const [path,bytes] of expected.payload){const destination=join(temporary,...path.split('/'));await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes,{flag:'wx'});}
    await writeFile(join(temporary,'release.json'),manifestBytes,{flag:'wx'});
    const archive={};for(const [path,bytes] of expected.payload)archive[`${name}/${path}`]=new Uint8Array(bytes);
    archive[`${name}/release.json`]=new Uint8Array(manifestBytes);
    await writeFile(temporaryZip,zipSync(archive,{level:6}),{flag:'wx'});
    if(await exists(folder)||await exists(zipPath))throw new Error('Một lượt đóng gói khác đã tạo đích; giữ nguyên gói đó.');
    let copied=false;
    try{await finalizeArtifact(temporary,folder);}
    catch(error){
      if(!['EPERM','EACCES','EBUSY','EXDEV'].includes(error.code))throw error;
      // Reserve a new destination exclusively; publish its manifest only after the ZIP.
      await mkdir(folder);
      for(const [path,bytes] of expected.payload){const destination=join(folder,...path.split('/'));await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes,{flag:'wx'});}
      copied=true;
    }
    if(copied){await writeFile(zipPath,await readFile(temporaryZip),{flag:'wx'});await writeFile(join(folder,'release.json'),manifestBytes,{flag:'wx'});}
    else{
      try{await finalizeArtifact(temporaryZip,zipPath);}
      catch(error){if(!['EPERM','EACCES','EBUSY','EXDEV'].includes(error.code))throw error;await writeFile(zipPath,await readFile(temporaryZip),{flag:'wx'});}
    }
    return {folder,zipPath,reused:false,manifest};
  }catch(error){throw new Error(`${error.message} Tệp tạm nếu có được giữ tại ${temporary} để kiểm tra; không xóa hoặc ghi đè gói trước.`);}
}

export async function main(args=process.argv.slice(2)){
  if(args.length){if(args.length===1&&['--help','-h'].includes(args[0])){console.log(`node tools/package_release.mjs\nĐóng gói dist hiện có vào releases/bao-an-learning-${RELEASE_VERSION} và ZIP. Chạy npm run build cùng các gate trước. Không tự build, không ghi đè gói khác nội dung.`);return 0;}console.error('Không nhận đường dẫn/phiên bản tùy ý. Dùng --help để xem cách chạy.');return 1;}
  try{const result=await packageRelease();console.log(JSON.stringify({status:'PILOT_PACKAGE',...result,manifest:{version:result.manifest.version,buildId:result.manifest.buildId,pilot:true,releaseReady:false,assetCount:result.manifest.assetCount}},null,2));return 0;}
  catch(error){console.error(error.message);return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
