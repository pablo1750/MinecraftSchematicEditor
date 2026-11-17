import { useEffect, useRef, useState } from "react";
import { setLocale, useLocale } from "../i18n";
import { useStore } from "../store";
import { ACCEPTED_EXTENSIONS, type SaveFormat } from "../formats";
import { IconClose, IconDownload, IconImport, IconOpen, IconRedo, IconSave, IconUndo, Mark } from "./icons";
import { TexturePack } from "./TexturePack";
import { ModPacks } from "./ModPacks";
import { NewBuildDialog } from "./NewBuildDialog";

const SAVE_FORMATS: { id: SaveFormat; label: string }[] = [
  { id: "litematic", label: "Litematica" },
  { id: "schem", label: "WorldEdit" },
  { id: "nbt", label: "Structure" },
];

type OpenMenu = "archivo" | "herramientas" | null;

export function TopBar({ propertiesVisible, onToggleProperties, onSave, onStyles, stylesEnabled }: {
  propertiesVisible: boolean; onToggleProperties: () => void; onSave: () => void;
  onStyles: () => void; stylesEnabled: boolean;
}) {
  const locale = useLocale();
  const build = useStore((s) => s.build);
  const styleEditing = useStore((s) => s.styleEditing);
  const fileName = useStore((s) => s.fileName);
  const undoStack = useStore((s) => s.undoStack);
  const redoStack = useStore((s) => s.redoStack);
  const importing = useStore((s) => s.importing);
  const input = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const [newBuild, setNewBuild] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  useEffect(() => {
    if (!openMenu) return;
    const outside = (event: PointerEvent) => {
      if (!menuRoot.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [openMenu]);

  const run = (action: () => void) => {
    setOpenMenu(null);
    action();
  };
  const toggle = (menu: Exclude<OpenMenu, null>) =>
    setOpenMenu((current) => current === menu ? null : menu);
  const lastEdit = undoStack[undoStack.length - 1];

  return (
    <header className="topbar">
      <div className="mark"><Mark /><span className="mark-text">Schematic</span></div>
      <input ref={input} type="file" accept={ACCEPTED_EXTENSIONS.join(",")} hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) useStore.getState().openFile(file);
          event.target.value = "";
        }} />
      {build && <input ref={importInput} type="file" accept={ACCEPTED_EXTENSIONS.join(",")} hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) useStore.getState().importFile(file);
          event.target.value = "";
        }} />}
      {newBuild && <NewBuildDialog onClose={() => setNewBuild(false)} />}

      <div className="topbar-menus" ref={menuRoot}>
        <div className="topbar-menu">
          <button type="button" className="btn btn-outline" aria-haspopup="true"
            aria-expanded={openMenu === "archivo"} onClick={() => toggle("archivo")}>
            Archivo <span aria-hidden="true">▾</span>
          </button>
          {openMenu === "archivo" && <div className="topbar-dropdown">
            <button type="button" onClick={() => run(() => input.current?.click())}>
              <IconOpen /> Abrir
            </button>
            <button type="button" onClick={() => run(() => setNewBuild(true))}>Nuevo</button>
            {build && <>
              <button type="button" disabled={importing} onClick={() => run(() => importInput.current?.click())}>
                <IconImport /> {importing ? "Importando…" : "Importar"}
              </button>
              <button type="button" disabled={styleEditing} onClick={() => run(onSave)}>
                <IconSave /> Guardar
              </button>
              <div className="topbar-menu-divider" />
              <span className="topbar-menu-heading">Exportar</span>
              {SAVE_FORMATS.map((format) => <button key={format.id} type="button"
                onClick={() => run(() => useStore.getState().download(format.id))}>
                <IconDownload /> {format.label}
              </button>)}
              <div className="topbar-menu-divider" />
              <button type="button" onClick={() => run(() => useStore.getState().closeBuild())}>
                <IconClose /> Cerrar construcción
              </button>
            </>}
          </div>}
        </div>
        {build && <div className="topbar-menu">
          <button type="button" className="btn btn-outline" aria-haspopup="true"
            aria-expanded={openMenu === "herramientas"} onClick={() => toggle("herramientas")}>
            Herramientas <span aria-hidden="true">▾</span>
          </button>
          {openMenu === "herramientas" && <div className="topbar-dropdown">
            <button type="button" onClick={() => run(() => useStore.getState().enterSimulation())}>Simular</button>
            <button type="button" onClick={() => run(() => useStore.getState().enterPhotoMode())}>Foto</button>
            <button type="button" disabled={!stylesEnabled} title={!stylesEnabled ? "Guardá primero la construcción en el catálogo" : undefined}
              onClick={() => run(onStyles)}>Estilos</button>
            <button type="button" aria-pressed={propertiesVisible}
              onClick={() => run(onToggleProperties)}>Propiedades</button>
          </div>}
        </div>}
      </div>

      {build && <div className="topbar-document" title={fileName ?? ""}>
        <span className="file-name">{fileName}</span>
        <span className="file-format">{build.meta.format}</span>
      </div>}
      <span className="topbar-spacer" />

      {build && <button className="btn btn-primary" type="button" onClick={onSave} disabled={styleEditing}
        title={styleEditing ? "Guardá las modificaciones desde el panel Estilos" : "Guardar construcción en el servidor"}
        aria-label="Guardar construcción">
        <IconSave /> Guardar
      </button>}
      {build && <div className="topbar-group">
        <button className="btn" disabled={undoStack.length === 0}
          onClick={() => useStore.getState().undo()}
          title={lastEdit ? `Undo ${lastEdit.label.toLowerCase()} (Ctrl+Z)` : "Nothing to undo"}><IconUndo /></button>
        <button className="btn" disabled={redoStack.length === 0}
          onClick={() => useStore.getState().redo()} title="Redo (Ctrl+Shift+Z)"><IconRedo /></button>
      </div>}
      <label className="language-control" title="Idioma / Language">
        <span>{locale === "es-AR" ? "Idioma" : "Language"}</span>
        <select aria-label="Idioma / Language" value={locale}
          onChange={(event) => setLocale(event.target.value as "es-AR" | "en-US")}>
          <option value="es-AR">Español (AR)</option>
          <option value="en-US">English</option>
        </select>
      </label>
      <TexturePack />
      <ModPacks />
    </header>
  );
}
