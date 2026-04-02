CREATE TABLE "riders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rider_code" text NOT NULL,
	"full_name" text NOT NULL,
	"phone_number" text,
	"address" text NOT NULL,
	"township" text NOT NULL,
	"notes" text,
	"linked_app_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_linked_app_user_id_app_users_id_fk" FOREIGN KEY ("linked_app_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "riders_rider_code_uidx" ON "riders" USING btree ("rider_code");--> statement-breakpoint
CREATE UNIQUE INDEX "riders_linked_app_user_uidx" ON "riders" USING btree ("linked_app_user_id");--> statement-breakpoint
CREATE INDEX "riders_full_name_idx" ON "riders" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "riders_phone_idx" ON "riders" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "riders_township_idx" ON "riders" USING btree ("township");--> statement-breakpoint
CREATE INDEX "riders_created_at_idx" ON "riders" USING btree ("created_at");