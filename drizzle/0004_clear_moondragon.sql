CREATE TABLE "employee_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" integer NOT NULL,
	"serial" text DEFAULT '' NOT NULL,
	"condition" text NOT NULL,
	"location" text NOT NULL,
	"recorded_on" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_material_quantity_positive" CHECK ("employee_materials"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "employee_materials" ADD CONSTRAINT "employee_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_materials" ADD CONSTRAINT "employee_materials_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_materials" ADD CONSTRAINT "employee_materials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_materials" ADD CONSTRAINT "employee_materials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_material_user_idx" ON "employee_materials" USING btree ("user_id");