# ONCHAIN Engineering Decisions

These decisions describe the implementation in this repository now. Earlier planning notes that claimed unimplemented services were removed.

## D-001: pnpm workspace with Next.js application and Solidity package

Use a pnpm monorepo with the web app under `apps/web`, Foundry contracts under `packages/contracts`, and ABIs/types under `packages/shared`. The indexer and dedicated API are not yet separate deployable packages.

## D-002: EVM wallet writes remain user-authorized

The browser uses wagmi/viem and asks the connected wallet to authorize each supported contract write. The server never signs for users. A wallet connection or SIWE signature is not transaction approval.

## D-003: PostgreSQL feed persistence requires chain receipt evidence

For entry creation, the browser stages and hashes a canonical content document, the contract records that hash, and the server checks the actual chain receipt and matching event before saving the content projection. PostgreSQL does not make a post authoritative. A durable worker archives events and projects entry create/status/pin state; deployment and the remaining social projections are outstanding.

## D-004: Post text and media use separate storage paths

Post text is currently served from PostgreSQL after its hash is recorded on-chain. Images are pinned to IPFS through Pinata when configured. Post text is not pinned to IPFS yet. The UI and deployment docs must not describe this content path as fully decentralized storage.

## D-005: Application-layer features must be identified as such

Features implemented only through the API/database are not blockchain-backed and must not imply that they required a wallet transaction. Audit each interaction and its UI disclosure before public launch.

## D-006: Base Sepolia first, Base mainnet only after deployment readiness

Base Sepolia is used for development; Base is the production target. The repository has deployment scripts and address configuration, but no live contract is configured. Mainnet deployment requires an operator-controlled deployment wallet and deliberate authorization.

## D-007: Drizzle schema in the web package

The current web API imports Drizzle schema and the Neon serverless client from `apps/web`. The initial migration is generated there. A separate database package should be introduced only alongside moving the actual schema/client, not as an empty workspace placeholder.

## D-008: No deployment claim without a verified environment

There is no linked Vercel project, configured production database, deployed contract, or live ONCHAIN URL in this checkout. Local build success is not deployment or runtime verification.
