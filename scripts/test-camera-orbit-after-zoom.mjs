import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { orbitAroundAnchor, zoomAdvance, NAVIGATION_MIN_RATIO } =
    await server.ssrLoadModule("/src/render/cameraNavigation.ts");
  assert.equal(NAVIGATION_MIN_RATIO, 0.10);

  const anchor = new THREE.Vector3(50, 22, 50);
  const camera = new THREE.PerspectiveCamera(55, 1.5, 0.1, 4000);
  camera.position.set(180, 90, 190);
  const target = anchor.clone();
  camera.lookAt(target);

  const initialPosition = camera.position.clone();
  const initialTarget = target.clone();
  const translation = new THREE.Vector3(20, -7, -17);
  // Zoom al cursor: cámara y target viajan, pero la referencia orbital permanece.
  camera.position.add(translation);
  target.add(translation);
  camera.lookAt(target);
  const postZoomPosition = camera.position.clone();
  const postZoomTarget = target.clone();
  const beforeDirection = camera.getWorldDirection(new THREE.Vector3());
  const beforeAnchor = anchor.clone();

  orbitAroundAnchor(camera, target, anchor, 0, 0, 700);
  assert.ok(camera.position.distanceTo(postZoomPosition) < 0.00001,
    "Un arrastre de 0 px no debe mover la cámara después de zoom");
  assert.ok(target.distanceTo(postZoomTarget) < 0.00001,
    "Un arrastre de 0 px no debe cambiar el target");
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(beforeDirection) < 0.00001,
    "Un arrastre de 0 px no debe cambiar la orientación");

  const distance = camera.position.distanceTo(anchor);
  const targetDistance = target.distanceTo(anchor);
  orbitAroundAnchor(camera, target, anchor, 35, -15, 700);
  assert.ok(anchor.equals(beforeAnchor), "El punto de giro debe permanecer fijo");
  assert.ok(Math.abs(camera.position.distanceTo(anchor) - distance) < 0.00001,
    "Al girar, la cámara debe mantener radio respecto del centro original");
  assert.ok(Math.abs(target.distanceTo(anchor) - targetDistance) < 0.00001,
    "El target de seguimiento debe rotar alrededor de la misma referencia");
  assert.ok(camera.position.distanceTo(postZoomPosition) > 0.1, "El giro debe mover cámara");
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(beforeDirection) > 0.01,
    "El giro debe cambiar el ángulo de cámara");
  assert.ok(initialPosition.distanceTo(camera.position) > 0);
  assert.ok(initialTarget.distanceTo(target) > 0);
  assert.ok(zoomAdvance(8, 80, -100).travel > 0);
  console.log("OK: zoom descentrado conserva el pivote orbital y el giro no salta.");
} finally {
  await server.close();
}
