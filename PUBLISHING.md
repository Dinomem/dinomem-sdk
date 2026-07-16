# Publishing the DinoMem SDKs

Runbook for (a) the one-time AgentMem → DinoMem republish and (b) every release after it.

## Current state (republish COMPLETE 2026-07-16)

The one-time AgentMem → DinoMem republish below was executed on 2026-07-16.
Parts 1–4 are kept for reference; day-to-day releases use the last section.

| Registry | Package | Published | Status |
|---|---|---|---|
| npm | `@dinomem/*` (all six) | **1.0.0** | live; smoke-tested against the live API |
| npm | `@agentmem/*` (all six) | old versions | **deprecated** with pointer to `@dinomem/*` |
| PyPI | `dinomem-py` | **1.0.0** | live |
| PyPI | `dinomem-crewai` | **1.0.0** | live (`dinomem-py>=1.0.0,<2.0`) |
| PyPI | `agentmem-py` | 0.2.2 | **tombstone** (rename notice + import warning) |
| PyPI | `agentmem-crewai` | 0.1.2 | **tombstone** |
| PyPI | `agentmem` | 0.3.0 — **NOT ours** (Max Goff) | nothing to do |

Still manual/optional: yank old `agentmem-*` releases on pypi.org (web UI);
npm version badge in the README.

Everything published predates the moat: no `checkConflicts`, no bi-temporal
(`atTime`/`getHistory`), no receipts, no CRDT, no batch/scratch. The local
packages in this repo have all of it and are already renamed to `@dinomem/*`.

npm cannot rename a package. The migration is: **publish fresh under
`@dinomem`, deprecate (never unpublish) `@agentmem`**.

---

## Part 1 — One-time setup

### 1.1 Create the `dinomem` npm org

The `@dinomem` scope only exists once an npm org (or user) named `dinomem`
does. Browser only, can't be done from the CLI:

