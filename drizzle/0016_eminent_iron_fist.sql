CREATE TABLE "warehouse_closing_statements" (
	"closing_id" text PRIMARY KEY NOT NULL,
	"digest" text NOT NULL,
	"filename" text NOT NULL,
	"workbook_base64" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouse_closing_statements" ADD CONSTRAINT "warehouse_closing_statements_closing_id_warehouse_closings_id_fk" FOREIGN KEY ("closing_id") REFERENCES "public"."warehouse_closings"("id") ON DELETE no action ON UPDATE no action;