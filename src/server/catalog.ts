import type { Build } from "../core/model";
import { saveBuild } from "../formats";

export interface ConstruccionServidor {
  id: string;
  categoria: string;
  categoria_nombre?: string;
  nombre: string;
  descripcion?: string;
  imagen?: string;
  editor_schem?: string;
  original_schem?: string;
  original_litematic?: string;
  original_schematic?: string;
  estadisticas?: { cantidad_bloques_detectados?: number; dimensiones?: { ancho: number; alto: number; largo: number } };
}

type CatalogResponse = {
  ok: boolean;
  categorias?: { id: string; nombre: string }[];
  construcciones?: ConstruccionServidor[];
  error?: string;
};

async function assertResponse(response: Response): Promise<void> {
  if (response.ok) return;
  let message = "Error al conectar con el catálogo.";
  try {
    const body = await response.json() as { error?: string };
    if (body.error) message = body.error;
  } catch { /* Respuesta no JSON */ }
  if (response.status === 401) message = "La sesión venció. Volvé a iniciar sesión.";
  throw new Error(message);
}

export async function listarConstrucciones(): Promise<CatalogResponse> {
  const response = await fetch("/api/construcciones", { credentials: "same-origin", cache: "no-store" });
  await assertResponse(response);
  const body = await response.json() as CatalogResponse;
  if (!body.ok || !Array.isArray(body.construcciones)) throw new Error(body.error ?? "Catálogo inválido.");
  return body;
}

export function urlImagen(construccion: ConstruccionServidor): string {
  const params = new URLSearchParams({
    accion: "imagen", categoria: construccion.categoria, id: construccion.id,
  });
  return "/api/construcciones?" + params.toString();
}

export function esEditable(construccion: ConstruccionServidor): boolean {
  return !!(construccion.editor_schem || construccion.original_schem ||
    construccion.original_litematic || construccion.original_schematic);
}

export async function descargarConstruccion(construccion: ConstruccionServidor): Promise<File> {
  const params = new URLSearchParams({
    accion: "editor_archivo", categoria: construccion.categoria, id: construccion.id,
  });
  const response = await fetch("/api/construcciones?" + params.toString(), { credentials: "same-origin" });
  await assertResponse(response);
  const ext = construccion.editor_schem || construccion.original_schem ? "schem"
    : construccion.original_litematic ? "litematic" : "schematic";
  return new File([await response.blob()], construccion.id + "." + ext, { type: "application/octet-stream" });
}

export type ModoGuardar = "editar" | "version" | "nueva";

export async function guardarConstruccion(
  build: Build,
  details: { nombre: string; descripcion: string; categoria: string },
  mode: ModoGuardar,
  source: ConstruccionServidor | null,
  photo: Blob | null,
): Promise<ConstruccionServidor> {
  const form = new FormData();
  form.set("modo", mode);
  form.set("nombre", details.nombre);
  form.set("descripcion", details.descripcion);
  form.set("categoria", details.categoria);
  if (source) {
    form.set("origen_categoria", source.categoria);
    form.set("origen_id", source.id);
  }
  const blob = await saveBuild(build, "schem");
  form.set("archivo", blob, "construction.schem");
  if (photo) form.set("imagen", photo, photo.type === "image/webp" ? "photo.webp" : "photo.png");
  const response = await fetch("/api/construcciones?accion=editor_guardar", {
    method: "POST", body: form, credentials: "same-origin",
  });
  await assertResponse(response);
  const body = await response.json() as { ok: boolean; data?: ConstruccionServidor; error?: string };
  if (!body.ok || !body.data) throw new Error(body.error ?? "No se pudo guardar.");
  return body.data;
}
