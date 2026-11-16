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
  oak_door:"wooden_door",
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
    // Start against the supporting wall, then lean into the cell.
    // "facing" is the direction away from the supporting wall.
    north:{from:[7,3,13],to:[9,13,15],origin:[8,3,15],axis:"x",angle:-22.5},
    south:{from:[7,3,1],to:[9,13,3],origin:[8,3,1],axis:"x",angle:22.5},
    east:{from:[1,3,7],to:[3,13,9],origin:[1,3,8],axis:"z",angle:-22.5},
    west:{from:[13,3,7],to:[15,13,9],origin:[15,3,8],axis:"z",angle:22.5},
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

/**
 * Bedrock's legacy door_upper/door_lower atlases are ordered by wood species.
 * Generic textureFile() intentionally chooses the first frame for most block
 * textures, but doors must select both their own wood and their own half.
 */
const LEGACY_DOOR_INDEX:Record<string,number> = {
  oak_door:0, spruce_door:1, birch_door:2, jungle_door:3,
  acacia_door:4, dark_oak_door:5, iron_door:6,
};

export function doorTexturePath(
  id:string,
  half:"upper"|"lower",
  terrain:Record<string,TextureDef>,
):string | null {
  const legacy=LEGACY_DOOR_INDEX[id];
  if (legacy !== undefined) {
    const list=terrain[half==="upper" ? "door_upper" : "door_lower"]?.textures;
    const variant=Array.isArray(list) ? list[legacy] : null;
    return typeof variant==="string" ? variant : variant?.path ?? null;
  }
  const suffix=half==="upper" ? ["_top","_upper"] : ["_bottom","_lower"];
  for (const ending of suffix) {
    const key=id+ending;
    const found=textureFile(terrain[key]);
    if(found) return found;
  }
  return null;
}

/**
 * Java facing points away from the closed door face. The door is a thin
 * 3-pixel slab at the rear of its cell. Opening swings this slab 90 degrees
 * around the left/right hinge to the corresponding side of the cell.
 * Upper and lower halves use identical positions and different PNG sprites.
 */
export function doorElements(
  texture:string,
  properties:Record<string,string> | undefined,
):ElementDef[] {
  const facing=["north","south","east","west"].includes(properties?.facing ?? "")
    ? properties!.facing : "north";
  const open=properties?.open==="true" || properties?.open_bit==="true" ||
    properties?.open_bit==="1";
  const right=properties?.hinge==="right" || properties?.door_hinge_bit==="true" ||
    properties?.door_hinge_bit==="1";
  const closed:Record<string,[number,number,number,number,number,number]>={
    north:[0,0,13,16,16,16], south:[0,0,0,16,16,3],
    east:[0,0,0,3,16,16], west:[13,0,0,16,16,16],
  };
  const opened:Record<string,[[number,number,number,number,number,number],[number,number,number,number,number,number]]>={
    north:[[0,0,0,3,16,16],[13,0,0,16,16,16]],
    south:[[13,0,0,16,16,16],[0,0,0,3,16,16]],
    east:[[0,0,0,16,16,3],[0,0,13,16,16,16]],
    west:[[0,0,13,16,16,16],[0,0,0,16,16,3]],
  };
  const bounds=open ? opened[facing][right?1:0] : closed[facing];
  const [x0,y0,z0,x1,y1,z1]=bounds;
  const alongX=(x1-x0)> (z1-z0);
  const wide={texture,uv:[0,0,16,16] as [number,number,number,number]};
  const edge={texture,uv:[0,0,3,16] as [number,number,number,number]};
  const cap={texture,uv:[0,0,16,3] as [number,number,number,number]};
  return [{
    from:[x0,y0,z0],to:[x1,y1,z1],
    shade:false,
    faces:{
      north:alongX?wide:edge,south:alongX?wide:edge,
      east:alongX?edge:wide,west:alongX?edge:wide,
      up:cap,down:cap,
    },
  }];
}

/**
 * Fence gates are not fences: they have two edge posts and a pair of movable
 * rail leaves. Model geometry in local X (the closed gate spans east/west),
 * then rotate it for east/west-facing gates. No neighbour or imported state
 * is changed. "in_wall" lowers the complete gate by three pixels.
 */
