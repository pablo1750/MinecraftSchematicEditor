import { useStore } from "../store";
import { translate } from "../i18n";
import { IconFrame } from "./icons";
import { TOOLS } from "./tools";

export function ToolRail() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const clip = useStore((s) => s.clip);

  return (
    <nav className="rail" aria-label="Tools">
      {TOOLS.map(({ id, key, label, blurb, icon: Icon }) => (
        <button
          key={id}
          className="rail-btn"
          data-active={tool === id}
          data-empty={id === "clone" && !clip}
          onClick={() => setTool(id)}
          title={`${translate(label)} — ${translate(blurb)}  (${key})`}
          aria-pressed={tool === id}
        >
          <Icon size={18} />
          <span className="rail-key">{key}</span>
        </button>
      ))}

      <div className="rail-divider" />

      <div className="rail-divider" />

      <button
        className="rail-btn"
        onClick={() => useStore.getState().frameBuild()}
        title="Fit the build to the view  (F)"
      >
        <IconFrame size={18} />
        <span className="rail-key">F</span>
      </button>
    </nav>
  );
}
