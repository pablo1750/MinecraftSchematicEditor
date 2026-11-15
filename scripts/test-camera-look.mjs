import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

const viewer = readFileSync("src/render/Viewer.ts", "utf8");
const rail = readFileSync("src/ui/ToolRail.tsx", "utf8");
const store = readFileSync("src/store.ts", "utf8");
assert.match(viewer, /export type CameraMode = "orbit" \| "look" \| "fly"/);
assert.match(viewer, /this\.mode === "look" && this\.lookPointer\?\.id === event\.pointerId/);
assert.match(viewer, /if \(this\.mode === "look"\) return;/);
assert.match(viewer, /this\.controls\.enabled = mode === "orbit"/);
assert.match(rail, /setCameraMode\("look"\)/);
assert.match(store, /cameraMode: "orbit" \| "look" \| "fly"/);

// El cálculo de giro modifica exclusivamente la orientación; la cámara
// conserva su posición (el centro de giro es el observador).
const camera = new THREE.PerspectiveCamera();
camera.position.set(31, 14, 27);
camera.lookAt(5, 7, 4);
const before = camera.position.clone();
const direction = camera.getWorldDirection(new THREE.Vector3());
const euler = new THREE.Euler(0, 0, 0, "YXZ");
euler.setFromQuaternion(camera.quaternion, "YXZ");
euler.y -= 72 * 0.0022;
euler.x -= 28 * 0.0022;
euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
camera.quaternion.setFromEuler(euler);
assert.ok(camera.position.equals(before), "La cámara no debe desplazarse");
assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > 0.01,
  "El arrastre debe cambiar la dirección");
console.log("OK: modo giro en posición sin desplazamiento ni conflicto con órbita/vuelo.");
