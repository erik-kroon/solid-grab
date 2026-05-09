import { beforeAll, describe, expect, test } from "bun:test";

import { generateSnippet, getElementContext, getSource } from "../primitives";

class FakeElement {
  tagName: string;
  nodeType = 1;
  parentElement: FakeElement | null = null;
  children: FakeElement[] = [];
  textContent: string;
  outerHTML: string;
  private attrs = new Map<string, string>();

  constructor(tagName: string, attrs: Record<string, string> = {}, textContent = "") {
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    for (const [name, value] of Object.entries(attrs)) this.attrs.set(name, value);
    const attrText = Object.entries(attrs)
      .map(([name, value]) => `${name}="${value}"`)
      .join(" ");
    this.outerHTML = `<${tagName}${attrText ? ` ${attrText}` : ""}>${textContent}</${tagName}>`;
  }

  append(child: FakeElement): void {
    child.parentElement = this;
    this.children.push(child);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  closest(selector: string): FakeElement | null {
    const attr = selector.match(/^\[([^\]]+)\]$/)?.[1];
    if (!attr) return null;
    if (this.attrs.has(attr)) return this;
    return this.parentElement?.closest(selector) ?? null;
  }
}

beforeAll(() => {
  Object.assign(globalThis, {
    Node: { ELEMENT_NODE: 1 },
    CSS: { escape: (value: string) => value },
  });
});

describe("solid-grab primitives", () => {
  test("returns metadata from the nearest annotated ancestor", async () => {
    const section = new FakeElement("section", {
      "data-solid-grab-id": "fixture-1",
      "data-solid-grab-component": "FixtureCard",
      "data-solid-grab-source": "src/fixtures/card.tsx",
      "data-solid-grab-line": "12",
      "data-solid-grab-column": "5",
    });
    const span = new FakeElement("span", { "data-testid": "child" }, "Nested child");
    section.append(span);

    const source = await getSource(span as unknown as Element);

    expect(source).toEqual({
      filePath: "src/fixtures/card.tsx",
      lineNumber: 12,
      columnNumber: 5,
      componentName: "FixtureCard",
      metadataId: "fixture-1",
    });
  });

  test("formats deterministic fallback snippets without metadata", async () => {
    const div = new FakeElement("div", { id: "plain-node" }, "Plain fallback");

    const context = await getElementContext(div as unknown as Element);
    const [snippet] = await generateSnippet([div as unknown as Element]);

    expect(context.source.filePath).toBeNull();
    expect(context.fallbackReason).toContain("No Solid Grab source metadata");
    expect(snippet).toContain("Source: unknown source");
    expect(snippet).toContain("Selector: #plain-node");
    expect(snippet).toContain('<div id="plain-node">Plain fallback</div>');
  });
});
