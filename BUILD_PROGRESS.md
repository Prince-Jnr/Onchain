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
| `pnpm --filter @onchain/web lint` | Pass with 40 warnings remaining before the current transaction/auth changes; rerun below before deployment. |
| `pnpm build` | Pass. Contracts compile and the Next.js production build completes with Webpack; 23 web routes compiled and static generation completed. |
| Production smoke check | Pass; local production server returned HTTP 200 for `/` (32,452-byte HTML response). |
| `pnpm --filter @onchain/web test` | Three new content-reference tests pass; no broader frontend suite exists yet. |
| `pnpm --filter @onchain/shared typecheck` | Fail; package has no `tsconfig.json`, so `tsc --noEmit` prints help instead of checking sources. |

## Important implementation gaps found

- The post API now only prepares a deterministic content hash. A separate confirmation endpoint checks the actual receipt, sender, target contract, and matching `EntryCreated` event before creating a database record. This path has not yet been exercised against a deployed contract and live database.
- SIWE nonce consumption is now an atomic update, and production SIWE domain validation uses `NEXT_PUBLIC_APP_URL`. The full SIWE flow remains untested against a configured database/deployment.
- Session creation now fails closed when `SESSION_SECRET` is absent or shorter than 32 characters.
- Rate limiters use in-memory maps, so they are process-local and unsuitable as distributed production controls.
- Database initialization is lazy and fails closed when `DATABASE_URL` is absent. No database is configured, so database-backed runtime routes remain unavailable.
- Other social writes still require review: several interactions are currently application/database-layer and must be labeled as such or moved on-chain. The confirmation path is not a replacement for a durable event indexer.
- `apps/indexer` and `apps/api` directories exist but are empty. The Drizzle schema and migration tooling are in the web app, with the first migration generated; there is no durable indexer, CI workflow, or Playwright configuration.
- No `.env*` files were found. Vercel is authenticated, but no matching project or deployment exists. No RPC, database, WalletConnect, IPFS or deployment secrets were found in the process environment (values were never printed).
- Playwright 1.65.1 is installed, but no Playwright browser binaries were found; visual inspection has not yet been performed.
- Vercel is now authenticated. A project search for `onchain` and matching deployment search both returned zero results; this checkout has no `.vercel/project.json` or Git remote, so it is not linked to a Vercel project.

## Changes made during this audit

- Replaced the stale progress report with the verified inventory and check results.
- Added the missing `@tailwindcss/postcss` dependency and Tailwind v4 PostCSS configuration.
- Removed the known default session-secret fallback and the silent placeholder database URL.
- Fixed the TypeScript errors found in the initial web check; web typechecking now passes.
- Replaced removed Lucide exports and repaired React-effect/JSX lint errors. Lint passes with 39 unused-code and navigation warnings still present.
- Confirmed that no GitHub repository is required for deployment; local Vercel CLI deployment remains an option once the app build and services are ready.
- Removed build-time Google Fonts fetching, mirrored optional-module aliases in Webpack, and made database initialization lazy. The Webpack production build now succeeds.
- Changed the web build script to `next build --webpack`. The full root `pnpm build`, web lint, and a non-overlapping web typecheck pass.
- Started the production server locally and verified the homepage response, then stopped the server.
- Replaced direct client-claimed database post creation with a content preparation endpoint plus receipt/event verification before persistence. The composer now uses chain entry IDs for replies/quotes and offers a retry when confirmation indexing fails.
- Added deterministic content-reference tests (3 passing) and unique database indexes for transaction and media idempotency.
- Added an authenticated Pinata upload route with MIME and 10 MB size checks. It returns a clear 503 until `PINATA_JWT` is configured; no credential is present here.
- Made SIWE nonce consumption atomic and bound the accepted production SIWE domain to the configured app URL.
- Added Base mainnet contract-address environment mapping. No contract has been deployed to populate those addresses.
- Added a Drizzle Kit config, fixed root database scripts to target the actual web package, and generated the initial PostgreSQL migration. The migration has not been applied because no database is configured.

## Remaining work

The code still needs a complete runtime check after these changes. The product is not production-ready: no live database, deployed contract, durable event indexer, distributed rate limiter, media credential, or deployment is configured. Next priorities are an authoritative indexer and migrations, a broader contract-write audit, integration checks with Base Sepolia and PostgreSQL, browser-based visual checks, and then local-directory Vercel deployment after runtime secrets are configured.
