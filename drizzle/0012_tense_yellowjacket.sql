CREATE TABLE "inventory_allocations" (
	"request_id" text NOT NULL,
	"batch_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "allocation_quantity_positive" CHECK ("inventory_allocations"."quantity">0)
);
--> statement-breakpoint
CREATE TABLE "inventory_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quantity" integer NOT NULL,
	"remaining" integer NOT NULL,
	"unit_cost" numeric(18, 6) NOT NULL,
	"lot" text DEFAULT '' NOT NULL,
	"expires_on" text,
	"source" text NOT NULL,
	CONSTRAINT "batch_valid_balance" CHECK ("inventory_batches"."quantity">0 and "inventory_batches"."remaining">=0 and "inventory_batches"."remaining"<="inventory_batches"."quantity" and "inventory_batches"."unit_cost">=0)
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "batch_id" integer;--> statement-breakpoint
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_batch_id_inventory_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."inventory_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_request_batch_unique" ON "inventory_allocations" USING btree ("request_id","batch_id");--> statement-breakpoint
CREATE INDEX "batch_fifo_idx" ON "inventory_batches" USING btree ("material_id","received_at","id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_inventory_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."inventory_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
LOCK TABLE materials,material_requests IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
-- Conserva el saldo disponible a su costo vigente. No inventa lotes históricos.
INSERT INTO inventory_batches(material_id,received_at,quantity,remaining,unit_cost,source)
SELECT m.id,coalesce((select min(created_at) from stock_movements where material_id=m.id),now()),m.stock,m.stock,m.unit_cost,'Saldo previo a PEPS'
FROM materials m WHERE m.stock>0 ORDER BY m.code,m.id;
--> statement-breakpoint
-- Reservas/entregas previas conservan su costo y permiten corregir/anular sin perder trazabilidad.
INSERT INTO inventory_batches(material_id,received_at,quantity,remaining,unit_cost,lot,expires_on,source)
SELECT r.material_id,r.created_at,coalesce(r.authorized_quantity,r.quantity),0,coalesce(r.unit_cost,m.unit_cost),r.lot,r.expires_on,'legacy-request:'||r.id
FROM material_requests r JOIN materials m ON m.id=r.material_id WHERE r.status IN ('approved','delivered') ORDER BY r.created_at,r.id;
--> statement-breakpoint
INSERT INTO inventory_allocations(request_id,batch_id,quantity)
SELECT r.id,b.id,coalesce(r.authorized_quantity,r.quantity) FROM material_requests r JOIN inventory_batches b ON b.source='legacy-request:'||r.id WHERE r.status IN ('approved','delivered');
