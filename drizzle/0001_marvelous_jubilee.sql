CREATE TABLE "act_activos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fila_origen_id" uuid NOT NULL,
	"origen" text NOT NULL,
	"numero_origen" text,
	"codigo" text,
	"codigo_historico" text,
	"descripcion" text NOT NULL,
	"estado" text,
	"ubicacion" text,
	"responsable" text,
	"acta" text,
	"observaciones" text,
	"comentario" text,
	"grupo_contable" text,
	"grupo_contable_codigo" text,
	"auxiliar_grupo" text,
	"auxiliar_grupo_alterno" text,
	"vida_util" numeric,
	"porcentaje_depreciacion" numeric,
	"costo_historico" numeric,
	"costo_migrado" numeric,
	"costo_final_actualizado" numeric,
	"depreciacion_gestion" numeric,
	"depreciacion_acumulada" numeric,
	"valor_neto" numeric,
	"fecha_historica" date,
	"fecha_migracion" date,
	"indicador_r" text,
	"rube" text,
	"incidencias_importacion" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_filas_importadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hoja_id" uuid NOT NULL,
	"fila_excel" integer NOT NULL,
	"celdas" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_hojas_importadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importacion_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer NOT NULL,
	"tipo" text NOT NULL,
	"vigencia" text DEFAULT 'pendiente' NOT NULL,
	"filas_con_datos" integer NOT NULL,
	"registros_activos" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_importaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archivo_nombre" text NOT NULL,
	"archivo_sha256" text NOT NULL,
	"archivo_original" "bytea" NOT NULL,
	"resumen" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_importaciones_archivo_sha256_unique" UNIQUE("archivo_sha256")
);
--> statement-breakpoint
ALTER TABLE "act_activos" ADD CONSTRAINT "act_activos_fila_origen_id_act_filas_importadas_id_fk" FOREIGN KEY ("fila_origen_id") REFERENCES "public"."act_filas_importadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_filas_importadas" ADD CONSTRAINT "act_filas_importadas_hoja_id_act_hojas_importadas_id_fk" FOREIGN KEY ("hoja_id") REFERENCES "public"."act_hojas_importadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_hojas_importadas" ADD CONSTRAINT "act_hojas_importadas_importacion_id_act_importaciones_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."act_importaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "act_activos_fila_origen_uq" ON "act_activos" USING btree ("fila_origen_id");--> statement-breakpoint
CREATE INDEX "act_activos_codigo_idx" ON "act_activos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "act_activos_origen_idx" ON "act_activos" USING btree ("origen");--> statement-breakpoint
CREATE INDEX "act_activos_responsable_idx" ON "act_activos" USING btree ("responsable");--> statement-breakpoint
CREATE UNIQUE INDEX "act_filas_hoja_numero_uq" ON "act_filas_importadas" USING btree ("hoja_id","fila_excel");--> statement-breakpoint
CREATE UNIQUE INDEX "act_hojas_importacion_nombre_uq" ON "act_hojas_importadas" USING btree ("importacion_id","nombre");