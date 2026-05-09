# Context Map

## Repo Shape

- `packages/solid-grab`: core package.
- `apps/web`: Solid Vite fixture/demo app used by Playwright.
- `packages/env`: shared environment helper package from the monorepo template.
- `packages/config`: shared TypeScript config.
- `e2e`: Playwright browser tests for Solid Grab behavior.

## Core Package Routing

- `packages/solid-grab/src/vite.ts`: dev-server Vite plugin and TSX source transform.
- `packages/solid-grab/src/index.ts`: browser/SSR initialization, global API, pending plugin registration.
- `packages/solid-grab/src/core/runtime.ts`: overlay UI, activation state, clipboard operations, plugin execution, drag selection, freeze lifecycle.
- `packages/solid-grab/src/core/noop.ts`: SSR/disabled no-op API.
- `packages/solid-grab/src/primitives.ts`: source lookup, stack formatting, snippet generation, open-in-editor URL, freeze helpers.
- `packages/solid-grab/src/types.ts`: public API and plugin contracts.
- `packages/solid-grab/src/utils/dom.ts`: DOM selectors, previews, overlay filtering, style previews.

## Test Routing

- `packages/solid-grab/src/__tests__/vite-transform.test.ts`: transform metadata insertion.
- `packages/solid-grab/src/__tests__/primitives.test.ts`: source lookup and fallback snippets without a browser.
- `e2e/solid-grab.spec.ts`: runtime initialization, clipboard content, fallback DOM, plugin actions, hold activation, drag copy, and freeze behavior.
- `apps/web/src/fixtures`: Solid fixture components used by browser tests.

## Where To Update Context

- Update `CONTEXT.md` when domain terms, invariants, or known limitations change.
- Add ADRs under `docs/adr/` for durable architecture decisions.
- Update `docs/agents/workflow.md` when repo-local verification or work-tracking conventions change.
- Keep package usage details in `packages/solid-grab/README.md`.

