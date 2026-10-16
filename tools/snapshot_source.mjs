import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,relative,join,sep,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync} from 'fflate';

const root=resolve('.'),folder=join(root,'backups');await mkdir(folder,{recursive:true});
const names=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,maxBuffer:8*1024*1024}).toString('utf8').split('\0').filter(Boolean))];
const files={},manifest=[];let total=0;
for(const name of names){
  if(name.split(/[\\/]/).some(part=>['.git','.online','node_modules','backups','releases','test-results'].includes(part))||/(?:^|\/)\.env(?:\.|$)/.test(name)&&name!=='.env.example')continue;
  const absolute=resolve(root,name),rel=relative(root,absolute);if(isAbsolute(rel)||rel==='..'||rel.startsWith(`..${sep}`))throw new Error('Source path outside workspace');
  let info;try{info=await stat(absolute);}catch(error){if(error.code==='ENOENT')continue;throw error;}if(!info.isFile())continue;
  const bytes=await readFile(absolute);total+=bytes.length;if(total>384*1024*1024)throw new Error('Source snapshot exceeds 384 MB');
  files[name.replaceAll('\\','/')]=bytes;manifest.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
files['WORKING_TREE.patch']=execFileSync('git',['diff','--binary','HEAD'],{cwd:root,maxBuffer:64*1024*1024});
files['SNAPSHOT.json']=Buffer.from(JSON.stringify({createdAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),files:manifest},null,2));
const output=join(folder,`source-production-checkpoint-${Date.now()}.zip`);await writeFile(output,zipSync(files,{level:6}),{flag:'wx'});
console.log(JSON.stringify({output,files:manifest.length,uncompressedBytes:total}));
