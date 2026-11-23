# ONCHAIN Architecture

## Repository today

- `apps/web`: Next.js App Router application, API route handlers, wagmi/RainbowKit client, Drizzle schema, and database access.
- `packages/contracts`: four Solidity contracts, Foundry deployment script, OpenZeppelin dependencies, and tests.
- `packages/shared`: shared ABI, types, chain IDs, and address configuration.
- `apps/indexer` and `apps/api`: directories exist but currently contain no implementation.
- `apps/web/drizzle`: Drizzle Kit configuration and generated PostgreSQL migration.

## Implemented post path

1. A signed-in user composes text. Images, when selected, are pinned through the server-side Pinata upload route.
2. The browser creates a canonical content document and asks `/api/entries` for its keccak256 reference. This endpoint does not write a post to the database.
3. wagmi requests the relevant `createPost`, `createComment`, or `createQuote` transaction through the connected wallet. The user approves or rejects it in their wallet.
4. Once wagmi reports a successful receipt, the browser sends the transaction hash and content metadata to `/api/entries/confirm`.
5. The server queries the chain identified by the SIWE session, checks receipt success, transaction sender, destination contract, and the matching `EntryCreated` event fields. Only then does it write the entry and content rows.

The content hash is stored on-chain; the matching text is stored in PostgreSQL. Post text is not currently uploaded to IPFS. Images are pinned to IPFS only when `PINATA_JWT` is configured. A post can be on-chain but not yet visible in the feed if the database is unavailable; the composer offers a retry of confirmation.

## Runtime dependencies

- **Wallet:** wagmi + viem + RainbowKit. Base Sepolia is the development network; Base is the production target. Writes require explicit wallet confirmation.
- **Authentication:** SIWE nonce and signature endpoints with iron-session cookies. Authentication is an off-chain signature and does not send a transaction.
- **Database:** PostgreSQL through `@neondatabase/serverless` and Drizzle. The database stores profiles, feed projections, sessions/nonces, and application-layer interaction data. It is not authoritative for blockchain state.
- **Media:** Pinata pinning API accessed server-side. Uploads are optional and return unavailable without `PINATA_JWT`.
- **Contracts:** Entries, Social, Profiles, and Moderation contracts. No contract addresses are currently deployed/configured.

## Not implemented yet

- Durable chain event indexing, confirmations/finality policy, reorganization handling, and reconciliation.
- Backfill from deployment block and recovery from missed events.
- A complete chain-authoritative source for every social and moderation action.
- Production database credentials and an applied migration.
- Realtime notifications, cross-instance rate limiting, operational monitoring, and a CI workflow.
- Verified production deployment or browser-based visual inspection.

See [BUILD_PROGRESS.md](BUILD_PROGRESS.md) for current checks and [DEPLOYMENT.md](DEPLOYMENT.md) for service setup.
