import assert from "node:assert/strict";
import { createServer } from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try{
  const { fenceGateElements,loadBedrockPack,prepareBedrockPalette }=
    await server.ssrLoadModule("/src/assets/bedrock.ts");
  const {fenceConnectionMask}=await server.ssrLoadModule("/src/core/connect.ts");
  const texture="minecraft:block/bedrock/planks_spruce";
  const box=(e)=>[...e.from,...e.to];
  for (const facing of ["north","east","south","west"]){
    const props={facing,open:"false",in_wall:"false"};
    const closed=fenceGateElements(texture,props);
    assert.equal(closed.length,6,"two posts, two rails and braces");
    assert.equal(closed[0].from[1],5,"posts are raised");
    const left=box(closed[0]),right=box(closed[1]);
    assert.notDeepEqual(left,right,"two independent hinge posts");
    assert.ok(closed.every(e=>Object.values(e.faces).every(f=>f.texture===texture)));
    const open=fenceGateElements(texture,{...props,open:"true"});
    assert.equal(open.length,6,"opened leaves stay drawn");
    assert.notDeepEqual(box(open[2]),box(closed[2]),"rails swing away when open");
    assert.deepEqual(box(open[0]),box(closed[0]),"hinge posts stay fixed");
    const lowered=fenceGateElements(texture,{...props,in_wall:"true"});
    assert.equal(lowered.length,closed.length);
    for(let j=0;j<closed.length;j++){
      assert.deepEqual(
        [lowered[j].from[0],lowered[j].from[2],lowered[j].to[0],lowered[j].to[2]],
        [closed[j].from[0],closed[j].from[2],closed[j].to[0],closed[j].to[2]]);
      assert.equal(lowered[j].from[1],closed[j].from[1]-3);
      assert.equal(lowered[j].to[1],closed[j].to[1]-3);
    }
  }
  const wood={name:"minecraft:spruce_fence"};
  const gateN={name:"minecraft:spruce_fence_gate",properties:{facing:"north"}};
  const gateE={name:"minecraft:spruce_fence_gate",properties:{facing:"east"}};
  assert.equal(fenceConnectionMask(wood,()=>gateN),10);
  assert.equal(fenceConnectionMask(wood,()=>gateE),5);

  const originalFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async (url)=>{
    requests.push(String(url));
    if(String(url).endsWith("blocks.json"))
      return {ok:true,text:async()=>JSON.stringify({spruce_fence_gate:{textures:"wood_spruce"}})};
    if(String(url).endsWith("terrain_texture.json"))
      return {ok:true,text:async()=>JSON.stringify({texture_data:{wood_spruce:{textures:"textures/blocks/planks_spruce"}}})};
    if(String(url).endsWith(".png"))
      return {ok:true,arrayBuffer:async()=>new Uint8Array([137,80,78,71]).buffer};
    throw Error("Unexpected "+url);
  };
  try{
    const pack=await loadBedrockPack();
    const palette=[
      {name:"minecraft:air"},
      ...["north","east","south","west"].flatMap(facing=>
        ["true","false"].map(open=>({
          name:"minecraft:spruce_fence_gate",
          properties:{facing,open,in_wall:"false"},
        }))),
    ];
    await prepareBedrockPalette(pack,palette);
    assert.equal(pack.blockstates.size,1,"one blockstate with variants");
    const variants=pack.blockstates.get("minecraft:spruce_fence_gate").variants;
    assert.equal(Object.keys(variants).length,8,"all eight orientations and open variants");
    for(const variant of Object.values(variants)){
      const model=pack.models.get(variant.model);
      assert.equal(model.elements.length,6,"renderer uses gate model instead of single post");
    }
    assert.ok(pack.textures.has(texture),"original Bedrock spruce texture loaded");
  }finally{globalThis.fetch=originalFetch;}
  console.log("OK: puertas de valla Bedrock; 4 orientaciones, abierta/cerrada, muro y conexiones.");
}finally{await server.close();}
