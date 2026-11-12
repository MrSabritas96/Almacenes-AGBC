CREATE TABLE "warehouse_closings" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"year" integer NOT NULL,
	"digest" text NOT NULL,
	"filename" text NOT NULL,
	"workbook_base64" text NOT NULL,
	"data" jsonb NOT NULL,
	"imported_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouse_closings" ADD CONSTRAINT "warehouse_closings_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_closings" ADD CONSTRAINT "warehouse_closings_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_closing_year_unique" ON "warehouse_closings" USING btree ("warehouse_id","year");