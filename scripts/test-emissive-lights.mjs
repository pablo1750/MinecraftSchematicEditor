import assert from "node:assert/strict";
import {createServer} from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try{
  const {Build}=await server.ssrLoadModule("/src/core/model.ts");
  const {emissionFor,emissionSamplesFor,collectBlockLights}=await server.ssrLoadModule("/src/render/emissiveLights.ts");
  const as=(name,properties={})=>({name:"minecraft:"+name,properties});
  for(const name of ["torch","wall_torch","lantern","campfire","glowstone",
    "sea_lantern","shroomlight","jack_o_lantern","soul_lantern","soul_campfire",
    "magma_block","candle"]){
    assert.ok(emissionFor(as(name)),name+" emits light");
  }
  assert.equal(emissionFor(as("stone")),null,"stone is unlit");
  assert.equal(emissionFor(as("redstone_lamp",{lit:"false"})),null,"off lamp unlit");
  assert.equal(emissionFor(as("redstone_lamp",{lit:"true"})).radius,10);
  assert.equal(emissionFor(as("campfire",{lit:"false"})),null,"extinguished fire unlit");
  assert.equal(emissionFor(as("soul_torch")).color,0x55dfff,"soul fire cool blue");
  const normalTorch=emissionFor(as("torch"));
  assert.equal(normalTorch.color,0xffb45a,"torch warm orange/amber, not cold white");
  assert.ok(normalTorch.intensity>=4.2,"torch brightness improved");
  assert.ok(normalTorch.radius>=12,"torch illuminates a wider room");
  const lantern=emissionSamplesFor(as("lantern"));
  const soulLantern=emissionSamplesFor(as("soul_lantern"));
  assert.equal(lantern.length,4,"lantern has four independent light sources");
  assert.equal(soulLantern.length,4,"soul lantern also illuminates from four faces");
  assert.deepEqual(lantern.map(p=>[p.dx,p.dz]),[
    [0.24,0],[-0.24,0],[0,0.24],[0,-0.24],
  ],"lantern lights are distributed across the four sides");
  assert.ok(lantern.every(p=>p.color===0xffc46b),"lantern light is warm yellow");
  assert.ok(soulLantern.every(p=>p.color===0x55dfff),"soul lantern remains cool blue");
  assert.ok(lantern.every(p=>p.intensity>0 && p.radius>=9),"each lantern face emits usable light");
  const palette=[as("air"),as("torch"),as("stone"),as("lantern"),as("soul_campfire"),
    as("campfire",{lit:"false"}),as("redstone_lamp",{lit:"true"})];
  const build=new Build(64,4,64,palette,new Uint16Array(64*4*64));
  const put=(x,y,z,p)=>{build.data[build.index(x,y,z)]=p;};
  put(1,1,1,1);put(2,1,1,3);put(62,1,62,4);
  put(3,1,1,5);put(3,1,3,6);
  const before=[...build.data];
  const lights=collectBlockLights(build);
  assert.equal(lights.length,7,"all active emitters collected, four per lantern");
  assert.ok(lights.some(l=>l.x===62.5 && l.z===62.5),
    "a light more than 40 blocks away remains included");
  assert.equal(lights.filter(l=>l.color===0x55dfff).length,1,"soul campfire is blue");
  assert.equal(lights.filter(l=>l.color===0xffc46b).length,5,"four warm lantern faces plus lamp");
  assert.ok(lights.every(l=>l.radius>0 && l.intensity>0),"valid attenuation");
  assert.deepEqual([...build.data],before,"scan never edits the schematic");
  console.log("OK: four warm lantern lights, stronger torches, all emitters >40 blocks, no original edits.");
}finally{await server.close();}
