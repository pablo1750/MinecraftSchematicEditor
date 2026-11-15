import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Traduce únicamente textos estáticos en JSX y atributos de presentación.
 * No modifica los nombres de bloques, enums, rutas, filtros, nombres de archivo
 * ni identificadores internos usados por Minecraft.
 *
 * La interfaz mantiene las fuentes inglesas y la traducción se evalúa al render.
 */
export function localizationPlugin() {
  const sourceRoot = path.resolve("src");
  const dictionaryPath = path.join(sourceRoot, "i18n/ui-es.json");
  const supportedAttributes = /\b(title|placeholder|aria-label|alt|help|description|label)\s*=\s*"([^"\n]*)"/g;
  const jsxText = />([^<>{}]+)</g;

  return {
    name: "minecraft-ui-localization",
    enforce: "pre",
    transform(source, id) {
      const file = id.split("?")[0];
      if (!file.endsWith(".tsx") || !file.startsWith(sourceRoot + path.sep)) return null;
      if (file.includes(path.sep + "i18n" + path.sep)) return null;
      const dictionary = JSON.parse(readFileSync(dictionaryPath, "utf8"));
      let replacements = 0;

      let code = source.replace(supportedAttributes, (original, name, value) => {
        if (!Object.hasOwn(dictionary, value)) return original;
        replacements++;
        return name + "={__tr(" + JSON.stringify(value) + ")}";
      });

      // Se procesa por texto completo entre tags: cualquier sección con JSX
      // dinámico se deja tal cual para no intervenir en lógica condicional.
      code = code.replace(jsxText, (original, value) => {
        if (!Object.hasOwn(dictionary, value.trim().replace(/\s+/g, " "))) return original;
        replacements++;
        return ">{__trText(" + JSON.stringify(value) + ")}<";
      });

      if (replacements === 0) return null;
      let relative = path.relative(path.dirname(file), path.join(sourceRoot, "i18n/index"))
        .replaceAll(path.sep, "/");
      if (!relative.startsWith(".")) relative = "./" + relative;
      return {
        code: "import { translate as __tr, translateText as __trText } from " +
          JSON.stringify(relative) + ";\n" + code,
        map: null,
      };
    },
  };
}
