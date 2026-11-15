import { useEffect, useState } from "react";
import { useStore } from "../store";
import {
  descargarConstruccion, esEditable, listarConstrucciones, urlImagen,
  type ConstruccionServidor, type ModoGuardar,
} from "../server/catalog";

export function ServerCatalog({
  onOpen,
}: { onOpen: (entry: ConstruccionServidor, mode: ModoGuardar) => void }) {
  const [items, setItems] = useState<ConstruccionServidor[]>([]);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    let active = true;
    void listarConstrucciones().then((result) => {
      if (!active) return;
      setItems(result.construcciones ?? []);
      setCategories(result.categorias ?? []);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function open(item: ConstruccionServidor, mode: ModoGuardar) {
    if (!esEditable(item)) return;
    setOpening(item.id);
    setError("");
    try {
      const file = await descargarConstruccion(item);
      await useStore.getState().openFile(file);
      if (useStore.getState().status !== "ready") {
        throw new Error(useStore.getState().error ?? "No se pudo cargar el esquema.");
      }
      onOpen(item, mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setOpening(null);
    }
  }

  const filtered = items.filter((item) => {
    const q = filter.toLocaleLowerCase();
    return (!category || item.categoria === category) &&
      (!q || (item.nombre + " " + (item.descripcion ?? "")).toLocaleLowerCase().includes(q));
  });

  return (
    <section className="server-catalog">
      <div className="server-catalog-heading">
        <div>
          <h2>Construcciones del servidor</h2>
          <p>Elegí una para editarla o crear otra versión sin modificar la original.</p>
        </div>
        <span className="server-catalog-count">{items.length} construcciones</span>
      </div>
      <div className="server-catalog-filters">
        <input aria-label="Buscar construcciones" placeholder="Buscar construcciones…" value={filter}
          onChange={(e) => setFilter(e.target.value)} />
        <select aria-label="Filtrar por categoría" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
        </select>
      </div>
      {loading && <p>Consultando construcciones…</p>}
      {error && <p role="alert" className="server-catalog-error">{error}</p>}
      {!loading && filtered.length === 0 && <p>No hay construcciones que coincidan con la búsqueda.</p>}
      <div className="server-catalog-grid">
        {filtered.map((item) => {
          const editable = esEditable(item);
          const busy = opening === item.id;
          return (
            <article className="server-catalog-item" key={item.categoria + "/" + item.id}>
              <div className="server-catalog-image">
                {item.imagen ? <img src={urlImagen(item)} alt={item.nombre} loading="lazy" /> : <span>Sin imagen</span>}
              </div>
              <div className="server-catalog-meta">
                <span className="eyebrow">{item.categoria_nombre ?? item.categoria}</span>
                <h3 title={item.nombre}>{item.nombre}</h3>
                {item.descripcion && <p>{item.descripcion}</p>}
                <div className="server-catalog-actions">
                  <button className="btn btn-primary" disabled={!editable || !!opening}
                    onClick={() => void open(item, "editar")}>{busy ? "Abriendo…" : "Editar"}</button>
                  <button className="btn" disabled={!editable || !!opening}
                    onClick={() => void open(item, "version")}>Nueva versión</button>
                </div>
                {!editable && <small>Este formato todavía necesita conversión a .schem.</small>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
