import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
const origin='https://gontogontet.netlify.app',results=[];
for(const pathname of ['/','/api/online/status','/sw.js','/api/online/status']){
  const started=performance.now();
  try{
    const response=await fetch(origin+pathname,{signal:AbortSignal.timeout(20000),redirect:'manual'}),body=await response.text();
    const row={path:pathname,status:response.status,elapsedMs:Math.round(performance.now()-started),bytes:Buffer.byteLength(body),headers:Object.fromEntries(['content-type','cache-control','netlify-cdn-cache-control','content-security-policy','x-content-type-options','x-frame-options'].map(key=>[key,response.headers.get(key)]))};
    if(pathname.endsWith('status'))row.publicStatus=JSON.parse(body);
    if(pathname==='/sw.js')row.buildId=/const BUILD_ID="([^"]+)"/.exec(body)?.[1];
    if(pathname==='/')row.entryScripts=[...body.matchAll(/src="([^"]+\.js)"/g)].map(match=>match[1]);
    results.push(row);
  }catch(error){results.push({path:pathname,error:error.message,elapsedMs:Math.round(performance.now()-started)});}
}
const local=await readFile(path.join(process.env.BAO_AN_STATIC_ROOT??'test-results/deep-release-audit/dist','sw.js'),'utf8');
const output=process.env.BAO_AN_AUDIT_OUTPUT_ROOT??'test-results/deep-release-audit';await mkdir(output,{recursive:true});
await writeFile(path.join(output,'public-site-check.json'),JSON.stringify({checkedAt:new Date().toISOString(),publicReadOnly:true,noCredentials:true,localBuildId:/const BUILD_ID="([^"]+)"/.exec(local)?.[1],results},null,2));
console.log(JSON.stringify(results,null,2));
