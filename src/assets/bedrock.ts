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
    const elements:ElementDef[]=lookFor(state).boxes.map(box=>{
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
