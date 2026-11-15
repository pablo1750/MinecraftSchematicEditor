import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const blocks = JSON.parse(readFileSync("src/i18n/blocks-es-ar.json", "utf8"));
const ui = JSON.parse(readFileSync("src/i18n/ui-es.json", "utf8"));
assert.ok(Object.keys(blocks).length > 2000, "Catálogo español incompleto");
assert.ok(Object.keys(ui).length > 300, "Textos de interfaz incompletos");
assert.equal(blocks["block.minecraft.stone"], "Piedra");
assert.ok(blocks["block.minecraft.oak_stairs"], "Faltan escaleras de roble");
assert.equal(ui["Save as"], "Guardar como");
assert.equal(ui["Materials"], "Materiales");
assert.equal(ui["Clone"], "Clonar");
console.log("OK i18n: " + Object.keys(blocks).length + " nombres Minecraft y " +
  Object.keys(ui).length + " traducciones de interfaz.");
