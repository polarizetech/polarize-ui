import { useEffect, useRef, useState } from 'react';
import { mountTrajectory3D } from '../../trajectory3d.js';
export default { title: 'Science/Space/Geometric overlays' };
export function SelectableSyntheticTetrahedron() {
  const host=useRef<HTMLDivElement>(null), [selection,setSelection]=useState('Select a point, edge or face.');
  useEffect(()=>{
    const p: [number,number,number][]=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
    const view=mountTrajectory3D(host.current!,{paths:[{points:[[0,0,0],[0,0,0]]}],showPath:false,bounds:{min:[-2,-2,-2],max:[2,2,2]},grid:true,axes:['X','Y','Z'],
      markers:p.map((point,i)=>({point,label:`Vertex ${i+1}`,id:`v${i+1}`})),
      segments:p.flatMap((a,i)=>p.slice(i+1).map((b,j)=>({from:a,to:b,id:`e${i}-${i+j+1}`}))),
      faces:[[0,1,2],[0,1,3],[0,2,3],[1,2,3]].map((ids,i)=>({points:ids.map(j=>p[j]),id:`face${i+1}`})),
      onSelect:a=>setSelection(a.id||'Unlabelled primitive')});
    return ()=>view?.destroy();
  },[]);
  return <><p>Synthetic regular tetrahedron. Fixed ±2 bounds on all axes; no physical units. Perspective projection. Drag to turn; labels follow vertices.</p><div ref={host}/><output>{selection}</output></>;
}
