# Agent Workflow

## Work Tracking

There is no repo-specific issue tracker convention checked in yet. Use the external tracker or Conductor workspace context when provided. For local collaboration notes, prefer `.context/` because it is gitignored.

If issue labels are introduced later, document the state machine here rather than scattering label meanings across tickets.

## Skill Guidance

- Use `solidjs-best-practices` for Solid component, router, and reactivity work.
- Use `interface-craft` for overlay or fixture UI changes that affect interaction quality.
- Use `test-first-delivery` for behavior changes in transform, primitives, runtime interactions, or plugin contracts.
- Use `proof-repair` for failing tests, browser regressions, clipboard problems, or CI failures.
- Use `contract-review` before broad runtime/API changes.
- Use `repo-context-bootstrap` when these context files drift or are missing.

## Verification Levels

- Transform-only changes: `cd packages/solid-grab && bun test`.
- Primitive/source/snippet changes: `cd packages/solid-grab && bun test`.
- Runtime, overlay, clipboard, drag, freeze, or plugin changes: `bun run test:e2e`.
- Public type/export changes: `bun run check-types`.
- Before handing off larger changes: run the relevant focused tests plus `bun run check-types`.

