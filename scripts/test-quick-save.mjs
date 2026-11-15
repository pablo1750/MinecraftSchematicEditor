import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const topbar = readFileSync("src/ui/TopBar.tsx", "utf8");
const props = readFileSync("src/ui/ServerProperties.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const icons = readFileSync("src/ui/icons.tsx", "utf8");

assert.match(icons, /export const IconSave/);
assert.match(topbar, /<IconSave \/> Guardar/);
assert.match(topbar, /onClick=\{onSave\}/);
assert.match(topbar, /aria-label="Guardar construcción"/);
assert.match(app, /onSave=\{\(\) => serverPropertiesRef\.current\?\.save\(\)\}/);
assert.match(app, /ref=\{serverPropertiesRef\}/);
assert.match(app, /onRequireDetails=\{\(\) => setPropertiesVisible\(true\)\}/);
assert.match(app, /savedBuildRef\.current = build/);
assert.match(app, /source=\{sourceIsCurrent \? serverSource : null\}/);
assert.match(app, /setNotice\("Construcción guardada en el servidor\."\)/);
assert.match(props, /useImperativeHandle\(ref, \(\) => \(\{ save: \(\) => \{ void save\(\); \} \}\)\)/);
assert.match(props, /onRequireDetails\(\);/);
assert.match(props, /guardarConstruccion\(build,/);
assert.match(props, /disabled=\{saving\}/);
console.log("OK: botón Guardar reutiliza el panel, abre datos faltantes, confirma y actualiza entrada existente.");
