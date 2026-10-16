# Osiris desktop (Electron)

Portable desktop builds wrap the same Next.js server used for local development. The Electron shell starts a child Node process, waits for `/api/health`, then loads the app in a native window.

## Prerequisites

- **Node.js 22+** on your PATH for development and for running pack scripts (the packaged app bundles its own Node runtime).
- Repository dependencies installed: `npm install`.

## Development

Run the Next.js dev server and the Electron shell in **two terminals** from the repo root:

| Terminal | Command |
|----------|---------|
| A | `npm run dev` |
| B | `npm run desktop:dev` |

Terminal B sets `OSIRIS_DESKTOP_DEV=1` and opens a window pointed at `http://127.0.0.1:3000` (override with `OSIRIS_DEV_URL` if needed).

## Pack for the current OS

From the repo root:

```bash
npm run desktop:pack
```

This runs `next build`, stages the standalone server under `desktop/resources/standalone/`, downloads a Node 22 binary into `desktop/resources/node/`, then invokes `electron-builder` with `desktop/electron-builder.yml`.

**Output:** installers/portables under `desktop/dist/` (e.g. Windows portable `.exe`, macOS `.zip`, Linux `.AppImage`, depending on the host OS).

## Optional configuration (`.env`)

Secrets and API keys are **not** baked into the app. For the desktop build, place an optional `.env` file in Electron **userData**:

| Platform | Typical userData directory |
|----------|----------------------------|
| Windows | `%APPDATA%\Osiris` |
| macOS | `~/Library/Application Support/Osiris` |
| Linux | `~/.config/Osiris` |

File path: `<userData>/.env` (simple `KEY=value` lines; `#` comments supported).

Common keys (features degrade or disable when missing):

| Key | Purpose |
|-----|---------|
| `AIS_API_KEY` | AIS / maritime data |
| `OI_*` | Open Intelligence–related integrations |
| `ETHERSCAN_API_KEY` | Ethereum / on-chain lookups |
| `HELIUS_API_KEY` | Solana / Helius RPC |
| `SDK_INGEST_KEY` | SDK ingest endpoints |

The child server also receives cache paths under userData (CCTV snapshot, Nominatim cache, etc.) via `OSIRIS_USER_DATA` and related env vars set by the desktop host.

## Security

The embedded Next.js server binds to **127.0.0.1 only** (`HOSTNAME=127.0.0.1`). It is not exposed on `0.0.0.0` or the LAN. Only the local Electron window (and other processes on the same machine) can reach it.

## Distribution caveats (v1)

- **macOS:** Builds are **unsigned / not notarized**. Gatekeeper may block first launch; users may need to right-click → Open or adjust Security & Privacy settings.
- **Windows:** Builds are **unsigned**. SmartScreen may warn on first run; choose “More info” → “Run anyway” if you trust the source.
- **Linux:** AppImage may require `chmod +x` and optional FUSE depending on the distro.

There is **no auto-update** in v1; download new builds manually when upgrading.
