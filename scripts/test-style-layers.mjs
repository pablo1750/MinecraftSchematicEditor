import assert from "node:assert/strict";
import {createServer} from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try {
  const {Build,stateKey}=await server.ssrLoadModule("/src/core/model.ts");
  const {mappedStyleBase,composeStyle,styleDifferences}=
    await server.ssrLoadModule("/src/core/styleLayers.ts");
  const AIR={name:"minecraft:air"};
  const STONE={name:"minecraft:stone_bricks"};
  const STAIRS={name:"minecraft:oak_stairs",properties:{facing:"east",half:"top"}};
  const original=new Build(3,2,2,[AIR,STONE,STAIRS],Uint16Array.from([
    1,2,0,0,1,0,
    0,0,0,0,0,0,
  ]),{name:"Test"});
  const originalCells=[...original.data],originalPalette=original.palette.map(stateKey);
  const replacements={
    "minecraft:stone_bricks":"minecraft:bricks",
    "minecraft:oak_stairs":"minecraft:spruce_stairs",
  };
  const mapped=mappedStyleBase(original,replacements);
  assert.equal(mapped.palette[1].name,"minecraft:bricks");
  assert.equal(mapped.palette[2].properties.facing,"east");
  assert.equal(mapped.palette[2].name,"minecraft:spruce_stairs");
  const changes=[
    {x:0,y:0,z:0,bloque:"minecraft:air"}, // erase occupied original block
    {x:2,y:0,z:0,bloque:"minecraft:glass"}, // add into original air
    {x:1,y:0,z:0,bloque:"minecraft:birch_stairs[facing=north,half=bottom]"},
  ];
  const {base,working}=composeStyle(original,replacements,changes);
  assert.equal(working.at(0,0,0),0,"erasing original maps to real air");
  assert.equal(working.palette[working.at(2,0,0)].name,"minecraft:glass");
  assert.equal(stateKey(working.palette[working.at(1,0,0)]),changes[2].bloque,
    "local override wins over global replacement, including orientation");
  assert.equal(working.palette[working.at(1,0,1)].name,"minecraft:bricks",
    "unmodified stone is globally replaced");
  const diff=styleDifferences(base,working);
  assert.deepEqual(diff.sort((a,b)=>a.x-b.x),changes.sort((a,b)=>a.x-b.x));
  const reloaded=composeStyle(original,replacements,diff);
  assert.deepEqual([...reloaded.working.data],[...working.data],
    "style round-trips with no full schematic copy");
  const differentMap={"minecraft:stone_bricks":"minecraft:gold_block"};
  const changedMap=composeStyle(original,differentMap,diff);
  assert.equal(changedMap.working.palette[changedMap.working.at(1,0,1)].name,
    "minecraft:gold_block","other original blocks take the new map");
  assert.equal(changedMap.working.at(0,0,0),0,"air override survives mapping edits");
  const redundant=composeStyle(original,replacements,[
    {x:0,y:0,z:0,bloque:"minecraft:bricks"},
  ]);
  assert.deepEqual(styleDifferences(redundant.base,redundant.working),[],
    "redundant explicit overrides are dropped");
  assert.deepEqual([...original.data],originalCells,"original positions never change");
  assert.deepEqual(original.palette.map(stateKey),originalPalette,"original palette never changes");
  assert.throws(()=>composeStyle(original,{},[
    {x:3,y:0,z:0,bloque:"minecraft:glass"}]),/fuera/);
  console.log("OK: styles mapping > cell overrides, air deletion, additions, roundtrip and immutable original.");
} finally {
  await server.close();
}
