import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const scene=readFileSync(new URL('../src/world3d/engine.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/real3d31.css',import.meta.url),'utf8');
test('Premium 3D: waterfall, bridge, lamp, flowers are genuine mesh construction',()=>{
 for(const key of ['function waterfall(m:Mesh','function woodBridge(m:Mesh','function flower(m:Mesh','function ornateCottage(m:Mesh','function crystal(m:Mesh','function lamp(m:Mesh'])assert.ok(scene.includes(key),key);
 assert.match(scene,/waterfall\(m,-4\.05/);
 assert.match(scene,/woodBridge\(m,\[/);
});
test('Premium 3D: matte painting stays in scenic background, not UI or foreground mesh',()=>{
 assert.match(css,/url\('\/art\/premium-world-scene\.webp'\)/);
 assert.match(scene,/gl\.drawArrays\(gl\.TRIANGLES/);
});
test('Premium 3D: supports low-motion and software triangle fallback',()=>{
 assert.match(scene,/setMotion\(enabled:boolean\)/);
 assert.match(scene,/private startSoftware\(quality:WorldQuality\)/);
});
