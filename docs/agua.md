# Renderizado de agua (sin propagación)

El editor admite bloques `minecraft:water`, `minecraft:flowing_water` y
`minecraft:bubble_column` como geometría fluida visual. Esta fase **no simula
propagación** y nunca crea, reemplaza ni elimina automáticamente bloques.

## Funcionamiento

- El bloque de agua utiliza una textura procedural azul con alfa de transparencia
  real, tanto con paquetes Bedrock como sin un paquete cargado. Ya no se dibuja
  con el cubo opaco de color de fallback.
- El estado `level` (o `liquid_depth`) determina la altura de la superficie:
  fuente `0` = 14/16; niveles 1–7 son progresivamente más bajos; niveles 8–15
  se interpretan como agua descendente de altura completa.
- El mesher omite paredes internas de bloques de agua contiguos cuando el
  vecino alcanza la misma altura o más, y omite la cara superior cuando hay
  agua inmediatamente encima.
- El shader desplaza suavemente las coordenadas UV de **la capa de agua**
  para producir movimiento visual. Los demás materiales conservan sus UV
  normales y la textura sigue siendo pixel-art.
- El renderizado tiene transparencia mediante la capa de mezcla existente.
  El agua en el esquema mantiene sus posiciones, nivel y estado originales;
  la vista de simulación lo representa sin agregar comportamiento físico.

## Limitaciones

- El agua no fluye ni se extiende; no se recalculan fuentes ni pendientes.
- Los niveles utilizan superficies planas por celda (todavía no se generan
  pendientes suaves entre las cuatro esquinas).
- No hay natación, oleaje físico, refracción, ni propagación de luz debajo
  del agua.
- Los bloques `waterlogged` no generan un volumen separado en esta fase.
- La transparencia comparte la capa de mezcla general, por lo que la
  superposición de varios líquidos y vidrios puede mostrar limitaciones de
  orden de dibujo típicas de WebGL.

## Validación

`node scripts/test-water-render.mjs` comprueba textura con alfa, altura
según nivel, unión entre vecinos, columnas apiladas, que el agua se genere
en la capa transparente y que no se modifique ningún bloque del original.
El workflow `Build Schematic Editor` ejecuta esta prueba antes de TypeScript
y la compilación de producción.
