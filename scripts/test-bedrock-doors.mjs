import assert from "node:assert/strict";
import { createServer } from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try {
  const {doorElements,doorTexturePath,loadBedrockPack,prepareBedrockPalette}=
    await server.ssrLoadModule("/src/assets/bedrock.ts");
  const paths=["wood","spruce","birch","jungle","acacia","dark_oak","iron"];
  const terrain={
    door_lower:{textures:paths.map(x=>({path:"textures/blocks/door_"+x+"_lower"}))},
    door_upper:{textures:paths.map(x=>({path:"textures/blocks/door_"+x+"_upper"}))},
    cherry_door_bottom:{textures:"textures/blocks/cherry_door_bottom"},
    cherry_door_top:{textures:"textures/blocks/cherry_door_top"},
  };
  assert.equal(doorTexturePath("oak_door","upper",terrain),"textures/blocks/door_wood_upper");
  assert.equal(doorTexturePath("spruce_door","lower",terrain),"textures/blocks/door_spruce_lower");
  assert.equal(doorTexturePath("birch_door","upper",terrain),"textures/blocks/door_birch_upper");
  assert.equal(doorTexturePath("cherry_door","upper",terrain),"textures/blocks/cherry_door_top");
  const texture="minecraft:block/bedrock/door_spruce_lower";
  const closed={
    north:[0,0,13,16,16,16],
    south:[0,0,0,16,16,3],
    east:[0,0,0,3,16,16],
    west:[13,0,0,16,16,16],
  };
  for (const [facing,fromTo] of Object.entries(closed)) {
    const [element]=doorElements(texture,{facing,open:"false",half:"lower"});
    assert.deepEqual([...element.from,...element.to],fromTo,"closed door "+facing);
    assert.equal(element.faces.north.texture,texture);
    assert.equal(element.faces.south.texture,texture);
  }
  for (const facing of Object.keys(closed)) {
    for (const hinge of ["left","right"]) {
      const [element]=doorElements(texture,{facing,open:"true",hinge});
      assert.equal(element.to[1]-element.from[1],16);
      assert.notDeepEqual([...element.from,...element.to],closed[facing],
        "open "+facing+" "+hinge+" must turn perpendicular to closed position");
    }
  }
  for (const facing of Object.keys(closed)) {
    const left=doorElements(texture,{facing,hinge:"left",open:"false"})[0];
    const right=doorElements(texture,{facing,hinge:"right",open:"false"})[0];
    assert.deepEqual([right.from,right.to],[left.from,left.to],
      "closed halves keep geometry aligned: "+facing);
    const broadFace=facing==="north" || facing==="south" ? "north" : "east";
    assert.deepEqual(left.faces[broadFace].uv,[0,0,16,16],
      "left hinge uses original handle side");
    assert.deepEqual(right.faces[broadFace].uv,[16,0,0,16],
      "right hinge mirrors handle to face the other door");
  }
  for (const facing of Object.keys(closed)) {
    const lower=doorElements(texture,{facing,open:"true",hinge:"right",half:"lower"});
    const upper=doorElements(texture,{facing,open:"true",hinge:"right",half:"upper"});
    assert.deepEqual(lower.map(e=>[e.from,e.to]),upper.map(e=>[e.from,e.to]),
      "both door halves must align");
  }

  const priorFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    const u=String(url);
    if(u.endsWith("blocks.json"))return {ok:true,text:async()=>JSON.stringify({
      wooden_door:{textures:{down:"door_lower",side:"door_upper",up:"door_lower"}},
      spruce_door:{textures:{down:"door_lower",side:"door_upper",up:"door_lower"}},
      cherry_door:{textures:{down:"cherry_door_bottom",side:"cherry_door_top",up:"cherry_door_bottom"}},
    })};
    if(u.endsWith("terrain_texture.json"))return {ok:true,text:async()=>JSON.stringify({texture_data:terrain})};
    if(u.endsWith(".png"))return {ok:true,arrayBuffer:async()=>new Uint8Array([137,80,78,71]).buffer};
    throw new Error("Unexpected request "+u);
  };
  try {
    const pack=await loadBedrockPack();
    const palette=[
      {name:"minecraft:air"},
      {name:"minecraft:oak_door",properties:{facing:"north",half:"lower",hinge:"left",open:"false"}},
      {name:"minecraft:oak_door",properties:{facing:"north",half:"upper",hinge:"left",open:"false"}},
      {name:"minecraft:spruce_door",properties:{facing:"east",half:"lower",hinge:"right",open:"true"}},
      {name:"minecraft:spruce_door",properties:{facing:"east",half:"upper",hinge:"right",open:"true"}},
      {name:"minecraft:cherry_door",properties:{facing:"south",half:"upper",hinge:"right",open:"false"}},
    ];
    await prepareBedrockPalette(pack,palette);
    for(const state of palette.slice(1)){
      const id=state.name;
      const key=Object.entries(state.properties).sort(([a],[b])=>a.localeCompare(b))
        .map(([k,v])=>k+"="+v).join(",");
      const modelId=pack.blockstates.get(id).variants[key].model;
      const model=pack.models.get(modelId);
      assert.equal(model.elements.length,1);
      const wanted=doorTexturePath(id.slice(10),state.properties.half,terrain);
      assert.equal(model.elements[0].faces.north.texture,
        "minecraft:block/bedrock/"+wanted.slice("textures/blocks/".length),
        "each half must use correct species and half image");
    }
    assert.ok(pack.textures.has("minecraft:block/bedrock/door_wood_upper"));
    assert.ok(pack.textures.has("minecraft:block/bedrock/door_spruce_lower"));
    assert.ok(pack.textures.has("minecraft:block/bedrock/door_spruce_upper"));
  }finally{
    globalThis.fetch=priorFetch;
  }
  console.log("OK: Bedrock doors: wood, halves, four orientations, hinges and open/closed.");
}finally{
  await server.close();
}
