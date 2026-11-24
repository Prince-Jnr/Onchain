# ONCHAIN Security Status

This file records protections that exist in the repository and the controls still required before production. It is not an audit or a claim that ONCHAIN is production-secure.

## Implemented protections

- Solidity 0.8.24 contracts use OpenZeppelin access control, pausing, and reentrancy guards in relevant functions. Contract tests exist, but an independent security audit has not been performed.
- Wallet writes in the web app are requested through wagmi and the user's connected wallet. The post path prepares a content reference first, then only persists the post after the server verifies a successful transaction receipt, sender, target contract, and matching `EntryCreated` event.
- SIWE signatures are verified server-side. Nonces are random, expire, and are atomically consumed once. Production verification requires the configured `NEXT_PUBLIC_APP_URL` domain.
- Sessions use HTTP-only, SameSite Strict cookies and require a configured `SESSION_SECRET` of at least 32 characters. Cookies are marked Secure in production.
- The media API requires an authenticated session, accepts a small allowlist of image MIME types, limits files to 10 MiB, and needs a server-only `PINATA_JWT`.
- Database calls use Drizzle's parameterized query builder. No private key is part of the web runtime configuration.

## Known security gaps

- There is no production database, deployed contract, or end-to-end test of the transaction verification flow in this checkout.
- The confirmation route verifies a receipt/event for the configured chain. The indexer waits for configurable confirmations, handles bounded reorgs within retained chunk markers, and projects common social/moderation events. It is not deployed, has not been exercised against a live database/RPC, and is not a substitute for reconciliation or a contract audit.
- Most social interactions and moderation APIs require a separate review to confirm their authorization model and whether they are on-chain or application-layer. Do not assume buttons or database rows imply on-chain authorization.
- Current rate limits are in-memory and process-local. Replace them with a shared store or provider-level controls before running multiple instances.
- The `sessions` table is not used for revocation; logout clears the iron-session cookie. Secret rotation invalidates sessions, but individual server-side session revocation is not available.
- The upload endpoint pins user files, but there is no image re-encoding or metadata stripping. Uploaded IPFS data can remain publicly available after the user removes a post.
- Link-preview fetching is not implemented. If added, it must block private IP ranges, revalidate redirects, limit response size, and use timeouts.
- No CSP, distributed abuse controls, dependency audit workflow, or external monitoring has been verified.
- The default app's social content and wallet addresses are public identifiers. Blockchain transactions are public and cannot be erased by database deletion.

## Operator requirements

- Keep `SESSION_SECRET`, `DATABASE_URL`, `PINATA_JWT`, deployer keys, and private RPC credentials server-side. Never prefix secrets with `NEXT_PUBLIC_`.
- Deploy contracts from a dedicated, protected deployment account and verify addresses before setting them in the app.
- Configure an independent database backup and a recovery procedure before accepting production data.
- Review changes to contract roles, admin endpoints, session handling, uploads, and chain receipt validation as security-sensitive code.

## Reporting

No verified security contact is configured for this project. Do not rely on the placeholder `onchain.app` domain or email as an active reporting channel; provide a maintained contact before public launch.
