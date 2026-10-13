/** Bảo An Learning asset pipeline: validated, self-contained GLB 2.0 mesh importer.
 * Supports scene hierarchy, node transforms, triangles, mesh colors and PBR base-color factors.
 * Deliberately rejects unimplemented compression/extensions; a model must not silently render broken.
 * Output uses the existing 10-float vertex layout: position(3), normal(3), color(3), animation(1).
 * Textures, skinning and glTF animations require a later renderer upgrade; DO NOT mark art gate passed.
 */

export class ModelImportError extends Error {
  constructor(message:string){super(message);this.name='ModelImportError';}
}
export interface ImportedGeometry {
  vertexData:Float32Array;
  triangleCount:number;
  nodeCount:number;
  warning:string[];
}
interface View {buffer?:number;byteOffset?:number;byteLength:number;byteStride?:number;}
interface Accessor {bufferView?:number;byteOffset?:number;componentType:number;count:number;type:string;normalized?:boolean;sparse?:unknown;}
interface Prim {attributes:Record<string,number>;indices?:number;material?:number;mode?:number;extensions?:unknown;}
interface Node {mesh?:number;children?:number[];matrix?:number[];translation?:number[];rotation?:number[];scale?:number[];}
interface Gltf {
  asset?:{version?:string};buffers?:{byteLength:number}[];bufferViews?:View[];accessors?:Accessor[];
  meshes?:{primitives:Prim[]}[];nodes?:Node[];scenes?:{nodes?:number[]}[];scene?:number;
  materials?:{pbrMetallicRoughness?:{baseColorFactor?:number[];baseColorTexture?:unknown}}[];
  extensionsRequired?:string[];
}
const COMPONENT_BYTES:Record<number,number>={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const COMPONENT_SIZE:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const MAX_TRIANGLES=600_000;
const finite=(n:number)=>Number.isFinite(n)?n:0;
const unit=(x:number,y:number,z:number):[number,number,number]=>{const d=Math.hypot(x,y,z)||1;return [x/d,y/d,z/d]};
const matIdentity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function matMul(a:number[],b:number[]):number[]{
  const out=Array<number>(16).fill(0);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
  return out;
}
function nodeTransform(n:Node):number[]{
  if(n.matrix){if(n.matrix.length!==16)throw new ModelImportError('Node matrix phải có 16 giá trị');return [...n.matrix];}
  const [x,y,z,w]=n.rotation??[0,0,0,1];
  const [sx,sy,sz]=n.scale??[1,1,1];
  const [tx,ty,tz]=n.translation??[0,0,0];
  return [
    (1-2*(y*y+z*z))*sx, 2*(x*y+z*w)*sx, 2*(x*z-y*w)*sx,0,
    2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,
    2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,
    tx,ty,tz,1
  ];
}
function point(m:number[],v:number[]):[number,number,number]{
 const [x,y,z]=v;return [finite(m[0]*x+m[4]*y+m[8]*z+m[12]),finite(m[1]*x+m[5]*y+m[9]*z+m[13]),finite(m[2]*x+m[6]*y+m[10]*z+m[14])];
}
function normal(m:number[],v:number[]):[number,number,number]{
  // Inverse transpose of the 3x3 linear transform to support non-uniform scales.
  const a=m[0],b=m[4],c=m[8],d=m[1],e=m[5],f=m[9],g=m[2],h=m[6],i=m[10];
  const A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,D=c*h-b*i,E=a*i-c*g,F=b*g-a*h,G=b*f-c*e,H=c*d-a*f,I=a*e-b*d;
  const det=a*A+b*B+c*C;
  if(Math.abs(det)<1e-8)return unit(...v as [number,number,number]);
  return unit((A*v[0]+B*v[1]+C*v[2])/det,(D*v[0]+E*v[1]+F*v[2])/det,(G*v[0]+H*v[1]+I*v[2])/det);
}
function readNumber(view:DataView,offset:number,type:number):number{
 switch(type){case 5120:return view.getInt8(offset);case 5121:return view.getUint8(offset);case 5122:return view.getInt16(offset,true);case 5123:return view.getUint16(offset,true);case 5125:return view.getUint32(offset,true);case 5126:return view.getFloat32(offset,true);default:throw new ModelImportError('GLB componentType không hỗ trợ: '+type)}
}
export function importGLB(data:ArrayBuffer):ImportedGeometry{
 const root=new DataView(data);
 if(root.byteLength<20 || root.getUint32(0,true)!==0x46546c67)throw new ModelImportError('Tệp không phải GLB hợp lệ');
 if(root.getUint32(4,true)!==2)throw new ModelImportError('Chỉ hỗ trợ GLB phiên bản 2');
 if(root.getUint32(8,true)!==root.byteLength)throw new ModelImportError('Độ dài GLB không khớp');
 let offset=12;let json:Uint8Array<ArrayBuffer>|null=null;let binOffset=-1;let binLength=0;
 while(offset+8<=data.byteLength){const len=root.getUint32(offset,true),type=root.getUint32(offset+4,true);offset+=8;
  if(len<0 || offset+len>data.byteLength)throw new ModelImportError('GLB chunk vượt giới hạn tệp');
  if(type===0x4e4f534a)json=new Uint8Array(data,offset,len);
  if(type===0x004e4942){binOffset=offset;binLength=len;}
  offset+=len;
 }
 if(!json||binOffset<0)throw new ModelImportError('Thiếu JSON hoặc BIN trong GLB');
 let doc:Gltf;
 try{doc=JSON.parse(new TextDecoder().decode(json).replace(/\u0000+$/g,'')) as Gltf;}catch{throw new ModelImportError('GLB JSON hỏng');}
 if(doc.asset?.version!=='2.0')throw new ModelImportError('GLB yêu cầu glTF 2.0');
 if(doc.extensionsRequired?.length)throw new ModelImportError('GLB dùng extension chưa hỗ trợ: '+doc.extensionsRequired.join(', '));
 const views=doc.bufferViews??[],accessors=doc.accessors??[],meshes=doc.meshes??[],nodes=doc.nodes??[];
 const warnings:string[]=[];const triangles:number[]=[];
 const readAccessor=(index:number):number[][]=>{
  const a=accessors[index];if(!a)throw new ModelImportError('Accessor không tồn tại: '+index);
  if(a.sparse)throw new ModelImportError('Sparse accessor chưa hỗ trợ');
  if(a.bufferView===undefined)throw new ModelImportError('Accessor thiếu bufferView');
  const bv=views[a.bufferView];if(!bv||bv.buffer && bv.buffer!==0)throw new ModelImportError('Chỉ hỗ trợ BIN nội bộ');
  const width=COMPONENT_SIZE[a.type],bytes=COMPONENT_BYTES[a.componentType];
  if(!width||!bytes || a.count<0 || a.count>MAX_TRIANGLES*3)throw new ModelImportError('Accessor không hợp lệ');
  const stride=bv.byteStride??width*bytes;if(stride<width*bytes)throw new ModelImportError('Accessor byteStride quá nhỏ');
  const start=binOffset+(bv.byteOffset??0)+(a.byteOffset??0);
  const last=start+(a.count?((a.count-1)*stride+width*bytes):0);
  if(start<binOffset||last>binOffset+binLength||last>data.byteLength)throw new ModelImportError('Accessor vượt giới hạn BIN');
  const rows:number[][]=[];for(let i=0;i<a.count;i++){
   const row:number[]=[];for(let j=0;j<width;j++){
    const raw=readNumber(root,start+i*stride+j*bytes,a.componentType);
    const divisor=a.componentType===5121?255:a.componentType===5123?65535:a.componentType===5125?4294967295:a.componentType===5120?127:a.componentType===5122?32767:1;
    row.push(a.normalized&&a.componentType!==5126?Math.max(-1,raw/divisor):raw);
   }rows.push(row);
  }
  return rows;
 };
 const processed=new Set<number>();
 const renderNode=(nidx:number,parent:number[],ancestors:Set<number>)=>{
  if(ancestors.has(nidx))throw new ModelImportError('Vòng lặp trong node hierarchy');
  const n=nodes[nidx];if(!n)throw new ModelImportError('Node không tồn tại: '+nidx);
  const stack=new Set(ancestors);stack.add(nidx);processed.add(nidx);const transform=matMul(parent,nodeTransform(n));
  if(n.mesh!==undefined){const mesh=meshes[n.mesh];if(!mesh)throw new ModelImportError('Mesh không tồn tại');
   for(const prim of mesh.primitives){
    if(prim.extensions)throw new ModelImportError('Primitive extension chưa hỗ trợ');
    if(prim.mode!==undefined && prim.mode!==4)throw new ModelImportError('Chỉ hỗ trợ TRIANGLES');
    const pos=readAccessor(prim.attributes.POSITION);if(pos.some(p=>p.length!==3))throw new ModelImportError('POSITION phải là VEC3');
    const nrm=prim.attributes.NORMAL===undefined?null:readAccessor(prim.attributes.NORMAL);
    const cols=prim.attributes.COLOR_0===undefined?null:readAccessor(prim.attributes.COLOR_0);
    const ids=prim.indices===undefined?pos.map((_,i)=>i):readAccessor(prim.indices).map(row=>row[0]);
    if(ids.length%3!==0)throw new ModelImportError('Indices phải chia hết cho 3');
    const f=doc.materials?.[prim.material??-1]?.pbrMetallicRoughness;
    if(f?.baseColorTexture)warnings.push('Vật liệu có texture; hiện chỉ đọc màu nền, chưa dựng họa tiết PBR');
    const base=f?.baseColorFactor??[1,1,1,1];
    for(let i=0;i<ids.length;i+=3){
     if(triangles.length/30>=MAX_TRIANGLES)throw new ModelImportError('Mô hình vượt giới hạn tam giác');
     const verts=ids.slice(i,i+3).map(k=>{
      if(!Number.isInteger(k)||k<0||k>=pos.length)throw new ModelImportError('Index nằm ngoài POSITION');
      return {p:point(transform,pos[k]),n:nrm?.[k],c:cols?.[k]};
     });
     const a=verts[0].p,b=verts[1].p,c=verts[2].p;
     const fNormal=unit((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
     for(const v of verts){const n=v.n?normal(transform,v.n):fNormal;
      const color=(v.c??[1,1,1]).map((x,j)=>Math.max(0,Math.min(1,(base[j]??1)*x)));
      triangles.push(...v.p,...n,color[0],color[1],color[2],0);
     }
    }
   }
  }
  for(const c of n.children??[])renderNode(c,transform,stack);
 };
 const scene=doc.scenes?.[doc.scene??0];if(!scene)throw new ModelImportError('GLB thiếu scene');
 for(const n of scene.nodes??[])renderNode(n,matIdentity(),new Set());
 return {vertexData:new Float32Array(triangles),triangleCount:triangles.length/30,nodeCount:processed.size,warning:[...new Set(warnings)]};
}
