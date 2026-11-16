import assert from "node:assert/strict";
import {createServer} from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try{
  const {Build}=await server.ssrLoadModule("/src/core/model.ts");
  const {
    walkerCollides,findWalkSpawn,advanceWalker,
    WALK_EYE_HEIGHT,WALK_HEIGHT,WALK_SPEED,SPRINT_SPEED,
  }=await server.ssrLoadModule("/src/render/walkSimulation.ts");
  const palette=[{name:"minecraft:air"},{name:"minecraft:stone"},
    {name:"minecraft:oak_slab",properties:{type:"bottom"}}];
  const makeBuild=(w=9,h=8,l=9)=>{
    const data=new Uint16Array(w*h*l);
    const b=new Build(w,h,l,palette,data,{name:"walk fixture"});
    for(let x=0;x<w;x++)for(let z=0;z<l;z++)data[b.index(x,0,z)]=1;
    return b;
  };
  const b=makeBuild();
  for(let y=1;y<4;y++)for(let z=2;z<=6;z++)b.data[b.index(6,y,z)]=1;
  assert.equal(WALK_HEIGHT,1.8);
  assert.equal(WALK_EYE_HEIGHT,1.62);
  assert.ok(SPRINT_SPEED>WALK_SPEED);
  assert.equal(walkerCollides(b,4.5,1,4.5),false,"free interior");
  assert.equal(walkerCollides(b,6.5,1,4.5),true,"solid wall");
  assert.equal(walkerCollides(b,-.1,1,4.5),true,"bounded world");
  assert.equal(walkerCollides(b,4.5,-.05,4.5),true,"no falling out of world");
  const spawn=findWalkSpawn(b,4.5,4.5);
  assert.equal(spawn.grounded,true,"spawn on a supported surface");
  assert.equal(spawn.y,1,"one block above floor");
  assert.equal(walkerCollides(b,spawn.x,spawn.y,spawn.z),false,"safe spawn");
  const idle={forward:0,right:0,yaw:0,jump:false,sprint:false};
  let body={...spawn};
  for(let i=0;i<60;i++)body=advanceWalker(b,body,idle,1/60);
  assert.equal(body.y,1,"gravity keeps the player on floor");
  assert.equal(body.grounded,true,"floor contact");
  body=advanceWalker(b,body,{...idle,forward:1},1/60);
  assert.ok(body.z<spawn.z,"W goes toward negative Z");
  let running={...spawn},walking={...spawn};
  for(let i=0;i<30;i++){
    running=advanceWalker(b,running,{...idle,forward:1,sprint:true},1/60);
    walking=advanceWalker(b,walking,{...idle,forward:1},1/60);
  }
  assert.ok(running.z<walking.z,"sprint covers more distance");
  let blocked={x:5.3,y:1,z:4.5,vy:0,grounded:true};
  for(let i=0;i<50;i++)blocked=advanceWalker(b,blocked,{...idle,right:1},1/60);
  assert.ok(blocked.x+0.29<=6.01,"wall collision prevents walking through stone");
  body={...spawn};
  let peak=1;
  for(let i=0;i<60;i++){
    body=advanceWalker(b,body,{...idle,jump:i===0},1/60);
    peak=Math.max(peak,body.y);
  }
  assert.ok(peak>1.6,"Space jumps");
  assert.equal(body.grounded,true,"gravity returns player to floor");
  assert.equal(body.y,1,"lands on initial ground");
  b.data[b.index(3,1,3)]=2;
  assert.equal(walkerCollides(b,3.5,1.2,3.5),true,"slab only occupies lower half");
  assert.equal(walkerCollides(b,3.5,1.5,3.5),false,"upper half over slab is free");
  console.log("OK simulation: spawn, WASD, sprint, jump, gravity, solid collisions, slabs and boundaries.");
}finally{await server.close();}
