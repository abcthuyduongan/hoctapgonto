/** Bảo An Learning V3.2 — self-contained WebGL 3D renderer.
 * Objects are real perspective-projected 3D mesh geometry, NOT a 2D image.
 * No network requests, no external textures, no extra rendering dependencies.
 */
import { importGLB, ModelImportError } from './assets/glb.ts';
export type WorldId = 'math-quest' | 'memory-match' | 'sentence-builder' | 'word-connect' | 'sequence-trail';
export type WorldQuality = 'full' | 'low';
type Vec3 = [number, number, number];
const PI = Math.PI;
const clamp=(a:number,b:number,c:number)=>Math.max(b,Math.min(c,a));
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:Vec3):Vec3=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a:Vec3,f:number):Vec3=>[a[0]*f,a[1]*f,a[2]*f];
const rgb=(hex:string):Vec3=>{const h=hex.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255) as Vec3;};
const adjust=(c:Vec3,f:number):Vec3=>[clamp(c[0]*f,0,1),clamp(c[1]*f,0,1),clamp(c[2]*f,0,1)];
function lookAt(eye:Vec3,target:Vec3):Float32Array{
  const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1]);
}
function perspective(fov:number,aspect:number,near:number,far:number):Float32Array{
 const f=1/Math.tan(fov/2),a=1/(near-far);
 return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*a,-1,0,0,2*far*near*a,0]);
}
export function project3D(p:Vec3, eye:Vec3, target:Vec3, width:number,height:number){
 const v=lookAt(eye,target),pr=perspective(PI/4.2,width/height,0.1,100);
 const tx=v[0]*p[0]+v[4]*p[1]+v[8]*p[2]+v[12],ty=v[1]*p[0]+v[5]*p[1]+v[9]*p[2]+v[13],tz=v[2]*p[0]+v[6]*p[1]+v[10]*p[2]+v[14];
 if(tz>=-0.1)return {x:-1,y:-1,visible:false};
 const x=(tx*pr[0]/-tz*.5+.5)*width,y=(-ty*pr[5]/-tz*.5+.5)*height;
 return {x,y,visible:x>=0&&x<=width&&y>=0&&y<=height};
}
class Mesh {
 private simplified:boolean;
 constructor(simplified=false){this.simplified=simplified;}
 data:number[]=[];
 tri(a:Vec3,b:Vec3,c:Vec3,color:string,brightness=1,animated=0){
  const n=norm(cross(sub(b,a),sub(c,a))),col=adjust(rgb(color),brightness);
  for(const p of [a,b,c])this.data.push(...p,...n,...col,animated);
 }
 quad(a:Vec3,b:Vec3,c:Vec3,d:Vec3,color:string,brightness=1,animated=0){this.tri(a,b,c,color,brightness,animated);this.tri(a,c,d,color,brightness,animated);}
 box(p:Vec3,size:Vec3,color:string,animated=0){const [x,y,z]=p,[a,b,c]=size.map(v=>v/2),v=(i:number,j:number,k:number):Vec3=>[x+i*a,y+j*b,z+k*c];
  const faces:[Vec3,Vec3,Vec3,Vec3,number][]=[
 [v(-1,-1,1),v(1,-1,1),v(1,1,1),v(-1,1,1),1],
 [v(1,-1,-1),v(-1,-1,-1),v(-1,1,-1),v(1,1,-1),.78],
 [v(-1,-1,-1),v(-1,-1,1),v(-1,1,1),v(-1,1,-1),.81],
 [v(1,-1,1),v(1,-1,-1),v(1,1,-1),v(1,1,1),.88],
 [v(-1,1,1),v(1,1,1),v(1,1,-1),v(-1,1,-1),1.12],
 [v(-1,-1,-1),v(1,-1,-1),v(1,-1,1),v(-1,-1,1),.65]];
  faces.forEach(([a,b,c,d,shade])=>this.quad(a,b,c,d,color,shade,animated));
 }
 cone(p:Vec3,rTop:number,rBottom:number,height:number,color:string,steps=10,animated=0){if(this.simplified)steps=Math.max(4,Math.floor(steps*.65));const [x,y,z]=p,lower=y-height/2,upper=y+height/2;
 for(let i=0;i<steps;i++){const a=2*PI*i/steps,b=2*PI*(i+1)/steps;
 const q=(r:number,t:number,y1:number):Vec3=>[x+Math.cos(t)*r,y1,z+Math.sin(t)*r];
 this.quad(q(rBottom,a,lower),q(rBottom,b,lower),q(rTop,b,upper),q(rTop,a,upper),color,1,animated);
 this.tri([x,upper,z],q(rTop,b,upper),q(rTop,a,upper),color,1.16,animated);
 }
 }
 sphere(p:Vec3,r:Vec3,color:string,lat=9,lon=14,animated=0){if(this.simplified){lat=Math.max(3,Math.floor(lat*.65));lon=Math.max(5,Math.floor(lon*.65));}const pt=(t:number,phi:number):Vec3=>[p[0]+Math.cos(t)*Math.sin(phi)*r[0],p[1]+Math.cos(phi)*r[1],p[2]+Math.sin(t)*Math.sin(phi)*r[2]];
 for(let j=0;j<lat;j++){const phi=PI*j/lat,ph2=PI*(j+1)/lat;for(let i=0;i<lon;i++){const t=2*PI*i/lon,t2=2*PI*(i+1)/lon;
 this.quad(pt(t,phi),pt(t2,phi),pt(t2,ph2),pt(t,ph2),color,1,animated);
 }} }
 roof(p:Vec3,w:number,d:number,h:number,color:string){const[x,y,z]=p,v=(a:number,b:number,c:number):Vec3=>[x+a,y+b,z+c];
 this.quad(v(-w/2,0,-d/2),v(0,h,-d/2),v(0,h,d/2),v(-w/2,0,d/2),color,1.08);
 this.quad(v(0,h,-d/2),v(w/2,0,-d/2),v(w/2,0,d/2),v(0,h,d/2),color,.9);
 this.quad(v(-w/2,0,d/2),v(0,h,d/2),v(w/2,0,d/2),v(w/2,0,-d/2),color,1);
 }
}
const palette={rock:'#787ea4',rock2:'#606b96',soil:'#98677c',grass:'#58c45e',grassDark:'#299a59',grassLight:'#a0e76d',wood:'#99552f',woodLight:'#cc8747',math:'#ffc559',memory:'#49d9ba',language:'#e883d0'};
function island(m:Mesh,x:number,y:number,z:number,r:number,hue:string,variant:number){
 m.cone([x,y-1.15,z],r*.15,r*.86,2.1,palette.rock2,12);
 m.cone([x,y-.55,z],r*.84,r,1.15,palette.rock,14);
 m.cone([x,y-.13,z],r,r*.99,.38,palette.soil,14);
 m.cone([x,y+.08,z],r*.98,r,.22,hue,14);
 m.cone([x,y+.18,z],r*.86,r*.95,.12,variant===0?'#95e374':'#7bdd8b',14);
 // Small irregular cliff facets and hanging rock tips create terrain depth
 // without textures, new draw calls, or a costly post-processing pipeline.
 for(let i=0;i<9;i++){
   const a=i*2*PI/9+.34,rr=r*(.53+.11*Math.sin(i*3.7));
   const px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr;
   m.cone([px,y-1.05-(i%3)*.12,pz],0,.19+(i%3)*.06,.53+(i%4)*.19,
     i%2?'#70759b':'#9096b4',5);
   if(i%2===0)m.sphere([x+Math.cos(a)*r*.89,y-.22,z+Math.sin(a)*r*.89],
     [.14,.12,.19],i%4?'#b9a0a5':'#dfb5a0',4,6);
 }
 // Colorful stones, flowers and grassy tufts around periphery.
 for(let i=0;i<16;i++){const a=i*2.399,rad=r*(.65+.2*Math.abs(Math.sin(i*3.4))),px=x+Math.cos(a)*rad,pz=z+Math.sin(a)*rad;
 if(i%3===0){m.sphere([px,y+.29,pz],[.095,.095,.095],i%2?'#f9a9f0':'#ffe97e',5,7);} else m.cone([px,y+.28,pz],0,.1,.22,i%2?'#3dae63':'#8be67e',5);
 }
}
// Decorative geometry is real 3D: waterfalls, wooden suspension bridges,
// lamps, flowers, crystalline portal stones and architectural detailing.
function waterfall(m:Mesh,x:number,y:number,z:number,width=.55,len=2.45){
 for(let j=0;j<4;j++){
   const w=width/4;
   const a:Vec3=[x-width/2+j*w,y,z];
   const b:Vec3=[a[0]+w,y,z];
   const bend=(j%2?-.045:.055);
   const c:Vec3=[b[0]+bend,y-len,z+.52];
   const d:Vec3=[a[0]+bend,y-len,z+.52];
   m.quad(a,b,c,d,j%2?'#55c4f8':'#aceffe',j%2?1.1:1.18,1);
   m.quad([a[0],y-.28,z+.02],[b[0],y-.28,z+.02],[c[0],y-len,z+.57],[d[0],y-len,z+.57],j%2?'#328edc':'#c8f9ff',1.06,1);
 }
 for(let i=0;i<5;i++){
 const k=i/4;
 m.sphere([x+Math.sin(i*2.4)*width*.52,y-len-.15,z+.56],[.14+.08*k,.055,.09],i%2?'#e8ffff':'#8cdcf8',4,7,1);
 }
}
function flower(m:Mesh,x:number,y:number,z:number,c='#f58ab7',s=1){
 m.cone([x,y+.12*s,z],0,.025*s,.25*s,'#318b4b',5);
 for(let j=0;j<5;j++){
 const a=j*2*PI/5;
 m.sphere([x+Math.cos(a)*.095*s,y+.27*s,z+Math.sin(a)*.095*s],[.085*s,.065*s,.075*s],c,4,6);
 }
 m.sphere([x,y+.27*s,z],[.07*s,.06*s,.07*s],'#ffe47b',4,6);
}
function lamp(m:Mesh,x:number,y:number,z:number,s=1){
 m.box([x,y+.41*s,z],[.065*s,.83*s,.065*s],'#805136');
 m.cone([x,y+.85*s,z],.03*s,.19*s,.25*s,'#f6bc68',6);
 m.sphere([x,y+.86*s,z],[.12*s,.12*s,.12*s],'#ffe8a0',6,9,1);
 m.cone([x,y+1.04*s,z],0,.17*s,.18*s,'#75483c',6);
}
function woodBridge(m:Mesh,from:Vec3,to:Vec3,planks=15){
 const delta=sub(to,from),d=norm([delta[0],0,delta[2]]),perp:Vec3=[-d[2],0,d[0]];
 for(let i=0;i<planks;i++){
   const f=(i+.5)/planks,mid=add(from,mul(delta,f));mid[1]-=Math.sin(PI*f)*.2;
   m.box(mid,[Math.abs(d[2])*.32+Math.abs(perp[0])*1.0,.10,Math.abs(d[0])*.32+Math.abs(perp[2])*1.0],i%4===0?'#e8a864':'#ba7544');
   if(i%3===0){for(const side of [-1,1]){
     const sidep=add(mid,mul(perp,side*.50));
     m.cone([sidep[0],sidep[1]+.28,sidep[2]],.045,.055,.54,'#8a5a36',6);
     m.sphere([sidep[0],sidep[1]+.58,sidep[2]],[.07,.07,.07],'#ffd488',5,7);
   }}
 }
}
function tiledRoof(m:Mesh,x:number,y:number,z:number,w:number,d:number,c='#e8876c'){
 m.roof([x,y,z],w,d,w*.46,c);
 const n=7;
 for(let i=0;i<n;i++){
 const t=(i+.5)/n,px=x-w/2+t*w;
 const yy=y+(.5-Math.abs(t-.5))*w*.46*2+.012;
 m.box([px,yy,z],[.035,.038,d*.98],i%2?'#fff0d1':'#9c5360');
 }
 for(const dz of [-d*.52,d*.52])m.box([x,y+.04,z+dz],[w*.98,.08,.05],'#f6c17a');
}
function ornateCottage(m:Mesh,x:number,y:number,z:number,s=1,pink=false){
 cottage(m,x,y,z,s,pink?'#fff0ef':'#fff2c9',pink?'#ef86b2':'#f6a052');
 tiledRoof(m,x,y+1.16*s,z,1.55*s,1.29*s,pink?'#eb81b1':'#ec8068');
 for(let side of [-1,1]){
   m.box([x+side*.41*s,y+.8*s,z+.557*s],[.09*s,.39*s,.09*s],'#fff5c4');
   m.box([x+side*.41*s,y+1.01*s,z+.567*s],[.28*s,.055*s,.09*s],pink?'#fdb5a4':'#f9c475');
 }
 m.box([x,y+.24*s,z+.59*s],[.45*s,.08*s,.16*s],'#dba56d');
 for(let i=0;i<3;i++)flower(m,x+(.35+i*.15)*s,y+.1*s,z+.5*s,i%2?'#ffed90':'#f38fa2',.6*s);
}
function steppingStones(m:Mesh,x:number,y:number,z:number){
 for(let i=0;i<4;i++){
  const xx=x+i*.40;
  m.box([xx,y+.18+i*.03,z],[.31,.27,.27],['#ffbd53','#90d7fb','#f4a5cf','#bdf283'][i]);
  m.box([xx,y+.33+i*.03,z],[.24,.045,.20],'#fff5db');
 }
}
function crystal(m:Mesh,x:number,y:number,z:number,s=1,c='#87eafa'){
 m.cone([x,y+.38*s,z],0,.21*s,.65*s,c,6,1);
 m.cone([x,y+.04*s,z],.21*s,0,.23*s,'#d3f8ff',6,1);
 sparkle(m,x,y+.91*s,z,.11*s,'#fff4b0');
}
function tallBanner(m:Mesh,x:number,y:number,z:number,color:string){
 m.box([x,y+.78,z],[.07,1.56,.07],'#a76e50');
 m.tri([x+.06,y+1.52,z],[x+.52,y+1.35,z],[x+.06,y+1.17,z],color,1,1);
 m.sphere([x,y+1.61,z],[.09,.10,.09],'#ffdf72',5,7);
}

