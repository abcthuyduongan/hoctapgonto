import path from 'node:path';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {createPostgresFixture} from './postgres-fixture.mjs';
import {createOnlineServer} from '../../server/online-server.mjs';
import {createCloudApi} from '../../server/cloud-api.mjs';
import {setTimeout as delay} from 'node:timers/promises';

/** Real cloud Request/Response adapter and PostgreSQL fixture, served with the production UI. */
export async function cloudBrowserFixture({staticRoot=path.resolve(process.env.BAO_AN_STATIC_ROOT??'dist'),queryDelayMs=0}={}){
  const cleanups=[],root=path.resolve('test-results');await mkdir(root,{recursive:true});const directory=await mkdtemp(path.join(root,'cloud-browser-'));
  const f=await createPostgresFixture({after:fn=>cleanups.push(fn)},{bootstrap:false}),objects=new Map();
  if(queryDelayMs){const query=f.pool.query.bind(f.pool),connect=f.pool.connect.bind(f.pool);
    f.pool.query=async(...args)=>{await delay(queryDelayMs);return query(...args);};
    f.pool.connect=async()=>{const client=await connect(),run=client.query.bind(client);client.query=async(...args)=>{await delay(queryDelayMs);return run(...args);};return client;};
  }
  const storage={async upload(key,bytes){objects.set(key,Buffer.from(bytes));},async download(key){return objects.get(key);},async remove(key){objects.delete(key);}};
  const token='cloud-browser-bootstrap-fixture-2026',password='Cloud-browser-fixture-password-2026!';
  const server=createOnlineServer({databasePath:path.join(directory,'unused.sqlite'),staticRoot,setupToken:token,secureCookies:false});
  const [staticHandler]=server.listeners('request');server.removeAllListeners('request');let api,origin;
  server.on('request',async(req,res)=>{
    if(!req.url.startsWith('/api/online/'))return staticHandler(req,res);
    try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      const response=await api(new Request(origin+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})}),{ip:'127.0.0.1'});
      res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Cloud fixture request failed'}));}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;
  api=createCloudApi({store:f.store,storage,publicOrigin:origin,setupToken:token});
  return{...f,origin,objects,token,password,async close(){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));server.onlineClose();for(const cleanup of cleanups.reverse())await cleanup();if(path.dirname(path.resolve(directory))!==root||!path.basename(directory).startsWith('cloud-browser-'))throw new Error('Unsafe fixture cleanup');await rm(directory,{recursive:true,force:true});}};
}
