import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __SOLID_GRAB__?: {
      activate: () => void;
      deactivate: () => void;
      dispose: () => void;
      copyElement: (element: Element) => Promise<boolean>;
      getSource: (element: Element) => Promise<unknown>;
      getState: () => {
        isActive: boolean;
        selectedElements: Element[];
        lastCopySucceeded: boolean | null;
      };
      registerPlugin: (plugin: unknown) => void;
      unregisterPlugin: (name: string) => void;
      getActions: () => Array<{ id: string }>;
      runAction: (id: string, element: Element) => Promise<boolean>;
    };
  }
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3107",
  });
  await page.goto("/");
  await expect(page.getByTestId("nested-card-child")).toBeVisible();
});

test("initializes, copies source context, falls back for plain DOM, and disposes", async ({
  page,
}) => {
  await expect(page.locator("[data-solid-grab-overlay]")).toHaveCount(1);

  const metadata = await page.getByTestId("nested-card-child").evaluate((element) => ({
    component: element.getAttribute("data-solid-grab-component"),
    source: element.getAttribute("data-solid-grab-source"),
  }));
  expect(metadata).toEqual({
    component: "NestedSourceCard",
    source: "src/fixtures/solid-grab-fixtures.tsx",
  });

  await page.evaluate(() => window.__SOLID_GRAB__?.activate());
  await page.getByTestId("nested-card-child").click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Component: NestedSourceCard");

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Source: src/fixtures/solid-grab-fixtures.tsx:");
  expect(copied).toContain('<span data-testid="nested-card-child">Copy nested child source</span>');

  const fallback = await page.evaluate(async () => {
    const element = document.getElementById("manual-plain-dom-anchor");
    if (!element) throw new Error("missing manual plain DOM fallback element");
    await window.__SOLID_GRAB__?.copyElement(element);
    return navigator.clipboard.readText();
  });
  expect(fallback).toContain("Source: unknown source");
  expect(fallback).toContain("Selector: #manual-plain-dom-anchor");
  expect(fallback).toContain("Manual plain DOM fallback anchor");

  const disposed = await page.evaluate(() => {
    const before = document.querySelectorAll("[data-solid-grab-overlay]").length;
    window.__SOLID_GRAB__?.dispose();
    return {
      after: document.querySelectorAll("[data-solid-grab-overlay]").length,
      before,
      hasApi: Boolean(window.__SOLID_GRAB__),
    };
  });
  expect(disposed).toEqual({ after: 0, before: 1, hasApi: false });
});

test("resolves Solid fixture source matrix", async ({ page }) => {
  const sources = await page.evaluate(async () => {
    const ids = [
      "duplicate-card-a-button",
      "duplicate-card-b-button",
      "unexpected-widget-button",
      "children-callback-button",
      "svg-circle",
      "hidden-target",
      "zero-size-target",
    ];
    const output: Record<string, unknown> = {};
    for (const id of ids) {
      const element = document.querySelector(`[data-testid="${id}"]`);
      output[id] = element ? await window.__SOLID_GRAB__?.getSource(element) : null;
    }
    return output as Record<
      string,
      { componentName: string | null; filePath: string | null; lineNumber: number | null } | null
    >;
  });

  expect(sources["duplicate-card-a-button"]?.filePath).toBe("src/fixtures/collisions/a.tsx");
  expect(sources["duplicate-card-b-button"]?.filePath).toBe("src/fixtures/collisions/b.tsx");
  expect(sources["duplicate-card-a-button"]?.componentName).toBe("DuplicateCard");
  expect(sources["duplicate-card-b-button"]?.componentName).toBe("DuplicateCard");
  expect(sources["unexpected-widget-button"]?.filePath).toBe(
    "src/odd-location/unexpected-widget.tsx",
  );
  expect(sources["children-callback-button"]?.componentName).toBe("SolidGrabFixtures");
  expect(sources["svg-circle"]?.componentName).toBe("SvgFixture");
  expect(sources["hidden-target"]?.componentName).toBe("EdgeFallbackFixture");
  expect(sources["zero-size-target"]?.componentName).toBe("EdgeFallbackFixture");
});

