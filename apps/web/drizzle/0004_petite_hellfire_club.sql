CREATE TABLE "api_rate_limits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"type" "notification_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_rate_limits_updated_idx" ON "api_rate_limits" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_wallet_type_idx" ON "notification_preferences" USING btree ("wallet_address","type");