function tree(m:Mesh,x:number,y:number,z:number,s=1,c='#51c963'){
 m.cone([x,y+.43*s,z],.09*s,.17*s,.9*s,'#835032',7);
 for(let i=0;i<3;i++){m.sphere([x+(i-1)*.24*s,y+(1.12+(i===1?.23:0))*s,z+((i%2)?-.06:.07)*s],[.48*s,.54*s,.45*s],i===1?c:'#298f60',7,9,1);}
 m.sphere([x-.12*s,y+1.46*s,z+.12*s],[.24*s,.2*s,.28*s],'#95eb83',5,7,1);
}
function cottage(m:Mesh,x:number,y:number,z:number,s=1,tone='#fff4bb',roof='#f37665'){
 m.box([x,y+.61*s,z],[1.25*s,1.17*s,1.03*s],tone);
 m.roof([x,y+1.16*s,z],1.6*s,1.35*s,.68*s,roof);
 m.box([x,y+.36*s,z+.53*s],[.31*s,.69*s,.06*s],'#9a553b');
 for(let a of [-.4,.4])m.box([x+a*s,y+.8*s,z+.54*s],[.24*s,.28*s,.06*s],'#80daff');
 m.box([x,y+1.88*s,z-.2*s],[.13*s,.36*s,.13*s],'#e7c47a');
}
function castle(m:Mesh,x:number,y:number,z:number,s=1){
 m.box([x,y+.9*s,z],[1.48*s,1.62*s,1.12*s],'#fff0c5');
 m.box([x,y+1.75*s,z],[1.69*s,.22*s,1.27*s],'#f6cb97');
 m.cone([x,y+2.18*s,z],0,.93*s,.78*s,'#ff7282',4);
 for(let i of [-1,1]){m.cone([x+i*.82*s,y+.87*s,z],.22*s,.34*s,1.85*s,'#fff8d9',8);
 m.cone([x+i*.82*s,y+2.25*s,z],0,.42*s,.72*s,i<0?'#8c73ea':'#f78477',8);
 m.box([x+i*.82*s,y+1.1*s,z+.36*s],[.19*s,.36*s,.07*s],'#78dcf9');}
 m.box([x,y+.56*s,z+.59*s],[.39*s,.76*s,.08*s],'#93604a');
 m.box([x,y+1.35*s,z+.62*s],[.28*s,.3*s,.07*s],'#86dcfb');
}
function sparkle(m:Mesh,x:number,y:number,z:number,s:number, color='#fff098'){
 m.cone([x,y,z],0,s*.19,s*1.25,color,4,1);
 m.cone([x,y,z],s*.19,0,s*1.25,color,4,1);
 m.sphere([x,y,z],[s*.18,s*.18,s*.18],color,5,7,1);
}
function card(m:Mesh,x:number,y:number,z:number,c:string){
 m.box([x,y,z],[.65,.87,.13],'#fff2d4');m.box([x,y,z+.09],[.55,.75,.03],c);m.sphere([x,y+.1,z+.13],[.17,.17,.04],'#fff4a4',5,7);m.box([x,y-.16,z+.14],[.26,.10,.03],'#e4f9ff');
}
function book(m:Mesh,x:number,y:number,z:number){
 m.box([x-.37,y,z],[.72,.14,.9],'#fff7e3');m.box([x+.37,y,z],[.72,.14,.9],'#fff2cb');
 m.box([x,y-.11,z],[1.56,.12,1.0],'#ad609d');
 for(let i=0;i<3;i++){m.box([x-.45,y+.085,z-.25+i*.2],[.40,.015,.025],'#93b1c9');m.box([x+.4,y+.085,z-.25+i*.2],[.4,.015,.025],'#c38db9');}
}
function fox(m:Mesh,x:number,y:number,z:number,s=.8){
 const o=(px:number,py:number,pz:number):Vec3=>[x+px*s,y+py*s,z+pz*s];
 m.sphere(o(0,.8,0),[.44,.51,.36],'#287cc6',8,12);
 m.sphere(o(0,1.64,.1),[.59,.56,.53],'#ef8a43',8,12);
 m.sphere(o(-.42,2.05,.05),[.22,.39,.22],'#f28854',5,8);
 m.sphere(o(.42,2.05,.05),[.22,.39,.22],'#f28854',5,8);
 m.sphere(o(-.42,2.12,.18),[.12,.22,.08],'#ffc9b9',5,7);
 m.sphere(o(.42,2.12,.18),[.12,.22,.08],'#ffc9b9',5,7);
 m.sphere(o(0,1.42,.45),[.46,.28,.17],'#ffe7c8',6,9);
 m.sphere(o(0,1.48,.59),[.12,.095,.08],'#332a35',5,8);
 for(let a of [-.24,.24]){m.sphere(o(a,1.78,.54),[.135,.17,.065],'#fffefa',5,7);m.sphere(o(a,1.79,.608),[.064,.09,.03],'#20273d',5,8);}
 for(let a of [-.38,.38])m.sphere(o(a,.85,.03),[.19,.32,.25],'#ee8d4e',7,9);
 m.sphere(o(-.12,.23,.12),[.22,.20,.27],'#f6c29a',5,7);m.sphere(o(.20,.23,.12),[.22,.20,.27],'#f6c29a',5,7);
 m.sphere(o(-.55,1,.19),[.19,.36,.19],'#ee8d4e',6,8);m.sphere(o(.55,1.18,.26),[.2,.33,.18],'#ee8d4e',6,8);
 m.sphere(o(-.70,.85,-.38),[.56,.32,.32],'#f18246',7,9);m.sphere(o(-1.0,.84,-.48),[.28,.27,.26],'#fff4dd',6,8);
 m.sphere(o(0,.82,.38),[.17,.16,.06],'#ffde58',5,8);
}
function cloud(m:Mesh,x:number,y:number,z:number,s:number){for(let k=0;k<4;k++)m.sphere([x+(k-1.5)*s*.43,y+Math.sin(k*2)*s*.13,z],[s*.52,s*.26+(k%2)*s*.12,s*.34],k%2?'#effaff':'#d9f4ff',6,10,2);}
function stars(m:Mesh){for(let i=0;i<27;i++){const x=Math.sin(i*2.23)*11.2,y=2.6+(i%7)*.54,z=-7-(i%5)*1.3;sparkle(m,x,y,z,.06+(i%4)*.038,i%3?'#fff3b6':'#a8f6ff');}}
export interface WorldSceneOptions { reducedMotion?:boolean; quality?:WorldQuality; onSelect?:(id:WorldId)=>void; onEnterWorld?:(id:WorldId)=>void; onReady?:(success:boolean)=>void; }
export class LearningWorld3D {
 private renderPreset:'balanced'|'sharp'='balanced';private softwareDirty=true;private lastRendered=0;private avgFrameMs=0;private frameSamples=0;
 private canvas:HTMLCanvasElement;private gl:WebGL2RenderingContext|null=null;private ctx:CanvasRenderingContext2D|null=null;private softwareData:Float32Array|null=null;
 private program:WebGLProgram|null=null;private vao:WebGLVertexArrayObject|null=null;private buffer:WebGLBuffer|null=null;
 private drawCount=0;private raf=0;private active=true;private disposed=false;private quality:WorldQuality='full';private modelAbort:AbortController|null=null;private modelSequence=0;private importedModel=false;private cheerUntil=0;private motion=true;private target:Vec3=[0,.4,0];private eye:Vec3=[0,5.9,17];private focus:WorldId|null=null;private pointer=0;private h=1;private w=1;private onSelect?: (id:WorldId)=>void;private onEnterWorld?: (id:WorldId)=>void;private ready=false;
 private onMove=(e:PointerEvent)=>{if(!this.motion||this.ctx)return;const r=this.canvas.getBoundingClientRect();this.pointer=clamp((e.clientX-r.left)/Math.max(1,r.width)*2-1,-1,1)};
 private onClick=(e:MouseEvent)=>{if(!this.active||this.disposed||e.button!==0)return;this.canvas.focus({preventScroll:true});const r=this.canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const ids:WorldId[]=['math-quest','memory-match','sentence-builder'];
  const coords=[-4.8,0,4.8].map(px=>project3D([px,.55,0],[...this.eye] as Vec3,[...this.target] as Vec3,this.w,this.h));
  const idx=coords.reduce((best,p,i)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(coords[best].x-x,coords[best].y-y)?i:best,0);
  if(y>this.h*.23&&y<this.h*.82&&Math.abs(coords[idx].x-x)<this.w*.2){if(this.focus===ids[idx]&&this.onEnterWorld)this.onEnterWorld(ids[idx]);else{this.focusOn(ids[idx]);this.onSelect?.(ids[idx]);}}
 };
 private onResize=()=>{const dpr=Math.min(devicePixelRatio||1,this.renderPreset==='sharp'?2:1.25);const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
  this.canvas.width=Math.floor(w*dpr);this.canvas.height=Math.floor(h*dpr);this.w=w;this.h=h;this.ctx?.setTransform(dpr,0,0,dpr,0,0);this.gl?.viewport(0,0,this.canvas.width,this.canvas.height);if(this.ctx)this.invalidateSoftware();
 };
 private onLoss=(event:Event)=>{event.preventDefault();this.ready=false;cancelAnimationFrame(this.raf);};
 constructor(canvas:HTMLCanvasElement,options:WorldSceneOptions={}){this.canvas=canvas;this.motion=!options.reducedMotion;this.onSelect=options.onSelect;this.onEnterWorld=options.onEnterWorld;try{this.start(options.quality??'full');options.onReady?.(true)}catch(e){console.warn('Bảo An 3D: renderer could not start',e);this.dispose();options.onReady?.(false)}}
 get available(){return this.ready}
 /** Render-resolution control; does not discard models, scores or the current scene. */
 setRenderQuality(preset:'balanced'|'sharp') {this.renderPreset=preset;this.onResize();}
 getDiagnostics(){return {renderer:this.gl?'webgl2':this.ctx?'canvas':'unavailable',quality:this.quality,resolution:this.renderPreset,
  width:this.canvas.width,height:this.canvas.height,triangles:Math.floor(this.ctx?(this.softwareData?.length??0)/30:this.drawCount/3),
  measuredFps:this.ctx?null:this.avgFrameMs>0?Math.round(1000/this.avgFrameMs*10)/10:null,samples:this.frameSamples,staticCanvasFallback:!!this.ctx,modelLoaded:this.importedModel};}
 private recordFrame(now:number){if(this.lastRendered&&now-this.lastRendered>1&&now-this.lastRendered<1000){const duration=now-this.lastRendered;
   this.avgFrameMs=this.avgFrameMs?this.avgFrameMs*.94+duration*.06:duration;
   this.frameSamples++;}this.lastRendered=now;}

