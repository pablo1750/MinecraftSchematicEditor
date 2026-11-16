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
   - **E** o **clic derecho**: abrir/cerrar la puerta o puerta de valla apuntada (a un máximo de 4,5 bloques).
   - **Esc**: salir y recuperar el editor.
4. Al salir se restaura la cámara previa y el nivel de capa, además de todos los controles.

## Arquitectura

- `src/render/walkSimulation.ts`: física sin dependencias del navegador (gravedad, altura de personaje, desplazamiento, salto, colisiones por las formas disponibles de cada bloque, subida automática de medias losas y escaleras).
- `src/render/Viewer.ts`: cámara del personaje, control de teclado y mouse mediante Pointer Lock API, y restauración exacta de la cámara de edición. En simulación se desactivan la edición y las guías de dibujo.
- `src/store.ts`: `simulation`, `enterSimulation()` y `exitSimulation()`.
- `src/App.tsx` y `src/styles.css`: ocultan interfaz sin desmontar el viewport ni los documentos.

El simulador **no escribe bloques**, no cambia dimensiones ni guarda el esquema. Reutiliza las texturas y los modelos ya renderizados, sin agregar archivos de recursos ni dependencias.

## Iluminación mejorada

Al entrar en simulación, el renderer utiliza materiales Lambert con luz ambiental
hemisférica cálida **más una luz ambiental uniforme** que ilumina paredes
interiores incluso cuando el techo bloquea el sol. La iluminación global no
depende de la cercanía a una antorcha. Se activa un mapa de sombras suavizadas de
1024×1024 cerca del personaje. También incorpora una luz de relleno tenue
junto a la cámara y un color de niebla diurna. Estas opciones solo funcionan
durante la simulación; al regresar al editor se restauran sus materiales, luz
y cámara originales, evitando el coste permanente de las sombras.

Los faroles normales y los de almas disponen de **cuatro focos**, uno por
cada cara lateral de su cuerpo. Se bajaron las cuatro fuentes hacia el cuerpo
del farol y se redujo su intensidad individual para suavizar las manchas
saturadas en techos y paredes. La antorcha de suelo emite desde la punta de
la llama y la antorcha de pared desplaza el foco hasta la punta inclinada
según su orientación. Con la iluminación general más equilibrada, las
antorchas mantienen una luz cálida perceptible sin puntos quemados.
Fogatas, antorchas y faroles normales utilizan ámbar/amarillo/anaranjado,
mientras que las variantes de almas conservan el azul. Estos cambios
afectan solo a la simulación, nunca a los bloques originales.

Cada antorcha, farol, fogata encendida y demás bloque emisor detectado
en la construcción genera su propia luz puntual. **No existe límite de ocho
luces ni recorte por distancia al personaje**, incluso si la fuente está a
más de 40 bloques. Cada emisor conserva su atenuación local y color
(tonos cálidos para fuego convencional, fríos para fuego de almas). Al salir
de la simulación se liberan todas las luces dinámicas.

**Importante:** sigue siendo una aproximación visual, no la propagación por
vóxeles de Minecraft. Las luces puntuales no proyectan sombras individuales:
las sombras proyectadas corresponden a la luz solar. Usar todos los emisores
es apropiado para construcciones pequeñas, aunque un edificio con cientos de
antorchas puede afectar el rendimiento de GPU.

## Puertas interactivas

La interacción mediante `E` o clic derecho lanza un rayo desde el centro de
la cámara: solo funciona sobre la puerta directamente visible y cercana.
Abrir una puerta actualiza sus dos mitades; los portones se abren como un
bloque individual. Se genera temporalmente el modelo de su nuevo estado
mediante el mismo paquete de texturas activo.

Los cambios se realizan sobre un `Build.clone()` de la simulación: **no se
guardan ni modifican el original o el estilo**. Al salir se recupera la
geometría original, la textura anterior y el alcance de selección del editor.

## Limitaciones iniciales

- Movimiento peatonal con colisión geométrica aproximada. No hay mobs, natación, vuelo ni inventario.
- Se intenta iniciar sobre un suelo libre en la planta baja; las construcciones importadas no incluyen un punto de aparición.
- Las colisiones usan las cajas simplificadas del editor, que no necesariamente coinciden con todos los modelos Bedrock de alta precisión.
- La simulación está limitada al espacio de la construcción para evitar caer fuera del mundo.

## Validación

`node scripts/test-walk-simulation.mjs` verifica colisiones, gravedad, salto, movimiento, velocidad de carrera, límites y subida de media losa. El workflow `Build Schematic Editor` ejecuta esta prueba antes de TypeScript y la compilación.
