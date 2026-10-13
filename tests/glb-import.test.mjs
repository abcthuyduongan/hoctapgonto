import test from 'node:test';
import assert from 'node:assert/strict';
import {importGLB,ModelImportError} from '../src/world3d/assets/glb.ts';
function glb(json,bin){
 const j=new TextEncoder().encode(JSON.stringify(json));
 const jc=Math.ceil(j.length/4)*4,bc=Math.ceil(bin.length/4)*4;
 const ab=new ArrayBuffer(12+8+jc+8+bc),v=new DataView(ab),u=new Uint8Array(ab);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,ab.byteLength,true);
 v.setUint32(12,jc,true);v.setUint32(16,0x4e4f534a,true);u.set(j,20);u.fill(32,20+j.length,20+jc);
 const o=20+jc;v.setUint32(o,bc,true);v.setUint32(o+4,0x004e4942,true);u.set(bin,o+8);
 return ab;
}
const triangle={asset:{version:'2.0'},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0,translation:[2,3,4]}],scenes:[{nodes:[0]}],scene:0};
const b=new Uint8Array(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer);
test('GLB: nhập một tam giác có dịch chuyển node',()=>{
 const g=importGLB(glb(triangle,b));assert.equal(g.triangleCount,1);assert.equal(g.nodeCount,1);
 assert.deepEqual([...g.vertexData.slice(0,3)],[2,3,4]);assert.deepEqual([...g.vertexData.slice(10,13)],[3,3,4]);
});
test('GLB: từ chối file hỏng, extension chưa hỗ trợ và node lặp',()=>{
 assert.throws(()=>importGLB(new ArrayBuffer(22)),ModelImportError);
 assert.throws(()=>importGLB(glb({...triangle,extensionsRequired:['KHR_draco_mesh_compression']},b)),/extension/);
 assert.throws(()=>importGLB(glb({...triangle,nodes:[{children:[0]}]},b)),/Vòng lặp/);
});
test('GLB: đọc màu từ material và từ chối primitive sai mode',()=>{
 const t={...triangle, materials:[{pbrMetallicRoughness:{baseColorFactor:[.5,.25,.1,1]}}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}]};
 const g=importGLB(glb(t,b));assert.ok(Math.abs(g.vertexData[6]-.5)<1e-6);
 assert.throws(()=>importGLB(glb({...triangle,meshes:[{primitives:[{attributes:{POSITION:0},mode:1}]}]},b)),/TRIANGLES/);
});
