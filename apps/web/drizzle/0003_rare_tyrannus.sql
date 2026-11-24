ALTER TABLE "reports" ADD COLUMN "target_chain_entry_id" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_logs_chain_audit_unique_idx" ON "moderation_logs" USING btree ("chain_audit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_chain_report_unique_idx" ON "reports" USING btree ("chain_report_id");
