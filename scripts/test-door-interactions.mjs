import assert from "node:assert/strict";
import {createServer} from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try{
  const {Build,stateKey}=await server.ssrLoadModule("/src/core/model.ts");
  const {toggleDoorAt,isInteractiveDoor}=await server.ssrLoadModule("/src/render/doorInteraction.ts");
  const air={name:"minecraft:air"};
  const stone={name:"minecraft:stone"};
  const low={name:"minecraft:dark_oak_door",properties:{half:"lower",facing:"north",hinge:"left",open:"false"}};
  const upper={name:"minecraft:dark_oak_door",properties:{half:"upper",facing:"north",hinge:"left",open:"false"}};
  const gate={name:"minecraft:spruce_fence_gate",properties:{facing:"east",open:"false"}};
  const palette=[air,stone,low,upper,gate];
  const build=new Build(4,4,4,palette, new Uint16Array(4*4*4));
  const put=(x,y,z,index)=>{build.data[build.index(x,y,z)]=index};
  put(1,1,1,2);put(1,2,1,3);
  put(2,1,1,2);put(2,2,1,3);
  put(1,1,2,4);
  const original=build.clone();
  assert.equal(isInteractiveDoor(low),true);
  assert.equal(isInteractiveDoor(stone),false);
  assert.equal(toggleDoorAt(build,0,0,0).length,0,"air cannot open");
  const open=toggleDoorAt(build,1,1,1);
  assert.equal(open.length,2,"both door halves toggle");
  assert.equal(build.palette[build.at(1,1,1)].properties.open,"true");
  assert.equal(build.palette[build.at(1,2,1)].properties.open,"true");
  assert.equal(build.palette[build.at(2,1,1)].properties.open,"false",
    "other doors sharing the original palette stay closed");
  assert.equal(toggleDoorAt(build,1,2,1).length,2,"clicking upper half toggles both");
  assert.equal(build.palette[build.at(1,1,1)].properties.open,"false");
  assert.equal(build.palette[build.at(1,2,1)].properties.open,"false");
  assert.equal(toggleDoorAt(build,1,1,2).length,1,"fence gate toggles alone");
  assert.equal(build.palette[build.at(1,1,2)].properties.open,"true");
  assert.deepEqual([...original.data],[...new Uint16Array([...original.data])],
    "original data is not mutated");
  assert.equal(original.palette.length,5,"original palette unchanged");
  assert.equal(stateKey(original.palette[original.at(1,1,1)]),stateKey(low));
  assert.equal(stateKey(original.palette[original.at(1,2,1)]),stateKey(upper));
  console.log("OK: independent doors, both halves, gates, open/close, original preserved.");
}finally{await server.close();}
