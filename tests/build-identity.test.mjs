import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createBuildIdentity} from '../tools/buildIdentity.mjs';
import {readBuildIdentity} from '../server/build-identity.mjs';
import metadata from '../package.json' with {type:'json'};
async function fixture(t){
 const parent=resolve('test-results');await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'identity-'));
 t.after(async()=>{assert.equal(dirname(root),parent);assert.match(root,/identity-[^\\/]+$/);await rm(root,{recursive:true,force:true});});
 for(const folder of ['src','server','netlify','public','public/models','tools'])await mkdir(join(root,folder),{recursive:true});
 for(const file of ['package-lock.json','vite.config.ts','tsconfig.json','index.html','tools/buildIdentity.mjs','tools/onlineBuild.mjs','tools/thirdPartyNotices.mjs','tools/package_release.mjs'])await writeFile(join(root,file),'fixture');
 await writeFile(join(root,'package.json'),JSON.stringify({version:metadata.version}));return root;
}
test('source fingerprint is reproducible and includes uncommitted runtime edits without leaking contents',async t=>{
 const root=await fixture(t);await writeFile(join(root,'src','main.ts'),'PRIVATE_SOURCE_ONE');
 const initial=await createBuildIdentity(root);assert.match(initial.sourceId,/^[a-f0-9]{64}$/);assert.equal(initial.commit,null);assert.equal(initial.displayMode,'2d');
 assert.deepEqual(await createBuildIdentity(root),initial);
 await writeFile(join(root,'src','main.ts'),'PRIVATE_SOURCE_TWO');const changed=await createBuildIdentity(root);assert.notEqual(changed.sourceId,initial.sourceId);assert.doesNotMatch(JSON.stringify(changed),/PRIVATE_SOURCE/);
 await writeFile(join(root,'public','models','archive.glb'),'retained source asset');assert.deepEqual(await createBuildIdentity(root),changed);
});
test('status only publishes validated artifact identity and cannot label an old version as this build',async t=>{
 const root=await fixture(t),valid=await createBuildIdentity(root);
 await writeFile(join(root,'build-info.json'),JSON.stringify({...valid,private:'SECRET'}));assert.deepEqual(await readBuildIdentity(root),valid);
 const other=join(root,'other');await mkdir(other);await writeFile(join(other,'build-info.json'),JSON.stringify({...valid,version:'old'}));
 assert.deepEqual(await readBuildIdentity(other),{version:metadata.version,sourceId:null,commit:null,displayMode:'2d',questionProtocolVersion:1});
 assert.equal((await readBuildIdentity(join(root,'missing'))).sourceId,null);
});
