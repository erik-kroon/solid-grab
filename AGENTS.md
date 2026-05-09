# Agent Guidance

This repo is a Bun/Turbo monorepo for `solid-grab`, a dev-only source context grabber for Solid Vite apps.

Start with these files:

- `CONTEXT.md` for domain language, invariants, and known limitations.
- `CONTEXT-MAP.md` for where code and tests live.
- `packages/solid-grab/README.md` for public package behavior.
- `docs/agents/workflow.md` for work tracking and verification conventions.

## Local Commands

- Install dependencies with `bun install`.
- Run all package type checks with `bun run check-types`.
- Run package unit tests with `cd packages/solid-grab && bun test`.
- Run browser coverage with `bun run test:e2e`.
- Run formatting/lint cleanup with `bun run check`.

## Working Rules

- Keep `solid-grab` browser behavior dev-only. The Vite plugin applies only during serve mode, and app imports should stay behind `import.meta.env.DEV`.
- Treat source metadata attributes as the primary contract between the Vite transform and runtime primitives.
- Preserve SSR safety: importing `solid-grab` without `window`/`document` must remain a no-op API.
- Prefer focused tests near the changed behavior: Bun tests for transform/primitives, Playwright for browser overlay, clipboard, activation, drag, and plugin flows.
- Do not add new repo-wide process docs unless they replace or extend the files linked above.

