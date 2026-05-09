# Solid Grab

Dev-only source context grabber for Solid Vite apps.

## Vite Setup

```ts
// vite.config.ts
import { solidGrab } from "solid-grab/vite";
import solid from "vite-plugin-solid";

export default {
  plugins: [solidGrab(), solid()],
};
```

```ts
// browser entry
if (import.meta.env.DEV) {
  void import("solid-grab");
}
```

The Vite plugin runs only in dev server mode. It annotates intrinsic JSX DOM nodes
with `data-solid-grab-*` source metadata before Solid compiles JSX. Production
builds should omit the browser import behind `import.meta.env.DEV`; the fixture
production build currently contains no Solid Grab runtime or metadata strings.

## Runtime API

`import "solid-grab"` initializes the browser runtime when `window` and
`document` exist, unless `window.__SOLID_GRAB_DISABLED__` is set.

The runtime exposes `window.__SOLID_GRAB__` with:

- `init`, `dispose`, `activate`, `deactivate`, `toggle`
- `copyElement`, `getSource`, `getStackContext`
- `getState`, `setOptions`
- `registerPlugin`, `unregisterPlugin`
- `getActions`, `runAction`

SSR imports are no-op and do not touch browser globals.

Primitive exports are available from `solid-grab/primitives`:

- `getElementContext`
- `generateSnippet`
- `getSource`
- `getStackContext`
- `openFile`
- `freeze`, `unfreeze`, `isFreezeActive`

## Current Metadata Strategy

Solid Grab v0 uses a dev-only Vite transform instead of Solid owner graph
introspection. For each intrinsic JSX DOM element inside an uppercase component
function, it injects:

- component name
- source file path
- source line and column of the JSX opening tag
- stable metadata id

Selecting a child DOM node resolves to the nearest annotated ancestor. Plain DOM,
third-party DOM, SVG without annotations, and nodes outside transformed TSX fall
back to selector, HTML preview, and text context.

Interaction coverage:

- toolbar/API toggle activation
- Alt hold activation
- hover highlight and source label
- click-to-copy
- keyboard copy with `C`
- Escape exit
- drag multi-select with joined snippets
- Shadow DOM overlay self-filtering
- CSS transition and WAAPI animation freeze while active

Known limitations:

- Stack frames are metadata-derived, not Solid runtime owner stacks.
- Dynamic component tags only resolve when the rendered intrinsic receives
  transformed props.
- Source line points to the JSX element, not necessarily the component function.
- The overlay is intentionally minimal compared with React Grab: no canvas
  easing, no context menu, and no comment/prompt mode yet.
- Solid's reactive graph is not paused. The current freeze layer stabilizes
  common visual motion but does not buffer signal/store updates.
- Plugin support currently covers registration, copy/html/styles/open hooks,
  contributed actions, and toolbar action buttons. A full context menu and
  prompt/comment mode are still future work.
