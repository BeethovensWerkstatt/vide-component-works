# AGENTS.md

Purpose: architecture-specific instructions for coding agents working in vide-component-works.

## Scope

Applies to all files under this directory.

## Architecture

- `src/vide-works.js` owns the Lit SPA state, History API navigation, and views.
- `src/work-data.js` owns API requests and converts API positions into absolute measure spans.
- `src/styles.scss` is the compiled light-DOM stylesheet.
- The custom element accepts `api-base`, `config-src`, inline `config`, and programmatic `config` settings. Attribute configuration takes precedence.

## Change Strategy

- Keep API shape handling in `work-data.js`; UI components consume normalized timeline spans.
- Preserve the translucent, stacking relation regions in the timeline.
- Test API normalization and rendered interaction behavior with Vitest and happy-dom.
- Do not add OpenSeadragon or remote runtime dependencies.

## Validation

Run all of the following before completing component changes:

- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run build`