 setMotion(enabled:boolean){this.motion=enabled;if(!enabled){this.pointer=0;this.cheerUntil=0;}if(this.ctx)this.invalidateSoftware();}
 /** GPU-only reaction: does not rebuild a mesh, request additional assets, or move the UI. */
 celebrateSelection(now=performance.now()){if(this.motion)this.cheerUntil=now+1250;}
 setPaused(paused:boolean){if(this.active===!paused)return;this.active=!paused;if(this.active&&this.ready){if(this.ctx){if(this.softwareDirty)this.invalidateSoftware();}else this.raf=requestAnimationFrame(this.draw)}else cancelAnimationFrame(this.raf)}
 focusOn(id:WorldId|null){if(id && id!==this.focus)this.celebrateSelection();if(this.focus!==id){this.focus=id;if(this.ctx)this.invalidateSoftware();}}
 // A static-on-demand 3D projection avoids a permanently busy main thread
 // on phones without WebGL. Interactivity stays in HTML controls.
 private invalidateSoftware(){if(!this.ctx||!this.ready)return;this.softwareDirty=true;
  if(this.active){cancelAnimationFrame(this.raf);this.raf=requestAnimationFrame(this.draw);}}
 private compile(type:number,src:string){const gl=this.gl!,sh=gl.createShader(type)!;gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh)??'Shader failed');return sh;}
 private start(quality:WorldQuality){this.quality=quality;const gl=this.canvas.getContext('webgl2',{antialias:true,alpha:true,premultipliedAlpha:false,powerPreference:'low-power'});if(!gl){this.startSoftware(quality);return;}this.gl=gl;
 const vert=`#version 300 es
 precision highp float;
 in vec3 aPosition;in vec3 aNormal;in vec3 aColor;in float aAnimation;
 uniform mat4 uProjection;uniform mat4 uView;uniform float uTime;uniform float uAnimate;uniform float uGuideCheer;
 out vec3 vColor;out float vFog;
 void main(){vec3 p=aPosition;
 if(aAnimation>2.5){
   // A single imported character is tagged with animation=3; idle float and
   // celebratory hop affect only its vertices (never the ground or controls).
   float bob=sin(uTime*.0024)*.085*uAnimate;
   float turn=sin(uTime*.0012)*.025*uAnimate;
   p.x+=turn*(p.y+.35);
   p.y+=bob+uGuideCheer*uAnimate*(.18+.20*max(0.,sin(uTime*.018)));
 }else if(aAnimation>1.5){p.x+=sin(uTime*.0003+p.x*.2)*.09*uAnimate;}
 else if(aAnimation>0.5){p.x+=sin(uTime*.0017+p.y*2.2+p.z*.7)*.045*uAnimate;}
 vec4 eye=uView*vec4(p,1.0);
 vec3 n=normalize(aNormal);
 vec3 keyLight=normalize(vec3(-.42,1.,.68));
 float diffuse=max(dot(n,keyLight),0.);
 float hemisphere=.76+max(n.y,0.)*.14;
 vec3 cameraDir=normalize(-eye.xyz);
 float rim=max(0.,1.-abs(dot(n,cameraDir)));
 // Stylized specular on the GLB character; world terrain remains matte.
 // This is intentionally NOT marketed as full glTF metallic-roughness PBR.
 float highlight=(aAnimation>2.5)?pow(max(dot(reflect(-keyLight,n),cameraDir),0.),28.)*.19:0.;
 vColor=aColor*(hemisphere+diffuse*.25)+vec3(.045,.055,.075)*pow(rim,3.)+vec3(.98,.93,.79)*highlight;
 vFog=clamp((-eye.z-12.)/32.,0.,.58);
 gl_Position=uProjection*eye;
 }`;
 const frag=`#version 300 es
 precision highp float;in vec3 vColor;in float vFog;out vec4 fragColor;
 void main(){vec3 c=mix(vColor,vec3(.69,.89,1.),vFog);c=pow(c,vec3(.84));c=mix(c,vec3(1.),.025);fragColor=vec4(c,1.0);}`;
 const p=gl.createProgram()!;gl.attachShader(p,this.compile(gl.VERTEX_SHADER,vert));gl.attachShader(p,this.compile(gl.FRAGMENT_SHADER,frag));gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)??'Program link failed');this.program=p;
 const m=new Mesh();this.build(m,quality);
 this.drawCount=m.data.length/10;
 const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(m.data),gl.STATIC_DRAW);this.buffer=buffer;
 const vao=gl.createVertexArray()!;gl.bindVertexArray(vao);const stride=40;
 for(const [name,size,offset] of [['aPosition',3,0],['aNormal',3,12],['aColor',3,24],['aAnimation',1,36]] as const){const loc=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset);}
 gl.bindVertexArray(null);this.vao=vao;gl.clearColor(0,0,0,0);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
 this.canvas.addEventListener('pointermove',this.onMove);this.canvas.addEventListener('click',this.onClick);
 this.canvas.addEventListener('webglcontextlost',this.onLoss);window.addEventListener('resize',this.onResize);this.onResize();this.ready=true;this.raf=requestAnimationFrame(this.draw);
 }
 private build(m:Mesh,quality:WorldQuality,showFallbackFox=true){
  // All three islands float above an actual 3D canyon of clouds.
  const xs=[-4.8,0,4.8],hues=['#6dce74','#4fc89d','#86c976'];
  xs.forEach((x,i)=>island(m,x,i===1?.25:0,i===1?-.55:0,2.43,hues[i],i));
  // Software fallback and small devices receive a reduced-poly variant.
  // Keep all three playable landmarks while avoiding tens of thousands of Canvas fills.
  if(quality==='low'){
   castle(m,-4.9,.24,-.55,.83);cottage(m,-6.27,.25,.12,.55);
   tree(m,-6.3,.23,-.75,.66);tree(m,-3.6,.23,-.65,.6);
   tree(m,-.12,.51,-.75,1.16,'#4acaa6');tree(m,-1.35,.48,.05,.65);
   card(m,-.65,1.36,.7,'#f99dca');card(m,.12,1.5,.72,'#87d4ff');card(m,.82,1.32,.55,'#c6a6ff');
   cottage(m,4.95,.18,-.56,.87,'#ffe6ee','#f39bd0');book(m,4.63,.8,.95);
   tree(m,6.3,.2,-.18,.70,'#f0a1ce');
   waterfall(m,-3.8,-.12,1.52,.55,1.90);waterfall(m,.6,.13,1.52,.56,1.9);
   woodBridge(m,[-2.86,.38,.24],[-1.94,.58,.20],7);woodBridge(m,[2.0,.58,.21],[2.92,.40,.20],7);
   island(m,-8.45,-.75,.2,1.6,'#73c86e',4);if(showFallbackFox)fox(m,-8.45,-.48,.62,.94);
   for(let i=0;i<5;i++)cloud(m,Math.sin(i*1.9)*11,1.8+(i%3)*.5,-9-(i%4)*1.4,.64);
   return;
  }

  // Premium scene accents: flowing falls, wooden island bridges and warm lanterns.
  waterfall(m,-4.05,-.11,1.64,.74,2.0);
  waterfall(m,.8,.12,1.68,.66,2.2);
  waterfall(m,5.68,-.11,1.70,.80,2.0);
  woodBridge(m,[-2.85,.37,.32],[-1.94,.60,.28],11);
  woodBridge(m,[1.98,.61,.2],[2.91,.37,.24],11);
  for(const [x,z] of [[-5.78,-1.26],[-3.47,-1.08],[-1.34,1.27],[1.2,1.15],[3.54,-1.10],[6.2,-.78]] as const){
    lamp(m,x,.25,z,.68);
  }
  for(let i=0;i<9;i++){
   flower(m,-6.2+Math.sin(i*1.8)*.67,.21,-.25+Math.cos(i*1.7)*1.1,i%2?'#ffc67a':'#f78ebf',.8);
   flower(m,-1.14+Math.sin(i*2.1)*1.9,.45,.5+Math.cos(i*2.3)*1.0,i%3?'#f6a7d5':'#ffc879',.73);
   flower(m,3.9+Math.sin(i*1.8)*1.2,.18,-.4+Math.cos(i*1.8)*1.15,i%2?'#fda1c7':'#fef19d',.92);
  }
  tallBanner(m,-5.68,.26,-1.0,'#ffd359');tallBanner(m,6.0,.21,-.95,'#ef8cc8');
  for(let i=0;i<5;i++){
    crystal(m,-3.18+i*.2,.12,-.6+.22*Math.sin(i),.52,i%2?'#94e5ff':'#ffe6a3');
  }

  // Math: illustrated castle and number-shaped stepping stones.
  castle(m,-4.85,.25,-.55,.83);ornateCottage(m,-6.28,.28,.25,.55);steppingStones(m,-5.80,.20,1.23);
  m.box([-3.55,.45,0],[.65,.54,.6],'#81d5ff');m.box([-3.55,.78,0],[.52,.10,.52],'#ffe487');
  for(let i=0;i<3;i++){m.box([-5.78+i*.7,.48,1.12],[.42,.42,.42],['#ffb752','#9bea83','#79c8f5'][i]);sparkle(m,-5.78+i*.7,.79,1.12,.09);}
  tree(m,-6.45,.21,-.66,.73);tree(m,-3.7,.25,-1.24,.58,'#81d86b');
  // Memory: glowing forest and the illustrated 3D memory cards.
  tree(m,-.1,.54,-.82,1.32,'#44caa5');tree(m,-1.52,.49,.1,.74,'#4ce4a7');tree(m,1.39,.49,.12,.73,'#67d56e');
  card(m,-.73,1.45,.67,'#ff9bb4');card(m,.0,1.59,.77,'#80c8ff');card(m,.74,1.43,.64,'#ba9bff');
  m.cone([0,.7,1.45],.34,.4,.4,'#efc77c',10);sparkle(m,0,1.14,1.45,.16);crystal(m,1.68,.38,-.5,.8,'#a1f5da');
  // Language: open book, blue ABC blocks, whimsical house and cherry trees.
  ornateCottage(m,4.95,.17,-.55,.86,true);book(m,4.68,.76,1.05);
  for(let i=0;i<3;i++){m.box([3.66+i*.5,1.22,.34],[.42,.49,.37],['#f7a0bb','#8bd6ff','#ffd27e'][i]);m.box([3.66+i*.5,1.46,.34],[.33,.07,.33],'#fff4db');}
  tree(m,6.35,.19,-.22,.82,'#f795c7');tree(m,3.4,.15,-.55,.54,'#fca7e8');crystal(m,3.22,.30,.8,.62,'#ffbdec');
  // Two supporting islands and fox guide (all meshes, not a pasted bitmap).
  island(m,-8.45,-.75,.2,1.60,'#73c86e',4);if(showFallbackFox)fox(m,-8.45,-.48,.62,1.15);
  island(m,8.2,-1.15,-1.6,1.45,'#76d99a',2);tree(m,8.2,-.98,-1.6,.8);
  castle(m,5.7,-.45,-7.6,1.06);castle(m,-7.8,-.65,-8.4,.8);
  for(let i=0;i<12;i++){cloud(m,Math.sin(i*1.37)*12,1.1+(i%5)*.67,-8-(i%4)*1.3,.66+(i%3)*.26);}
  if(quality==='full')stars(m);
 }
 /** Loads an authored GLB prototype into the existing WebGL scene.
  * Does not affect game results, controls or Canvas fallback; default fox remains on failure.
  * GLB materials are currently read as base colors, not textured PBR; art gate remains closed.
  */
 async loadGuideModel(url:string,position:Vec3=[-8.45,-.48,.62],scale=1.15):Promise<boolean>{
  if((!this.gl&&!this.ctx) || this.disposed || !this.ready)return false;
  this.modelAbort?.abort();
  const controller=new AbortController();this.modelAbort=controller;
  const sequence=++this.modelSequence;
  try{
   const response=await fetch(url,{signal:controller.signal,cache:'force-cache'});
   if(!response.ok)throw new ModelImportError(`Không tải được GLB: HTTP ${response.status}`);
   if(Number(response.headers.get('content-length')||0)>8_000_000)throw new ModelImportError('Mô hình vượt 8 MB');
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength>8_000_000)throw new ModelImportError('Mô hình vượt 8 MB');
   const loaded=importGLB(bytes);
   if(loaded.triangleCount<1)throw new ModelImportError('Mô hình không có tam giác');
   if(controller.signal.aborted||this.disposed||sequence!==this.modelSequence||(!this.gl&&!this.ctx))return false;
   // Rebuild the original scene without the procedural fox, then inject the GLB.
   // Replacement is atomic and requires no new WebGL program or scene graph dependency.
   const scene=new Mesh(!!this.ctx);this.build(scene,this.quality,false);
   const base=new Float32Array(scene.data),merged=new Float32Array(base.length+loaded.vertexData.length);
   merged.set(base);
   for(let i=0;i<loaded.vertexData.length;i+=10){
    const output=base.length+i;
    merged[output]=loaded.vertexData[i]*scale+position[0];
    merged[output+1]=loaded.vertexData[i+1]*scale+position[1];
    merged[output+2]=loaded.vertexData[i+2]*scale+position[2];
    for(let j=3;j<10;j++)merged[output+j]=loaded.vertexData[i+j];
    // Animated GLB vertices are distinct from environmental movement tags.
    merged[output+9]=3;
   }
   if(this.gl&&this.buffer){
    const gl=this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,merged,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,null);
    this.drawCount=merged.length/10;
   }else if(this.ctx){this.softwareData=merged;}
   this.importedModel=true;if(this.ctx)this.invalidateSoftware();
   return true;
  }catch(error){
   if(!controller.signal.aborted && !this.disposed)console.warn('Bảo An GLB: giữ nhân vật dự phòng',error);
   return false;
  }finally{if(this.modelAbort===controller)this.modelAbort=null;}
 }
 get guideModelLoaded(){return this.importedModel;}
 get isSoftwareRenderer(){return !!this.ctx;}
 private draw=(now:number)=>{if(!this.active||!this.ready)return;
  if(this.ctx){this.drawSoftware(now);return;}
  if(!this.gl||!this.program)return;
  const gl=this.gl,w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h){this.raf=requestAnimationFrame(this.draw);return;}
  const t=this.motion?now:0,smaller=w<760;
  const centered=smaller?22.3:17.7;
  const focusX=this.focus?({'math-quest':-1.0,'memory-match':0,'sentence-builder':1.0,'word-connect':1.5,'sequence-trail':-1.5} as Record<WorldId, number>)[this.focus] ?? 0:0;
  const desiredEye:Vec3=[this.pointer*.48+focusX,smaller?8.25:6.8,centered],desiredTarget:Vec3=[focusX*.55,smaller?-.05:.18,-.3];
  this.eye=add(mul(this.eye,.96),mul(desiredEye,.04));this.target=add(mul(this.target,.96),mul(desiredTarget,.04));
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
  gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'uView'),false,lookAt(this.eye,this.target));
  gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'uProjection'),false,perspective(PI/(smaller?3.5:4.3),this.canvas.width/this.canvas.height,.1,85));
  gl.uniform1f(gl.getUniformLocation(this.program,'uTime'),t);gl.uniform1f(gl.getUniformLocation(this.program,'uAnimate'),this.motion?1:0);
  const remaining=this.motion?Math.max(0,this.cheerUntil-now)/1250:0;
  gl.uniform1f(gl.getUniformLocation(this.program,'uGuideCheer'),remaining>0?remaining*remaining*(3-2*remaining):0);
  gl.drawArrays(gl.TRIANGLES,0,this.drawCount);gl.bindVertexArray(null);this.recordFrame(now);
  this.raf=requestAnimationFrame(this.draw);
 }
 private startSoftware(_quality:WorldQuality){
   const ctx=this.canvas.getContext('2d',{alpha:true});
   if(!ctx)throw Error('Không có trình dựng hình Canvas');
   this.ctx=ctx;const m=new Mesh(true);this.build(m,'low');this.softwareData=new Float32Array(m.data);
   this.canvas.addEventListener('pointermove',this.onMove);this.canvas.addEventListener('click',this.onClick);
   window.addEventListener('resize',this.onResize);this.onResize();this.ready=true;this.raf=requestAnimationFrame(this.draw);
 }
 private drawSoftware(now:number){
   if(!this.softwareDirty)return;this.softwareDirty=false;
   const ctx=this.ctx!,a=this.softwareData!;const w=this.w,h=this.h;
   if(!w||!h)return;
   const smaller=w<760;
   const focusX=this.focus?({'math-quest':-1.0,'memory-match':0,'sentence-builder':1.0,'word-connect':1.5,'sequence-trail':-1.5} as Record<WorldId, number>)[this.focus] ?? 0:0;
   const desiredEye:Vec3=[this.pointer*.48+focusX,smaller?8.25:6.8,smaller?22.3:17.7];
   this.eye=add(mul(this.eye,.88),mul(desiredEye,.12));this.target=add(mul(this.target,.88),mul([focusX*.55,smaller?-.05:.18,-.3],.12));
   const v=lookAt(this.eye,this.target),pr=perspective(PI/(smaller?3.5:4.3),w/h,.1,85);
   const sx=pr[0]*w*.5,sy=pr[5]*h*.5;
   const triangles:{z:number,x0:number,y0:number,x1:number,y1:number,x2:number,y2:number,c:string}[]=[];
   for(let i=0;i<a.length-29;i+=30){
     let zz=0;const pts:number[]=[];
     for(let j=0;j<3;j++){
       const k=i+j*10,x=a[k],y=a[k+1],z=a[k+2];
       const tx=v[0]*x+v[4]*y+v[8]*z+v[12],ty=v[1]*x+v[5]*y+v[9]*z+v[13],tz=v[2]*x+v[6]*y+v[10]*z+v[14];
       if(tz>-.12){zz=1e9;break;}
       const animated=a[k+9]>0.5&&this.motion?Math.sin(now*.0014+y*2+z)*.02:0;
       const guideBob=a[k+9]>2.5&&this.motion?Math.sin(now*.0024)*.08:0;
       pts.push((tx+animated)*sx/-tz+w*.5,-(ty+guideBob)*sy/-tz+h*.5);zz+=-tz;
     }
     if(zz>=1e9)continue;
     const minx=Math.min(pts[0],pts[2],pts[4]),maxx=Math.max(pts[0],pts[2],pts[4]);
     const miny=Math.min(pts[1],pts[3],pts[5]),maxy=Math.max(pts[1],pts[3],pts[5]);
     if(maxx<-10||minx>w+10||maxy<-10||miny>h+10)continue;
     const nx=a[i+3],ny=a[i+4],nz=a[i+5],light=.74+Math.max(0,-nx*.35+ny*.79+nz*.48)*.32;
     let r=a[i+6]*light,g=a[i+7]*light,b=a[i+8]*light;
     const fog=clamp((zz/3-13)/35,0,.4);r=r*(1-fog)+.66*fog;g=g*(1-fog)+.86*fog;b=b*(1-fog)+.99*fog;
     const c=`rgb(${Math.round(clamp(r,0,1)*255)},${Math.round(clamp(g,0,1)*255)},${Math.round(clamp(b,0,1)*255)})`;
     triangles.push({z:zz,x0:pts[0],y0:pts[1],x1:pts[2],y1:pts[3],x2:pts[4],y2:pts[5],c});
   }
   triangles.sort((a,b)=>b.z-a.z);
   ctx.clearRect(0,0,w,h);for(const t of triangles){ctx.beginPath();ctx.moveTo(t.x0,t.y0);ctx.lineTo(t.x1,t.y1);ctx.lineTo(t.x2,t.y2);ctx.closePath();ctx.fillStyle=t.c;ctx.fill();}
   this.recordFrame(now);
 }
 dispose(){this.disposed=true;this.modelAbort?.abort();this.modelAbort=null;this.modelSequence++;this.ready=false;cancelAnimationFrame(this.raf);this.canvas.removeEventListener('pointermove',this.onMove);this.canvas.removeEventListener('click',this.onClick);this.canvas.removeEventListener('webglcontextlost',this.onLoss);window.removeEventListener('resize',this.onResize);
  this.ctx=null;this.softwareData=null;this.cheerUntil=0;this.lastRendered=0;if(this.gl){if(this.vao)this.gl.deleteVertexArray(this.vao);if(this.buffer)this.gl.deleteBuffer(this.buffer);if(this.program)this.gl.deleteProgram(this.program);this.gl=null;}
 }
}
