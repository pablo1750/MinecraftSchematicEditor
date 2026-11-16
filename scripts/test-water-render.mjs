import assert from "node:assert/strict";
import {createServer} from "vite";

const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try {
  const {Build}=await vite.ssrLoadModule("/src/core/model.ts");
  const {waterHeight,isWater,makeWaterTexture,WATER_TEXTURE_KEY}=
    await vite.ssrLoadModule("/src/render/water.ts");
  const {bakePalette}=await vite.ssrLoadModule("/src/render/bake.ts");
  const {meshRegion}=await vite.ssrLoadModule("/src/render/mesher.ts");
  const air={name:"minecraft:air"};
  const source={name:"minecraft:water",properties:{level:"0"}};
  const shallow={name:"minecraft:water",properties:{level:"5"}};
  assert.ok(isWater(source));
  assert.ok(isWater({name:"minecraft:flowing_water"}));
  assert.equal(isWater({name:"minecraft:stone"}),false);
  assert.equal(waterHeight(source),14/16);
  assert.ok(waterHeight(shallow)<waterHeight(source));
  assert.equal(waterHeight({name:"minecraft:water",properties:{level:"8"}}),1);
  const png=makeWaterTexture();
  assert.equal(png.size,16);
  assert.equal(png.opaque,false);
  assert.equal(png.rgba[3],148,"water is translucent, not pink fallback");
  const palette=[air,source,shallow];
  const build=new Build(3,3,2,palette,new Uint16Array(3*3*2));
  build.data[build.index(0,0,0)]=1;
  build.data[build.index(1,0,0)]=1;
  build.data[build.index(2,0,0)]=2;
  build.data[build.index(0,1,0)]=1; // stacked water hides lower upper face
  const old=[...build.data];
  const baked=await bakePalette(build,null);
  const layer=baked.texturePaths.indexOf(WATER_TEXTURE_KEY);
  assert.ok(layer>0,"procedural texture is in the GPU array without any resource pack");
  assert.equal(baked.blocks[1].layer,2,"water uses the blended render pass");
  assert.equal(baked.blocks[1].waterHeight,14/16);
  assert.equal(baked.blocks[1].single.length,6,"water has top, bottom and four sides");
  assert.ok(baked.blocks[1].single.every(q=>q.layer===layer),"not fallback grain");
  assert.equal(baked.blocks[1].single.find(q=>q.dir===2).cull,2,
    "top of water culls against another water cell");
  const mesh=meshRegion(build,baked,0,0,0,3,3,2,2);
  assert.equal(mesh.layers[0],null,"no opaque pink boxes");
  assert.ok(mesh.layers[2].indices.length>0,"translucent water geometry is rendered");
  assert.ok(mesh.layers[2].quadBlocks.length<4*6,"neighbouring water faces hidden");
  assert.deepEqual([...build.data],old,"building geometry is unchanged");
  baked.texture.dispose();
  console.log("OK: blue translucent procedural water, level heights, joined blocks, stacking, no propagation or edits.");
} finally {await vite.close();}
