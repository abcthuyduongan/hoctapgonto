import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import metadata from '../package.json' with {type:'json'};
const root=resolve('dist'),files=[];
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=join(folder,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile())files.push(path);}}
await walk(root);let bytes=0;
for(const file of files){assert.doesNotMatch(file,/\.glb$|three-vendor|WorldCanvas|PremiumWorldRenderer|legacyAdapter/i,`3D leaked into the online artifact: ${file}`);assert.doesNotMatch(file,/(?:^|[/\\])(?:\.env[^/\\]*|node_modules|\.online|backups|test-results)(?:[/\\]|$)|\.(?:sqlite|db)$/i,`Private file leaked into the artifact: ${file}`);bytes+=(await stat(file)).size;}
assert.ok(bytes<=5*1024*1024,`Online artifact ${bytes} exceeds 5 MiB`);
const info=JSON.parse(await readFile(join(root,'build-info.json'),'utf8'));assert.equal(info.version,metadata.version);assert.equal(info.displayMode,'2d');assert.match(info.sourceId,/^[a-f0-9]{64}$/);
const worker=await readFile(join(root,'sw.js'),'utf8');assert.doesNotMatch(worker,/PRECACHE_URLS|respondWith|cache\.put/);assert.match(worker,/registration\.unregister/);
for(const file of ['art/fox-guide-common.webp','manifest.webmanifest','question-templates/online-week.xlsx','THIRD_PARTY_NOTICES.txt'])await stat(join(root,file));
console.log(`ONLINE ASSET GATE PASS: ${files.length} files, ${(bytes/1024/1024).toFixed(2)} MiB, 2D only, no authenticated precache.`);
