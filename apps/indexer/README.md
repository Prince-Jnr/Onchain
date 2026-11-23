# ONCHAIN Chain Indexer

This long-running worker scans the configured EVM contracts, stores raw logs and chunk block hashes, projects Entries contract events into PostgreSQL, and retries from a durable checkpoint. It holds a PostgreSQL advisory lock per chain so only one process indexes a chain at a time.

## Configuration

Required: `DATABASE_URL`, `INDEXER_CHAIN_ID`, `INDEXER_START_BLOCK`, and the deployed contract address variables for the selected chain. The worker uses `BASE_SEPOLIA_RPC_URL` or `BASE_RPC_URL`, falling back to the public Base RPC endpoint if unset.

Operational knobs: `INDEXER_CONFIRMATIONS` (default 12), `INDEXER_BLOCK_CHUNK` (default 500), `INDEXER_POLL_MS` (default 5000). Set `INDEXER_START_BLOCK` to the earliest deployment block for the configured contracts. Do not use zero for a long-lived chain deployment unless scanning from genesis is intended.

## Run

```sh
pnpm --filter @onchain/indexer build
pnpm --filter @onchain/indexer start
```

Apply database migrations first with `pnpm db:migrate`. The worker records all logs for configured contracts and currently materializes entry creation, moderation status, and pin state. Other contract logs are durably archived but their profile, report, reaction, repost, and follow projections are not yet implemented.

## Reorganization behavior

The worker waits for the configured number of confirmations, persists the hash at each scan chunk boundary, and compares the latest checkpoint with the canonical chain. On mismatch it finds a common saved chunk boundary, reverses entry projections and orphan log rows in descending order, then rescans. It stops with an operator error if a common marker cannot be found among the most recent 128 checkpoints; investigate RPC history and reconcile before restarting. Database and RPC outages leave the previous checkpoint intact and the worker retries.

The worker requires a long-lived Node.js process and WebSocket-compatible Neon PostgreSQL connectivity. Vercel Functions are not an appropriate host for this continuous polling process; deploy it as a separate worker service.
