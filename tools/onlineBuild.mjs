import {readFile,readdir} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';
import {BROWSER_NOTICE_PACKAGES,thirdPartyNotices} from './thirdPartyNotices.mjs';

export function retirementWorkerSource(buildId){
  return `const BUILD_ID="${buildId}";\nself.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('bao-an-learning-'))await caches.delete(name);await self.registration.unregister();})()));\n`;
}

/** Copy only online public assets. Authenticated classroom content is never precached. */
export function onlineBuildPlugin(identity){
  let publicRoot;
  return{
    name:'bao-an-online-build',apply:'build',
    configResolved(config){publicRoot=resolve(config.root,'public');},
    async generateBundle(){
      const emit=(name,source)=>this.emitFile({type:'asset',fileName:name,source});
      async function walk(folder){
        for(const entry of await readdir(folder,{withFileTypes:true})){
          const full=join(folder,entry.name),name=relative(publicRoot,full).split(sep).join('/');
          if(entry.isSymbolicLink())throw new Error('Public assets must not contain symbolic links.');
          if(name==='models'||name==='sw.js')continue;
          if(entry.isDirectory())await walk(full);else if(entry.isFile())emit(name,await readFile(full));
        }
      }
      await walk(publicRoot);
      emit('build-info.json',JSON.stringify(identity,null,2)+'\n');
      emit('THIRD_PARTY_NOTICES.txt',await thirdPartyNotices({packageNames:BROWSER_NOTICE_PACKAGES}));
      // Existing installations may still request /sw.js. Retire that worker without installing an offline cache.
      emit('sw.js',retirementWorkerSource(identity.sourceId.slice(0,16)));
    },
  };
}
