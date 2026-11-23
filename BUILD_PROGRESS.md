# ONCHAIN — Build Progress

## Current status: existing implementation audited; not production-ready

Last checked: 2026-11-23

This repository was already populated when work began. It is an uncommitted project on branch `main` with no commits yet. This file replaces the inaccurate earlier status that described the directory as empty and infrastructure as ready.

## What is present

- A pnpm workspace with a Next.js 16 App Router web app and a shared TypeScript package.
- Web routes and components for home, feed, explore, search, profiles, posts, notifications, bookmarks, wallet connection and several API endpoints.
- A Drizzle schema currently located inside `apps/web/src/lib/schema.ts`.
- Four Solidity contracts, Foundry deployment script, vendored OpenZeppelin/forge-std dependencies and contract tests.
- Architecture, decisions and security notes, although parts of those documents describe intended behavior that is not yet implemented.
- Installed Node.js 22.23.5, pnpm 10.15.0, Foundry 1.10.0, and local `node_modules` / build artifacts.

## Verified checks

| Check | Result |
|---|---|
| `pnpm --filter @onchain/contracts build` | Pass; compiler reports modifier-order lint warnings. |
| `pnpm --filter @onchain/contracts test` | Pass; 84 tests across 3 suites. |
| `pnpm --filter @onchain/web typecheck` | Pass after repairing authenticated-session narrowing, Lucide icon exports, search type naming, and recursive API serialization typing. |
| `pnpm --filter @onchain/web lint` | Pass with 39 warnings remaining. |
| `pnpm --filter @onchain/web build` | Fail. Added the missing Tailwind v4 PostCSS plugin and config; Turbopack panics while spawning its CSS worker (`Operation not permitted`), including an elevated retry. Webpack build instead fails parsing TypeScript `--showConfig` output. |
| `pnpm --filter @onchain/web test` | Fail; Vitest reports no test files. |
| `pnpm --filter @onchain/shared typecheck` | Fail; package has no `tsconfig.json`, so `tsc --noEmit` prints help instead of checking sources. |

## Important implementation gaps found

- The post API inserts `ACTIVE` entries into PostgreSQL from client-supplied content and `txHash`; it does not verify the transaction or wait for an indexed contract event. This conflicts with the documented chain-authoritative model and must be fixed before treating posts as blockchain-backed.
- SIWE verification checks a valid signature and a matching, unused nonce separately; nonce consumption is not an atomic compare-and-set, and the message nonce is not bound to a claimed wallet when the nonce is issued. Review for replay/concurrency issues before production.
- Session creation now fails closed when `SESSION_SECRET` is absent or shorter than 32 characters.
- Rate limiters use in-memory maps, so they are process-local and unsuitable as distributed production controls.
- `apps/web/src/lib/db.ts` constructs a placeholder localhost database URL when `DATABASE_URL` is absent. Routes guard some calls, but a shared fail-closed database configuration is needed.
- Contract writes, database persistence and event indexing are not yet demonstrated as an integrated end-to-end flow.
- There is no `apps/indexer`, standalone database package, migrations directory, CI workflow, Playwright configuration, or root README in the inspected tree.
- No `.env*` files were found. The Vercel connection is configured but currently requires reauthentication. No RPC, database, WalletConnect, IPFS or deployment secrets were found in the process environment (values were never printed).
- Playwright 1.65.1 is installed, but no Playwright browser binaries were found; visual inspection has not yet been performed.
- Vercel is now authenticated. A project search for `onchain` and matching deployment search both returned zero results; this checkout has no `.vercel/project.json` or Git remote, so it is not linked to a Vercel project.

## Changes made during this audit

- Replaced the stale progress report with the verified inventory and check results.
- Added the missing `@tailwindcss/postcss` dependency and Tailwind v4 PostCSS configuration. CSS worker/build problems remain unresolved.
- Removed the known default session-secret fallback and the silent placeholder database URL.
- Fixed the TypeScript errors found in the initial web check; web typechecking now passes.
- Replaced removed Lucide exports and repaired React-effect/JSX lint errors. Lint passes with 39 unused-code and navigation warnings still present.

## Remaining work

The current implementation must be corrected and verified before the product can be called production-ready. Priorities are: fix build/type/lint failures; secure SIWE and session handling; remove the unverified post-write path; make blockchain/indexer reconciliation authoritative; validate API authorization and moderation; add database migrations and missing infrastructure; then perform UI, integration and deployment checks as credentials permit.
