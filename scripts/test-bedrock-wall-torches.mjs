import assert from "node:assert/strict";
import { createServer } from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try {
  const {wallTorchElements,loadBedrockPack,prepareBedrockPalette}=
    await server.ssrLoadModule("/src/assets/bedrock.ts");
  const texture="minecraft:block/bedrock/torch_on";
  const sample={north:[7,3,13],south:[7,3,1],east:[1,3,7],west:[13,3,7]};
  for(const [direction,expectedFrom] of Object.entries(sample)){
    const [element]=wallTorchElements(texture,direction);
    assert.deepEqual(element.from,expectedFrom,`wall torch mounted toward ${direction}`);
    // The bottom of the torch touches the side of its own cell that borders
    // the supporting wall (not the middle of the cell).
    const origin=element.rotation.origin;
    if(direction==="north") assert.equal(origin[2],15);
    if(direction==="south") assert.equal(origin[2],1);
    if(direction==="east") assert.equal(origin[0],1);
    if(direction==="west") assert.equal(origin[0],15);
    assert.equal(Math.abs(element.rotation.angle),22.5);
    assert.ok(["x","z"].includes(element.rotation.axis));
    for(const face of ["north","south","east","west"]){
      assert.equal(element.faces[face].texture,texture);
      assert.deepEqual(element.faces[face].uv,[7,6,9,16]);
    }
  }
  const requests=[];
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    requests.push(String(url));
    if(String(url).endsWith("blocks.json")){
      return {ok:true,text:async()=>JSON.stringify({
        torch:{textures:"torch_on"},
        soul_torch:{textures:"soul_torch"},
        redstone_torch:{textures:"redstone_torch_on"},
      })};
    }
    if(String(url).endsWith("terrain_texture.json")){
      return {ok:true,text:async()=>JSON.stringify({texture_data:{
        torch_on:{textures:"textures/blocks/torch_on"},
        soul_torch:{textures:"textures/blocks/soul_torch"},
        redstone_torch_on:{textures:"textures/blocks/redstone_torch_on"},
      }})};
    }
    if(String(url).endsWith(".png")){
      return {ok:true,arrayBuffer:async()=>new Uint8Array([137,80,78,71]).buffer};
    }
    throw Error("Unexpected fetch: "+url);
  };
  try{
    const pack=await loadBedrockPack();
    const palette=[
      {name:"minecraft:air"},
      {name:"minecraft:wall_torch",properties:{facing:"north"}},
      {name:"minecraft:soul_wall_torch",properties:{facing:"west"}},
      {name:"minecraft:redstone_wall_torch",properties:{facing:"east"}},
      {name:"minecraft:torch"},
    ];
    await prepareBedrockPalette(pack,palette);
    for(const state of palette.slice(1)){
      const id=state.name;
      assert.ok(pack.blockstates.has(id),"model for "+id);
    }
    assert.equal(pack.textures.size,3,"all wall variants fetch their original Bedrock textures");
    const wall=pack.models.get(pack.blockstates.get("minecraft:wall_torch").variants["facing=north"].model);
    assert.equal(wall.elements[0].rotation.angle,-22.5);
    const ground=pack.models.get(pack.blockstates.get("minecraft:torch").variants[""].model);
    assert.equal(ground.elements[0].rotation,undefined,"standing torches remain unchanged");
  }finally{globalThis.fetch=previousFetch;}
  console.log("OK: antorchas de pared Bedrock: cuatro orientaciones, tres variantes y suelo intacto.");
}finally{
  await server.close();
}
