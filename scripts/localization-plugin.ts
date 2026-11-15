/**
 * Localización de textos JSX con TypeScript AST durante Vite.
 *
 * El código y las identificaciones originales se conservan en los fuentes.
 * Solo se reemplazan textos que existen explícitamente en ui-es.json.
 * Jamás se modifican IDs, eventos, claves de almacenamiento o NBT.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Plugin } from "vite";

const sourceRoot = path.resolve("src");
const translationFile = path.join(sourceRoot, "i18n/ui-es.json");

export function localizationPlugin(): Plugin {
  return {
    name: "minecraft-ui-localization",
    enforce: "pre",
    transform(source, id) {
      const file = id.split("?")[0];
      if (!file.endsWith(".tsx") || !file.startsWith(sourceRoot + path.sep)) return null;
      if (file.includes(path.sep + "i18n" + path.sep)) return null;
      const dictionary = JSON.parse(readFileSync(translationFile, "utf8")) as Record<string, string>;
      const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let changed = 0;

      const call = (name: "__tr" | "__trText", value: string) =>
        ts.factory.createCallExpression(ts.factory.createIdentifier(name), undefined, [ts.factory.createStringLiteral(value)]);

      const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
        const visit = (node: ts.Node, insideJsx = false): ts.Node => {
          if (ts.isJsxText(node)) {
            const literal = node.getText(sf);
            if (Object.hasOwn(dictionary, literal.trim())) {
              changed++;
              return ts.factory.createJsxExpression(undefined, call("__trText", literal));
            }
            return node;
          }

          if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
            const text = node.initializer.text;
            if (Object.hasOwn(dictionary, text)) {
              changed++;
              return ts.factory.updateJsxAttribute(node, node.name,
                ts.factory.createJsxExpression(undefined, call("__tr", text)));
            }
          }

          // Traducir también expresiones visuales (ternarios de botones,
          // textos de títulos, etc.) sin alterar cadenas usadas en la lógica.
          if (insideJsx && ts.isStringLiteral(node) && Object.hasOwn(dictionary, node.text)) {
            changed++;
            return call("__tr", node.text);
          }
          if (ts.isJsxExpression(node)) {
            return ts.visitEachChild(node, (child) => visit(child, true), context);
          }
          return ts.visitEachChild(node, (child) => visit(child, insideJsx), context);
        };
        return (root) => ts.visitNode(root, (node) => visit(node)) as ts.SourceFile;
      };

      const result = ts.transform(sf, [transformer]);
      try {
        if (!changed) return null;
        const generated = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result.transformed[0]);
        let importPath = path.relative(path.dirname(file), path.join(sourceRoot, "i18n/index")).replaceAll(path.sep, "/");
        if (!importPath.startsWith(".")) importPath = "./" + importPath;
        return {
          code: `import { translate as __tr, translateText as __trText } from "${importPath}";\n${generated}`,
          map: null,
        };
      } finally {
        result.dispose();
      }
    },
  };
}
