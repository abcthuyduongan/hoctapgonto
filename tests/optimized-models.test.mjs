import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';
import {disposeScene} from '../src/world3d/renderer/disposeScene.ts';

const manifest=JSON.parse(readFileSync(new URL('../src/world3d/assets/optimized-manifest.json',import.meta.url),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function parse(bytes){
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const size=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+size)),bin=bytes.subarray(28+size);
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},types={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']};
 const values=index=>{const a=json.accessors[index],v=json.bufferViews[a.bufferView],[width,method]=types[a.componentType],offset=(v.byteOffset??0)+(a.byteOffset??0);assert.ok(offset+a.count*sizes[a.type]*width<=bin.length);return Array.from({length:a.count*sizes[a.type]},(_,i)=>bin[method](offset+i*width));};
 return{json,values,bin};
}
test('hashed low models fit transfer budget and contain valid finite indexed geometry and small embedded textures',()=>{
 for(const [id,asset] of Object.entries(manifest.assets)){
  const bytes=readFileSync(new URL('../public'+asset.url,import.meta.url)),master=readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url));
  assert.equal(bytes.length,asset.bytes);assert.equal(hash(bytes),asset.sha256);assert.equal(hash(master),asset.sourceSha256);
  const {json,values,bin}=parse(bytes);assert.equal(json.buffers[0].byteLength,bin.length);
  for(const view of json.bufferViews)assert.ok((view.byteOffset??0)+view.byteLength<=bin.length);
  for(const image of json.images){assert.equal(image.uri,undefined);const view=json.bufferViews[image.bufferView],offset=view.byteOffset??0;assert.ok(bin.readUInt32BE(offset+16)<=128);assert.ok(bin.readUInt32BE(offset+20)<=128);}
  for(const mesh of json.meshes)for(const p of mesh.primitives){const vertexCount=json.accessors[p.attributes.POSITION].count,indices=values(p.indices);assert.equal(indices.length%3,0);assert.ok(indices.every(index=>Number.isInteger(index)&&index>=0&&index<vertexCount));for(const index of Object.values(p.attributes))assert.ok(values(index).every(Number.isFinite));}
 }
 for(const id of ['math-world','memory-world','language-world'])assert.ok(manifest.assets['fox-guide'].bytes+manifest.assets.environment.bytes+manifest.assets[id].bytes<=2*1024*1024);
});
test('optimized fox preserves the authored rig, animation samples and skin geometry',()=>{
 const master=parse(readFileSync(new URL('../public/models/fox-guide.glb',import.meta.url))),low=parse(readFileSync(new URL('../public'+manifest.assets['fox-guide'].url,import.meta.url)));
 assert.deepEqual(low.json.nodes,master.json.nodes);assert.deepEqual(low.json.skins,master.json.skins);assert.deepEqual(low.json.animations,master.json.animations);
 for(const animation of master.json.animations)for(const sampler of animation.samplers)for(const key of ['input','output'])assert.deepEqual(low.values(sampler[key]),master.values(sampler[key]));
 low.json.meshes.forEach((mesh,i)=>mesh.primitives.forEach((p,j)=>{if(!('JOINTS_0'in p.attributes))return;const original=master.json.meshes[i].primitives[j];assert.deepEqual(low.values(p.attributes.POSITION),master.values(original.attributes.POSITION));assert.deepEqual(low.values(p.attributes.JOINTS_0),master.values(original.attributes.JOINTS_0));const weights=low.values(p.attributes.WEIGHTS_0);for(let at=0;at<weights.length;at+=4)assert.equal(weights.slice(at,at+4).reduce((a,b)=>a+b,0),65535);}));
});
test('scene cleanup releases shared geometry, material and texture once and clears its ownership',()=>{
 const scene=new Group(),geometry=new BoxGeometry(),texture=new Texture(),material=new MeshStandardMaterial({map:texture});let geometries=0,materials=0,textures=0;
 geometry.addEventListener('dispose',()=>geometries++);material.addEventListener('dispose',()=>materials++);texture.addEventListener('dispose',()=>textures++);
 scene.add(new Mesh(geometry,material),new Mesh(geometry,material));disposeScene(scene);disposeScene(scene);
 assert.deepEqual({geometries,materials,textures,children:scene.children.length},{geometries:1,materials:1,textures:1,children:0});
});
