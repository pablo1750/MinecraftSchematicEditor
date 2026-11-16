/** Bedrock resource adapter; assets live on the server, never in Git. */
import { baseName, stateKey, type BlockState } from "../core/model";
import { lookFor } from "../core/blockLook";
import type { FaceName, ElementDef, ResourcePack, BlockstateDef } from "./pack";

const ROOT = "/data/textures/debrock";
type BlockDef = { textures?: string | Record<string,string> };
type TextureDef = { textures?: string | {path?:string} | Array<string | {path?:string}> };
type Metadata = { blocks:Record<string,BlockDef>; terrain:Record<string,TextureDef>; attempted:Set<string> };
const metadata = new WeakMap<ResourcePack,Metadata>();
const faces:FaceName[] = ["down","up","north","south","west","east"];
const aliases:Record<string,string> = {
  grass_block:"grass", stone_bricks:"stonebrick", mossy_stone_bricks:"stonebrick",
  cracked_stone_bricks:"stonebrick", chiseled_stone_bricks:"stonebrick",
  flowering_azalea_leaves:"azalea_leaves_flowered",
  wall_torch:"torch",
  soul_wall_torch:"soul_torch",
  redstone_wall_torch:"redstone_torch",
};

async function json<T>(path:string):Promise<T> {
  const response = await fetch(ROOT+"/"+path);
  if (!response.ok) throw new Error(`No se pudo cargar Bedrock: ${path} (HTTP ${response.status})`);
  // Mojang's terrain_texture.json includes a leading // reference comment.
  // Strip only whole-line comments before the JSON document, preserving values.
  const raw = (await response.text()).replace(/^\uFEFF/, "");
  const cleaned = raw.replace(/^(?:\s*\/\/[^\r\n]*(?:\r?\n|$))*/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch (cause) {
    throw new Error(`Bedrock: ${path} no es JSON válido`, { cause });
  }
}
function textureFile(t:TextureDef | undefined):string | null {
  if (!t) return null;
  const value = Array.isArray(t.textures) ? t.textures[0] : t.textures;
  return typeof value === "string" ? value : value?.path ?? null;
}
export async function loadBedrockPack():Promise<ResourcePack> {
  const [blocks,terrain] = await Promise.all([
    json<Record<string,BlockDef>>("blocks.json"),
    json<{texture_data:Record<string,TextureDef>}>("textures/terrain_texture.json"),
  ]);
  if (!terrain.texture_data) throw new Error("Bedrock no tiene texture_data");
  const pack:ResourcePack = {
    name:"Bedrock",blockstates:new Map(),models:new Map(),textures:new Map(),
    animated:new Set(),namespaces:["minecraft"],
    counts:{blockstates:0,models:0,textures:0},
  };
  metadata.set(pack,{blocks,terrain:terrain.texture_data,attempted:new Set()});
  return pack;
}
/**
 * The lantern PNG is a small UV atlas, not a tileable block face. Map its
 * individual body, cap and handle regions instead of stretching the entire
 * image over the old stand-in box. Use the existing model baker and shader.
 */
function lanternElements(texture:string,hanging:boolean):ElementDef[] {
  const offset=hanging ? 1 : 0;
  const face=(uv:[number,number,number,number])=>({texture,uv});
  const main:ElementDef={
    from:[5,offset,5],to:[11,7+offset,11],
    faces:{
      down:{...face([0,9,6,15]),...(!hanging?{cullface:"down" as FaceName}:{})},
      up:face([0,9,6,15]),
      north:face([0,2,6,9]),south:face([0,2,6,9]),
      east:face([0,2,6,9]),west:face([0,2,6,9]),
    },
  };
  const cap:ElementDef={
    from:[6,7+offset,6],to:[10,9+offset,10],
    faces:{
      ...(hanging?{down:face([1,10,5,14])}:{}),
      up:face([1,10,5,14]),
      north:face([1,0,5,2]),south:face([1,0,5,2]),
      east:face([1,0,5,2]),west:face([1,0,5,2]),
    },
  };
  const start=hanging ? 11 : 9;
  const cross1:ElementDef={
    from:[6.5,start,8],to:[9.5,hanging?15:11,8],
    rotation:{origin:[8,8,8],axis:"y",angle:45},
    shade:false,
    faces:{
      north:face(hanging?[14,1,11,5]:[14,1,11,3]),
      south:face(hanging?[11,1,14,5]:[11,1,14,3]),
    },
  };
  const cross2:ElementDef={
    from:[8,hanging?10:9,6.5],to:[8,hanging?16:11,9.5],
    rotation:{origin:[8,8,8],axis:"y",angle:45},
    shade:false,
    faces:{
      east:face(hanging?[11,6,14,12]:[11,10,14,12]),
      west:face(hanging?[14,6,11,12]:[14,10,11,12]),
    },
  };
  return [main,cap,cross1,cross2];
}

/**
 * Bedrock reuses the standing torch textures for wall torches. The atlas
 * contains the sprite centred in a 16px tile, so using it across a wide box
 * turns the torch into a wooden shelf. Draw the 2x10px shaft with proper UVs,
 * tilt it 22.5 degrees out from its supporting wall and leave ground torches
 * unchanged.
 */
export function wallTorchElements(texture:string, facing:string | undefined):ElementDef[] {
  // "facing" means the direction away from the supporting wall in Java.
  // Rotate the shaft away from the wall, not back into it.
  const direction = facing==="south" || facing==="east" || facing==="west"
    ? facing : "north";
  const configuration:Record<string,{
    from:[number,number,number];
    to:[number,number,number];
    origin:[number,number,number];
    axis:"x"|"z";
    angle:number;
  }> = {
    north:{from:[7,3,10],to:[9,13,12],origin:[8,3,11],axis:"x",angle:-22.5},
    south:{from:[7,3,4],to:[9,13,6],origin:[8,3,5],axis:"x",angle:22.5},
    east:{from:[4,3,7],to:[6,13,9],origin:[5,3,8],axis:"z",angle:-22.5},
    west:{from:[10,3,7],to:[12,13,9],origin:[11,3,8],axis:"z",angle:22.5},
  };
  const d=configuration[direction];
  const side={texture,uv:[7,6,9,16] as [number,number,number,number]};
  return [{
    from:d.from,to:d.to,
    rotation:{origin:d.origin,axis:d.axis,angle:d.angle},
    shade:false,
    faces:{
      north:side,south:side,east:side,west:side,
      up:{texture,uv:[7,6,9,8]},
      down:{texture,uv:[7,13,9,15]},
    },
  }];
}

/** Generate compatible models for the current build; preserve the existing block geometry. */
export async function prepareBedrockPalette(pack:ResourcePack,palette:BlockState[]):Promise<void> {
  const meta=metadata.get(pack);
  if (!meta) return;
  const needed=new Set<string>();
  for (const state of palette) {
    const id=baseName(state.name);
    const def=meta.blocks[id] ?? meta.blocks[aliases[id]];
    if (!def?.textures) continue;
    const keys:Partial<Record<FaceName,string>>={};
    let valid=true;
    for (const face of faces) {
      const raw=def.textures;
      const name=typeof raw==="string" ? raw : raw[face] ?? raw.side ?? raw.up ?? raw.down;
      const path=name ? textureFile(meta.terrain[name]) : null;
      if (!path || !/^textures\/blocks\/[\w/-]+$/.test(path)) { valid=false; break; }
      keys[face]="minecraft:block/bedrock/"+path.slice("textures/blocks/".length);
      needed.add(path);
    }
    if (!valid) continue;
    // Lanterns use a single PNG atlas with per-part UVs, not generic block mapping.
    const isLantern=id==="lantern" || id==="soul_lantern";
    const atlas=keys.up;
    const isWallTorch=id==="wall_torch" || id==="soul_wall_torch" ||
      id==="redstone_wall_torch";
    const elements:ElementDef[]=isWallTorch && atlas
      ? wallTorchElements(atlas,state.properties?.facing)
      : isLantern && atlas
      ? lanternElements(atlas,state.properties?.hanging==="true" ||
          state.properties?.hanging_bit==="true" || state.properties?.hanging_bit==="1")
      : lookFor(state).boxes.map(box=>{
      const from:[number,number,number]=[box[0]*16,box[1]*16,box[2]*16];
      const to:[number,number,number]=[box[3]*16,box[4]*16,box[5]*16];
      const directions:ElementDef["faces"]={};
      for (const face of faces) {
        const edge=face==="up" ? box[4]===1 : face==="down" ? box[1]===0
          : face==="north" ? box[2]===0 : face==="south" ? box[5]===1
          : face==="east" ? box[3]===1 : box[0]===0;
        directions[face]={texture:keys[face]!,...(edge?{cullface:face}:{})};
      }
      return {from,to,faces:directions};
    });
    if (!elements.length) continue;
    const model="minecraft:block/bedrock/state_"+encodeURIComponent(stateKey(state));
    const props=Object.entries(state.properties??{}).sort(([a],[b])=>a.localeCompare(b))
      .map(([k,v])=>k+"="+v).join(",");
    const blockId="minecraft:"+id;
    const current:BlockstateDef=pack.blockstates.get(blockId)??{variants:{}};
    current.variants??={};
    current.variants[props]={model};
    pack.blockstates.set(blockId,current);
    pack.models.set(model,{elements,ambientocclusion:true});
  }
  const pending=[...needed].filter(path=>!meta.attempted.has(path));
  await Promise.all(pending.map(async path=>{
    meta.attempted.add(path);
    try {
      const response=await fetch(ROOT+"/"+path+".png");
      if (!response.ok) return;
      pack.textures.set("minecraft:block/bedrock/"+path.slice("textures/blocks/".length),
        new Uint8Array(await response.arrayBuffer()));
    } catch { /* Missing images use existing flat-colour fallback. */ }
  }));
  pack.counts={blockstates:pack.blockstates.size,models:pack.models.size,textures:pack.textures.size};
}
export function isBedrockPack(pack:ResourcePack|null):boolean {
  return !!pack && metadata.has(pack);
}