export function fenceGateElements(
  texture:string,
  properties:Record<string,string> | undefined,
):ElementDef[] {
  const facing=properties?.facing ?? "north";
  const alongZ=facing==="east" || facing==="west";
  const opened=properties?.open==="true" || properties?.open_bit==="true" ||
    properties?.open_bit==="1";
  const lowered=properties?.in_wall==="true" || properties?.in_wall_bit==="true" ||
    properties?.in_wall_bit==="1";
  const yShift=lowered ? -3 : 0;
  type Bounds=[number,number,number,number,number,number];
  const boxes:Bounds[]=[
    [0,5,6,2,16,10], // left hinge post
    [14,5,6,16,16,10], // right hinge post
  ];
  if(!opened){
    // Two uninterrupted rails between the posts, with central braces.
    boxes.push(
      [2,6,7,14,9,9],
      [2,12,7,14,15,9],
      [6,6,6,8,15,10],
      [8,6,6,10,15,10],
    );
  }else{
    // Each leaf swings back against its hinge, leaving the passage open.
    const toSouth=facing==="north" || facing==="east";
    const z0=toSouth?8:2;
    const z1=toSouth?14:8;
    boxes.push(
      [1,6,z0,3,9,z1],
      [1,12,z0,3,15,z1],
      [13,6,z0,15,9,z1],
      [13,12,z0,15,z1===14?15:15,z1],
    );
  }
  const face=(uv:[number,number,number,number])=>({texture,uv});
  return boxes.map(([x0,y0,z0,x1,y1,z1]):ElementDef=>{
    const from: [number,number,number]=alongZ
      ? [z0,y0+yShift,x0] : [x0,y0+yShift,z0];
    const to: [number,number,number]=alongZ
      ? [z1,y1+yShift,x1] : [x1,y1+yShift,z1];
    const broadX=(to[0]-from[0])>(to[2]-from[2]);
    const width=Math.min(16,broadX?to[0]-from[0]:to[2]-from[2]);
    const height=to[1]-from[1];
    const uv=face([0,0,width,height]);
    const thin=face([0,0,Math.min(16,broadX?to[2]-from[2]:to[0]-from[0]),height]);
    const top=face([0,0,width,Math.min(16,broadX?to[2]-from[2]:to[0]-from[0])]);
    return {
      from,to,
      faces:{
        north:broadX?uv:thin,south:broadX?uv:thin,
        east:broadX?thin:uv,west:broadX?thin:uv,
        up:top,down:top,
      },
    };
  });
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
    // Doors need their own upper/lower texture rather than generic
    // Bedrock's "door_lower"/"door_upper" arrays' first (oak) entry.
    const isFenceGate=id.endsWith("_fence_gate");
    const isDoor=id.endsWith("_door") && !id.endsWith("_trapdoor");
    const half: "upper" | "lower" =
      state.properties?.half==="upper" || state.properties?.upper_block_bit==="true" ||
      state.properties?.upper_block_bit==="1" ? "upper" : "lower";
    const doorPath=isDoor ? doorTexturePath(id,half,meta.terrain) : null;
    if(doorPath && /^textures\/blocks\/[\w/-]+$/.test(doorPath)) needed.add(doorPath);
    const doorTexture=doorPath && /^textures\/blocks\/[\w/-]+$/.test(doorPath)
      ? "minecraft:block/bedrock/"+doorPath.slice("textures/blocks/".length) : null;
    // Lanterns and torches are small UV atlases, not tileable cuboid faces.
    const isLantern=id==="lantern" || id==="soul_lantern";
    const atlas=keys.up;
    const isWallTorch=id==="wall_torch" || id==="soul_wall_torch" ||
      id==="redstone_wall_torch";
    const elements:ElementDef[]=isWallTorch && atlas
      ? wallTorchElements(atlas,state.properties?.facing)
      : isLantern && atlas
      ? lanternElements(atlas,state.properties?.hanging==="true" ||
          state.properties?.hanging_bit==="true" || state.properties?.hanging_bit==="1")
      : isDoor && doorTexture
      ? doorElements(doorTexture,state.properties)
      : isFenceGate && atlas
      ? fenceGateElements(atlas,state.properties)
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
