import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import metadata from '../package.json' with {type:'json'};

const identities=new Map();
export function readBuildIdentity(staticRoot=resolve('dist')){
  const root=resolve(staticRoot);
  if(!identities.has(root))identities.set(root,(async()=>{
    try{
      const value=JSON.parse(await readFile(resolve(root,'build-info.json'),'utf8'));
      if(value.version===metadata.version&&/^[a-f0-9]{64}$/.test(value.sourceId)&&value.displayMode==='2d')return{
        version:value.version,sourceId:value.sourceId,commit:/^[a-f0-9]{40,64}$/.test(value.commit??'')?value.commit:null,displayMode:'2d',questionProtocolVersion:1,
      };
    }catch(error){if(error?.code!=='ENOENT')throw error;}
    // No artifact is preferable to claiming that an older artifact is this server's build.
    return{version:metadata.version,sourceId:null,commit:null,displayMode:'2d',questionProtocolVersion:1};
  })().catch(error=>{identities.delete(root);throw error;}));
  return identities.get(root);
}
