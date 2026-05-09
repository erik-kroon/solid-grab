# Solid Grab

Dev-only source context grabber for Solid Vite apps.

Solid Grab lets you point at rendered Solid UI, copy the relevant source context, and paste it into a coding agent. It is a Solid-first port of the React Grab workflow: browser overlay, element selection, source hints, snippets, and plugin hooks, with Solid-specific dev metadata instead of React fiber introspection.

## Install

```sh
bun add -d solid-grab
```

## Vite Setup

```ts
// vite.config.ts
import { solidGrab } from "solid-grab/vite";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [solidGrab(), solid()],
});
```

Add the runtime only in development:

```ts
// src/main.tsx
if (import.meta.env.DEV) {
  void import("solid-grab");
}
```

## How It Works

`solidGrab()` is a dev-server-only Vite plugin. Before Solid compiles JSX, it annotates intrinsic JSX DOM nodes inside uppercase component functions with:

- component name
- source file path
- JSX line and column
- stable metadata id

At runtime, Solid Grab resolves a selected DOM node to the nearest annotated ancestor. If no metadata exists, it falls back to selector, HTML preview, and text context.

## Usage

Start your app, then use the overlay:

- Click the bottom **Grab** toolbar button, or hold `Alt`.
- Hover an element to see its label/source hint.
- Click an element to copy Solid context.
- Press `C` while active to copy the current target.
- Press `Escape` to exit.
- Drag across elements to copy joined snippets.

The runtime exposes `window.__SOLID_GRAB__`.

## Runtime API

```ts
import {
  init,
  getGlobalApi,
  registerPlugin,
  unregisterPlugin,
} from "solid-grab";

import {
  getElementContext,
  generateSnippet,
  getSource,
  getStackContext,
  openFile,
  freeze,
  unfreeze,
  isFreezeActive,
} from "solid-grab/primitives";
```

Available API methods:

- `init()`
- `dispose()`
- `activate()`
- `deactivate()`
- `toggle()`
- `copyElement(element)`
- `getSource(element)`
- `getStackContext(element)`
- `getState()`
- `setOptions(options)`
- `registerPlugin(plugin)`
- `unregisterPlugin(name)`
- `getPlugins()`
- `getActions()`
- `runAction(id, element)`

SSR imports are safe no-ops and do not touch `window` or `document`.

## Plugins

```ts
import { registerPlugin } from "solid-grab";

registerPlugin({
  name: "my-plugin",
  hooks: {
    transformCopyContent: (content) => `${content}\n\nExtra context`,
  },
  actions: [
    {
      id: "copy-marker",
      label: "Marker",
      onAction: (ctx) =>
        ctx.writeText(
          `${ctx.context.componentName}:${ctx.context.source.filePath}`,
        ),
    },
  ],
});
```

Built-in actions include copy, open in editor, copy HTML, and copy styles.

## Known Limitations

- Source frames are metadata-derived, not Solid runtime owner stacks.
- Line numbers point to JSX opening tags, not necessarily component functions.
- Dynamic components resolve only when rendered intrinsic DOM receives transformed metadata.
- Solid's reactive graph is not paused. Solid Grab freezes common visual motion, CSS transitions, and WAAPI animations while active.
- The overlay is intentionally smaller than React Grab: no full context menu and no prompt/comment mode yet.

## Development

```sh
bun install
bun run check-types
bun run build
bun run test:e2e
```

Run the fixture app:

```sh
bun run dev:web
```

## Package Layout

- `packages/solid-grab` - runtime, primitives, Vite plugin, tests
- `apps/web` - Solid fixture app
- `e2e` - Playwright coverage for init, selection, copy, plugins, fixtures, and disposal

## License

MIT
