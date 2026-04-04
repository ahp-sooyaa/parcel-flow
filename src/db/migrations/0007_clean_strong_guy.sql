ALTER TABLE "app_users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "app_users_deleted_at_idx" ON "app_users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "merchants_deleted_at_idx" ON "merchants" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "riders_deleted_at_idx" ON "riders" USING btree ("deleted_at");