# @dinomem/cli

One-command setup for [DinoMem](https://dinomem-dashboard.vercel.app) — the memory API for AI agents.

## Usage

In an existing TypeScript or Python project:

```bash
npx @dinomem/cli init
```

The CLI will:

1. Detect whether your project is TypeScript or Python.
2. Install the matching SDK (`@dinomem/sdk` or `dinomem-py`) using your project's package manager (`npm` / `pnpm` / `yarn` / `bun` / `pip` / `uv` / `poetry`).
3. Add `DINOMEM_API_KEY=` to `.env.local` (TS) or `.env` (Python).
4. Append that file to `.gitignore` if it isn't already.
5. Drop an `dinomem-example.{ts,py}` script that does a write + search round-trip.

Then paste your key from [the dashboard](https://dinomem-dashboard.vercel.app) into the env file and run the example.

## Flags

| Flag | Effect |
|---|---|
| `--lang ts\|python` | Force a language; skip detection. |
| `--yes`, `-y` | Skip the confirmation prompt (for CI). |
| `--skip-install` | Don't run `npm install` / `pip install` — just write files. |
| `--help`, `-h` | Print usage. |
| `--version`, `-v` | Print version. |

## What it does *not* do

- It does not create a key for you — you still grab one from the dashboard.
- It does not scaffold a new project. Run it inside an existing repo (`package.json` or `pyproject.toml`).
- It does not modify code outside the env file, gitignore, and one example file. Re-running is safe; existing files are left alone.

## License

[Apache-2.0](../LICENSE)
