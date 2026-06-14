# Changelog

All notable changes to `@dinomem/sdk` will be documented here. This project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html); while we
are pre-1.0, the **minor** version is bumped for breaking changes.

## 0.8.0 — 2026-05-28

### Changed (type-level breaking)

- `MemoryHit.relevance_score` is now typed as `number | null | undefined`
  (previously `number | undefined`). A value of `null` signals that rerank
  was requested but failed (typically a Gemini rate-limit on the backend);
  the raw `score` is **not** a valid substitute for relevance in that case
  and integrations should drop the hit rather than fall back.

  This is a TypeScript-only breaking change — callers that read
  `relevance_score` may now need to handle the `null` case explicitly. No
  runtime behavior of `MemoryStore` itself changed in this release.

### Why

Previously, when rerank hit a rate-limit, the backend silently collapsed
`relevance_score` onto the internal hybrid score (~0.03 typical), with no
error. Downstream integrations comparing against `minScore` would then drop
near-exact matches without any signal that scoring had degraded. The
`null`-on-failure contract makes the degraded state explicit so callers can
react deliberately (retry, fall back, or drop).

### Integration packages

- `@dinomem/claude-agent` and `@dinomem/vercel-ai-provider` now drop hits
  with `relevance_score: null` from injected context. See those packages'
  own release notes for details.
