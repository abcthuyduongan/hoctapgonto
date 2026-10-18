/** Keep both faces of a source pair together, and avoid a one-pair final screen.
 * Only array references are copied: source IDs and item objects remain unchanged. */
export function createPairRounds<T>(items:readonly T[],limit:number):T[][] {
  if(!Number.isInteger(limit)||limit<2)throw new RangeError('A pair round must allow at least two pairs.');
  if(items.length===0)return [];
  const count=Math.ceil(items.length/limit),size=Math.floor(items.length/count),extra=items.length%count;
  let offset=0;
  return Array.from({length:count},(_,index)=>{
    const length=size+(index<extra?1:0),round=items.slice(offset,offset+length);
    offset+=length;
    return round;
  });
}

/** Capture this once when a session mounts; resizing only changes its layout. */
export function initialPairRoundLimit():4|6 {
  return typeof window!=='undefined'&&window.matchMedia('(max-width: 620px)').matches?4:6;
}
