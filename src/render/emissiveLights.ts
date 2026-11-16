import { baseName, type Build, type BlockState } from "../core/model";

/** Color and brightness are approximate game-like values, not voxel light levels. */
export interface BlockLight {
  x:number; y:number; z:number;
  color:number;
  intensity:number;
  radius:number;
}

export interface EmissionSample {
  dx:number; dy:number; dz:number;
  color:number; intensity:number; radius:number;
}

type Emission = Pick<BlockLight,"color"|"intensity"|"radius">;

const WARM_TORCH=0xffb45a;
const WARM_LANTERN=0xffc46b;
const WARM_FIRE=0xff9a4d;
const SOUL_BLUE=0x55dfff;

/** One emission profile for non-lanterns and each individual lantern face. */
export function emissionFor(state:BlockState):Emission|null {
  const id=baseName(state.name);
  const prop=state.properties ?? {};
  if(id==="redstone_lamp" && prop.lit!=="true" && prop.lit_bit!=="true" && prop.lit_bit!=="1")return null;
  if((id==="campfire" || id==="soul_campfire") && prop.lit==="false")return null;
  if(id==="furnace" || id==="blast_furnace" || id==="smoker"){
    if(prop.lit!=="true")return null;
    return {color:WARM_FIRE,intensity:4.0,radius:11};
  }
  if(id==="lantern")return {color:WARM_LANTERN,intensity:2.0,radius:10};
  if(id==="soul_lantern")return {color:SOUL_BLUE,intensity:1.8,radius:10};
  if(id==="torch" || id==="wall_torch")return {color:WARM_TORCH,intensity:4.6,radius:13};
  if(id==="soul_torch" || id==="soul_wall_torch")
    return {color:SOUL_BLUE,intensity:4.0,radius:12};
  if(id==="campfire")return {color:WARM_FIRE,intensity:5.2,radius:15};
  if(id==="soul_campfire")return {color:SOUL_BLUE,intensity:4.7,radius:14};
  if(id==="jack_o_lantern" || id==="shroomlight" || id==="glowstone" ||
     id==="ochre_froglight" || id==="pearlescent_froglight")
    return {color:WARM_LANTERN,intensity:3.9,radius:12};
  if(id==="sea_lantern" || id==="end_rod" || id==="verdant_froglight")
    return {color:0xc7edff,intensity:3.6,radius:11};
  if(id==="redstone_lamp")return {color:WARM_LANTERN,intensity:4.0,radius:12};
  if(id==="redstone_torch" || id==="redstone_wall_torch"){
    if(prop.lit==="false")return null;
    return {color:0xff4944,intensity:1.9,radius:8};
  }
  if(id==="candle" || id.endsWith("_candle")){
    if(prop.lit==="false")return null;
    return {color:WARM_TORCH,intensity:2.1,radius:8};
  }
  if(id==="magma_block")return {color:WARM_FIRE,intensity:1.7,radius:6};
  if(id==="lava")return {color:WARM_FIRE,intensity:3.2,radius:10};
  return null;
}

/**
 * Lanterns emit from four horizontal faces rather than a point in the
 * centre of their own cell. Other blocks use a single source near the flame.
 * Offsets are local to the block and never modify schematic geometry.
 */
export function emissionSamplesFor(state:BlockState):EmissionSample[] {
  const profile=emissionFor(state);
  if(!profile)return [];
  const id=baseName(state.name);
  if(id==="lantern" || id==="soul_lantern"){
    // The four sources sit just beyond each side of the lantern housing.
    // Keep them relatively weak individually: together they illuminate
    // more evenly without quadrupling the perceived brightness too much.
    const y=state.properties?.hanging==="true" || state.properties?.hanging_bit==="true"
      ? 0.55 : 0.42;
    return [
      {dx: 0.24,dy:y,dz:0,...profile},
      {dx:-0.24,dy:y,dz:0,...profile},
      {dx:0,dy:y,dz: 0.24,...profile},
      {dx:0,dy:y,dz:-0.24,...profile},
    ];
  }
  const height=id.includes("torch") ? 0.67 :
    id.includes("campfire") ? 0.35 : 0.65;
  return [{dx:0,dy:height,dz:0,...profile}];
}

/** Collect all emission points, regardless of distance from the player. */
export function collectBlockLights(build:Build):BlockLight[] {
  const samples=build.palette.map(emissionSamplesFor);
  if(!samples.some(group=>group.length))return [];
  const lights:BlockLight[]=[];
  for(let y=0;y<build.height;y++){
    for(let z=0;z<build.length;z++){
      for(let x=0;x<build.width;x++){
        for(const sample of samples[build.at(x,y,z)]){
          lights.push({
            x:x+0.5+sample.dx,
            y:y+sample.dy,
            z:z+0.5+sample.dz,
            color:sample.color,
            intensity:sample.intensity,
            radius:sample.radius,
          });
        }
      }
    }
  }
  return lights;
}
