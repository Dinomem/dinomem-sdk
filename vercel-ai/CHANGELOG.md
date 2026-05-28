# Changelog

All notable changes to `@agentmem/vercel-ai-provider` will be documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html);
while we are pre-1.0, the **minor** version is bumped for breaking changes.

## 0.2.0 — 2026-05-28

### Changed (behavior breaking)

- `searchMemories` and `retrieveMemories` now **always drop hits where
  `relevance_score` is `null`**, regardless of `minScore`. Previously, when
  `minScore` was `0` (the default), all hits were returned — including ones
  where rerank had failed and `relevance_score` was `null`.

  This aligns the package with `@agentmem/claude-agent`, which has always
  dropped null-relevance hits unconditionally.

### Why

A `null` `relevance_score` signals that rerank was requested but failed
(typically a Gemini rate-limit on the backend). The previous behavior left
callers with hits whose only score was the raw hybrid `score` — a different
range and different semantics. Mixing the two is how the rerank
silent-degrade bug surfaced in the first place. "No signal" is safer than
"wrong signal."

### Bumped

- Requires `@agentmem/sdk` `^0.8.0` (was `^0.7.0`) — see that package's
  `CHANGELOG.md` for the type-level change to `MemoryHit.relevance_score`.
