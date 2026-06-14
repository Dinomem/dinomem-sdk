# Changelog

All notable changes to `@dinomem/claude-agent` will be documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html);
while we are pre-1.0, the **minor** version is bumped for breaking changes.

## 0.1.2 — 2026-05-28

### Bumped

- Requires `@dinomem/sdk` `^0.8.0` (was `^0.7.0`). No behavior change in
  this package — the recall hook already dropped hits with
  `relevance_score: null` unconditionally. See
  [`@dinomem/sdk` CHANGELOG](../typescript/CHANGELOG.md) for the
  underlying type-level change.
