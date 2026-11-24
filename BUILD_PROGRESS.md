# ONCHAIN — Build Progress

## Current status: existing implementation audited; not production-ready

Last checked: 2026-11-23

This repository was already populated when work began. The current checkout is branch `main` tracking a local `origin/main` ref; this status report records what has been verified in the working tree. The existence of a Git remote ref does not establish that a usable GitHub repository or deployment is configured.

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
| `pnpm --filter @onchain/web lint` | Pass with 38 warnings (mostly unused imports/variables and one navigation warning). |
| `pnpm build` | Pass after adding a typecheck preflight and limiting build workers; contracts and web build complete. |
| Production smoke check | Pass; local production server returned HTTP 200 for `/` (32,452-byte HTML response). |
| `pnpm --filter @onchain/web test` | Three content-reference tests pass; no broader frontend suite exists yet. |
| `pnpm -r typecheck` | Pass for shared, web, and indexer packages. |

## Important implementation gaps found

- The post API stages a deterministic content hash and private pending content. A separate confirmation endpoint checks the actual receipt, sender, target contract, and matching `EntryCreated` event before creating a visible database entry. The indexer can recover staged content if the client closes after a transaction. This path has not yet been exercised against a deployed contract and live database.
- SIWE nonce consumption is now an atomic update, and production SIWE domain validation uses `NEXT_PUBLIC_APP_URL`. The full SIWE flow remains untested against a configured database/deployment.
- Session creation now fails closed when `SESSION_SECRET` is absent or shorter than 32 characters.
- Rate limiters use in-memory maps, so they are process-local and unsuitable as distributed production controls.
- Database initialization is lazy and fails closed when `DATABASE_URL` is absent. No database is configured, so database-backed runtime routes remain unavailable.
- Other social writes still require review: several interactions are currently application/database-layer and must be labeled as such or moved on-chain.
- The indexer archives configured contract logs and projects entry creation/status/pin, reaction/repost/follow state and counts, profile metadata references, reports, moderation audit records, moderator/trusted flags, and wallet restrictions. Notifications and moderation configuration projection are still missing. The worker has not been run against a live database or RPC. `apps/api` remains empty.
- Drizzle migrations are generated but unapplied. Playwright is installed but has no browser configuration/binaries.
- `.env.example` documents required settings, but no runtime `.env` credentials are configured. Vercel is authenticated, but no matching project or deployment exists. No RPC, database, WalletConnect, IPFS or deployment secrets were found in the process environment (values were never printed).
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
- Changed the web build script to `next build --webpack`; root builds run sequentially to reduce peak memory. The full root `pnpm build` passes, along with workspace typechecks.
- Started the production server locally and verified the homepage response, then stopped the server.
- Replaced direct client-claimed database post creation with a content preparation endpoint plus receipt/event verification before persistence. The composer now uses chain entry IDs for replies/quotes and offers a retry when confirmation indexing fails.
- Added deterministic content-reference tests (3 passing) and unique database indexes for transaction and media idempotency.
- Added an authenticated Pinata upload route with MIME and 10 MB size checks. It returns a clear 503 until `PINATA_JWT` is configured; no credential is present here.
- Made SIWE nonce consumption atomic and bound the accepted production SIWE domain to the configured app URL.
- Added Base mainnet contract-address environment mapping. No contract has been deployed to populate those addresses.
- Added a Drizzle Kit config, fixed root database scripts to target the actual web package, and generated the initial PostgreSQL migration. The migration has not been applied because no database is configured.
- Added the standalone indexer worker, durable event/block ledgers, a per-chain advisory lock, bounded reorg rollback, and staged-content recovery. Added schema migrations for indexer state and pending entries. The indexer typecheck passes but it has not been run against external services.
- Expanded the indexer projections to social actions, profile metadata references, report state, moderation audit, trusted/moderator flags, and wallet restrictions. Added on-chain report target IDs and idempotency indexes to the Drizzle schema/migration; the generated migration matches the current schema.
- Added unit coverage for social event forward/reverse state transitions (2 tests). These tests do not replace a live PostgreSQL/RPC reorg test.
- Added GitHub Actions jobs for web checks, indexer typecheck/tests, and Foundry build/tests. The workflow has not run remotely because this environment has no verified GitHub repository integration.
- Fixed indexer shutdown to stop polling, release the per-chain PostgreSQL advisory lock, and close the pool; block-hash markers are pruned to the configured 128-marker reorg window.
- Final checks after current changes: root workspace build passes, workspace typechecks pass, 84 Foundry tests pass, 3 web unit tests pass, lint passes with 38 warnings, and the earlier built homepage smoke check returned HTTP 200. The latest indexer additions have only been typechecked; they have not yet been verified against live services.

## Remaining work

The product is not production-ready: no live database, deployed contract, running indexer, distributed rate limiter, media credential, or deployment is configured. Next priorities are a contract-write/feature-label audit, integration checks with Base Sepolia and PostgreSQL, browser-based visual checks, then local-directory Vercel deployment after runtime configuration. The Next build skips its duplicate internal typecheck to stay within the environment's memory; the build script runs `tsc --noEmit` before invoking Next, so the type gate remains enforced.
