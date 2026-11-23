# ONCHAIN — Engineering Decisions

## Decision Log

---

### D-001: Monorepo with pnpm workspaces
**Date:** Phase 1
**Decision:** Use pnpm workspaces for the monorepo instead of Turborepo or Nx.
**Rationale:** pnpm 10 is available, provides efficient workspace management without additional tooling overhead. Turborepo would add value at scale but is unnecessary complexity for this stage. Can be added later.

---

### D-002: Next.js App Router
**Decision:** Use Next.js 14+ with App Router.
**Rationale:** App Router provides server components, server actions, and streaming — reducing client-side bundle size and enabling efficient server-side rendering. Best suited for a social platform with mixed static and dynamic content.

---

### D-003: RainbowKit over custom wallet UI
**Decision:** Use RainbowKit for wallet connection UI.
**Rationale:** RainbowKit provides a polished, battle-tested wallet connection experience with EIP-6963 support. It supports MetaMask, Coinbase Wallet, WalletConnect, and injected wallets out of the box. Building a custom wallet connection UI from scratch would take significant time for marginal design gain.

---

### D-004: Base as primary network
**Decision:** Base Sepolia for development, Base mainnet for production.
**Rationale:** Base provides low transaction fees, EVM compatibility, Coinbase backing, and Optimism OP Stack security. Optimal for a social platform where users will execute frequent small transactions. The L2 cost structure makes on-chain social interactions economically viable.

---

### D-005: Hybrid content storage
**Decision:** Social actions (reactions, reposts, follows) on-chain; post content on IPFS with on-chain hash reference; profile metadata on IPFS; application-layer features (bookmarks, notifications) in PostgreSQL.
**Rationale:** Storing full post text on-chain is cost-prohibitive and unnecessary. IPFS provides content addressing and verifiability. The on-chain hash reference provides proof of what was published. Application-layer features that don't require blockchain verification stay off-chain for performance and cost.

---

### D-006: Ponder for event indexing
**Decision:** Use Ponder (ponder.sh) for blockchain event indexing.
**Rationale:** Ponder provides a TypeScript-native event indexing framework with built-in reorg handling, checkpointing, and a GraphQL API. It significantly reduces the complexity of building a custom indexer. The framework is actively maintained and production-ready.

---

### D-007: Drizzle ORM over Prisma
**Decision:** Use Drizzle ORM for database access.
**Rationale:** Drizzle provides TypeScript-first schema definition, superior type inference, and better performance than Prisma for read-heavy workloads. The schema-as-code approach fits the monorepo architecture. Neon serverless driver compatibility is excellent.

---

### D-008: SIWE for authentication
**Decision:** Implement Sign-In with Ethereum (EIP-4361) for user authentication.
**Rationale:** SIWE provides wallet-native authentication without passwords, centralized identity providers, or custodial systems. Users sign a structured message (no gas cost) proving wallet ownership. Sessions are managed via secure HTTP-only cookies.

---

### D-009: Four-contract architecture
**Decision:** Split contracts into OnchainEntries, OnchainSocial, OnchainProfiles, OnchainModeration rather than a single monolithic contract.
**Rationale:** Separation of concerns. Each contract has a focused responsibility. Reduces individual contract size (staying under EIP-170 limit). Allows independent upgrades/replacements. Easier to audit.

---

### D-010: Off-chain bookmarks
**Decision:** Implement bookmarks as an application-layer (PostgreSQL) feature rather than on-chain.
**Rationale:** Bookmarks are inherently private user preferences. Putting them on-chain would expose private curation publicly, incur gas costs for a simple organizational feature, and provide no meaningful ownership benefit. Users will not be misled — the UI clearly labels bookmarks as app-layer features.

---

### D-011: Off-chain follows (hybrid option)
**Decision:** Implement follows as primarily an application-layer feature with optional on-chain recording.
**Rationale:** Follow relationships being private but verifiable is a nuanced requirement. For v1, follows are stored in PostgreSQL for performance. The contract includes a Follow event for users who want public, verifiable follow records. This satisfies both use cases.

---

### D-012: Neon PostgreSQL
**Decision:** Use Neon for managed PostgreSQL.
**Rationale:** Neon provides serverless PostgreSQL with excellent Next.js and Vercel integration, connection pooling, and a free tier for development. The @neondatabase/serverless driver works seamlessly with Drizzle ORM and Next.js server components.

---

### D-013: TanStack Query for server state
**Decision:** Use TanStack Query (React Query) for server state management.
**Rationale:** Social feeds require complex caching, pagination, optimistic updates, and background refetching. TanStack Query provides all of these out of the box. Pairing with Zustand for local UI state provides clean separation.

---

### D-014: OpenZeppelin Contracts v5
**Decision:** Use OpenZeppelin Contracts v5 for Solidity.
**Rationale:** Industry-standard, extensively audited contract library. v5 provides AccessControl, Pausable, ReentrancyGuard, and other security primitives. Foundry compatibility is excellent.

---

### D-015: Content moderation modes as on-chain configuration
**Decision:** Store moderation mode (STRICT/TRUSTED/OPEN/EVENT) in the OnchainModeration contract.
**Rationale:** The moderation mode determines which content requires approval before publication. Storing it on-chain makes the platform's moderation policy transparent and verifiable. Users can see exactly what mode is active. Mode changes require admin authorization and emit events.
