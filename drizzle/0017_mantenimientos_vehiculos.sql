CREATE TABLE "act_mantenimientos_vehiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activo_id" uuid NOT NULL REFERENCES "act_activos"("id"),
	"fecha" date NOT NULL,
	"kilometraje" text,
	"descripcion" text NOT NULL,
	"taller" text,
	"unidad" text,
	"factura" text,
	"importe" text,
	"observaciones" text,
	"registrado_por" text NOT NULL REFERENCES "users"("id"),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "act_mantenimientos_vehiculo_fecha_idx" ON "act_mantenimientos_vehiculos" USING btree ("activo_id", "fecha");
