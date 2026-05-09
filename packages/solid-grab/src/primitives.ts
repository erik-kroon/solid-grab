import type {
  GenerateSnippetOptions,
  SolidGrabElementContext,
  SolidGrabSourceInfo,
  SolidGrabStackFrame,
} from "./types.js";
import {
  createHtmlPreview,
  createSelector,
  getComputedStylePreview,
  getTagName,
  getTextPreview,
  isSolidGrabOverlayElement,
} from "./utils/dom.js";

const SOURCE_ATTR = "data-solid-grab-source";
const LINE_ATTR = "data-solid-grab-line";
const COLUMN_ATTR = "data-solid-grab-column";
const COMPONENT_ATTR = "data-solid-grab-component";
const ID_ATTR = "data-solid-grab-id";

const contextCache = new WeakMap<Element, SolidGrabElementContext>();

const readSource = (element: Element): SolidGrabSourceInfo | null => {
  const owner = element.closest(`[${ID_ATTR}]`);
  if (!owner || isSolidGrabOverlayElement(owner)) return null;

  const filePath = owner.getAttribute(SOURCE_ATTR);
  const componentName = owner.getAttribute(COMPONENT_ATTR);
  const lineValue = owner.getAttribute(LINE_ATTR);
  const columnValue = owner.getAttribute(COLUMN_ATTR);
  const metadataId = owner.getAttribute(ID_ATTR);

  if (!filePath && !componentName && !metadataId) return null;

  return {
    filePath: filePath || null,
    lineNumber: lineValue ? Number(lineValue) : null,
    columnNumber: columnValue ? Number(columnValue) : null,
    componentName: componentName || null,
    metadataId: metadataId || null,
  };
};

const stackFromSource = (source: SolidGrabSourceInfo | null): SolidGrabStackFrame[] => {
  if (!source) return [];
  return [
    {
      functionName: source.componentName,
      fileName: source.filePath,
      lineNumber: source.lineNumber,
      columnNumber: source.columnNumber,
    },
  ];
};

const formatStack = (frames: SolidGrabStackFrame[]): string =>
  frames
    .map((frame) => {
      const name = frame.functionName ?? "(anonymous)";
      const file = frame.fileName ?? "(unknown source)";
      const line = frame.lineNumber ? `:${frame.lineNumber}` : "";
      const column = frame.columnNumber ? `:${frame.columnNumber}` : "";
      return `at ${name} (${file}${line}${column})`;
    })
    .join("\n");

export const getSource = async (element: Element): Promise<SolidGrabSourceInfo | null> =>
  readSource(element);

export const getStackContext = async (element: Element): Promise<string> =>
  formatStack(stackFromSource(readSource(element)));

export const getElementContext = async (
  element: Element,
  options: GenerateSnippetOptions = {},
): Promise<SolidGrabElementContext> => {
  const cached = contextCache.get(element);
  if (cached) return cached;

  const source = readSource(element);
  const frames = stackFromSource(source);
  const context: SolidGrabElementContext = {
    element,
    tagName: getTagName(element),
    componentName: source?.componentName ?? null,
    displayName: source?.componentName ?? getTagName(element),
    source: source ?? {
      filePath: null,
      lineNumber: null,
      columnNumber: null,
      componentName: null,
      metadataId: null,
    },
    selector: createSelector(element),
    htmlPreview: createHtmlPreview(element, options.maxHtmlLength),
    textPreview: getTextPreview(element),
    stackString: formatStack(frames),
    stackFrames: frames,
    styles: options.includeStyles ? getComputedStylePreview(element) : {},
    fallbackReason: source
      ? null
      : "No Solid Grab source metadata found on this element or ancestors.",
  };

  contextCache.set(element, context);
  return context;
};

const formatStyles = (styles: Record<string, string>): string => {
  const entries = Object.entries(styles);
  if (entries.length === 0) return "";
  return entries.map(([name, value]) => `${name}: ${value};`).join("\n");
};

export const generateSnippet = async (
  elements: Element[],
  options: GenerateSnippetOptions = {},
): Promise<string[]> => {
  const snippets = await Promise.all(
    elements.map(async (element) => {
      const context = await getElementContext(element, options);
      const sourceLine = context.source.filePath
        ? `${context.source.filePath}${context.source.lineNumber ? `:${context.source.lineNumber}` : ""}`
        : "unknown source";
      const lines = [
        `Solid Grab selection: ${context.displayName ?? context.tagName}`,
        `Source: ${sourceLine}`,
        `Component: ${context.componentName ?? "unknown"}`,
        `Selector: ${context.selector}`,
      ];
      if (context.stackString) lines.push("Stack:", context.stackString);
      if (context.fallbackReason) lines.push(`Fallback: ${context.fallbackReason}`);
      lines.push("HTML:", context.htmlPreview);
      const styles = formatStyles(context.styles);
      if (styles) lines.push("Styles:", styles);
      return lines.join("\n");
    }),
  );
  return snippets;
};

export const createOpenFileUrl = (filePath: string, lineNumber?: number | null): string => {
  const line = lineNumber ? `:${lineNumber}` : "";
  const params = new URLSearchParams({ file: `${filePath}${line}` });
  return `/__open-in-editor?${params.toString()}`;
};

export const openFile = async (
  filePath: string,
  lineNumber?: number | null,
  url = createOpenFileUrl(filePath, lineNumber),
): Promise<boolean> => {
  if (typeof fetch === "undefined" || !filePath) return false;
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
};

let freezeDepth = 0;
let freezeStyle: HTMLStyleElement | null = null;
let pausedAnimations: Animation[] = [];

export const freeze = (): void => {
  freezeDepth += 1;
  if (freezeDepth > 1 || typeof document === "undefined") return;

  freezeStyle = document.createElement("style");
  freezeStyle.setAttribute("data-solid-grab-freeze", "");
  freezeStyle.textContent = `
    *, *::before, *::after {
      animation-play-state: paused !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `;
  document.head.append(freezeStyle);

  const animatedRoot = document.body ?? document.documentElement;
  if (animatedRoot?.getAnimations) {
    pausedAnimations = animatedRoot
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running");
    for (const animation of pausedAnimations) {
      try {
        animation.pause();
      } catch {
        // Ignore browser-specific animation states that cannot be paused.
      }
    }
  }
};

export const unfreeze = (): void => {
  freezeDepth = Math.max(0, freezeDepth - 1);
  if (freezeDepth > 0) return;

  freezeStyle?.remove();
  freezeStyle = null;

  for (const animation of pausedAnimations) {
    try {
      animation.play();
    } catch {
      // Ignore animations that were removed while the page was frozen.
    }
  }
  pausedAnimations = [];
};

export const isFreezeActive = (): boolean => freezeDepth > 0;
