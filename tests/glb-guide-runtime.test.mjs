import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LearningWorld3D} from '../src/world3d/engine.ts';
const ab=(()=>{const b=readFileSync(new URL('../public/models/fox-guide-prototype.glb',import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)})();

function fakeWorld(){
 const uploads=[], listeners=[];
 const gl=new Proxy({
  VERTEX_SHADER:1, FRAGMENT_SHADER:2, COMPILE_STATUS:3, LINK_STATUS:4, ARRAY_BUFFER:5, STATIC_DRAW:6, FLOAT:7,
  DEPTH_TEST:8, LEQUAL:9, CULL_FACE:10, TRIANGLES:11, COLOR_BUFFER_BIT:12,DEPTH_BUFFER_BIT:13,
  createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createVertexArray:()=>({}),
  getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,
  bufferData:(_target,arr)=>uploads.push(arr.length),
 },{get:(t,p)=>p in t?t[p]:(..._args)=>{}});
 const canvas={clientWidth:1200,clientHeight:800,width:0,height:0,
  getContext:(type)=>type==='webgl2'?gl:null,
  addEventListener:(...a)=>listeners.push(a),removeEventListener:()=>{},getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800})};
 globalThis.devicePixelRatio=1;
 globalThis.requestAnimationFrame=()=>14; globalThis.cancelAnimationFrame=()=>{};
 globalThis.window={addEventListener:()=>{},removeEventListener:()=>{}};
 return {canvas,uploads};
}
test('WebGL runtime really uploads prototype fox GLB after base scene and updates model state',async()=>{
 const {canvas,uploads}=fakeWorld();
 globalThis.fetch=async()=>({ok:true,headers:{get:()=>String(ab.byteLength)},arrayBuffer:async()=>ab});
 const world=new LearningWorld3D(canvas,{quality:'low',reducedMotion:true});
 assert.equal(world.guideModelLoaded,false);
 const base=uploads.at(-1),success=await world.loadGuideModel('/models/fox-guide-prototype.glb');
 assert.equal(success,true);assert.equal(world.guideModelLoaded,true);
 assert.ok(uploads.length>=2);assert.ok(uploads.at(-1)>base);
 world.dispose();
});
test('Missing model leaves procedural character available without throwing',async()=>{
 const {canvas,uploads}=fakeWorld();
 globalThis.fetch=async()=>({ok:false,status:404,headers:{get:()=>null}});
 const originalWarn=console.warn;console.warn=()=>{};
 try{
  const world=new LearningWorld3D(canvas,{quality:'low'});
  const originalCount=uploads.length;
  assert.equal(await world.loadGuideModel('/models/missing.glb'),false);
  assert.equal(world.guideModelLoaded,false);assert.equal(uploads.length,originalCount);
  world.dispose();
 }finally{console.warn=originalWarn;}
});
test('If renderer is disposed while a model is downloading, no stale buffer is uploaded',async()=>{
 const {canvas,uploads}=fakeWorld();
 let finish;
 globalThis.fetch=()=>new Promise(resolve=>{finish=()=>resolve({ok:true,headers:{get:()=>null},arrayBuffer:async()=>ab})});
 const world=new LearningWorld3D(canvas,{quality:'low'});
 const count=uploads.length,pending=world.loadGuideModel('/models/fox-guide-prototype.glb');
 world.dispose(); finish();
 assert.equal(await pending,false);
 assert.equal(uploads.length,count);
});
