# ONCHAIN

**Leave something behind.**

ONCHAIN is an in-progress wallet-based social guestbook. This repository contains an early web application and Solidity contracts; it is not production-ready and has no current deployment.

## Current implementation

- Next.js App Router frontend with feed, explore, search, profile, post, notification, and bookmark screens.
- wagmi, viem, and RainbowKit wallet connection; SIWE routes and a Drizzle schema live in the web app.
- Four Solidity contracts and Foundry tests for entries, social interactions, profiles, and moderation.
- Shared TypeScript package for contract ABIs and common types.

The post path stages a deterministic content document, asks the user's wallet to create its on-chain reference, and persists entries after receipt/event verification. A long-running indexer archives configured logs and projects entries, reactions, reposts, follows, profile references, reports, moderation audit records, role flags, and wallet restrictions, with bounded reorg rollback. Image uploads use Pinata when `PINATA_JWT` is configured, and Drizzle migrations are included. Notifications from chain activity, full on-chain configuration projection, production services, and several advertised API features are still incomplete, so the app is not production-ready. See [BUILD_PROGRESS.md](BUILD_PROGRESS.md) for verified checks and remaining gaps.

## Requirements

- Node.js 22 (Node 20+ is declared in `package.json`).
- pnpm 10.
- Foundry for contract builds and tests.
- A configured PostgreSQL database and `SESSION_SECRET` (at least 32 characters) to use authenticated web API routes.
- Pinata `PINATA_JWT` for image uploads and a WalletConnect project ID for WalletConnect-compatible wallets.

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

The production workspace build passes with the configured Webpack builder. Workspace typechecks pass, 84 Foundry tests pass, three web tests pass, and two indexer projection-state tests pass. A GitHub Actions workflow now runs those checks on pushes and pull requests. There is no configured database or live contract to verify the wallet-to-database/indexer flow.

## Deployments

There is no ONCHAIN Vercel project or deployment linked to this checkout. A GitHub repository is not required; see [DEPLOYMENT.md](DEPLOYMENT.md) for the local CLI deployment route and required services. Do not publish until the required database, contract, RPC, and storage configuration is ready and the runtime path has been tested.

## Project notes

- [Architecture](ARCHITECTURE.md)
- [Build progress and audit](BUILD_PROGRESS.md)
- [Engineering decisions](DECISIONS.md)
- [Security notes](SECURITY.md)
- [Deployment steps and required configuration](DEPLOYMENT.md)
