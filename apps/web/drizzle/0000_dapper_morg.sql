CREATE TYPE "public"."badge_type" AS ENUM('EARLY_CONTRIBUTOR', 'FOUNDING_MEMBER', 'ACTIVE_PARTICIPANT', 'TRUSTED_CONTRIBUTOR', 'VERIFIED_MODERATOR', 'CREATOR', 'COMMUNITY_MEMBER');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('ACTIVE', 'DELETED', 'HIDDEN', 'PENDING', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('POST', 'COMMENT', 'QUOTE');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('APPROVE', 'REJECT', 'HIDE', 'RESTORE', 'PIN', 'UNPIN', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."moderation_mode" AS ENUM('OPEN', 'TRUSTED', 'STRICT', 'EVENT');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('REPLY', 'COMMENT', 'MENTION', 'REPOST', 'QUOTE', 'REACTION', 'FOLLOW', 'MODERATION', 'ADMIN_ANNOUNCEMENT');--> statement-breakpoint
CREATE TYPE "public"."reaction_type" AS ENUM('LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'ANGRY');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'MISINFORMATION', 'ILLEGAL_CONTENT', 'VIOLENT_CONTENT', 'ADULT_CONTENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."user_restriction" AS ENUM('NONE', 'RESTRICTED', 'BANNED');--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_address" varchar(42)
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"type" "badge_type" NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_entry_id" bigint,
	"tx_hash" varchar(66),
	"block_number" bigint,
	"log_index" integer,
	"author_address" varchar(42) NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"parent_id" integer,
	"reference_id" integer,
	"content_ref" text NOT NULL,
	"chain_created_at" timestamp,
	"status" "entry_status" DEFAULT 'PENDING' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"repost_count" integer DEFAULT 0 NOT NULL,
	"total_reactions" integer DEFAULT 0 NOT NULL,
	"reaction_like" integer DEFAULT 0 NOT NULL,
	"reaction_love" integer DEFAULT 0 NOT NULL,
	"reaction_laugh" integer DEFAULT 0 NOT NULL,
	"reaction_wow" integer DEFAULT 0 NOT NULL,
	"reaction_sad" integer DEFAULT 0 NOT NULL,
	"reaction_angry" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "entries_chain_entry_id_unique" UNIQUE("chain_entry_id")
);
--> statement-breakpoint
CREATE TABLE "entry_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"text" text NOT NULL,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"mentions" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_hashtags" (
	"entry_id" integer NOT NULL,
	"hashtag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_address" varchar(42) NOT NULL,
	"followed_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hashtags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag" varchar(100) NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hashtags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "indexer_checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_name" varchar(50) NOT NULL,
	"last_block" bigint DEFAULT 0 NOT NULL,
	"last_log_index" integer DEFAULT 0 NOT NULL,
	"last_tx_hash" varchar(66),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"url" text NOT NULL,
	"ipfs_cid" text,
	"mime_type" varchar(100) NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"alt_text" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"mentioned_address" varchar(42) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_address" varchar(42) NOT NULL,
	"action" "moderation_action" NOT NULL,
	"target_entry_id" integer,
	"target_wallet_address" varchar(42),
	"reason" text,
	"tx_hash" varchar(66),
	"chain_audit_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_address" varchar(42) NOT NULL,
	"type" "notification_type" NOT NULL,
	"actor_address" varchar(42),
	"target_entry_id" integer,
	"target_wallet_address" varchar(42),
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"display_name" varchar(50),
	"bio" text,
	"avatar_url" text,
	"banner_url" text,
	"website" text,
	"twitter_handle" varchar(50),
	"github_handle" varchar(50),
	"metadata_ref" text,
	"registered_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"following_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"reaction_type" "reaction_type" NOT NULL,
	"tx_hash" varchar(66),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_report_id" bigint,
	"reporter_address" varchar(42) NOT NULL,
	"target_entry_id" integer,
	"target_wallet_address" varchar(42),
	"category" "report_category" NOT NULL,
	"status" "report_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"tx_hash" varchar(66),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_address" varchar(42)
);
--> statement-breakpoint
CREATE TABLE "reposts" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "siwe_nonces" (
	"id" serial PRIMARY KEY NOT NULL,
	"nonce" varchar(64) NOT NULL,
	"wallet_address" varchar(42),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	CONSTRAINT "siwe_nonces_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"address" varchar(42) PRIMARY KEY NOT NULL,
	"chain_id" integer DEFAULT 8453 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"restriction" "user_restriction" DEFAULT 'NONE' NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"is_moderator" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_author_address_wallets_address_fk" FOREIGN KEY ("author_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_content" ADD CONSTRAINT "entry_content_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_hashtags" ADD CONSTRAINT "entry_hashtags_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_hashtags" ADD CONSTRAINT "entry_hashtags_hashtag_id_hashtags_id_fk" FOREIGN KEY ("hashtag_id") REFERENCES "public"."hashtags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_address_wallets_address_fk" FOREIGN KEY ("follower_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_address_wallets_address_fk" FOREIGN KEY ("followed_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_actor_address_wallets_address_fk" FOREIGN KEY ("actor_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_target_entry_id_entries_id_fk" FOREIGN KEY ("target_entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_address_wallets_address_fk" FOREIGN KEY ("recipient_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_address_wallets_address_fk" FOREIGN KEY ("actor_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_entry_id_entries_id_fk" FOREIGN KEY ("target_entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_address_wallets_address_fk" FOREIGN KEY ("reporter_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_entry_id_entries_id_fk" FOREIGN KEY ("target_entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badges_wallet_type_idx" ON "badges" USING btree ("wallet_address","type");--> statement-breakpoint
CREATE INDEX "badges_wallet_idx" ON "badges" USING btree ("wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_entry_wallet_idx" ON "bookmarks" USING btree ("entry_id","wallet_address");--> statement-breakpoint
CREATE INDEX "bookmarks_wallet_idx" ON "bookmarks" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "bookmarks_entry_idx" ON "bookmarks" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "entries_author_idx" ON "entries" USING btree ("author_address");--> statement-breakpoint
CREATE INDEX "entries_parent_idx" ON "entries" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "entries_status_idx" ON "entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entries_created_idx" ON "entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "entries_chain_id_idx" ON "entries" USING btree ("chain_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_tx_hash_unique_idx" ON "entries" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "entries_type_idx" ON "entries" USING btree ("entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_content_entry_idx" ON "entry_content" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_hashtags_pair_idx" ON "entry_hashtags" USING btree ("entry_id","hashtag_id");--> statement-breakpoint
CREATE INDEX "entry_hashtags_hashtag_idx" ON "entry_hashtags" USING btree ("hashtag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_pair_idx" ON "follows" USING btree ("follower_address","followed_address");--> statement-breakpoint
CREATE INDEX "follows_follower_idx" ON "follows" USING btree ("follower_address");--> statement-breakpoint
CREATE INDEX "follows_followed_idx" ON "follows" USING btree ("followed_address");--> statement-breakpoint
CREATE INDEX "hashtags_count_idx" ON "hashtags" USING btree ("post_count");--> statement-breakpoint
CREATE INDEX "hashtags_tag_idx" ON "hashtags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "indexer_chain_contract_idx" ON "indexer_checkpoints" USING btree ("chain_id","contract_name");--> statement-breakpoint
CREATE INDEX "media_entry_idx" ON "media" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_entry_cid_unique_idx" ON "media" USING btree ("entry_id","ipfs_cid");--> statement-breakpoint
CREATE INDEX "mentions_entry_idx" ON "mentions" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "mentions_address_idx" ON "mentions" USING btree ("mentioned_address");--> statement-breakpoint
CREATE INDEX "moderation_logs_actor_idx" ON "moderation_logs" USING btree ("actor_address");--> statement-breakpoint
CREATE INDEX "moderation_logs_action_idx" ON "moderation_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "moderation_logs_created_idx" ON "moderation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_address");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_wallet_idx" ON "profiles" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "profiles_display_name_idx" ON "profiles" USING btree ("display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_entry_wallet_idx" ON "reactions" USING btree ("entry_id","wallet_address");--> statement-breakpoint
CREATE INDEX "reactions_entry_idx" ON "reactions" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "reactions_wallet_idx" ON "reactions" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_address");--> statement-breakpoint
CREATE INDEX "reports_target_entry_idx" ON "reports" USING btree ("target_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reposts_entry_wallet_idx" ON "reposts" USING btree ("entry_id","wallet_address");--> statement-breakpoint
CREATE INDEX "reposts_wallet_idx" ON "reposts" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "sessions_wallet_idx" ON "sessions" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "siwe_nonces_expires_idx" ON "siwe_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "siwe_nonces_nonce_idx" ON "siwe_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "wallets_last_seen_idx" ON "wallets" USING btree ("last_seen_at");