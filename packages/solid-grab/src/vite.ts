import ts from "typescript";
import type { Plugin } from "vite";

interface SolidGrabViteOptions {
  include?: RegExp;
  exclude?: RegExp;
}

const DEFAULT_INCLUDE = /\.[jt]sx$/;
const DEFAULT_EXCLUDE = /node_modules|\.solid-grab\./;

const SOURCE_ATTRS = new Set([
  "data-solid-grab-id",
  "data-solid-grab-source",
  "data-solid-grab-line",
  "data-solid-grab-column",
  "data-solid-grab-component",
]);

const isUppercaseName = (name: string | undefined): name is string =>
  Boolean(name && name[0] === name[0]?.toUpperCase());

const intrinsicTagName = (tagName: ts.JsxTagNameExpression): string | null => {
  if (!ts.isIdentifier(tagName)) return null;
  const text = tagName.text;
  return text[0] === text[0]?.toLowerCase() ? text : null;
};

const hasSolidGrabAttr = (attributes: ts.JsxAttributes): boolean =>
  attributes.properties.some(
    (prop) =>
      ts.isJsxAttribute(prop) && ts.isIdentifier(prop.name) && SOURCE_ATTRS.has(prop.name.text),
  );

const escapeAttr = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const hash = (value: string): string => {
  let next = 2166136261;
  for (let index = 0; index < value.length; index++) {
    next ^= value.charCodeAt(index);
    next = Math.imul(next, 16777619);
  }
  return (next >>> 0).toString(36);
};

const normalizePath = (value: string): string => value.replace(/\\/g, "/");

const relativePath = (root: string, filePath: string): string => {
  const normalizedRoot = normalizePath(root).replace(/\/$/, "");
  const normalizedFile = normalizePath(filePath);
  if (normalizedFile.startsWith(`${normalizedRoot}/`)) {
    return normalizedFile.slice(normalizedRoot.length + 1);
  }
  return normalizedFile;
};

const insertPosition = (
  source: string,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
): number => {
  const end = node.end;
  return source[end - 2] === "/" ? end - 2 : end - 1;
};

export const transformSolidGrabSource = (code: string, id: string, root: string): string | null => {
  const sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relativeFile = relativePath(root, id);
  const fileHash = hash(relativeFile);
  const inserts: Array<{ pos: number; text: string }> = [];
  let counter = 0;

  const visit = (node: ts.Node, componentName: string | null): void => {
    let activeComponent = componentName;

    if (ts.isFunctionDeclaration(node) && isUppercaseName(node.name?.text)) {
      activeComponent = node.name.text;
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      isUppercaseName(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      activeComponent = node.name.text;
    }

    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      activeComponent &&
      intrinsicTagName(node.tagName) &&
      !hasSolidGrabAttr(node.attributes)
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      counter += 1;
      const metadataId = `${fileHash}-${counter}`;
      inserts.push({
        pos: insertPosition(code, node),
        text:
          ` data-solid-grab-id="${metadataId}"` +
          ` data-solid-grab-component="${escapeAttr(activeComponent)}"` +
          ` data-solid-grab-source="${escapeAttr(relativeFile)}"` +
          ` data-solid-grab-line="${position.line + 1}"` +
          ` data-solid-grab-column="${position.character + 1}"`,
      });
    }

    ts.forEachChild(node, (child) => visit(child, activeComponent));
  };

  visit(sourceFile, null);
  if (inserts.length === 0) return null;

  let transformed = code;
  for (const insert of inserts.sort((a, b) => b.pos - a.pos)) {
    transformed = `${transformed.slice(0, insert.pos)}${insert.text}${transformed.slice(insert.pos)}`;
  }
  return transformed;
};

export const solidGrab = (options: SolidGrabViteOptions = {}): Plugin => {
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  let root = "";

  return {
    name: "solid-grab",
    enforce: "pre",
    apply: "serve",
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      const cleanId = id.split("?")[0] ?? id;
      if (!include.test(cleanId) || exclude.test(cleanId)) return null;
      const transformed = transformSolidGrabSource(code, cleanId, root);
      return transformed ? { code: transformed, map: null } : null;
    },
  };
};

export default solidGrab;
