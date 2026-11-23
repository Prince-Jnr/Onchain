# Deployment

There is no active ONCHAIN deployment or linked Vercel project yet. The code can deploy without GitHub by using the Vercel CLI from this local checkout, but it is not ready for production until the services below are configured and runtime flows are verified.

## Required configuration

Configure secrets in the hosting provider's environment settings. Do not commit them or send secret values in chat.

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Server | PostgreSQL connection string. |
| `SESSION_SECRET` | Server | Random session key of at least 32 characters. |
| `NEXT_PUBLIC_APP_URL` | Build and server | Canonical HTTPS application URL used by SIWE domain validation. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Build | WalletConnect-compatible wallet support. |
| `NEXT_PUBLIC_ENTRIES_ADDRESS_SEPOLIA` | Build and server | Deployed ONCHAIN Entries contract on Base Sepolia. |
| `NEXT_PUBLIC_ENTRIES_ADDRESS` | Build and server | Deployed ONCHAIN Entries contract on Base mainnet. |
| `BASE_SEPOLIA_RPC_URL` | Server and Foundry | Base Sepolia JSON-RPC endpoint. |
| `BASE_RPC_URL` | Server and Foundry | Base mainnet JSON-RPC endpoint. |
| `PINATA_JWT` | Server | Pinata authentication for image upload. |

`BASESCAN_API_KEY` is needed only for Foundry verification. Public contract addresses and WalletConnect project ID are not private keys, but still configure them per environment. The app also needs PostgreSQL tables created from `apps/web/src/lib/schema.ts`; a migration workflow has not yet been added, so do not rely on a fresh database until schema migration support exists.

## Testnet deployment sequence

1. Create a PostgreSQL database, Pinata account, and WalletConnect project. Add the values above to a local ignored `.env.local` for development and to Vercel's Preview/Production environments as appropriate.
2. Apply the database schema using a reviewed migration. This repository currently has no generated Drizzle migrations.
3. Deploy contracts to Base Sepolia from `packages/contracts` using the provided `script/Deploy.s.sol` and a funded test wallet. Set `PRIVATE_KEY` and `BASE_SEPOLIA_RPC_URL` only in the deployment shell's secure environment.
4. Record the four deployed addresses. Set the Entries address in web environments; configure other addresses before enabling their contract interactions.
5. Verify contracts with Foundry and `BASESCAN_API_KEY`. Run contract tests and the app's configured runtime checks against the same Base Sepolia deployment and database.

The deployer key is an operational secret and should not be added to Vercel or this repository. Do not use a personal wallet key for an unattended production deployment.

## Vercel without GitHub

From the repository root, install or use the Vercel CLI, authenticate to the account, and link this local directory to a Vercel project. Configure the project's Root Directory as `apps/web`, then add the environment variables above. Deploy a Preview first and verify database migrations, SIWE, image uploads, wallet connection, transaction confirmation, and feed persistence. Promote to Production only after that verification.

For the Vercel CLI flow, see [Deploying projects from the CLI](https://vercel.com/docs/projects/deploy-from-cli). No ONCHAIN project was found in the connected Vercel account at the time of this repository audit, so project linking still needs to happen.

## What is not deployed

- PostgreSQL and schema migrations.
- Base Sepolia or Base mainnet contracts.
- A durable blockchain event indexer.
- Pinata-backed media until `PINATA_JWT` is configured.
- A Vercel project or deployment.

Do not treat this application as production-ready until these gaps are closed and the resulting deployment passes real testnet checks.
