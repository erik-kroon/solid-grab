# Architecture Decisions

Record durable architecture decisions here when a change affects contracts across the Vite transform, runtime API, primitives, package exports, or fixture app.

Use short ADR files named `YYYY-MM-DD-short-title.md` with:

- Status
- Context
- Decision
- Consequences

Existing implicit decisions worth preserving:

- Solid Grab uses a dev-only Vite transform for source metadata instead of Solid owner graph introspection.
- Browser runtime import is guarded for dev usage, while SSR import returns a no-op API.
- The fixture app and Playwright suite are part of the package behavior contract.

