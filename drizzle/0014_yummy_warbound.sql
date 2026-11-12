ALTER TABLE "material_requests" ADD COLUMN "group_reference" text;--> statement-breakpoint
CREATE INDEX "request_group_idx" ON "material_requests" USING btree ("group_reference");