test("runs plugin transforms and actions", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const target = document.querySelector('[data-testid="nested-card-child"]');
    if (!target) throw new Error("missing target");

    window.__SOLID_GRAB__?.registerPlugin({
      actions: [
        {
          id: "plugin-copy-marker",
          label: "Marker",
          onAction: (context: {
            context: { componentName: string | null; source: { filePath: string | null } };
            writeText: (content: string) => Promise<boolean>;
          }) =>
            context.writeText(
              `PLUGIN:${context.context.componentName}:${context.context.source.filePath}`,
            ),
        },
      ],
      hooks: {
        transformCopyContent: (content: string) => `${content}\nPLUGIN_TRANSFORM`,
        transformHtmlContent: (html: string) => `${html}\nHTML_TRANSFORM`,
        transformStylesContent: (styles: string) => `${styles}\nSTYLES_TRANSFORM`,
      },
      name: "e2e-plugin",
    });

    await window.__SOLID_GRAB__?.copyElement(target);
    const transformedCopy = await navigator.clipboard.readText();
    await window.__SOLID_GRAB__?.runAction("copy-html", target);
    const htmlCopy = await navigator.clipboard.readText();
    await window.__SOLID_GRAB__?.runAction("copy-styles", target);
    const stylesCopy = await navigator.clipboard.readText();
    await window.__SOLID_GRAB__?.runAction("plugin-copy-marker", target);
    const pluginCopy = await navigator.clipboard.readText();
    const actions = window.__SOLID_GRAB__?.getActions().map((action) => action.id) ?? [];
    window.__SOLID_GRAB__?.unregisterPlugin("e2e-plugin");
    const afterUnregister = window.__SOLID_GRAB__?.getActions().map((action) => action.id) ?? [];

    return { actions, afterUnregister, htmlCopy, pluginCopy, stylesCopy, transformedCopy };
  });

  expect(result.transformedCopy).toContain("PLUGIN_TRANSFORM");
  expect(result.htmlCopy).toContain("HTML_TRANSFORM");
  expect(result.stylesCopy).toContain("STYLES_TRANSFORM");
  expect(result.pluginCopy).toBe("PLUGIN:NestedSourceCard:src/fixtures/solid-grab-fixtures.tsx");
  expect(result.actions).toContain("plugin-copy-marker");
  expect(result.afterUnregister).not.toContain("plugin-copy-marker");
});

test("supports hold activation, drag copy, and animation freeze", async ({ page }) => {
  await page.keyboard.down("Alt");
  await expect
    .poll(() => page.evaluate(() => window.__SOLID_GRAB__?.getState().isActive))
    .toBe(true);
  await page.keyboard.up("Alt");
  await expect
    .poll(() => page.evaluate(() => window.__SOLID_GRAB__?.getState().isActive))
    .toBe(false);

  const freeze = await page.evaluate(async () => {
    const element = document.createElement("div");
    element.style.height = "10px";
    element.style.width = "10px";
    document.body.append(element);
    const animation = element.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(10px)" }],
      {
        duration: 10_000,
        iterations: Infinity,
      },
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const before = animation.playState;
    window.__SOLID_GRAB__?.activate();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const during = animation.playState;
    const hasStyle = Boolean(document.querySelector("[data-solid-grab-freeze]"));
    window.__SOLID_GRAB__?.deactivate();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      after: animation.playState,
      before,
      during,
      hasStyle,
      styleAfter: Boolean(document.querySelector("[data-solid-grab-freeze]")),
    };
  });
  expect(freeze).toEqual({
    after: "running",
    before: "running",
    during: "paused",
    hasStyle: true,
    styleAfter: false,
  });

  await page.evaluate(() => window.__SOLID_GRAB__?.activate());
  const box = await page.getByTestId("list-fixture").boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height - 4, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(async () => ({
        clipboard: await navigator.clipboard.readText(),
        lastCopySucceeded: window.__SOLID_GRAB__?.getState().lastCopySucceeded,
        selectedCount: window.__SOLID_GRAB__?.getState().selectedElements.length ?? 0,
      })),
    )
    .toMatchObject({
      lastCopySucceeded: true,
      selectedCount: 7,
    });

  const dragResult = await page.evaluate(async () => ({
    clipboard: await navigator.clipboard.readText(),
    selectedCount: window.__SOLID_GRAB__?.getState().selectedElements.length,
  }));
  expect(dragResult.selectedCount).toBe(7);
  expect(dragResult.clipboard).toContain("For region North");
  expect(dragResult.clipboard).toContain("---");
  expect(dragResult.clipboard).not.toContain("Selector: #app");
});
