# Context

## Product

Solid Grab is a development-only source context grabber for Solid Vite apps. It lets a developer activate an overlay, point at rendered DOM, and copy source/component context for the selected element.

The package is currently private and exported from `packages/solid-grab`.

## Domain Terms

- **Vite transform**: `solidGrab()` in `packages/solid-grab/src/vite.ts`. It annotates intrinsic JSX DOM elements before Solid compiles JSX.
- **Source metadata**: `data-solid-grab-*` attributes injected by the transform, including component name, source path, line, column, and stable metadata id.
- **Runtime**: browser overlay and interaction controller in `packages/solid-grab/src/core/runtime.ts`.
- **Primitives**: source/context/snippet helpers in `packages/solid-grab/src/primitives.ts`. These are usable independently of the overlay.
- **Fallback context**: selector, HTML preview, text preview, and optional styles used when no source metadata exists.
- **Freeze**: temporary pausing of CSS transitions and Web Animations while the grab overlay is active.
- **Plugin**: extension object that can transform copied content, override open-file behavior, and contribute toolbar actions.

## Behavior Contract

- The package must be safe to import during SSR. Without browser globals it returns a no-op API.
- Production app bundles should not include Solid Grab runtime or metadata strings.
- Selecting an unannotated child should resolve to the nearest annotated ancestor.
- DOM outside transformed TSX should degrade to fallback context instead of failing.
- The overlay must ignore its own Shadow DOM and not select Solid Grab UI elements.
- Clipboard, activation, drag multi-select, plugin hooks, and animation freeze are user-visible flows and need browser coverage when changed.

## Known Limitations

- Stack frames are metadata-derived rather than Solid owner graph stacks.
- Source line points to the JSX element opening tag, not necessarily the component function.
- Dynamic component tags only resolve when the rendered intrinsic receives transformed props.
- The current overlay is intentionally minimal; context menus and prompt/comment mode are future work.
- Solid reactive graph updates are not paused. Freeze only stabilizes common visual motion.

