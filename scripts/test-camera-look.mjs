import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createServer } from "vite";

const viewer = readFileSync("src/render/Viewer.ts", "utf8");
const rail = readFileSync("src/ui/ToolRail.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const store = readFileSync("src/store.ts", "utf8");
assert.match(viewer, /rotateCameraInPlace\(this\.camera, dx, dy\)/);
assert.match(viewer, /this\.rotatePointer\?\.id === event\.pointerId/);
assert.match(viewer, /this\.controls\.enabled = false/);
assert.doesNotMatch(viewer, /orbitAroundAnchor|setCameraMode\(|updateFly\(/);
assert.doesNotMatch(rail, /setCameraMode|IconOrbit|IconFly/);
assert.doesNotMatch(app, /setCameraMode|cameraMode/);
assert.doesNotMatch(store, /setCameraMode|cameraMode/);

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { rotateCameraInPlace } = await server.ssrLoadModule("/src/render/cameraNavigation.ts");
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(31, 14, 27);
  camera.lookAt(5, 7, 4);
  const beforePosition = camera.position.clone();
  const beforeDirection = camera.getWorldDirection(new THREE.Vector3());
  rotateCameraInPlace(camera, 72, 28);
  assert.ok(camera.position.equals(beforePosition), "El giro nunca debe desplazar X, Y, Z");
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(beforeDirection) > 0.01,
    "El giro debe cambiar la orientación");
  for (let i = 0; i < 1000; i++) rotateCameraInPlace(camera, 1, i % 2 ? 3 : -3);
  assert.ok(camera.position.equals(beforePosition), "Ni los giros repetidos pueden mover la posición");
  console.log("OK: giro local y navegación única, sin modificar la posición de cámara.");
} finally {
  await server.close();
}
