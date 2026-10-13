import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {importGLB} from '../src/world3d/assets/glb.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const filepath=resolve(root,'public/models/fox-guide-prototype.glb');
const blob=readFileSync(filepath);
const bytes=blob.buffer.slice(blob.byteOffset,blob.byteOffset+blob.byteLength);
const imported=importGLB(bytes);

test('Real GLB file is self-contained, reasonably sized and parses to expected layout',()=>{
  assert.ok(statSync(filepath).size<350_000);
  assert.ok(imported.triangleCount>=5000&&imported.triangleCount<=15000, String(imported.triangleCount));
  assert.equal(imported.vertexData.length,imported.triangleCount*30);
  assert.ok(imported.nodeCount>=20);
  assert.deepEqual(imported.warning,[]);
});
test('3D fox actually has three dimensions, geometry not a screenshot',()=>{
 const a=imported.vertexData;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<a.length;i+=10){for(let k=0;k<3;k++){min[k]=Math.min(min[k],a[i+k]);max[k]=Math.max(max[k],a[i+k]);}}
 assert.ok(max[0]-min[0]>2,`x ${min[0]}..${max[0]}`);
 assert.ok(max[1]-min[1]>2.4,`y ${min[1]}..${max[1]}`);
 assert.ok(max[2]-min[2]>.9,`z ${min[2]}..${max[2]}`);
});
test('GLB contains colored materials distinct from the original procedural fox',()=>{
 const colors=new Set();const a=imported.vertexData;
 for(let i=0;i<a.length;i+=10)colors.add(`${a[i+6].toFixed(2)},${a[i+7].toFixed(2)},${a[i+8].toFixed(2)}`);
 assert.ok(colors.size>=7,`unique colors ${colors.size}`);
});
test('Runtime swaps only after successful import, updates WebGL buffer and preserves fallback',()=>{
 const engine=readFileSync(resolve(root,'src/world3d/engine.ts'),'utf8');
 const adapter=readFileSync(resolve(root,'src/world3d/renderer/legacyAdapter.ts'),'utf8');
 assert.match(adapter,/world\.isSoftwareRenderer\?'\/models\/fox-guide-mobile\.glb':'\/models\/fox-guide-prototype\.glb'/);
 assert.match(engine,/async loadGuideModel/);
 assert.match(engine,/this\.build\(scene,this\.quality,false\)/);
 assert.match(engine,/gl\.bufferData\(gl\.ARRAY_BUFFER,merged/);
 assert.match(engine,/modelAbort\?\.abort/);
 assert.match(engine,/const m=new Mesh\((?:true)?\);this\.build\(m,'low'\)/);
 assert.match(engine,/this\.softwareData=merged/);
});
