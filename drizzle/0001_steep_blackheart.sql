CREATE TABLE "material_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"material_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"purpose" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"needed_on" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"delivery_on" text,
	"delivery_place" text,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "request_quantity_positive" CHECK ("material_requests"."quantity" > 0),
	CONSTRAINT "request_valid_status" CHECK ("material_requests"."status" in ('pending','approved','waiting','denied','delivered'))
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"minimum" integer DEFAULT 5 NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "materials_code_unique" UNIQUE("code"),
	CONSTRAINT "material_stock_nonnegative" CHECK ("materials"."stock" >= 0),
	CONSTRAINT "material_minimum_nonnegative" CHECK ("materials"."minimum" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"document" text DEFAULT '' NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"material_id" text NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_user_idx" ON "material_requests" USING btree ("user_id");