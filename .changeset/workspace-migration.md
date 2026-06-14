---
"@dinomem/sdk": patch
"@dinomem/cli": patch
"@dinomem/mcp": patch
"@dinomem/mastra": patch
"@dinomem/claude-agent": patch
"@dinomem/vercel-ai-provider": patch
---

Migrate the SDK repo to a single pnpm workspace with changesets-managed releases.
Integration packages now reference the core `@dinomem/sdk` via `workspace:^`, which
pnpm rewrites to a concrete `^<version>` at publish time, eliminating the prior
0.7.x/0.8.x version skew. Per-package `package-lock.json` files are replaced by one
root `pnpm-lock.yaml`. No runtime/API changes.
