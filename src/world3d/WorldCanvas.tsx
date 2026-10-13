import { useEffect, useRef, useState } from 'react';
import { LearningWorld3D } from './engine';
import type { WorldId } from './engine';

interface Props {
  selected: WorldId | null;
  onSelect: (id: WorldId) => void;
  active: boolean;
  motionOn: boolean;
}

export default function WorldCanvas({selected,onSelect,active,motionOn}: Props){
  const canvas=useRef<HTMLCanvasElement>(null);
  const runtime=useRef<LearningWorld3D|null>(null);
  const selection=useRef(onSelect);
  const [state,setState]=useState<'loading'|'ready'|'fallback'>('loading');
  useEffect(()=>{selection.current=onSelect},[onSelect]);
  useEffect(()=>{
    const node=canvas.current;
    if(!node)return;
    const prefers=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const world=new LearningWorld3D(node,{
      quality:window.innerWidth<=640?'low':'full',
      reducedMotion:prefers||!motionOn,
      onSelect:(id)=>selection.current(id),
      onReady:(ok)=>setState(ok?'ready':'fallback')
    });
    runtime.current=world;
    // Load an authored GLB in both WebGL and Canvas; Canvas uses a lighter mesh.
    void world.loadGuideModel(world.isSoftwareRenderer?'/models/fox-guide-mobile.glb':'/models/fox-guide-prototype.glb');
    return()=>{world.dispose();runtime.current=null;};
  },[]);
  useEffect(()=>{runtime.current?.focusOn(selected)},[selected]);
  useEffect(()=>{runtime.current?.setPaused(!active)},[active]);
  useEffect(()=>{runtime.current?.setMotion(motionOn&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)},[motionOn]);
  return <>
    <canvas ref={canvas} className="ba3d-canvas" role="img" aria-label="Thế giới học tập 3D có ba đảo nổi: Toán học, Trí nhớ và Ngôn từ" />
    {state==='fallback'&&<div className="ba3d-fallback" role="status">Thiết bị không hỗ trợ WebGL2. Các trò chơi vẫn sử dụng được qua các nút bên dưới.</div>}
  </>;
}
