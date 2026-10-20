---
title: "Pusula CLI Plugin System"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Pusula CLI Plugin System

Extend the `pusula` CLI without modifying its core. Plugins follow the `pusula-cmd-*` naming convention, similar to `gh extension` or `kubectl plugin`.

## Quick start

```bash
# Install a plugin from npm
pusula plugin install stripe

# Install a local plugin in development
pusula plugin install ./my-plugin

# List installed plugins
pusula plugin list

# Scaffold a new plugin
pusula plugin scaffold myplugin
cd pusula-cmd-myplugin
pusula plugin install .
```

## Plugin anatomy

A plugin is an npm package named `pusula-cmd-<name>` (or `@scope/pusula-cmd-<name>`).

```
pusula-cmd-myplugin/
├── package.json     # must have "type": "module" and "main": "index.mjs"
├── index.mjs        # exports register(program, ctx) + optional meta
└── README.md
```

### `package.json`

```json
{
  "name": "pusula-cmd-myplugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.mjs",
  "engines": { "pusula": ">=4.0.0" },
  "keywords": ["pusula-plugin", "pusula-cmd"]
}
```

### `index.mjs`

```js
export const meta = {
  name: "myplugin",
  version: "0.1.0",
  description: "My plugin for Pusula",
  pusulaApi: ">=4.0.0",
};

export function register(program, ctx) {
  program
    .command("myplugin")
    .description(meta.description)
    .option("-n, --name <name>")
    .action(async (opts, cmd) => {
      const gOpts = cmd.optsWithGlobals();
      const res = await ctx.apiFetch("/api/combos", {
        baseUrl: gOpts.baseUrl,
        apiKey: gOpts.apiKey,
      });
      const data = await res.json();
      ctx.emit(data, gOpts);
    });
}
```

## Plugin context API

The `ctx` object passed to `register(program, ctx)`:

| Property                     | Type             | Description                                        |
| ---------------------------- | ---------------- | -------------------------------------------------- |
| `ctx.apiFetch(path, opts)`   | `async function` | Authenticated fetch to the Pusula server        |
| `ctx.emit(data, opts)`       | `function`       | Output in table/json/jsonl/csv per `--output` flag |
| `ctx.t(key)`                 | `async function` | i18n translation lookup                            |
| `ctx.withSpinner(label, fn)` | `async function` | Wraps async fn with ora spinner                    |
| `ctx.baseUrl`                | `string`         | Resolved base URL                                  |
| `ctx.apiKey`                 | `string \| null` | API key if provided                                |

## Discovery

Plugins are discovered from:

1. `~/.pusula/plugins/<name>/` — user-local installs
2. `PUSULA_PLUGIN_PATH` env var — custom directory

Both are **CLI-only**. The server-side plugin runtime (the marketplace/`plugin.json`
plugins that run inside the proxy) has its own scanner with its own override,
`PUSULA_PLUGINS_DIR` — see
[PLUGIN_MARKETPLACE.md → Plugin directory](./PLUGIN_MARKETPLACE.md#plugin-directory).
Setting one does not affect the other.

Loading errors are caught and printed as warnings — a broken plugin never crashes the CLI.

## Security

Plugins run with the same Node.js process privileges as `pusula`. Only install plugins from sources you trust. `pusula plugin install` shows an explicit warning and requires `--yes` or interactive confirmation.

## Publishing

1. Ensure `package.json` has `"keywords": ["pusula-plugin"]`
2. `npm publish` as normal
3. Users discover via `pusula plugin search <query>` (searches npm registry)

## Example plugin

See [`examples/pusula-cmd-hello/`](../../examples/pusula-cmd-hello/index.mjs) for a minimal working example with `meta` + `register()`.
