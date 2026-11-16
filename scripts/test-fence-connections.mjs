import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try {
  const { meshRegion } = await server.ssrLoadModule("/src/render/mesher.ts");
  const { fenceConnectionMask } = await server.ssrLoadModule("/src/core/connect.ts");
  const AIR = { name: "minecraft:air" };
  const FENCE = { name: "minecraft:spruce_fence" };
  const OAK = { name: "minecraft:oak_fence" };
  const NETHER = { name: "minecraft:nether_brick_fence" };
  const STONE = { name: "minecraft:stone" };
  const LEAVES = { name: "minecraft:oak_leaves" };
  const GATE_EAST = { name: "minecraft:spruce_fence_gate", properties: {facing:"east"} };
  const GATE_NORTH = { name: "minecraft:spruce_fence_gate", properties: {facing:"north"} };
  const palette = [AIR, FENCE, OAK, NETHER, STONE, LEAVES, GATE_EAST, GATE_NORTH];
  const quad = (x) => ({
    pos: Float32Array.from([x,0,0, x+.1,0,0, x+.1,1,0, x,1,0]),
    uv: Float32Array.from([0,0,1,0,1,1,0,1]),
    layer:0,cull:-1,dir:5,edge:false,shade:1,tr:1,tg:1,tb:1,
  });
  // One quad for the post, two for the rail pair on each connected side.
  const fenceParts = [
    [quad(0)],
    [quad(.1),quad(.2)],
    [quad(.3),quad(.4)],
    [quad(.5),quad(.6)],
    [quad(.7),quad(.8)],
  ];
  const empty = {occludes:new Uint8Array(6),layer:0,ao:false,empty:true,single:[],parts:[]};
  const fence = {occludes:new Uint8Array(6),layer:0,ao:false,empty:false,single:null,parts:[],fenceParts};
  const opaque = {occludes:new Uint8Array(6),layer:0,ao:false,empty:false,single:[],parts:[]};
  const baked = {blocks:[empty,fence,opaque,opaque,opaque,opaque,opaque,opaque]};
  const width=3,height=1,length=3;
  const data=new Uint16Array(width*height*length);
  const index=(x,z)=>z*width+x;
  const build={width,height,length,palette,data};

  function render(neighbours) {
    data.fill(0);
    data[index(1,1)]=1;
    for(const [dx,dz,paletteIndex] of neighbours) data[index(1+dx,1+dz)]=paletteIndex;
    const before=[...data];
    const paletteBefore=JSON.stringify(palette);
    const mesh=meshRegion(build,baked,1,0,1,1,1,1,0);
    assert.deepEqual([...data],before,"render must not change schematic blocks");
    assert.equal(JSON.stringify(palette),paletteBefore,"render must not change blockstate properties");
    return mesh.layers[0]?.quadBlocks.length ?? 0;
  }

  assert.equal(render([]),1,"isolated fence: post only");
  assert.equal(render([[0,-1,2]]),3,"another wooden fence: post plus 2 rails");
  assert.equal(render([[0,-1,2],[0,1,4]]),5,"two sides: post plus 4 rails");
  assert.equal(render([[0,-1,4],[1,0,4]]),5,"corner connected to solid blocks");
  assert.equal(render([[0,-1,4],[1,0,4],[0,1,4]]),7,"T: three rail pairs");
  assert.equal(render([[0,-1,4],[1,0,4],[0,1,4],[-1,0,4]]),9,"cross: four rail pairs");
  assert.equal(render([[0,-1,5]]),1,"leaves do not connect");
  assert.equal(render([[0,-1,3]]),1,"wood does not connect to nether brick fence");
  assert.equal(fenceConnectionMask(NETHER,()=>OAK),0,"nether fence doesn't connect to wooden fences");
  assert.equal(fenceConnectionMask(FENCE,()=>STONE),15,"solid block connections in all directions");
  assert.equal(fenceConnectionMask(FENCE,()=>AIR),0,"isolated fence");
  assert.equal(fenceConnectionMask(STONE,()=>FENCE),0,"non-fence has no fence arms");
  assert.equal(fenceConnectionMask(FENCE,()=>GATE_EAST),5,
    "east-west facing gate connects fences along north-south");
  assert.equal(fenceConnectionMask(FENCE,()=>GATE_NORTH),10,
    "north-south facing gate connects fences along east-west");
  assert.equal(render([[0,-1,6]]),3,"compatible fence gate connects");
  assert.equal(render([[1,0,6]]),1,"perpendicular side of gate doesn't connect");
  console.log("OK: fences isolated, solids, other fences, gates, T/cross, no schematic changes.");
} finally {
  await server.close();
}
