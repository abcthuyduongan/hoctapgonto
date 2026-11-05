import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
/** Fingerprint runtime inputs, including uncommitted edits, without publishing their contents. */
export async function createBuildIdentity(root=projectRoot){
  const files=[];
  async function walk(folder){
    for(const entry of await readdir(join(root,folder),{withFileTypes:true})){
      if(entry.isSymbolicLink()||['node_modules','.git','models'].includes(entry.name))continue;
      const name=join(folder,entry.name);
      if(entry.isDirectory())await walk(name);else if(entry.isFile())files.push(name);
    }
  }
  for(const folder of ['src','server','netlify','public'])await walk(folder);
  files.push('package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html','tools/buildIdentity.mjs','tools/onlineBuild.mjs','tools/thirdPartyNotices.mjs','tools/package_release.mjs');
  const hash=createHash('sha256');
  for(const file of files.sort()){
    hash.update(relative(root,resolve(root,file)).split(sep).join('/')).update('\0');
    hash.update(await readFile(join(root,file))).update('\0');
  }
  let commit=null;
  try{const[repository,value]=execFileSync('git',['rev-parse','--show-toplevel','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/);if(relative(root,resolve(repository))===''&&/^[a-f0-9]{40,64}$/.test(value))commit=value;}catch{/* A source ZIP can be built without Git metadata. */}
  const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  return{version,commit,sourceId:hash.digest('hex'),displayMode:'2d',questionProtocolVersion:1};
}
