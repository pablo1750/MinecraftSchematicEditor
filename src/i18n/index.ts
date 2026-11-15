import { useSyncExternalStore } from "react";
import names from "./blocks-es-ar.json";
import ui from "./ui-es.json";

export type Locale = "es-AR" | "en-US";
const BLOCKS = names as Record<string, string>;
const UI = ui as Record<string, string>;

let current: Locale = (() => {
  try {
    return localStorage.getItem("schematic-editor-language") === "en-US" ? "en-US" : "es-AR";
  } catch {
    return "es-AR";
  }
})();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getLocale(): Locale { return current; }
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => "es-AR");
}
export function setLocale(locale: Locale): void {
  if (current === locale) return;
  current = locale;
  document.documentElement.lang = locale;
  try { localStorage.setItem("schematic-editor-language", locale); } catch { /* storage optional */ }
  for (const listener of listeners) listener();
}

/** Textos visibles: las cadenas técnicas, rutas y los identificadores no se traducen. */
export function translate(value: string): string {
  if (current === "en-US") return value;
  return UI[value] ?? value;
}

/** Conserva la separación entre etiquetas JSX sin traducir su puntuación ni espacios. */
export function translateText(value: string): string {
  const prefix = /^\s*/.exec(value)?.[0] ?? "";
  const suffix = /\s*$/.exec(value)?.[0] ?? "";
  const middle = value.slice(prefix.length, value.length - suffix.length);
  return prefix + (current === "es-AR" ? translate(middle.replace(/\s+/g, " ")) : middle) + suffix;
}

/** Dejar el identificador en inglés es imprescindible para los archivos Minecraft. */
export function translateBlock(id: string): string | null {
  if (current !== "es-AR") return null;
  const [namespace, path] = id.includes(":") ? id.split(":", 2) : ["minecraft", id];
  if (namespace !== "minecraft") return null;
  return BLOCKS["block.minecraft." + path] ?? BLOCKS["item.minecraft." + path] ?? null;
}
const PROPERTIES: Record<string, string> = {
  north: "norte", south: "sur", east: "este", west: "oeste", up: "arriba",
  down: "abajo", top: "superior", bottom: "inferior", upper: "superior",
  lower: "inferior", left: "izquierda", right: "derecha", horizontal: "horizontal",
  vertical: "vertical", inner: "interior", outer: "exterior",
  single: "individual", double: "doble", none: "ninguno", true: "sí",
  false: "no", waterlogged: "sumergido", open: "abierto", closed: "cerrado",
};
export function translateProperty(value: string): string {
  return current === "es-AR" ? (PROPERTIES[value] ?? value) : value;
}

if (typeof document !== "undefined") {
  document.documentElement.lang = current;
}
