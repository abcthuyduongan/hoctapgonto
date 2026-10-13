import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LearningWorld3D} from '../src/world3d/engine.ts';
import {importGLB} from '../src/world3d/assets/glb.ts';
const input=readFileSync(new URL('../public/models/fox-guide-prototype.glb',import.meta.url));
const bytes=input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength);

function mockScene(){
 const uploads=[];const uniformValues=[];
 const gl = new Proxy({
  VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,
  FLOAT:7,DEPTH_TEST:8,LEQUAL:9,CULL_FACE:10,TRIANGLES:11,COLOR_BUFFER_BIT:12,DEPTH_BUFFER_BIT:13,
  createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createVertexArray:()=>({}),
  getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,
  getUniformLocation:(_p,name)=>name,
  uniform1f:(location,value)=>uniformValues.push({location,value}),
  bufferData:(_p,array)=>uploads.push(new Float32Array(array)),
 },{get:(t,p)=>p in t?t[p]:(..._args)=>{}});
 const canvas={clientWidth:1180,clientHeight:800,width:0,height:0,
   getContext:type=>type==='webgl2'?gl:null,addEventListener:()=>{},removeEventListener:()=>{},
   getBoundingClientRect:()=>({left:0,top:0,width:1180,height:800})};
 globalThis.window={addEventListener:()=>{},removeEventListener:()=>{}};
 globalThis.devicePixelRatio=1;
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 globalThis.fetch=async()=>({ok:true,headers:{get:()=>String(bytes.byteLength)},arrayBuffer:async()=>bytes});
 return {canvas,uploads,uniformValues};
}
test('GLB upload marks only character vertices as the guide animation group',async()=>{
 const {canvas,uploads}=mockScene();const world=new LearningWorld3D(canvas,{quality:'low'});
 assert.equal(await world.loadGuideModel('/models/fox-guide-prototype.glb'),true);
 const latest=uploads.at(-1),first=uploads[0];
 assert.ok(latest.length>first.length);
 let tagged=0,environment=0;
 for(let i=0;i<latest.length;i+=10){if(latest[i+9]===3)tagged++;else environment++;}
 assert.ok(tagged>1000);assert.ok(environment>1000);
 assert.equal(tagged,importGLB(bytes).vertexData.length/10,'guide vertices must equal imported GLB, not the procedural fox');
 world.dispose();
});
test('World selection animates only while enabled and respects reduced-motion',()=>{
 const {canvas,uniformValues}=mockScene();const world=new LearningWorld3D(canvas,{quality:'low',reducedMotion:false});
 world.focusOn('math-quest');
 assert.ok(world.cheerUntil>0);
 world.draw(world.cheerUntil-450);
 assert.ok(uniformValues.some(({location,value})=>location==='uGuideCheer'&&value>0));
 world.setMotion(false);
 assert.equal(world.cheerUntil,0);
 world.focusOn('sentence-builder');
 assert.equal(world.cheerUntil,0);
 uniformValues.length=0;
 world.draw(5000);
 assert.ok(uniformValues.some(({location,value})=>location==='uAnimate'&&value===0));
 assert.ok(uniformValues.some(({location,value})=>location==='uGuideCheer'&&value===0));
 world.dispose();
});
test('Re-selecting the same world does not restart celebration repeatedly',()=>{
 const {canvas}=mockScene();const world=new LearningWorld3D(canvas,{quality:'low'});
 world.focusOn('memory-match');const deadline=world.cheerUntil;
 world.focusOn('memory-match');assert.equal(world.cheerUntil,deadline);
 world.dispose();
});
