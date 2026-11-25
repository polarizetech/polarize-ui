import { useEffect, useRef, useState } from 'react';
import { mountTrajectory3D, mountOscillatorBank } from '../../trajectory3d.js';
import { Fader } from '@/components/controls';
export default { title: 'Science/Trajectory playback' };
export function ReferenceFrameAndPhasors() {
  const [trajectory,setTrajectory]=useState<HTMLDivElement|null>(null), [bank,setBank]=useState<HTMLDivElement|null>(null);
  const handles=useRef<{setTime(t:number):void;destroy():void}[]>([]);
  const [time,setTime]=useState(0);
  useEffect(()=>{
    if(!trajectory||!bank) return;
    const points: [number,number,number][] = Array.from({length:201},(_,i)=>[Math.cos(i/20),i/100-1,Math.sin(i/20)]);
    const samples: [number,number][][] = points.map((_,i)=>Array.from({length:7},(_,k)=>[Math.cos(i/20+k),Math.sin(i/20+k)]));
    const v=mountTrajectory3D(trajectory,{paths:[{points}],duration:5,grid:true,referenceVectors:[{vector:[0,-1,0],label:'Down'},{vector:[1,1,0],label:'Reference'}],referenceNote:'Synthetic display frame'});
    const b=mountOscillatorBank(bank,{samples,duration:5});
    handles.current=v?[v,b]:[b]; return ()=>handles.current.forEach(h=>h.destroy());
  },[trajectory,bank]);
  return <><p>Synthetic data. Reference arrows are directions, not forces. Dials share a fixed radial scale.</p><Fader label="Playback time" value={time} min={0} max={5} step={0.01} unit="s" digits={2} showRange={false} onChange={t=>{setTime(t);handles.current.forEach(h=>h.setTime(t));}}/><div ref={setTrajectory}/><div ref={setBank}/></>;
}
