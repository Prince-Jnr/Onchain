CREATE TABLE "indexed_blocks" (
	"chain_id" integer NOT NULL,
	"contract_name" varchar(50) NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" varchar(66) NOT NULL,
	CONSTRAINT "indexed_blocks_chain_id_contract_name_block_number_pk" PRIMARY KEY("chain_id","contract_name","block_number")
);
--> statement-breakpoint
CREATE TABLE "indexed_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_name" varchar(50) NOT NULL,
	"contract_address" varchar(42) NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" varchar(66) NOT NULL,
	"transaction_hash" varchar(66) NOT NULL,
	"log_index" integer NOT NULL,
	"topics" jsonb NOT NULL,
	"data" text NOT NULL,
	"canonical" boolean DEFAULT true NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "indexer_checkpoints" ADD COLUMN "last_block_hash" varchar(66);--> statement-breakpoint
CREATE INDEX "indexed_blocks_recent_idx" ON "indexed_blocks" USING btree ("chain_id","contract_name","block_number");--> statement-breakpoint
CREATE UNIQUE INDEX "indexed_events_tx_log_unique_idx" ON "indexed_events" USING btree ("chain_id","transaction_hash","log_index");--> statement-breakpoint
CREATE INDEX "indexed_events_block_idx" ON "indexed_events" USING btree ("chain_id","contract_name","block_number");