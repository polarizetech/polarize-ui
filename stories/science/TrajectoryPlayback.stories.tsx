import { useEffect, useRef, useState } from 'react';
import { mountTrajectory3D, mountOscillatorBank } from '../../trajectory3d.js';
export default { title: 'Science/Trajectory playback' };
export function ReferenceFrameAndPhasors() {
  const trajectory=useRef<HTMLDivElement>(null), bank=useRef<HTMLDivElement>(null);
  const handles=useRef<{setTime(t:number):void;destroy():void}[]>([]);
  const [time,setTime]=useState(0);
  useEffect(()=>{
    const points: [number,number,number][] = Array.from({length:201},(_,i)=>[Math.cos(i/20),i/100-1,Math.sin(i/20)]);
    const samples: [number,number][][] = points.map((_,i)=>Array.from({length:7},(_,k)=>[Math.cos(i/20+k),Math.sin(i/20+k)]));
    const v=mountTrajectory3D(trajectory.current!,{paths:[{points}],duration:5,grid:true,referenceVectors:[{vector:[0,-1,0],label:'Down'},{vector:[1,1,0],label:'Reference'}],referenceNote:'Synthetic display frame'});
    const b=mountOscillatorBank(bank.current!,{samples,duration:5});
    handles.current=v?[v,b]:[b]; return ()=>handles.current.forEach(h=>h.destroy());
  },[]);
  return <><p>Synthetic data. Reference arrows are directions, not forces. Dials share a fixed radial scale.</p><label>Time <input aria-label="Playback time" type="range" min="0" max="5" step=".01" value={time} onChange={e=>{const t=Number(e.target.value);setTime(t);handles.current.forEach(h=>h.setTime(t));}}/></label><div ref={trajectory}/><div ref={bank}/></>;
}
