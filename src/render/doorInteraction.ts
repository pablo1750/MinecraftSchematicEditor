import { Build, baseName, type BlockState } from "../core/model";

export function isInteractiveDoor(state:BlockState):boolean {
  const id=baseName(state.name);
  return (id.endsWith("_door") && !id.endsWith("_trapdoor")) ||
    id.endsWith("_fence_gate");
}

function upperHalf(state:BlockState):boolean {
  return state.properties?.half==="upper" ||
    state.properties?.upper_block_bit==="true" ||
    state.properties?.upper_block_bit==="1";
}
function isDoorPanel(state:BlockState):boolean {
  const id=baseName(state.name);
  return id.endsWith("_door") && !id.endsWith("_trapdoor") && !id.endsWith("_fence_gate");
}
function opened(state:BlockState):boolean {
  return state.properties?.open==="true" || state.properties?.open_bit==="true" ||
    state.properties?.open_bit==="1";
}

/**
 * Toggle both halves of an ordinary door or one fence gate in the temporary
 * simulation Build. Never mutate palette states (they may be shared by many
 * cells). The returned indices are the only cells requiring a re-mesh.
 */
export function toggleDoorAt(build:Build,x:number,y:number,z:number):number[] {
  if(!build.inBounds(x,y,z))return [];
  const index=build.index(x,y,z);
  const source=build.palette[build.data[index]];
  if(!source || !isInteractiveDoor(source))return [];
  const nextOpen=!opened(source);
  const positions:[[number,number,number],...Array<[number,number,number]>]=[[x,y,z]];
  if(isDoorPanel(source)){
    const otherY=y+(upperHalf(source)?-1:1);
    if(build.inBounds(x,otherY,z)){
      const other=build.palette[build.at(x,otherY,z)];
      if(other?.name===source.name && upperHalf(other)!==upperHalf(source)){
        positions.push([x,otherY,z]);
      }
    }
  }
  const changed:number[]=[];
  for(const [cx,cy,cz] of positions){
    const idx=build.index(cx,cy,cz);
    const state=build.palette[build.data[idx]];
    if(!state)continue;
    const properties={...state.properties};
    // Both blockstate formats may exist, but never invent a second format
    // that was not in the source schematic.
    if("open_bit" in properties)properties.open_bit=nextOpen?"true":"false";
    else properties.open=nextOpen?"true":"false";
    const value=build.paletteIndexFor({name:state.name,properties});
    build.applyChanges(Uint32Array.of(idx),Uint16Array.of(value));
    changed.push(idx);
  }
  return changed;
}
