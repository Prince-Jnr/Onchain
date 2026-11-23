CREATE TABLE "pending_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"parent_chain_id" bigint DEFAULT 0 NOT NULL,
	"reference_chain_id" bigint DEFAULT 0 NOT NULL,
	"content_ref" varchar(66) NOT NULL,
	"text" text NOT NULL,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"mentions" text[] DEFAULT '{}' NOT NULL,
	"media_urls" text[] DEFAULT '{}' NOT NULL,
	"media_metadata" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_entries" ADD CONSTRAINT "pending_entries_author_address_wallets_address_fk" FOREIGN KEY ("author_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_entries_author_ref_unique_idx" ON "pending_entries" USING btree ("author_address","content_ref");--> statement-breakpoint
CREATE INDEX "pending_entries_expiry_idx" ON "pending_entries" USING btree ("expires_at");