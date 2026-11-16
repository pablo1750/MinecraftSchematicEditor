import { useEffect } from "react";
import { useStore } from "../store";
import { IconTexture } from "./icons";

/**
 * Server-hosted Bedrock assets load automatically. Java remains a future
 * edition: no user needs to select files or install anything in the browser.
 */
export function TexturePack() {
  const status = useStore(s => s.packStatus);
  const name = useStore(s => s.packName);
  const error = useStore(s => s.packError);
  const enabled = useStore(s => s.texturesEnabled);
  const baking = useStore(s => s.baking);
  const counts = useStore(s => s.packCounts);

  useEffect(() => {
    void useStore.getState().autoLoadResourcePack();
  }, []);

  return (
    <div className="pack-chip" data-off={!enabled}>
      <IconTexture />
      <select
        aria-label="Edición de Minecraft"
        title="Las texturas de Bedrock se cargan automáticamente desde el servidor"
        defaultValue="bedrock"
        style={{ background: "transparent", color: "inherit", border: 0, maxWidth: 118 }}
      >
        <option value="bedrock">Bedrock</option>
        <option value="java" disabled>Java (próximamente)</option>
      </select>
      <button
        className="pack-toggle"
        disabled={status === "loading" || status === "error"}
        aria-pressed={enabled}
        title={status === "error" ? error ?? "Error de texturas"
          : `${name ?? "Bedrock"} · ${counts?.textures ?? 0} texturas cargadas\nAlternar colores y texturas`}
        onClick={() => void useStore.getState().setTexturesEnabled(!enabled)}
      >
        {status === "loading" || baking ? "Cargando…" : enabled ? "Texturas" : "Colores"}
      </button>
      {status === "error" && (
        <button className="btn pack-more"
          title={error ?? "Reintentar carga de Bedrock"}
          onClick={() => void useStore.getState().useBedrockTextures()}
        >Reintentar</button>
      )}
    </div>
  );
}
