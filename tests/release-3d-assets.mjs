/** Release-only gate: this intentionally fails until actual premium 3D content exists.
 * A render based exclusively on procedural colored primitives is NOT a premium art release.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/world3d/assets/premium-manifest.json'),'utf8'));
let problems=0;
for(const asset of manifest.assets){
 const full=path.join(root,asset.path);
 if(!fs.existsSync(full)){console.error('MISSING',asset.id,asset.path);problems++;continue;}
 if(!asset.license || !/^(CC0|CC-BY|CUSTOM|OWNED)(?:$|[ :])/.test(asset.license)){console.error('LICENSE MISSING',asset.id);problems++;}
 const b=fs.readFileSync(full);
 if(b.length<32||b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length){console.error('INVALID GLB',asset.id);problems++;continue;}
 const len=b.readUInt32LE(12);const type=b.readUInt32LE(16);
 if(type!==0x4e4f534a ||20+len>b.length){console.error('GLB JSON INVALID',asset.id);problems++;continue;}
 let gltf;
 try{gltf=JSON.parse(b.subarray(20,20+len).toString('utf8'));}catch{console.error('GLB JSON PARSE FAILED',asset.id);problems++;continue;}
 if(asset.mustHaveAnimation && (gltf.animations?.length??0)<asset.minAnimations){console.error('ANIMATIONS MISSING',asset.id);problems++;}
 if(asset.mustHaveTextures && (!(gltf.textures?.length) || !gltf.materials?.some(m=>m.pbrMetallicRoughness?.baseColorTexture))){console.error('PBR TEXTURES MISSING',asset.id);problems++;}
 if(gltf.images?.some(image=>!Number.isInteger(image.bufferView)||!/^image\/(png|jpeg|webp)$/.test(image.mimeType??'')) || gltf.buffers?.some(buffer=>buffer.uri)){console.error('GLB NOT SELF-CONTAINED',asset.id);problems++;}
 for(const mesh of gltf.meshes??[])for(const primitive of mesh.primitives??[]){
  if(primitive.attributes?.POSITION===undefined||primitive.attributes?.NORMAL===undefined||primitive.attributes?.TEXCOORD_0===undefined){console.error('POSITION/NORMAL/UV MISSING',asset.id);problems++;}
 }
 if(asset.id==='fox-guide'){
  const skins=gltf.skins??[];
  const names=new Set((gltf.animations??[]).map(clip=>clip.name));
  const joints=new Set(skins.flatMap(skin=>skin.joints??[]));
  if(!skins.length||!gltf.nodes?.some(node=>node.skin!==undefined)){console.error('SKIN RIG MISSING',asset.id);problems++;}
  for(const name of ['Idle','Cheer','Victory']){
   const clip=(gltf.animations??[]).find(animation=>animation.name===name);
   if(!names.has(name)||!clip?.channels?.some(channel=>joints.has(channel.target?.node))){console.error('BONE CLIP MISSING',asset.id,name);problems++;}
  }
 }
 if(!fs.existsSync(path.join(root,'docs/ASSET_LICENSES_V37.md'))){console.error('PROVENANCE DOCUMENT MISSING',asset.id);problems++;}
 console.log('OK MODEL',asset.id,'meshes:',gltf.meshes?.length??0,'animations:',gltf.animations?.length??0);
}
if(problems){console.error(`\nPREMIUM ART GATE: NOT READY (${problems} defects). Do not release.`);process.exitCode=1;}
else console.log('PREMIUM ART FILE GATE passed. Still requires React, visual, mobile and gameplay acceptance.');
