import {readFile,readdir} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const PROJECT_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const BROWSER_NOTICE_PACKAGES=Object.freeze(['react','react-dom','scheduler','three','fflate']);
const within=(root,path)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`));};

/** Read installed package notices at build time; the distributed artifact needs no node_modules. */
export async function thirdPartyNotices({projectRoot=PROJECT_ROOT,inputs=[],packageNames=[]}={}){
  const project=resolve(projectRoot),roots=new Set();
  for(const name of packageNames){
    if(!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name))throw new Error('Invalid third-party package name.');
    roots.add(join(project,'node_modules',...name.split('/')));
  }
  for(const input of inputs){
    const path=resolve(project,input),parts=path.split(sep),index=parts.lastIndexOf('node_modules');
    if(index<0)continue;
    const count=parts[index+1]?.startsWith('@')?3:2;
    if(parts.length<index+count)throw new Error(`Invalid bundled package path: ${input}`);
    const root=parts.slice(0,index+count).join(sep);
    if(!within(project,root))throw new Error(`Bundled dependency is outside the project: ${input}`);
    roots.add(root);
  }
  const packages=[];
  for(const root of roots){
    const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
    if(typeof metadata.name!=='string'||!metadata.name||typeof metadata.version!=='string'||!metadata.version)throw new Error(`Missing third-party package identity: ${root}`);
    const files=(await readdir(root,{withFileTypes:true})).filter(entry=>entry.isFile()&&/^(?:licen[sc]e|copying|notice)(?:$|[._-])/i.test(entry.name)).map(entry=>entry.name).sort();
    if(!files.some(name=>/^(?:licen[sc]e|copying)(?:$|[._-])/i.test(name)))throw new Error(`Missing third-party license file: ${metadata.name}@${metadata.version}`);
    const notices=[];
    for(const filename of files){
      const text=(await readFile(join(root,filename),'utf8')).trim();
      if(!text)throw new Error(`Empty third-party notice: ${metadata.name}/${filename}`);
      notices.push(`--- ${filename} ---\n${text}\n`);
    }
    packages.push({name:metadata.name,version:metadata.version,license:typeof metadata.license==='string'?metadata.license:'See license text',notices});
  }
  packages.sort((a,b)=>a.name.localeCompare(b.name,'en')||a.version.localeCompare(b.version,'en'));
  return Buffer.from('THIRD-PARTY SOFTWARE NOTICES\n\nThis distribution includes the following third-party software. License and copyright notices are reproduced below.\n\n'+packages.map(pkg=>`===== ${pkg.name}@${pkg.version} (${pkg.license}) =====\n\n${pkg.notices.join('\n')}`).join('\n')+'\n','utf8');
}
