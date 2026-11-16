# Modo Simulación — primera persona

El editor dispone de un modo **Simular** independiente de los controles de edición.

## Uso

1. Abrí cualquier construcción (o un estilo con sus modificaciones aplicadas).
2. Pulsá **Simular** en la barra superior. El editor oculta paneles, barra de herramientas, materiales y demás superposiciones. El canvas WebGL ocupa toda la pantalla disponible.
3. Navegá como un personaje de Minecraft:
   - **Mouse**: mirar alrededor (captura de puntero). Si no se captura al entrar, hacé clic en el canvas.
   - **W / A / S / D**: avanzar, desplazarse a los lados y retroceder. Las flechas también funcionan.
   - **Espacio**: saltar.
   - **Shift**: correr.
   - **Esc**: salir y recuperar el editor.
4. Al salir se restaura la cámara previa y el nivel de capa, además de todos los controles.

## Arquitectura

- `src/render/walkSimulation.ts`: física sin dependencias del navegador (gravedad, altura de personaje, desplazamiento, salto, colisiones por las formas disponibles de cada bloque, subida automática de medias losas y escaleras).
- `src/render/Viewer.ts`: cámara del personaje, control de teclado y mouse mediante Pointer Lock API, y restauración exacta de la cámara de edición. En simulación se desactivan la edición y las guías de dibujo.
- `src/store.ts`: `simulation`, `enterSimulation()` y `exitSimulation()`.
- `src/App.tsx` y `src/styles.css`: ocultan interfaz sin desmontar el viewport ni los documentos.

El simulador **no escribe bloques**, no cambia dimensiones ni guarda el esquema. Reutiliza las texturas y los modelos ya renderizados, sin agregar archivos de recursos ni dependencias.

## Limitaciones iniciales

- Movimiento peatonal con colisión geométrica aproximada. No hay mobs, puertas interactivas, natación, vuelo ni inventario.
- Se intenta iniciar sobre un suelo libre en la planta baja; las construcciones importadas no incluyen un punto de aparición.
- Las colisiones usan las cajas simplificadas del editor, que no necesariamente coinciden con todos los modelos Bedrock de alta precisión.
- La simulación está limitada al espacio de la construcción para evitar caer fuera del mundo.

## Validación

`node scripts/test-walk-simulation.mjs` verifica colisiones, gravedad, salto, movimiento, velocidad de carrera, límites y subida de media losa. El workflow `Build Schematic Editor` ejecuta esta prueba antes de TypeScript y la compilación.
