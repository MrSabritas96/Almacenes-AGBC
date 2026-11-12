CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"material_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"movement_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_description" text NOT NULL,
	"purchased_on" text NOT NULL,
	"lot" text DEFAULT '' NOT NULL,
	"expires_on" text,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(18, 6) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_quantity_positive" CHECK ("purchases"."quantity" > 0),
	CONSTRAINT "purchase_cost_nonnegative" CHECK ("purchases"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"name" text NOT NULL,
	"nit" text NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "material_requests" ALTER COLUMN "needed_on" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "material_requests" ADD COLUMN "unit_cost" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "invoice_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "unit_cost" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "regional" text DEFAULT 'Sin asignar' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unit_cost" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "balance_after" integer;--> statement-breakpoint
ALTER TABLE "warehouse_people" ADD COLUMN "regional" text DEFAULT 'Sin asignar' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_warehouse_nit_unique" ON "suppliers" USING btree ("warehouse_id","nit");
--> statement-breakpoint
CREATE FUNCTION capture_stock_movement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.balance_after IS NULL THEN
    SELECT stock,unit_cost INTO NEW.balance_after,NEW.unit_cost FROM materials WHERE id=NEW.material_id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER stock_movement_snapshot BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION capture_stock_movement();
