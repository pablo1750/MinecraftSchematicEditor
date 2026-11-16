import type { Build } from "../core/model";
import { baseName, isAir } from "../core/model";
import { lookFor } from "../core/blockLook";

export const WALK_EYE_HEIGHT = 1.62;
export const WALK_HEIGHT = 1.8;
export const WALK_RADIUS = 0.29;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 6.1;
export const JUMP_SPEED = 8;
export const WALK_GRAVITY = 25;

/** The body is an upright 0.58 x 1.8 voxel AABB, measured from its feet. */
export interface Walker {
  x:number; y:number; z:number; vy:number; grounded:boolean;
}
export interface WalkInput {
  forward:number; right:number; yaw:number; jump:boolean; sprint:boolean;
}

/** Decorations, liquids and foliage don't stop the simulated character. */
function isPassable(name:string):boolean {
  if(isAir(name))return true;
  const id=baseName(name);
  return id==="water" || id==="lava" || id==="bubble_column" ||
    id==="ladder" || id==="vine" || id==="glow_lichen" ||
    id==="tripwire" || id==="redstone_wire" ||
    id==="rail" || id.endsWith("_rail") || id.endsWith("_torch") ||
    id==="torch" || id==="lantern" || id==="soul_lantern" ||
    id.endsWith("_flower") || id.endsWith("_sapling") ||
    id.endsWith("_grass") || id.endsWith("_fern") ||
    id.endsWith("_mushroom") || id.endsWith("_button") ||
    id.endsWith("_sign") || id.endsWith("_hanging_sign");
}

/** Shape-based collision, including half slabs and stairs. */
export function walkerCollides(build:Build,x:number,y:number,z:number):boolean {
  const epsilon=1e-5;
  const loX=Math.floor(x-WALK_RADIUS+epsilon);
  const hiX=Math.floor(x+WALK_RADIUS-epsilon);
  const loY=Math.floor(y+epsilon);
  const hiY=Math.floor(y+WALK_HEIGHT-epsilon);
  const loZ=Math.floor(z-WALK_RADIUS+epsilon);
  const hiZ=Math.floor(z+WALK_RADIUS-epsilon);
  // Exterior bounds act as invisible walls; the builder is a finite scene.
  if(x-WALK_RADIUS<0 || z-WALK_RADIUS<0 ||
     x+WALK_RADIUS>build.width || z+WALK_RADIUS>build.length ||
     y<0 || y+WALK_HEIGHT>build.height+2)return true;
  for(let cy=Math.max(0,loY);cy<=Math.min(build.height-1,hiY);cy++){
    for(let cz=Math.max(0,loZ);cz<=Math.min(build.length-1,hiZ);cz++){
      for(let cx=Math.max(0,loX);cx<=Math.min(build.width-1,hiX);cx++){
        const block=build.palette[build.at(cx,cy,cz)];
        if(!block || isPassable(block.name))continue;
        const name=baseName(block.name);
        if(name.endsWith("_door") && block.properties?.open==="true")continue;
        const boxes=lookFor(block).boxes;
        for(const box of boxes){
          if(x+WALK_RADIUS>cx+box[0]+epsilon &&
             x-WALK_RADIUS<cx+box[3]-epsilon &&
             y+WALK_HEIGHT>cy+box[1]+epsilon &&
             y<cy+box[4]-epsilon &&
             z+WALK_RADIUS>cz+box[2]+epsilon &&
             z-WALK_RADIUS<cz+box[5]-epsilon)return true;
        }
      }
    }
  }
  return false;
}

/** Pick a safe standing position near the desired X/Z, preferring upper floors. */
export function findWalkSpawn(build:Build,wantedX:number,wantedZ:number):Walker {
  const x=Math.max(WALK_RADIUS+.01,Math.min(build.width-WALK_RADIUS-.01,wantedX));
  const z=Math.max(WALK_RADIUS+.01,Math.min(build.length-WALK_RADIUS-.01,wantedZ));
  const candidates:[[number,number],...Array<[number,number]>]=[
    [x,z],[build.width/2,build.length/2],
  ];
  for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
    candidates.push([Math.max(.3,Math.min(build.width-.3,x+dx)),
      Math.max(.3,Math.min(build.length-.3,z+dz))]);
  }
  for(const [px,pz] of candidates){
    for(let y=build.height;y>=0;y-=.5){
      if(walkerCollides(build,px,y,pz))continue;
      if(walkerCollides(build,px,y-.08,pz))return {x:px,y,z:pz,vy:0,grounded:true};
    }
  }
  // An entirely empty build still has an invisible bottom floor.
  return {x:build.width/2,y:0,z:build.length/2,vy:0,grounded:true};
}

/** Independent per-axis sweeps prevent passing through a wall at low FPS. */
export function advanceWalker(build:Build,body:Walker,keys:WalkInput,dt:number):Walker {
  const next={...body};
  const forward=-keys.forward;
  const right=keys.right;
  const length=Math.hypot(forward,right);
  const speed=keys.sprint?SPRINT_SPEED:WALK_SPEED;
  const f=length?forward/length:0;
  const r=length?right/length:0;
  const dx=(Math.cos(keys.yaw)*r+Math.sin(keys.yaw)*f)*speed*dt;
  const dz=(-Math.sin(keys.yaw)*r+Math.cos(keys.y)*f)*speed*dt;
  if(next.grounded && keys.jump){next.vy=JUMP_SPEED;next.grounded=false;}
  next.vy=Math.max(-35,next.vy-WALK_GRAVITY*dt);
  const dy=next.vy*dt;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz),Math.abs(dy))/.10));
  if(!Number.isFinite(steps)) console.warn("walk invalid step", {body,keys,dx,dz,dy,steps});
  for(let i=0;i<steps;i++){
    for(const [axis,movement] of [["x",dx/steps],["z",dz/steps]] as const){
      if(!movement)continue;
      if(!walkerCollides(build,next.x+(axis==="x"?movement:0),next.y,
        next.z+(axis==="z"?movement:0)))next[axis]+=movement;
    }
    const y=next.y+dy/steps;
    if(walkerCollides(build,next.x,y,next.z)){
      if(next.vy<0)next.grounded=true;
      next.vy=0;
    }else{
      next.y=y;
      next.grounded=false;
    }
  }
  if(!next.grounded && next.vy<=0 &&
    walkerCollides(build,next.x,next.y-.025,next.z)){
    next.grounded=true;next.vy=0;
  }
  return next;
}
