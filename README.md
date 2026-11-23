# ONCHAIN

**Leave something behind.**

ONCHAIN is an in-progress wallet-based social guestbook. This repository contains an early web application and Solidity contracts; it is not production-ready and has no current deployment.

## Current implementation

- Next.js App Router frontend with feed, explore, search, profile, post, notification, and bookmark screens.
- wagmi, viem, and RainbowKit wallet connection; SIWE routes and a Drizzle schema live in the web app.
- Four Solidity contracts and Foundry tests for entries, social interactions, profiles, and moderation.
- Shared TypeScript package for contract ABIs and common types.

The indexer, database migrations, media upload service, and several advertised API features are not implemented yet. In particular, do not treat database post records as verified chain events. See [BUILD_PROGRESS.md](BUILD_PROGRESS.md) for the audit, current checks, and critical gaps.

## Requirements

- Node.js 22 (Node 20+ is declared in `package.json`).
- pnpm 10.
- Foundry for contract builds and tests.
- A configured PostgreSQL database and `SESSION_SECRET` (at least 32 characters) to use authenticated web API routes.

## Local development

```bash
pnpm install
pnpm dev
```

The web app runs at `http://localhost:3000`. Wallet writes also require deployed contracts on a supported network and matching `NEXT_PUBLIC_*_ADDRESS_*` configuration. SIWE routes require `DATABASE_URL` and `SESSION_SECRET`.

## Checks

```bash
pnpm --filter @onchain/web typecheck
pnpm --filter @onchain/web lint
pnpm --filter @onchain/contracts build
pnpm --filter @onchain/contracts test
```

The web test script currently has no tests. The current production web build fails in the local environment; refer to the build journal for the exact failure. Contract tests currently pass (84 tests).

## Deployments

There is no ONCHAIN Vercel project or deployment linked to this checkout. It has no Git remote or `.vercel/project.json`. The Vercel account was checked and returned no matching `onchain` project or deployment. Do not publish until the build, required backend services, and environment configuration are ready.

## Project notes

- [Architecture](ARCHITECTURE.md)
- [Build progress and audit](BUILD_PROGRESS.md)
- [Engineering decisions](DECISIONS.md)
- [Security notes](SECURITY.md)
