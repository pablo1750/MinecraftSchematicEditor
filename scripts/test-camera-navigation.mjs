import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const viewer = readFileSync("src/render/Viewer.ts", "utf8");
assert.match(viewer, /this\.controls\.enableZoom\s*=\s*false;/);
assert.match(viewer, /this\.onNavigationWheel/);
assert.match(viewer, /this\.translateView\(direction\.multiplyScalar\(travel\)\)/);
assert.match(viewer, /this\.orbitPointer\?\.id === event\.pointerId/);
assert.match(viewer, /orbitAroundAnchor\(this\.camera, this\.controls\.target, this\.orbitAnchor/);
assert.match(viewer, /this\.translateView\(offset, true\)/);
assert.match(viewer, /this\.orbi[t]Anchor\.copy\(center\)/);
assert.match(viewer, /this\.panPointer\?\.id === event\.pointerId/);

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { NAVIGATION_MIN_RATIO, navigationScale, zoomAdvance, panUnitsPerPixel } =
    await server.ssrLoadModule("/src/render/cameraNavigation.ts");
  assert.equal(NAVIGATION_MIN_RATIO, 0.10);
  const reference = 80;
  const fastPan = panUnitsPerPixel(reference, reference, 55, 800);
  const floorPan = panUnitsPerPixel(0.001, reference, 55, 800);
  assert.ok(Math.abs(floorPan / fastPan - 0.10) < 0.0000001,
    "El desplazamiento no debe caer por debajo del 10% inicial.");
  assert.equal(navigationScale(0, reference), 8);

  let scale = reference;
  let nearTotal = 0;
  for (let n = 0; n < 150; n++) {
    const result = zoomAdvance(scale, reference, -100);
    assert.ok(result.travel > 0, "La rueda hacia adelante debe acercar");
    scale = result.nextScale;
    nearTotal += result.travel;
  }
  assert.equal(scale, 8, "El zoom debe quedar con piso del 10% en velocidad");
  assert.ok(zoomAdvance(scale, reference, -100).travel > reference * 0.01,
    "Debe seguir avanzando incluso después de superar el centro orbital");
  assert.ok(nearTotal > reference * 2, "Debe poder recorrer planos muy descentrados");
  let outTotal = 0;
  for (let n = 0; n < 60; n++) {
    const result = zoomAdvance(scale, reference, 100);
    assert.ok(result.travel < 0, "La rueda hacia atrás debe alejar");
    scale = result.nextScale;
    outTotal += -result.travel;
  }
  assert.ok(outTotal > 20, "El zoom out debe seguir funcionando");
  console.log("OK: zoom continuo y reversible, pan y zoom con piso del 10%, controles orbitales intactos.");
} finally {
  await server.close();
}
