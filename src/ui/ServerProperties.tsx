import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { guardarConstruccion, urlImagen, type ConstruccionServidor, type ModoGuardar } from "../server/catalog";
import { useStore } from "../store";

export interface ServerPropertiesHandle {
  save: () => void;
}

interface Props {
  ref?: Ref<ServerPropertiesHandle>;
  onRequireDetails: () => void;
  visible: boolean;
  onClose: () => void;
  source: ConstruccionServidor | null;
  mode: ModoGuardar;
  onSaved: (entry: ConstruccionServidor) => void;
}

export function ServerProperties({ ref, onRequireDetails, source, mode, onSaved, visible, onClose }: Props) {
  const build = useStore((s) => s.build);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setNombre(mode === "version" && source
      ? source.nombre + " - versión 2" : source?.nombre ?? build?.meta.name ?? "");
    setDescripcion(source?.descripcion ?? build?.meta.description ?? "");
    setCategoria(source?.categoria ?? "");
    setPhoto(null);
    setPreview(null);
    setMessage("");
    setError("");
  }, [source?.id, source?.categoria, mode, build]);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function takePhoto() {
    setError("");
    try {
      const dataUrl = useStore.getState().takePhoto();
      if (!dataUrl) throw new Error("No hay un canvas 3D disponible.");
      const response = await fetch(dataUrl);
      const image = await response.blob();
      if (!image.size) throw new Error("La captura quedó vacía.");
      setPhoto(image);
      setMessage("Captura preparada. Guardá para publicarla en el catálogo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function save() {
    if (!build || saving) return;
    setError("");
    setMessage("");
    if (!nombre.trim() || !categoria.trim()) {
      setError("Completá el nombre y la categoría.");
      onRequireDetails();
      return;
    }
    setSaving(true);
    try {
      const result = await guardarConstruccion(build,
        { nombre: nombre.trim(), descripcion: descripcion.trim(), categoria: categoria.trim() },
        mode, source, photo);
      build.meta.name = result.nombre;
      build.meta.description = descripcion.trim();
      onSaved(result);
      setPhoto(null);
      setMessage("Construcción guardada en el servidor. No se ejecutó en Minecraft.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({ save: () => { void save(); } }));

  if (!build) return null;
  return (
    <aside id="server-properties-panel" className={"server-properties" + (visible ? "" : " server-properties--hidden")} aria-hidden={!visible} inert={!visible}>
      <div className="server-properties-title">
        <h2>Propiedades</h2>
        <button className="server-properties-close" type="button" onClick={onClose} aria-label="Ocultar propiedades" title="Ocultar propiedades">×</button>
        <span className="eyebrow">{mode === "editar" ? "Editar construcción" : mode === "version" ? "Nueva versión" : "Nueva construcción"}</span>
      </div>
      <label>Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={180} />
      </label>
      <label>Descripción
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} maxLength={4000} />
      </label>
      <label>Categoría
        <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="ej. casas" />
      </label>
      {source && mode === "version" && <p className="server-properties-note">Se conservará intacta la construcción original.</p>}
      <div className="server-photo">
        <span>Imagen de portada</span>
        {preview ? <img src={preview} alt="Nueva captura del canvas" />
          : source?.imagen ? <img src={urlImagen(source)} alt="Imagen actual" />
          : <div className="server-photo-empty">Sin imagen</div>}
        <button className="btn" type="button" onClick={() => void takePhoto()}>📷 Take photo</button>
        <small>Captura la vista actual del canvas 3D, sin barras ni controles.</small>
      </div>
      <button className="btn btn-primary server-save" disabled={saving} onClick={() => void save()}>
        {saving ? "Guardando…" : mode === "version" ? "Crear versión" : "Guardar construcción"}
      </button>
      {message && <p role="status" className="server-properties-success">{message}</p>}
      {error && <p role="alert" className="server-catalog-error">{error}</p>}
    </aside>
  );
}
