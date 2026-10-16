CREATE TABLE "act_acta_bienes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acta_id" uuid NOT NULL,
	"activo_id" uuid NOT NULL,
	"asignacion_id" uuid
);
--> statement-breakpoint
CREATE TABLE "act_actas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"solicitud_hash" text NOT NULL,
	"numero" serial NOT NULL,
	"tipo" text NOT NULL,
	"fecha" date NOT NULL,
	"cabecera" jsonb NOT NULL,
	"bienes" jsonb NOT NULL,
	"documento_pdf" "bytea" NOT NULL,
	"pdf_sha256" text NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_actas_solicitud_id_unique" UNIQUE("solicitud_id"),
	CONSTRAINT "act_actas_numero_unique" UNIQUE("numero"),
	CONSTRAINT "act_actas_tipo_ck" CHECK ("act_actas"."tipo" IN ('fija','momentanea','devolucion'))
);
--> statement-breakpoint
ALTER TABLE "act_acta_bienes" ADD CONSTRAINT "act_acta_bienes_acta_id_act_actas_id_fk" FOREIGN KEY ("acta_id") REFERENCES "public"."act_actas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_acta_bienes" ADD CONSTRAINT "act_acta_bienes_activo_id_act_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."act_activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_acta_bienes" ADD CONSTRAINT "act_acta_bienes_asignacion_id_act_asignaciones_id_fk" FOREIGN KEY ("asignacion_id") REFERENCES "public"."act_asignaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_actas" ADD CONSTRAINT "act_actas_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "act_acta_bien_uq" ON "act_acta_bienes" USING btree ("acta_id","activo_id");--> statement-breakpoint
CREATE INDEX "act_acta_bien_activo_idx" ON "act_acta_bienes" USING btree ("activo_id");--> statement-breakpoint
CREATE INDEX "act_actas_fecha_idx" ON "act_actas" USING btree ("fecha");