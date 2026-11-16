import { useMemo, useState } from "react";
import { translate, useLocale } from "../i18n";
import { ALL_COMMON_BLOCKS, BLOCK_GROUPS } from "../core/commonBlocks";
import { groupBlocks } from "../core/blockCatalog";
import { cssColor } from "../core/blockLook";
import { displayName, type BlockState } from "../core/model";
import { matchingBlockIds, typedBlock } from "./blockPickerSearch";
import { useStore } from "../store";
import { IconClose } from "./icons";

interface Props {
  title: string;
  onPick: (state: BlockState) => void;
  onClose: () => void;
}

/**
 * Browse-or-type block chooser. The typed field takes a full blockstate string
 * so `oak_stairs[facing=east,half=top]` works, not just plain ids.
 */
export function BlockPicker({ title, onPick, onClose }: Props) {
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const build = useStore((s) => s.build);
  const revision = useStore((s) => s.revision);
  const packBlocks = useStore((s) => s.packBlocks);
  const modBlocks = useStore((s) => s.modBlocks);

  const inBuild = useMemo(() => {
    void revision;
    if (!build) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = 1; i < build.palette.length; i++) {
      const name = build.palette[i].name;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out.sort();
  }, [build, revision]);

  /**
   * The curated groups first, then every other block the pack knows about,
   * sorted into groups of its own. The curated set reads like a builder's
   * shelf — stone, wood, wool — and the rest is the long tail a hand-written list
   * always misses: every wall, gate, trapdoor and button in the game.
   *
   * A catalogue group that shares a curated group's name joins it rather than
   * appearing again further down, so there is one Walls group holding every wall
   * rather than the two dozen that were curated and the ones that were not.
   */
  const catalogue = useMemo(() => {
    if (packBlocks.length === 0) return BLOCK_GROUPS;
    const out = BLOCK_GROUPS.map((group) => ({ name: group.name, blocks: [...group.blocks] }));
    const byName = new Map(out.map((group) => [group.name, group]));
    for (const group of groupBlocks(packBlocks, new Set(ALL_COMMON_BLOCKS))) {
      const existing = byName.get(group.name);
      if (existing) existing.blocks.push(...group.blocks);
      else out.push(group);
    }
    return out;
  }, [packBlocks]);

  /**
   * Each mod keeps its own run of groups under its own heading, below the
   * vanilla shelf. Folding a thousand modded blocks into the vanilla groups
   * would bury the blocks most builds are actually made of, and a mod's own
   * palette is usually what you are reaching for when you reach for it at all.
   */
  const modCatalogue = useMemo(
    () =>
      modBlocks.flatMap((mod) =>
        groupBlocks(mod.blocks).map((group) => ({
          name: `${mod.label} · ${group.name}`,
          blocks: group.blocks,
        })),
      ),
    [modBlocks],
  );

  const knownIds = useMemo(() => new Set([
    ...catalogue.flatMap(group => group.blocks),
    ...modCatalogue.flatMap(group => group.blocks),
  ]), [catalogue, modCatalogue]);

  const groups = useMemo(() => {
    // Search real catalogue entries first. A legacy invalid block in a
    // schematic (e.g. minecraft:agua) must not outrank minecraft:water.
    const used = { name: "Already in this build", blocks: inBuild };
    const all = query.trim()
      ? [...catalogue, ...modCatalogue, used]
      : [used, ...catalogue, ...modCatalogue];
    if (!query.trim()) return all;
    return all
      .map((group) => ({
        name: group.name,
        blocks: matchingBlockIds(query, group.blocks),
      }))
      .filter((group) => group.blocks.length > 0);
  }, [query, inBuild, catalogue, modCatalogue, locale]);

  const typed = query.trim();
  const custom = typedBlock(typed,knownIds);
  const exactMatch = groups.some(group => group.blocks.some(id =>
    displayName({name:id}).toLocaleLowerCase() === typed.toLocaleLowerCase() ||
    id.toLocaleLowerCase() === typed.toLocaleLowerCase() ||
    id.toLocaleLowerCase() === `minecraft:${typed.toLocaleLowerCase()}`
  ));

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <span className="eyebrow">{title}</span>
          <input
            className="search"
            autoFocus
            value={query}
            placeholder="Search, or type a block id such as oak_stairs[facing=east]"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (exactMatch) {
                  const id = groups.flatMap(group => group.blocks).find(id =>
                    displayName({name:id}).toLocaleLowerCase() === typed.toLocaleLowerCase() ||
                    id.toLocaleLowerCase() === typed.toLocaleLowerCase() ||
                    id.toLocaleLowerCase() === `minecraft:${typed.toLocaleLowerCase()}`
                  );
                  if (id) onPick({name:id});
                } else if(custom) onPick(custom.state);
              }
              if (e.key === "Escape") onClose();
            }}
          />
          <button className="btn" onClick={onClose} title="Close" aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="picker-body">
          {custom && !exactMatch && groups.every((g) => !g.blocks.includes(custom.state.name)) && (
            <div className="picker-group">
              <div className="eyebrow">{custom.unrecognized ? "ID personalizado no reconocido — puede no existir" : "Usar identificador con propiedades"}</div>
              <div className="picker-grid">
                <BlockButton state={custom.state} onPick={onPick} />
              </div>
            </div>
          )}

          {groups.map((group) => (
            <div className="picker-group" key={group.name}>
              <div className="eyebrow">{translate(group.name)}</div>
              <div className="picker-grid">
                {group.blocks.map((id) => (
                  <BlockButton key={group.name + id} state={{ name: id }} onPick={onPick} />
                ))}
              </div>
            </div>
          ))}

          {groups.length === 0 && !custom && (
            <p style={{ color: "var(--mute)" }}>
              No se encontró «{query}». Buscá por nombre traducido o escribí un ID completo como minecraft:water.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockButton({ state, onPick }: { state: BlockState; onPick: (s: BlockState) => void }) {
  return (
    <button className="picker-item" onClick={() => onPick(state)} title={state.name}>
      <i className="swatch" style={{ background: cssColor(state) }} />
      <span>{displayName(state)}</span>
    </button>
  );
}
