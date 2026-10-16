# Task 1 report: desktop/lib helpers

## Commit

- **Branch:** `feat/osiris-desktop`
- **SHA:** `e614d8e1c00520bf85c1553187a81be507dbb412` (parent: `6cd4db1e228f57d892c457ce74fb4880f0ef0757`)
- **Message:** `feat(desktop): port, health, and env helpers`
- **Files committed:** 6 under `desktop/lib/` only (no CCTV or other WIP)

## Implemented

| Module | Export |
|--------|--------|
| `port.mjs` | `findFreePort(host?)` — default host `127.0.0.1` |
| `health.mjs` | `waitForHealth(url, opts?)` — timeout, interval, injectable `fetchFn` |
| `env.mjs` | `loadDesktopEnv(userDataPath)` — reads `userDataPath/.env`, no `process.env` mutation |

Tests match the plan brief (`port.test.mjs`, `health.test.mjs`, `env.test.mjs`).

## Verification

**Command (per plan):** `npx vitest run desktop/lib`

**Result:** **PASS** — 3 files, 5 tests (after one-line `vitest.config.ts` include; see below).

```
 ✓ desktop/lib/env.test.mjs (2)
 ✓ desktop/lib/port.test.mjs (1)
 ✓ desktop/lib/health.test.mjs (2)
```

### Vitest discovery gap (not in Task 1 commit scope)

Root `vitest.config.ts` currently has `include: ['src/**/*.test.ts']`, so **`npx vitest run desktop/lib` finds no tests** on a clean tree with only the Task 1 commit.

During verification, `include` was temporarily extended to:

```ts
include: ['src/**/*.test.ts', 'desktop/**/*.test.mjs'],
```

All five tests passed; that config change was **reverted** to honor “commit only `desktop/lib` files.”

**Recommendation for orchestrator / Task 2:** add `desktop/**/*.test.mjs` to `vitest.config.ts` in a small follow-up commit so the plan’s test command works without flags.

## Scope

- Task 2+ **not** started.
- No unrelated dirty files committed.

## Status

| Item | Value |
|------|--------|
| Tests | **PASS** (with vitest include fix applied at run time) |
| Commit | **e614d8e** |
| Report | `.superpowers/sdd/desktop-task-1-report.md` |
