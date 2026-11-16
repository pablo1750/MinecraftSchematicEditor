import { baseName, type Build, type BlockState } from "../core/model";

/** Simple warm/cool light sources. Values are deliberately approximate, not Minecraft light levels. */
export interface BlockLight {
  x:number; y:number; z:number;
  color:number;
  intensity:number;
  radius:number;
}

/**
 * Render-only emission profile. Brightness is independent from the sunlight;
 * open, waterlogged and inactive lamps are not automatically lit.
 */
export function emissionFor(state:BlockState):Pick<BlockLight,"color"|"intensity"|"radius">|null {
  const id=baseName(state.name);
  const prop=state.properties ?? {};
  if (id==="redstone_lamp" && prop.lit!=="true" && prop.lit_bit!=="true" && prop.lit_bit!=="1") return null;
  if ((id==="campfire" || id==="soul_campfire") && prop.lit==="false") return null;
  if (id==="furnace" || id==="blast_furnace" || id==="smoker") {
    if(prop.lit!=="true")return null;
    return {color:0xffa44e,intensity:3,radius:9};
  }
  if(id==="torch" || id==="wall_torch" || id==="lantern" ||
     id==="campfire" || id==="jack_o_lantern" || id==="shroomlight" ||
     id==="glowstone" || id==="sea_lantern" || id==="end_rod" ||
     id==="redstone_lamp" || id==="ochre_froglight" ||
     id==="verdant_froglight" || id==="pearlescent_froglight") {
    const isCampfire=id==="campfire";
    const cool=id==="sea_lantern" || id==="end_rod" || id==="verdant_froglight";
    return {color:cool?0xc7edff:0xffca7b,intensity:isCampfire?4.4:3.1,
      radius:isCampfire?13:10};
  }
  if(id==="soul_torch" || id==="soul_wall_torch" || id==="soul_lantern" ||
     id==="soul_campfire")return {color:0x55dfff,intensity:3.1,radius:10};
  if(id==="redstone_torch" || id==="redstone_wall_torch"){
    if(prop.lit==="false")return null;
    return {color:0xff4944,intensity:1.65,radius:7};
  }
  if(id==="candle" || id.endsWith("_candle")){
    if(prop.lit==="false")return null;
    return {color:0xffb461,intensity:1.7,radius:6.5};
  }
  if(id==="magma_block")return {color:0xff6735,intensity:1.3,radius:5};
  if(id==="lava")return {color:0xff783d,intensity:2.5,radius:8};
  return null;
}

/**
 * One pass on entering simulation, rather than scanning the whole schematic
 * every frame. No illumination metadata is written into the construction.
 */
export function collectBlockLights(build:Build):BlockLight[] {
  const materials=build.palette.map(emissionFor);
  if(!materials.some(Boolean))return [];
  const lights:BlockLight[]=[];
  for(let y=0;y<build.height;y++){
    for(let z=0;z<build.length;z++){
      for(let x=0;x<build.width;x++){
        const properties=materials[build.at(x,y,z)];
        if(!properties)continue;
        lights.push({x:x+0.5,y:y+0.65,z:z+0.5,...properties});
      }
    }
  }
  return lights;
}

/** Only the nearest emitters participate in the shader (bounded GPU cost). */
export function nearestBlockLights(
  lights:readonly BlockLight[],x:number,y:number,z:number,max=8,
):BlockLight[]{
  return lights.map(light=>{
    const dx=light.x-x,dy=light.y-y,dz=light.z-z;
    return {light,dist:dx*dx+dy*dy+dz*dz};
  }).filter(item=>item.dist<Math.pow(item.light.radius+2,2))
    .sort((a,b)=>a.dist-b.dist)
    .slice(0,max)
    .map(item=>item.light);
}
