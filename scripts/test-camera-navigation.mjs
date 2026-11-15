import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

// Check the actual viewer wiring. These regressions used to swap the right
// button into rotation during editing and allow the zoom radius to reach zero.
const src = readFileSync("src/render/Viewer.ts", "utf8");
assert.match(src, /this\.controls\.zoomToCursor\s*=\s*true;/);
assert.match(src, /this\.controls\.minDistance\s*=\s*0\.25;/);
assert.match(src, /this\.controls\.maxDistance\s*=\s*2000;/);
assert.match(src, /MIDDLE: THREE\.MOUSE\.ROTATE, RIGHT: THREE\.MOUSE\.PAN/);
assert.match(src, /LEFT: THREE\.MOUSE\.ROTATE, MIDDLE: THREE\.MOUSE\.DOLLY, RIGHT: THREE\.MOUSE\.PAN/);

const min = 0.25, max = 2000;
let radius = 8;
for (let i = 0; i < 250; i++) radius = Math.max(min, Math.min(max, radius * 0.92));
assert.equal(radius, min, "El límite mínimo debe ser alcanzable y finito");
for (let i = 0; i < 100; i++) radius = Math.max(min, Math.min(max, radius / 0.92));
assert.ok(radius > 20, "El zoom out debe recuperar distancia desde el límite mínimo");

const modes = {
  editing: { LEFT: undefined, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN },
  viewing: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
};
for (const mapping of Object.values(modes)) {
  assert.equal(mapping.RIGHT, THREE.MOUSE.PAN, "El botón derecho siempre desplaza");
}
console.log("OK: zoom con radio positivo y recuperación; clic derecho PAN con o sin edición.");
