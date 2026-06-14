CREATE TABLE "parcel_correction_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parcel_id" uuid NOT NULL,
  "correction_type" text NOT NULL,
  "old_status" text,
  "new_status" text,
  "old_rider_id" uuid,
  "new_rider_id" uuid,
  "status_log_id" uuid,
  "reason" text NOT NULL,
  "side_effects" jsonb DEFAULT '{"summary":[]}'::jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcel_correction_logs"
ADD CONSTRAINT "parcel_correction_logs_parcel_id_parcels_id_fk"
FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parcel_correction_logs"
ADD CONSTRAINT "parcel_correction_logs_old_rider_id_riders_id_fk"
FOREIGN KEY ("old_rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parcel_correction_logs"
ADD CONSTRAINT "parcel_correction_logs_new_rider_id_riders_id_fk"
FOREIGN KEY ("new_rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parcel_correction_logs"
ADD CONSTRAINT "parcel_correction_logs_status_log_id_parcel_status_logs_id_fk"
FOREIGN KEY ("status_log_id") REFERENCES "public"."parcel_status_logs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parcel_correction_logs"
ADD CONSTRAINT "parcel_correction_logs_created_by_user_id_fk"
FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "parcel_correction_logs_parcel_id_idx" ON "parcel_correction_logs" USING btree ("parcel_id");
--> statement-breakpoint
CREATE INDEX "parcel_correction_logs_created_by_idx" ON "parcel_correction_logs" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "parcel_correction_logs_status_log_id_idx" ON "parcel_correction_logs" USING btree ("status_log_id");