1. Log in at [npmjs.com](https://www.npmjs.com) → avatar → **Add Organization**.
2. Name: `dinomem` (must match the scope exactly). Pick the **free / public
   packages** plan.
3. Add your co-founder as a member (Owner or Admin) so publishing doesn't
   have a bus factor of one.

If the name is somehow taken, stop and rethink the scope before publishing
anything — the README/docs all say `@dinomem/sdk`.

### 1.2 Log in locally

```bash
npm login          # or: npm login --auth-type=web
npm whoami         # sanity check — must print your username
```

If 2FA is set to "Authorization and writes" you'll be prompted for an OTP on
every publish/deprecate. Six packages = six prompts; either keep the
authenticator handy or use an **Automation** granular access token
(`npm config set //registry.npmjs.org/:_authToken=<token>`), which skips OTP.

### 1.3 PyPI accounts + tokens

1. On [pypi.org](https://pypi.org): Account Settings → API tokens → create a
   token (scope: "Entire account" for the first upload of a new project —
   project-scoped tokens can't create projects).
2. Put it in `~/.pypirc`:

   ```ini
   [pypi]
   username = __token__
   password = pypi-...
   ```

3. Install the tooling once: `pipx install build twine` (or `pip install --user build twine`).

---

## Part 2 — Publish `@dinomem/*` to npm

All commands from the repo root (`agentmem-sdk/`). The workspace is already
wired: pnpm workspaces + changesets, `.changeset/config.json` has
`"access": "public"` (required for scoped packages — without it npm assumes
scoped = private and rejects the publish on the free plan).

### 2.1 Decide versions

Recommendation: **take everything to 1.0.0** in one go. `@dinomem/*` are
brand-new names to npm — there is no continuity to preserve — and you're
doing a public launch of a live-verified API. A brand-new package appearing
at 0.8.0 reads as "unfinished". (Conservative alternative: minor-bump
everything, e.g. sdk → 0.9.0, and cut 1.0.0 at launch day.)

### 2.2 Create the changeset

```bash
pnpm changeset
```

- Select **all six** packages (space to toggle, `a` selects all).
- Bump type: `major` (0.x → 1.0.0 is a major).
- Summary, e.g.: `DinoMem 1.0 — rename from @agentmem, full moat surface
  (conflicts dry-run, bi-temporal atTime/history, receipts, CRDT replica/sync,
  batch, scratch)`.

Then apply it:

```bash
pnpm changeset version   # rewrites package.json versions + CHANGELOGs
git diff                 # review: all six at 1.0.0, workspace deps intact
```

Note: the five adapters depend on `"@dinomem/sdk": "workspace:^"`. Leave that
alone — `pnpm publish`/changesets rewrites it to the real version (`^1.0.0`)
in the published tarball automatically.

### 2.3 Build, test, publish

```bash
pnpm install             # refresh lockfile after version bumps
pnpm build
pnpm test
pnpm typecheck
pnpm release             # = pnpm build && changeset publish
```

`changeset publish` publishes every package whose version isn't on the
registry yet (here: all six) and creates git tags.

```bash
git add -A && git commit -m "release: @dinomem/* 1.0.0 — rename + moat surface"
git push --follow-tags
```

### 2.4 Verify

```bash
npm view @dinomem/sdk version            # → 1.0.0
mkdir -p /tmp/dino-smoke && cd /tmp/dino-smoke && npm init -y >/dev/null
npm install @dinomem/sdk
node -e "const {MemoryStore}=require('@dinomem/sdk'); console.log(typeof MemoryStore)"
```

Then run the README quick start against the live backend (write → search →
`checkConflicts` → `getHistory`) with a real API key.

---

## Part 3 — Deprecate `@agentmem/*` on npm

Deprecation keeps existing installs working and shows a warning on new
installs. **Never `npm unpublish`** — it breaks anyone already depending on
the packages, and npm forbids it after 72h anyway.

```bash
npm deprecate @agentmem/sdk                "AgentMem is now DinoMem — install @dinomem/sdk"
npm deprecate @agentmem/mcp                "AgentMem is now DinoMem — install @dinomem/mcp"
npm deprecate @agentmem/cli                "AgentMem is now DinoMem — install @dinomem/cli"
npm deprecate @agentmem/claude-agent       "AgentMem is now DinoMem — install @dinomem/claude-agent"
npm deprecate @agentmem/vercel-ai-provider "AgentMem is now DinoMem — install @dinomem/vercel-ai-provider"
npm deprecate @agentmem/mastra             "AgentMem is now DinoMem — install @dinomem/mastra"
```

(No version range = all versions. Requires owner rights on the old packages
+ OTP per command if 2FA covers writes.)

Verify: `npm view @agentmem/sdk deprecated` prints the message.

---

## Part 4 — Publish to PyPI

> **Gotcha:** `python/dist/` and `crewai/dist/` still contain **stale
> `agentmem_*` artifacts** from the pre-rename builds. Delete them first —
> never upload `dist/*` blindly.

### 4.1 `dinomem-py`

```bash
cd python
rm -rf dist
python -m build            # hatchling backend; produces sdist + wheel
twine check dist/*
twine upload dist/*        # first upload creates the project
```

### 4.2 `dinomem-crewai`

```bash
cd ../crewai
rm -rf dist
python -m build
twine check dist/*
twine upload dist/*
```

### 4.3 Verify

```bash
python3 -m venv /tmp/dino-venv && /tmp/dino-venv/bin/pip install dinomem-py dinomem-crewai
/tmp/dino-venv/bin/python -c "import dinomem_py; print(dinomem_py.__name__)"
```

### 4.4 Tombstone the old PyPI packages

PyPI has no `deprecate` command. Convention is a final "tombstone" release:

For each of `agentmem-py` and `agentmem-crewai`:

1. Bump the patch version (0.2.1 → 0.2.2, 0.1.1 → 0.1.2).
2. Replace the README/`description` with:
   > **This package has been renamed.** AgentMem is now **DinoMem** —
   > install [`dinomem-py`](https://pypi.org/project/dinomem-py/) instead.
   > This package will receive no further updates.
3. Optionally have the module raise/warn on import
   (`warnings.warn("agentmem-py is now dinomem-py", DeprecationWarning)`).
4. `python -m build && twine upload dist/*`.
5. Optionally **yank** the older releases on pypi.org (project → Manage →
   Releases → Yank): pinned installs keep working, but bare
   `pip install agentmem-py` stops resolving to them.

The easiest way to build the tombstones: check out the last pre-rename commit
of this repo (`git log --oneline | grep -i rename` → parent of `45c42cb`) in a
worktree, or just hand-write a minimal package — it's 4 files.

---

## Part 5 — Post-publish checklist

- [ ] `npm install @dinomem/sdk` + quick start passes against the live backend
- [ ] `@dinomem/mcp` works in a real MCP config (Claude Desktop / Claude Code)
- [ ] Backend repo README install instructions resolve (they already say `@dinomem/sdk`)
- [ ] Dashboard **Docs** page install snippets match published names + versions
- [ ] Old-name deprecation warning shows: `npm install @agentmem/sdk` in a scratch dir
- [ ] GitHub repo description/topics on `Dinomem/dinomem-sdk` mention npm + PyPI names
- [ ] Add npm version badge to this repo's README (optional):
      `[![npm](https://img.shields.io/npm/v/%40dinomem%2Fsdk)](https://www.npmjs.com/package/@dinomem/sdk)`
- [ ] `LAUNCH-TODO.md` (backend workspace): tick the SDK-republish item / add if missing

---

## Every release after this one

```bash
pnpm changeset            # describe the change, pick packages + bump
pnpm changeset version    # apply bumps + changelogs
pnpm install && pnpm test
pnpm release              # build + publish anything not yet on the registry
git add -A && git commit -m "release: <summary>" && git push --follow-tags
```

Python packages are versioned by hand in their `pyproject.toml`; rebuild
(`rm -rf dist && python -m build`) and `twine upload dist/*` per package.

Keep the SDK's API surface in lockstep with the backend: if a route ships in
`supabase/functions/api/routes/`, the corresponding client method + types ship
in the same release train, and the backend README API table gets a row.
