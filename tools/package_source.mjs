import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,relative,join,sep,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync} from 'fflate';

const root=resolve('.'),version=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const tracked=execFileSync('git',['ls-files','--cached','-z'],{cwd:root,maxBuffer:8*1024*1024}).toString('utf8').split('\0').filter(Boolean);
const pending=execFileSync('git',['ls-files','--others','--exclude-standard','-z','--','src','server','tools','tests','docs','public/models/optimized'],{cwd:root,maxBuffer:8*1024*1024}).toString('utf8').split('\0').filter(Boolean);
const names=[...new Set([...tracked,...pending])].sort(),prefix=`bao-an-learning-${version}-source/`,files={},manifest=[];
let total=0;
for(const name of names){
 const portable=name.replaceAll('\\','/');
 if(portable.split('/').some(part=>['.git','.codex','.agents','.aws','.ssh','.online','node_modules','outputs','backups','releases','test-results','dist'].includes(part)))continue;
 if(/(?:^|\/)\.env(?:\.|$)/.test(portable)&&!['.env.example','.env.cloud.example'].includes(portable))continue;
 const absolute=resolve(root,name),rel=relative(root,absolute);
 if(isAbsolute(rel)||rel==='..'||rel.startsWith(`..${sep}`))throw new Error('Source path outside workspace');
 let info;try{info=await lstat(absolute);}catch(error){if(error.code==='ENOENT')continue;throw error;}
 if(info.isSymbolicLink())throw new Error('Source package does not follow symbolic links');
 if(!info.isFile())continue;
 const bytes=await readFile(absolute);total+=bytes.length;
 if(bytes.length>64*1024*1024||total>256*1024*1024||manifest.length>=3000)throw new Error('Source package exceeds its bounded size');
 files[prefix+portable]=bytes;manifest.push({path:portable,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
files[prefix+'SOURCE_MANIFEST.json']=Buffer.from(JSON.stringify({version,createdAt:new Date().toISOString(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),workingTreeSnapshot:true,files:manifest},null,2)+'\n');
const folder=join(root,'releases');await mkdir(folder,{recursive:true});const output=join(folder,`bao-an-learning-${version}-source.zip`),archive=zipSync(files,{level:6});
await writeFile(output,archive,{flag:'wx'});
console.log(JSON.stringify({output,files:manifest.length,uncompressedBytes:total,bytes:archive.length,sha256:createHash('sha256').update(archive).digest('hex')}));
