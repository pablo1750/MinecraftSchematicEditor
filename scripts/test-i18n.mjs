import path from "node:path";
import { localizationPlugin } from "./localization-plugin.mjs";
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
const plugin = localizationPlugin();
const sample = `export function Sample(){return <section><button title="Open">Save as</button><span>Construcciones del servidor</span></section>}`;
const transformed = plugin.transform(sample, path.resolve("src/ui/Sample.tsx"));
assert.ok(transformed?.code?.includes('__tr("Open")'), "No traduce atributos JSX");
assert.ok(transformed?.code?.includes('__trText("Save as")'), "No traduce contenido JSX");
assert.ok(transformed?.code?.includes("Construcciones del servidor"), "No reconoce textos en español");
console.log("OK transformación JSX de interfaz.");
console.log("OK i18n: " + Object.keys(blocks).length + " nombres Minecraft y " +
  Object.keys(ui).length + " traducciones de interfaz.");
