# ONCHAIN — Architecture

## Overview

ONCHAIN is a decentralized social guestbook built as a full-stack monorepo. It combines on-chain ownership and social actions with a polished application-layer experience.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          USERS                                   │
│                (Browser + EVM Wallet)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS APP (Vercel)                        │
│   App Router · React · TypeScript · Tailwind · shadcn/ui        │
│   wagmi · viem · RainbowKit · SIWE · TanStack Query             │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌────────────────────────────────┐
│   NEXT.JS API ROUTES     │    │       BASE BLOCKCHAIN          │
│   Authentication (SIWE)  │    │   Base Sepolia (dev/test)      │
│   REST API endpoints     │    │   Base Mainnet (production)    │
│   Server Actions         │    │                                │
│   Rate limiting          │    │   OnchainEntries.sol           │
│   Validation             │    │   OnchainSocial.sol            │
│   Authorization          │    │   OnchainModeration.sol        │
└──────────┬───────────────┘    │   OnchainProfiles.sol          │
           │                    └──────────────┬─────────────────┘
           ▼                                   │
┌──────────────────────────┐                   │ Events
│    POSTGRESQL (Neon)     │    ┌──────────────▼─────────────────┐
│    Drizzle ORM           │◄───┤    EVENT INDEXER (Ponder)      │
│                          │    │    Event ingestion             │
│    Users/Profiles        │    │    Block tracking              │
│    Sessions/Nonces       │    │    Reorg handling              │
│    Posts/Comments        │    │    Idempotent processing       │
│    Reactions/Reposts     │    │    DB synchronization          │
│    Notifications         │    └────────────────────────────────┘
│    Moderation            │
│    Audit logs            │    ┌────────────────────────────────┐
│    Analytics             │    │    IPFS / Pinning              │
└──────────────────────────┘    │    Media storage               │
                                │    Content references          │
                                │    Integrity verification      │
                                └────────────────────────────────┘
```

## Monorepo Structure

```
onchain/
├── apps/
│   ├── web/           — Next.js frontend application
│   ├── indexer/       — Ponder blockchain event indexer
│   └── api/           — Dedicated API services (if needed)
├── packages/
│   ├── contracts/     — Solidity smart contracts (Foundry)
│   ├── database/      — Drizzle schema, migrations, client
│   ├── ui/            — Shared UI components
│   ├── shared/        — Shared types, utilities, constants
│   └── config/        — Shared configuration
└── docs/              — Extended documentation
```

## Smart Contract Architecture

### OnchainEntries.sol
Core entry management. Handles posts, comments, quotes. Each entry stores:
- Unique ID (auto-incremented)
- Author address
- Entry type (POST, COMMENT, QUOTE)
- Parent entry ID (for comments/replies)
- Referenced entry ID (for quotes)
- Content reference (IPFS CID or hash)
- Timestamp
- Status (ACTIVE, DELETED, HIDDEN)

### OnchainSocial.sol
Social interactions. Handles:
- Reactions (Like/Love/Laugh/Wow/Sad/Angry)
- Reposts / Unreposts
- Following / Unfollowing
- Bookmarks (on-chain option)

### OnchainProfiles.sol
Profile registration and updates. Stores IPFS CID references to profile metadata.

### OnchainModeration.sol
Moderation and access control:
- Role management (Owner, Admin, Moderator, Trusted, Restricted)
- Content moderation (approve, reject, hide, restore, pin)
- Configuration (moderation mode: STRICT, TRUSTED, OPEN, EVENT)
- Emergency pause

## Database Architecture

PostgreSQL serves as the application-layer database. It is NOT the source of truth for on-chain data — the blockchain is. The indexer synchronizes on-chain events into PostgreSQL for efficient querying.

Key tables: users, profiles, entries, comments, reactions, reposts, follows, bookmarks, notifications, reports, moderation_actions, audit_logs, indexer_checkpoints, sessions, siwe_nonces.

## Authentication

Sign-In with Ethereum (SIWE) — EIP-4361.
1. Client requests a nonce from the server.
2. User signs a SIWE message in their wallet (no gas, off-chain signature).
3. Server verifies the signature, domain, nonce, chain.
4. Server creates a secure HTTP-only session cookie.
5. Nonce is invalidated (single-use).

## Wallet Integration

- wagmi v2 + viem v2
- RainbowKit for wallet onboarding
- EIP-6963 multi-wallet discovery
- EIP-1193 provider interface
- Supported: MetaMask, Coinbase Wallet, WalletConnect, Rabby, injected wallets

## Content Storage

| Content | Storage | Rationale |
|---------|---------|-----------|
| Post text | IPFS (pinned) + DB cache | Decentralized, verifiable |
| Profile metadata | IPFS (pinned) + DB cache | Large payload, off-chain ref |
| Images | IPFS (pinned) | Decentralized media |
| Social actions | On-chain + DB index | Ownership, verifiability |
| Sessions | DB only | Application layer |
| Notifications | DB only | Application layer |
| Moderation notes | DB only | Private application layer |

## Network Configuration

- Development: Local Anvil (chain ID 31337)
- Testing: Base Sepolia (chain ID 84532)
- Production: Base Mainnet (chain ID 8453)

## Security Architecture

See SECURITY.md for full threat model.

Key principles:
1. Blockchain is authoritative for on-chain actions.
2. All writes require explicit wallet authorization.
3. Server validates all permissions independently.
4. No secrets in client-side code.
5. SIWE authentication is separate from transaction authorization.
