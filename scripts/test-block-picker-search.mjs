import assert from "node:assert/strict";
import { createServer } from "vite";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try {
  const { matchingBlockIds,typedBlock }=await server.ssrLoadModule("/src/ui/blockPickerSearch.ts");
  const { BLOCK_GROUPS }=await server.ssrLoadModule("/src/core/commonBlocks.ts");
  const { displayName }=await server.ssrLoadModule("/src/core/model.ts");
  const ids=new Set(BLOCK_GROUPS.flatMap(g=>g.blocks));
  assert.ok(ids.has("minecraft:water"),"water available before it is used in a build");
  assert.ok(ids.has("minecraft:lava"),"lava included as a curated material");
  assert.equal(displayName({name:"minecraft:water"}),"Agua");
  assert.deepEqual(matchingBlockIds("agua",["minecraft:water","minecraft:stone"]),
    ["minecraft:water"],"translated search finds the correct id");
  assert.deepEqual(matchingBlockIds("minecraft:water",["minecraft:water"]),
    ["minecraft:water"],"full id search still works");
  assert.equal(typedBlock("agua",ids),null,
    "translated word never becomes invalid minecraft:agua");
  assert.equal(typedBlock("water",ids)?.state.name,"minecraft:water",
    "known unqualified id is accepted");
  assert.equal(typedBlock("minecraft:water",ids)?.state.name,"minecraft:water");
  assert.equal(typedBlock("minecraft:agua",ids)?.unrecognized,true,
    "explicit invalid id remains possible but marked unrecognized");
  assert.equal(typedBlock("unknown_made_up_block",ids),null,
    "unknown plain text is not offered as a valid block");
  const props=typedBlock("oak_stairs[facing=east,half=top]",ids);
  assert.equal(props?.state.properties?.facing,"east",
    "manual blockstate editing remains available");
  assert.equal(props?.unrecognized,false);
  console.log("OK picker: water by translated label, real IDs, invalid block warning, custom blockstates.");
}finally{await server.close();}
