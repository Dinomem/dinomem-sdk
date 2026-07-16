# Changelog

## 1.0.0

### Major Changes

- DinoMem 1.0 — rename from @agentmem, full moat surface (conflicts dry-run, bi-temporal atTime/history, receipts, CRDT replica/sync, batch, scratch)

### Patch Changes

- 01d3db9: Migrate the SDK repo to a single pnpm workspace with changesets-managed releases.
  Integration packages now reference the core `@dinomem/sdk` via `workspace:^`, which
  pnpm rewrites to a concrete `^<version>` at publish time, eliminating the prior
  0.7.x/0.8.x version skew. Per-package `package-lock.json` files are replaced by one
  root `pnpm-lock.yaml`. No runtime/API changes.
- Updated dependencies
- Updated dependencies [01d3db9]
  - @dinomem/sdk@1.0.0

All notable changes to `@dinomem/vercel-ai-provider` will be documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html);
while we are pre-1.0, the **minor** version is bumped for breaking changes.

## 0.2.0 — 2026-05-28

### Changed (behavior breaking)

- `searchMemories` and `retrieveMemories` now **always drop hits where
  `relevance_score` is `null`**, regardless of `minScore`. Previously, when
  `minScore` was `0` (the default), all hits were returned — including ones
  where rerank had failed and `relevance_score` was `null`.

  This aligns the package with `@dinomem/claude-agent`, which has always
  dropped null-relevance hits unconditionally.

### Why

A `null` `relevance_score` signals that rerank was requested but failed
(typically a Gemini rate-limit on the backend). The previous behavior left
callers with hits whose only score was the raw hybrid `score` — a different
range and different semantics. Mixing the two is how the rerank
silent-degrade bug surfaced in the first place. "No signal" is safer than
"wrong signal."

### Bumped

- Requires `@dinomem/sdk` `^0.8.0` (was `^0.7.0`) — see that package's
  `CHANGELOG.md` for the type-level change to `MemoryHit.relevance_score`.
