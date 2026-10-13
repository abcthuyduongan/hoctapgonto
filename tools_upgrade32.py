from pathlib import Path
p=Path(__file__).parent/'src/world3d/engine.ts'
s=p.read_text()
anchor='function tree(m:Mesh,x:number,y:number,z:number,s=1,c=\'#51c963\'){' 
extra='''// Decorative geometry is real 3D: waterfalls, wooden suspension bridges,
// lamps, flowers, crystalline portal stones and architectural detailing.
function waterfall(m:Mesh,x:number,y:number,z:number,width=.55,len=2.45){
 for(let j=0;j<4;j++){
   const u=j/4,w=width/4;
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
'''
assert anchor in s
s=s.replace(anchor,extra+'\n'+anchor)
# modify default shape smoothness (only defaults)
s=s.replace("sphere(p:Vec3,r:Vec3,color:string,lat=7,lon=10,animated=0)","sphere(p:Vec3,r:Vec3,color:string,lat=9,lon=14,animated=0)")
# diffuse shader change
s=s.replace("float hemisphere=.71+max(aNormal.y,.0)*.16;\n vColor=aColor*(hemisphere+diffuse*.27);", "float hemisphere=.76+max(aNormal.y,.0)*.14;\n float rim=max(0.,1.-abs(dot(normalize(aNormal), normalize(-eye.xyz))));\n vColor=aColor*(hemisphere+diffuse*.25)+vec3(.045,.055,.075)*pow(rim,3.); ")
s=s.replace("vec3 c=mix(vColor,vec3(.66,.86,.99),vFog);c=pow(c,vec3(.88));", "vec3 c=mix(vColor,vec3(.69,.89,1.),vFog);c=pow(c,vec3(.84));c=mix(c,vec3(1.),.025);")
# extend scene geometry after island trio and before existing small structures
insertion='''  // Premium scene accents: flowing falls, wooden island bridges and warm lanterns.
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
'''
needle="  // Math: illustrated castle and number-shaped stepping stones."
assert needle in s
s=s.replace(needle,insertion+'\n'+needle)
s=s.replace("castle(m,-4.85,.25,-.55,.83);cottage(m,-6.28,.28,.25,.55,'#fef3ce','#ffa556');", "castle(m,-4.85,.25,-.55,.83);ornateCottage(m,-6.28,.28,.25,.55);steppingStones(m,-5.80,.20,1.23);")
s=s.replace("  m.box([-3.55,.45,0],[.65,.54,.6],'#81d5ff');", "  m.box([-3.55,.45,0],[.65,.54,.6],'#81d5ff');")
s=s.replace("  tree(m,-6.45,.21,-.66,.73);", "  tree(m,-6.45,.21,-.66,.73);tree(m,-3.7,.25,-1.24,.58,'#81d86b');")
s=s.replace("  tree(m,-.1,.54,-.82,1.32,'#44caa5');", "  tree(m,-.1,.54,-.82,1.32,'#44caa5');")
s=s.replace("  m.cone([0,.7,1.45],.34,.4,.4,'#efc77c',10);sparkle(m,0,1.14,1.45,.16);", "  m.cone([0,.7,1.45],.34,.4,.4,'#efc77c',10);sparkle(m,0,1.14,1.45,.16);crystal(m,1.68,.38,-.5,.8,'#a1f5da');")
s=s.replace("  cottage(m,4.95,.17,-.55,.86,'#ffe2e8','#da78ba');book(m,4.68,.76,1.05);", "  ornateCottage(m,4.95,.17,-.55,.86,true);book(m,4.68,.76,1.05);")
s=s.replace("  tree(m,6.35,.19,-.22,.82,'#f795c7');tree(m,3.4,.15,-.55,.54,'#fca7e8');", "  tree(m,6.35,.19,-.22,.82,'#f795c7');tree(m,3.4,.15,-.55,.54,'#fca7e8');crystal(m,3.22,.30,.8,.62,'#ffbdec');")
# camera desktop scene slight larger
s=s.replace('const centered=smaller?22.3:18.4;', 'const centered=smaller?22.3:17.7;')
s=s.replace('smaller?22.3:18.4', 'smaller?22.3:17.7')
# update doc header
s=s.replace('Bảo An Learning V3.1', 'Bảo An Learning V3.2')
p.write_text(s)
print('upgraded source',len(s))
