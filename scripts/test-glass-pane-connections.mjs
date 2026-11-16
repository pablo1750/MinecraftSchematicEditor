import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const { meshRegion } = await server.ssrLoadModule("/src/render/mesher.ts");
  const { paneConnectionMask } = await server.ssrLoadModule("/src/core/connect.ts");
  const { paneTextureFace } = await server.ssrLoadModule("/src/render/bake.ts");
  const bedrockFaces = {
    north: { texture:"minecraft:block/bedrock/glass" },
    south: { texture:"minecraft:block/bedrock/glass" },
    east: { texture:"minecraft:block/bedrock/glass_pane_top" },
    west: { texture:"minecraft:block/bedrock/glass_pane_top" },
    up: { texture:"minecraft:block/bedrock/glass" },
    down: { texture:"minecraft:block/bedrock/glass" },
  };
  for (const face of ["north","south","east","west"]) {
    assert.equal(paneTextureFace(bedrockFaces,face)?.texture,
      "minecraft:block/bedrock/glass",
      "the transparent glass face must render from all four directions");
  }
  for (const face of ["up","down"]) {
    assert.equal(paneTextureFace(bedrockFaces,face)?.texture,
      "minecraft:block/bedrock/glass_pane_top",
      "the opaque pane edge must only appear on horizontal caps");
  }
  const javaFaces = {
    north:{ texture:"minecraft:block/glass_pane" },
    east:{ texture:"minecraft:block/glass_pane_edge" },
  };
  assert.equal(paneTextureFace(javaFaces,"east")?.texture,"minecraft:block/glass_pane_edge",
    "Java pack face selection remains unchanged");


  const AIR = { name: "minecraft:air" };
  const PANE = { name: "minecraft:glass_pane" };
  const STONE = { name: "minecraft:stone" };
  const palette = [AIR, PANE, STONE];
  const width = 3, height = 1, length = 3;
  const index = (x, z) => z * width + x;
  const data = new Uint16Array(width * height * length);
  const simpleQuad = (shift) => ({
    pos: Float32Array.from([shift,0,0, shift+0.1,0,0, shift+0.1,1,0, shift,1,0]),
    uv: Float32Array.from([0,0,1,0,1,1,0,1]),
    layer:0, cull:-1, dir:5, edge:false,
    shade:1, tr:1, tg:1, tb:1,
  });
  const paneParts = Array.from({length:5}, (_,i)=>[simpleQuad(i/10)]);
  const empty = {occludes:new Uint8Array(6),layer:0,ao:false,empty:true,single:[],parts:[]};
  const pane = {occludes:new Uint8Array(6),layer:0,ao:false,empty:false,single:null,parts:[],paneParts};
  const solid = {occludes:new Uint8Array([1,1,1,1,1,1]),layer:0,ao:false,empty:false,single:[],parts:[]};
  const baked = {blocks:[empty,pane,solid]};
  const build = {width,height,length,palette,data};

  function countFor(neighbours) {
    data.fill(0);
    data[index(1,1)] = 1;
    for (const [dx,dz] of neighbours) data[index(1+dx,1+dz)] = 2;
    const before = Array.from(data);
    const stateBefore = JSON.stringify(palette);
    const mesh = meshRegion(build,baked,0,0,0,width,height,length,0);
    assert.deepEqual(Array.from(data),before,"rendering must not edit build");
    assert.equal(JSON.stringify(palette),stateBefore,"rendering must not rewrite properties");
    return mesh.layers[0]?.quadBlocks.length ?? 0;
  }

  assert.equal(countFor([]),1,"isolated pane renders centre only");
  assert.equal(countFor([[0,-1]]),2,"single north neighbour");
  assert.equal(countFor([[0,-1],[0,1]]),3,"opposite sides form a straight pane");
  assert.equal(countFor([[0,-1],[1,0]]),3,"two adjacent sides form corner");
  assert.equal(countFor([[0,-1],[1,0],[0,1]]),4,"three sides form T");
  assert.equal(countFor([[0,-1],[1,0],[0,1],[-1,0]]),5,"four sides form cross");
  assert.equal(paneConnectionMask(PANE,()=>AIR),0);
  assert.equal(paneConnectionMask(PANE,()=>STONE),15);
  console.log("OK: paneles de vidrio conectados por vecinos; construcción sin modificaciones.");
} finally {
  await server.close();
}
