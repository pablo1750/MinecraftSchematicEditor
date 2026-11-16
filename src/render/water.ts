import { baseName, type BlockState } from "../core/model";
import type { DecodedTexture } from "../assets/textures";

/** Water is a visually animated fluid, never an editable solid cube. */
export function isWater(state:BlockState):boolean {
  const name=baseName(state.name);
  return name==="water" || name==="flowing_water" || name==="bubble_column";
}

/** Source blocks sit 2 pixels beneath a full block surface; higher levels are shallower. */
export function waterHeight(state:BlockState):number {
  const raw=Number(state.properties?.level ?? state.properties?.liquid_depth ?? 0);
  const level=Number.isFinite(raw)?Math.max(0,Math.min(15,Math.floor(raw))):0;
  // 8..15 are falling water: preserve their full-height appearance.
  return level>=8 ? 1 : Math.max(2/16,(14-level*1.7)/16);
}

/** A blue translucent pixel texture, also available when the pack has no water PNG. */
export function makeWaterTexture():DecodedTexture {
  const size=16;
  const rgba=new Uint8ClampedArray(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const wave=Math.sin(x*.95+y*.65)*8+Math.cos(x*.42-y*1.3)*7;
    rgba[i]=Math.max(15,Math.round(35+wave*.35));
    rgba[i+1]=Math.max(55,Math.round(115+wave));
    rgba[i+2]=Math.max(120,Math.round(208+wave*.65));
    rgba[i+3]=148;
  }
  return {size,rgba,opaque:false};
}

export const WATER_TEXTURE_KEY="<water-procedural>";
