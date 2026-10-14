ALTER TABLE "schedules" ALTER COLUMN "saved_query_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "app_id" uuid;--> statement-breakpoint
ALTER TABLE "write_actions" ADD COLUMN "max_affected_rows" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_target_check" CHECK (num_nonnulls(saved_query_id, app_id) = 1);