const PREVIEW_ATTRS = ["id", "class", "role", "aria-label", "data-testid", "href", "type"];

const escapeSelectorValue = (value: string): string => {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
};

export const getTagName = (element: Element): string => element.tagName.toLowerCase();

export const isSolidGrabOverlayElement = (element: Element | null): boolean =>
  Boolean(element?.closest?.("[data-solid-grab-overlay]"));

export const createSelector = (element: Element): string => {
  const id = element.getAttribute("id");
  if (id) return `#${escapeSelectorValue(id)}`;

  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${escapeSelectorValue(testId)}"]`;

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
    const tag = getTagName(current);
    const currentId = current.getAttribute("id");
    if (currentId) {
      parts.unshift(`${tag}#${escapeSelectorValue(currentId)}`);
      break;
    }

    let segment = tag;
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child): child is Element => getTagName(child) === tag,
      );
      if (siblings.length > 1) {
        segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(segment);
    current = parent;
  }

  return parts.join(" > ");
};

export const createHtmlPreview = (element: Element, maxLength = 700): string => {
  const tag = getTagName(element);
  const attrs: string[] = [];

  for (const attrName of PREVIEW_ATTRS) {
    const value = element.getAttribute(attrName);
    if (!value) continue;
    const clipped = value.length > 80 ? `${value.slice(0, 77)}...` : value;
    attrs.push(`${attrName}="${clipped.replace(/"/g, "&quot;")}"`);
  }

  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  const clippedText = text.length > 160 ? `${text.slice(0, 157)}...` : text;
  const open = attrs.length > 0 ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
  const preview = clippedText ? `${open}${clippedText}</${tag}>` : element.outerHTML;
  return preview.length > maxLength ? `${preview.slice(0, maxLength - 3)}...` : preview;
};

export const getTextPreview = (element: Element): string | null => {
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
};

export const getComputedStylePreview = (element: Element): Record<string, string> => {
  if (typeof window === "undefined" || !window.getComputedStyle) return {};
  const computed = window.getComputedStyle(element);
  const names = [
    "display",
    "position",
    "color",
    "background-color",
    "font-size",
    "font-weight",
    "padding",
    "margin",
    "border",
    "border-radius",
  ];
  const styles: Record<string, string> = {};
  for (const name of names) {
    const value = computed.getPropertyValue(name);
    if (value) styles[name] = value;
  }
  return styles;
};
