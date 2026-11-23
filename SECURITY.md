# ONCHAIN — Security Architecture

## Threat Model

ONCHAIN is a public blockchain-integrated social platform. The threat surface spans smart contracts, wallet integration, authentication, API endpoints, content handling, and the database.

---

## Smart Contract Security

### Access Control
- `OnchainModeration.sol` implements role-based access control (RBAC) using OpenZeppelin's `AccessControl`.
- Roles: `OWNER_ROLE`, `ADMIN_ROLE`, `MODERATOR_ROLE`, `TRUSTED_ROLE`.
- All sensitive functions require appropriate role membership.
- Role assignment requires the assigning role to have sufficient privilege.

### Reentrancy
- All state-changing external functions follow Checks-Effects-Interactions pattern.
- `ReentrancyGuard` applied to functions that could be targets.

### Integer Arithmetic
- Solidity 0.8.x provides built-in overflow/underflow protection.
- No unchecked arithmetic in security-sensitive paths.

### Emergency Pause
- `Pausable` from OpenZeppelin applied to entry creation and social actions.
- Read functions remain active during pause.
- Only ADMIN_ROLE can pause/unpause.

### Input Validation
- Content references validated to be non-empty.
- Parent/reference entry IDs validated to exist and be active.
- Maximum content reference length enforced.
- Entry type enum validated.

### Gas Considerations
- No unbounded loops over user-controlled arrays.
- Mappings used for O(1) lookups (reactions, reposts, follows).
- Event emission preferred over on-chain storage for data that only needs querying.

### Known Contract Limitations
- Content (IPFS CIDs) are stored as bytes/strings; validation is application-layer.
- Entry IDs are sequential, which reveals approximate posting volume.
- No on-chain privacy for social graph (follows, reactions are public).

---

## Wallet Security

### Key Principles
- Private keys are never transmitted, stored, or touched by the application.
- Wallet connection establishes a provider connection only.
- Seed phrases are never requested, suggested, or handled.
- Each blockchain write requires a fresh wallet authorization.

### Transaction Security
- Transaction data is constructed server-side where possible and validated client-side.
- Contract ABIs are type-safe via viem's ABI encoding.
- Chain ID validation on every transaction preparation.
- Address validation on all user-provided wallet addresses.

### SIWE Authentication
- Nonces are cryptographically random (crypto.randomBytes(32)).
- Nonces are single-use and expire after 10 minutes.
- Domain binding prevents cross-site signature reuse.
- Chain ID validated in signature verification.
- Address in SIWE message validated against session.
- Server-side nonce storage with expiration.

---

## API Security

### Authentication
- All authenticated routes validate the HTTP-only session cookie.
- Session tokens are cryptographically random.
- Sessions expire after 7 days of inactivity.
- Session revocation on explicit logout and wallet change.

### Authorization
- Server-side permission checks on all protected endpoints.
- Moderation actions require server-verified moderator role.
- Admin actions require server-verified admin role.
- Role membership sourced from both DB and on-chain verification.

### Input Validation
- All API inputs validated with Zod schemas.
- SQL injection prevented by Drizzle ORM parameterized queries.
- Content sanitized before database storage.
- Maximum length limits on all text fields.

### Rate Limiting
- Authentication endpoints: 10 requests/minute per IP.
- Content submission: 20 posts/hour per authenticated wallet.
- Search: 60 requests/minute per IP.
- Media upload: 10 uploads/hour per authenticated wallet.
- Reports: 5 reports/hour per authenticated wallet.
- Global API rate limit: 1000 requests/minute per IP.

### CSRF Protection
- SameSite=Strict cookies for session management.
- CSRF token for state-changing requests (supplementary to SameSite).

---

## Content Security

### XSS Prevention
- All user content rendered through React's default escaping.
- No dangerouslySetInnerHTML with user content.
- Link previews fetched server-side, metadata sanitized.
- Content Security Policy headers configured.

### SSRF Prevention
- Link preview fetching is restricted to allow-listed domains or public IP validation.
- Private IP ranges blocked in preview fetcher.
- Request timeout enforced.
- Redirect following limited and validated.

### Media Security
- MIME type validation on upload.
- File size limits enforced.
- File extension validation.
- Uploaded files processed through sanitization pipeline.
- No executable content accepted.
- Images processed through sharp for normalization.

### Content Integrity
- IPFS CIDs are content-addressed — the CID proves content integrity.
- On-chain CID references cannot be retroactively changed.
- Database CID cache compared against on-chain records during reconciliation.

---

## Data Privacy

### Wallet Addresses
- Wallet addresses are public blockchain identifiers.
- The application does not associate wallet addresses with real-world identity.
- No KYC or identity verification is performed.
- Users are informed that blockchain transactions are public.

### Session Data
- Sessions stored server-side (database).
- Session token transmitted only via HTTP-only, Secure, SameSite=Strict cookie.
- No session data in localStorage or URL parameters.

### Application Data
- PostgreSQL stores application-layer data.
- No sensitive personal information collected beyond wallet address.
- No tracking pixels, analytics SDKs with PII collection.

---

## Secrets Management

### Environment Variables
- All secrets stored in environment variables.
- Never committed to version control.
- `.env.example` documents required variables without values.
- Vercel environment variable encryption used for production.

### Client-Side Code
- No secrets in client-side bundles.
- Next.js NEXT_PUBLIC_ prefix convention enforced.
- Server-only code clearly separated from client code.

---

## Dependency Security

### Strategy
- Minimal dependencies (no unnecessary packages).
- Dependencies pinned to specific versions in package.json.
- Regular `pnpm audit` in CI/CD pipeline.
- OpenZeppelin contracts used as the security foundation.

---

## Known Limitations and Accepted Risks

1. **IPFS Availability:** Content on IPFS may become unavailable if no pinning service maintains it. Mitigation: Use reliable pinning service, cache content in DB.

2. **Blockchain Reorganizations:** Short reorgs can temporarily cause inconsistent state. Mitigation: Indexer implements reorg handling with appropriate confirmation depths.

3. **Gas Price Volatility:** High gas prices may deter on-chain interactions. Mitigation: Base L2 provides predictably low fees.

4. **Front-Running:** Some transactions could theoretically be front-run. This is accepted as a consequence of public blockchain operation and has minimal impact on a social platform.

5. **Moderation Transparency:** On-chain moderation actions are public. Moderation notes are off-chain. This is a deliberate design choice.

6. **Wallet Phishing:** Users connecting their wallets must trust the application. Mitigation: Clear transaction descriptions, no unusual permission requests, transparent open-source code.

---

## Responsible Disclosure

Security vulnerabilities in ONCHAIN should be reported to: security@onchain.app

Please do not disclose vulnerabilities publicly until they have been addressed.
