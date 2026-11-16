import { displayName, normalizeName, parseStateKey, type BlockState } from "../core/model";

/** Search labels are for discovery; only real block IDs go into the Build palette. */
export function matchingBlockIds(query: string, ids: readonly string[]): string[] {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return [...ids];
  const idNeedle = search.replace(/\s+/g, "_");
  return ids.filter(id =>
    id.toLocaleLowerCase().includes(idNeedle) ||
    displayName({ name: id }).toLocaleLowerCase().includes(search)
  ).sort((a, b) => {
    const aExact = displayName({name:a}).toLocaleLowerCase() === search || a.toLocaleLowerCase() === search || a.toLocaleLowerCase() === "minecraft:" + search;
    const bExact = displayName({name:b}).toLocaleLowerCase() === search || b.toLocaleLowerCase() === search || b.toLocaleLowerCase() === "minecraft:" + search;
    return Number(bExact) - Number(aExact);
  });
}

/**
 * Translating "agua" into minecraft:agua would create a nonexistent block.
 * Explicit namespace / blockstate syntax is an intentional manual override.
 * Plain identifiers are accepted only if they exist in the available catalog.
 */
export function typedBlock(query:string, knownIds:ReadonlySet<string>):{
  state:BlockState; unrecognized:boolean;
}|null {
  const value=query.trim();
  if (!value || /\s/.test(value)) return null;
  const explicit = value.includes(":") || value.includes("[");
  const normalized = normalizeName(value);
  const state = parseStateKey(normalized);
  if(!/^([a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(state.name))return null;
  const known=knownIds.has(state.name);
  if(!known && !explicit)return null;
  return {state,unrecognized:!known};
}
