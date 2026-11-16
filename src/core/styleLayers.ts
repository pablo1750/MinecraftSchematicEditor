import { Build, parseStateKey, stateKey, type BlockState } from "./model";

/** Cell overrides are final states, independent of global material replacements. */
export interface StyleCell {
  x: number;
  y: number;
  z: number;
  bloque: string;
}

/** Never modify the source geometry or any of its palette entries. */
export function mappedStyleBase(original: Build, replacements: Record<string,string>): Build {
  const palette = original.palette.map((state): BlockState => {
    const destination = replacements[state.name];
    if (!destination || destination === state.name || state.name === "minecraft:air") return state;
    return {name:destination, ...(state.properties ? {properties:{...state.properties}} : {})};
  });
  return new Build(original.width,original.height,original.length,
    palette,new Uint16Array(original.data),{...original.meta});
}

/** Compare by block state, not palette index: equivalent palette slots are harmless. */
export function styleDifferences(base:Build, working:Build):StyleCell[] {
  if(base.width!==working.width || base.height!==working.height || base.length!==working.length)
    throw new Error("El estilo debe conservar las dimensiones del original.");
  const changes:StyleCell[]=[];
  for(let i=0;i<base.data.length;i++){
    const before=stateKey(base.palette[base.data[i]]);
    const after=stateKey(working.palette[working.data[i]]);
    if(before===after)continue;
    const [x,y,z]=base.positionOf(i);
    changes.push({x,y,z,bloque:after});
  }
  return changes;
}

/** Apply individual overrides last; minecraft:air is a genuine removal. */
export function composeStyle(
  original:Build,replacements:Record<string,string>,changes:readonly StyleCell[],
):{base:Build;working:Build}{
  const base=mappedStyleBase(original,replacements);
  const working=new Build(base.width,base.height,base.length,
    [...base.palette],new Uint16Array(base.data),{...base.meta});
  for(const change of changes){
    if(!working.inBounds(change.x,change.y,change.z))
      throw new Error("La modificación de estilo está fuera de las dimensiones originales.");
    if(change.bloque==="minecraft:air"){
      working.data[working.index(change.x,change.y,change.z)]=0;
    }else{
      const index=working.paletteIndexFor(parseStateKey(change.bloque));
      working.data[working.index(change.x,change.y,change.z)]=index;
    }
  }
  return {base,working};
}
