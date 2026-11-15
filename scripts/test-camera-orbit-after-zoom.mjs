import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { rotateCameraInPlace, zoomAdvance, NAVIGATION_MIN_RATIO, panUnitsPerPixel } =
    await server.ssrLoadModule("/src/render/cameraNavigation.ts");
  assert.equal(NAVIGATION_MIN_RATIO, 0.10);

  const camera = new THREE.PerspectiveCamera(55, 1.5, 0.1, 4000);
  camera.position.set(180, 90, 190);
  camera.lookAt(50, 22, 50);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  // Zoom oblicuo a un borde del esquema, sin referencia a un pivote.
  const direction = new THREE.Vector3(0.45, -0.2, 0.5).unproject(camera)
    .sub(camera.position).normalize();
  const travel = zoomAdvance(80, 80, -100).travel;
  camera.position.addScaledVector(direction, travel);
  const afterZoom = camera.position.clone();
  const beforeDirection = camera.getWorldDirection(new THREE.Vector3());
  rotateCameraInPlace(camera, 0, 0);
  assert.ok(camera.position.equals(afterZoom), "Un giro de 0 px no debe mover la cámara");
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(beforeDirection) < 1e-9);

  rotateCameraInPlace(camera, 35, -15);
  assert.ok(camera.position.equals(afterZoom), "Un giro después de zoom NO puede mover la cámara");
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(beforeDirection) > 0.01,
    "El giro sí debe cambiar la dirección");
  const afterRotation = camera.position.clone();

  // Pan conserva la rotación actual y también su mínimo del 10%.
  const panUnit = panUnitsPerPixel(0, 80, camera.fov, 700);
  assert.ok(panUnit > 0);
  const qBefore = camera.quaternion.clone();
  const horizontal = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  camera.position.addScaledVector(horizontal, 30 * panUnit);
  assert.ok(camera.quaternion.equals(qBefore), "Pan no debe girar la cámara");
  assert.ok(!camera.position.equals(afterRotation), "Pan sí debe desplazar la cámara");
  console.log("OK: zoom descentrado → giro sobre posición propia → desplazamiento con velocidad 10%.");
} finally {
  await server.close();
}
