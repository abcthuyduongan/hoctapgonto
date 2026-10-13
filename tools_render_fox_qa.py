"""Offline raster screenshot of the GLB vertices, used only for pipeline review."""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
import trimesh
from trimesh.visual.material import PBRMaterial
root=Path(__file__).resolve().parent
scene=trimesh.load(root/'public/models/fox-guide-prototype.glb',force='scene')
W,H=680,750
img=Image.new('RGB',(W,H),(226,243,252));d=ImageDraw.Draw(img)
# Orthographic oblique view, y+ up and z+ faces viewer.
angle=np.deg2rad(-15)
c,s=np.cos(angle),np.sin(angle)
rot=np.array([[c,0,s],[0,1,0],[-s,0,c]])
eye=np.array([.0,2.2,5.]);light=np.array([-.5,.9,1.5]);light/=np.linalg.norm(light)
tris=[]
for node_name in scene.graph.nodes_geometry:
  trans,geom_name=scene.graph[node_name]
  mesh=scene.geometry[geom_name]
  pts=trimesh.transform_points(mesh.vertices,trans)
  pts=pts@rot.T
  faces=mesh.faces
  mat=mesh.visual.material
  color=np.asarray(getattr(mat,'baseColorFactor',[245,140,60,255]),dtype=float)[:3]
  for face in faces:
    p=pts[face]
    n=np.cross(p[1]-p[0],p[2]-p[0]);n=n/(np.linalg.norm(n)+1e-8)
    shade=.61+.45*max(0,float(np.dot(n,light)))
    rgb=tuple(np.clip(color*shade,0,255).astype(np.uint8))
    xy=[(float(W/2+v[0]*155),float(H-80-v[1]*200)) for v in p]
    tris.append((float(p[:,2].mean()),xy,rgb))
for _z,xy,c in sorted(tris,key=lambda a:a[0]):d.polygon(xy,fill=c)
out=root/'preview/fox-guide-prototype-qa.png';out.parent.mkdir(exist_ok=True)
img.save(out)
print(out)
