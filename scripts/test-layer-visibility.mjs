import assert from "node:assert/strict";
import { createServer } from "vite";

// Usamos el mismo cargador TS/ESM que Vite para probar el render real, sin DOM.
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { meshRegion } = await server.ssrLoadModule("/src/render/mesher.ts");

  const width = 2, height = 20, length = 2;
  const data = new Uint16Array(width * height * length);
  const index = (x, y, z) => (y * length + z) * width + x;
  data[index(0, 2, 0)] = 1;
  data[index(0, 12, 0)] = 1;
  data[index(1, 18, 1)] = 1;

  // Simula el bloque agregado en la vista recortada.
  const original = data.slice();
  const build = { width, height, length, data };
  const quad = {
    pos: Float32Array.from([0,0,0, 1,0,0, 1,1,0, 0,1,0]),
    uv: Float32Array.from([0,0, 1,0, 1,1, 0,1]),
    layer: 0, cull: -1, dir: 5, edge: false,
    shade: 1, tr: 1, tg: 1, tb: 1,
  };
  const baked = {
    blocks: [
      { occludes: new Uint8Array(6), layer: 0, ao: false, empty: true, single: [], parts: [] },
      { occludes: new Uint8Array(6), layer: 0, ao: false, empty: false, single: [quad], parts: [] },
    ],
  };
  function visible(yMax) {
    const result = meshRegion(build, baked, 0, 0, 0, width, height, length, yMax);
    return Array.from(result.layers[0]?.quadBlocks ?? []);
  }

  assert.deepEqual(visible(height - 1).sort(), [index(0,2,0), index(0,12,0), index(1,18,1)].sort());
  assert.deepEqual(visible(4), [index(0,2,0)]);
  data[index(1, 3, 1)] = 1;
  assert.deepEqual(visible(4).sort(), [index(0,2,0), index(1,3,1)].sort());
  assert.deepEqual(visible(height - 1).sort(),
    [index(0,2,0), index(0,12,0), index(1,18,1), index(1,3,1)].sort());
  for (let i = 0; i < data.length; i++) {
    if (i === index(1,3,1)) continue;
    assert.equal(data[i], original[i], "El recorte no debe modificar otros bloques.");
  }
  console.log("OK: recortar, editar abajo y mostrar todos los pisos conserva la estructura.");
} finally {
  await server.close();
}
