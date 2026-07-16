# @dinomem/mcp

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
