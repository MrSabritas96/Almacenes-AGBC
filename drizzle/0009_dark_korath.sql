ALTER TABLE "material_requests" ADD COLUMN "authorized_quantity" integer;--> statement-breakpoint
ALTER TABLE "material_requests" ADD COLUMN "fund" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_requests" ADD COLUMN "lot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_requests" ADD COLUMN "expires_on" text;