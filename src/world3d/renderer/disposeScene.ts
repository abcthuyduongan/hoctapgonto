import { InstancedMesh, Material, Mesh, Texture, type Object3D } from 'three';

/** Resources can be shared by many meshes. Release each exactly once. */
export function disposeScene(root: Object3D) {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<{ dispose(): void }>();
  root.traverse(node => {
    const mesh = node as Mesh & { skeleton?: { dispose(): void } };
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
    if (mesh.skeleton) skeletons.add(mesh.skeleton);
    if (mesh instanceof InstancedMesh) mesh.dispose();
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  const images = new Set<ImageBitmap>();
  textures.forEach(value => {
    if (typeof ImageBitmap !== 'undefined' && value.image instanceof ImageBitmap) images.add(value.image);
    value.dispose();
  });
  images.forEach(value => value.close());
  skeletons.forEach(value => value.dispose());
  root.clear();
}

export function estimateTextureBytes(root: Object3D) {
  const textures = new Set<Texture>();
  root.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  return [...textures].reduce((sum, texture) => {
    const image = texture.image as { width?: number; height?: number } | undefined;
    return sum + (image?.width ?? 0) * (image?.height ?? 0) * 4 * 4 / 3;
  }, 0);
}

/** Shared geometry attributes/index buffers are counted once, including skin data. */
export function estimateGeometryBytes(root:Object3D){
  const arrays=new Set<ArrayBufferView>();
  root.traverse(node=>{
    const mesh=node as Mesh;if(!mesh.isMesh)return;
    for(const attribute of Object.values(mesh.geometry.attributes))arrays.add('data'in attribute?attribute.data.array:attribute.array);
    if(mesh.geometry.index)arrays.add(mesh.geometry.index.array);
  });
  return [...arrays].reduce((sum,array)=>sum+array.byteLength,0);
}
