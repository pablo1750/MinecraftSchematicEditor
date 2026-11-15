/**
 * Navegación de cámara independiente de la distancia mínima de OrbitControls.
 * La escala disminuye normalmente al acercarse, pero nunca cae por debajo
 * del 25% de la distancia de referencia al encuadrar la construcción.
 */
export const NAVIGATION_MIN_RATIO = 0.25;
const MAX_WHEEL_STEPS = 5;
const WHEEL_SENSITIVITY = 0.15;

export function navigationScale(distance: number, reference: number): number {
  return Math.max(
    Math.max(0.01, reference) * NAVIGATION_MIN_RATIO,
    Math.max(0, distance),
  );
}

/** Devuelve el avance firmado; deltaY negativo significa acercar. */
export function zoomAdvance(
  currentScale: number,
  reference: number,
  deltaY: number,
  deltaMode = 0,
): { travel: number; nextScale: number } {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 800 : deltaY;
  const steps = Math.max(-MAX_WHEEL_STEPS, Math.min(MAX_WHEEL_STEPS, pixels / 100));
  const scale = navigationScale(currentScale, reference);
  // Distancia proporcional y reversible. La referencia de velocidad tiene
  // piso; no depende de acercarse arbitrariamente al pivote de OrbitControls.
  const travel = -scale * Math.expm1(steps * WHEEL_SENSITIVITY);
  const nextScale = Math.max(reference * NAVIGATION_MIN_RATIO,
    Math.min(reference * 100, currentScale * Math.exp(steps * WHEEL_SENSITIVITY)));
  return { travel, nextScale };
}

/** Un arrastre de 100 px nunca baja del 25% de su recorrido inicial. */
export function panUnitsPerPixel(
  currentScale: number,
  reference: number,
  fovDegrees: number,
  viewportHeight: number,
): number {
  const visibleHeight = 2 * Math.tan((fovDegrees * Math.PI) / 360) *
    navigationScale(currentScale, reference);
  return visibleHeight / Math.max(1, viewportHeight);
}
