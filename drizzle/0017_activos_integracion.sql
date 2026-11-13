CREATE TYPE "public"."act_estado_asignacion" AS ENUM('activa', 'devuelta', 'reemplazada');--> statement-breakpoint
CREATE TYPE "public"."act_tipo_asignacion" AS ENUM('fija', 'momentanea');--> statement-breakpoint
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
	"procedencia_serie" text,
	"gestion_serie" integer,
	"tipo" text NOT NULL,
	"fecha" date NOT NULL,
	"cabecera" jsonb NOT NULL,
	"bienes" jsonb NOT NULL,
	"documento_pdf" "bytea" NOT NULL,
	"pdf_sha256" text NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_actas_solicitud_id_unique" UNIQUE("solicitud_id"),
	CONSTRAINT "act_actas_tipo_ck" CHECK ("act_actas"."tipo" IN ('fija','momentanea','devolucion'))
);
--> statement-breakpoint
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
	"regional" text,
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
CREATE TABLE "act_archivo_pdf" (
	"documento_id" uuid PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"tipo" text NOT NULL,
	"fecha" date,
	"ciudad" text NOT NULL,
	"departamento" text NOT NULL,
	"regional" text NOT NULL,
	"ambito" text NOT NULL,
	"observaciones" jsonb NOT NULL,
	"area_impresion" text NOT NULL,
	"fuente_sha256" text NOT NULL,
	"pdf_original" "bytea",
	"pdf_sha256" text,
	"motor" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_archivos_actas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"sha256" text NOT NULL,
	"original" "bytea" NOT NULL,
	"resumen" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_archivos_actas_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "act_asignaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"eliminado_en" timestamp with time zone,
	"activo_id" uuid NOT NULL,
	"tipo" "act_tipo_asignacion" NOT NULL,
	"estado" "act_estado_asignacion" DEFAULT 'activa' NOT NULL,
	"responsable_destino" text NOT NULL,
	"ubicacion_destino" text NOT NULL,
	"responsable_anterior" text,
	"ubicacion_anterior" text,
	"fecha_inicio" date NOT NULL,
	"fecha_devolucion_prevista" date,
	"fecha_cierre" date,
	"motivo" text NOT NULL,
	"referencia_acta" text,
	"motivo_cierre" text,
	"creado_por" text NOT NULL,
	"cerrado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_asignaciones_solicitud_id_unique" UNIQUE("solicitud_id"),
	CONSTRAINT "act_asignacion_destino_ck" CHECK (length(trim("act_asignaciones"."responsable_destino")) > 0 AND length(trim("act_asignaciones"."ubicacion_destino")) > 0 AND length(trim("act_asignaciones"."motivo")) > 0),
	CONSTRAINT "act_asignacion_plazo_ck" CHECK (("act_asignaciones"."tipo" = 'fija' AND "act_asignaciones"."fecha_devolucion_prevista" IS NULL) OR ("act_asignaciones"."tipo" = 'momentanea' AND "act_asignaciones"."fecha_devolucion_prevista" IS NOT NULL AND "act_asignaciones"."fecha_devolucion_prevista" >= "act_asignaciones"."fecha_inicio")),
	CONSTRAINT "act_asignacion_cierre_ck" CHECK (("act_asignaciones"."estado" = 'activa' AND "act_asignaciones"."fecha_cierre" IS NULL AND "act_asignaciones"."cerrado_por" IS NULL AND "act_asignaciones"."motivo_cierre" IS NULL) OR ("act_asignaciones"."estado" <> 'activa' AND "act_asignaciones"."fecha_cierre" IS NOT NULL AND "act_asignaciones"."fecha_cierre" >= "act_asignaciones"."fecha_inicio" AND "act_asignaciones"."cerrado_por" IS NOT NULL AND "act_asignaciones"."motivo_cierre" IS NOT NULL AND length(trim("act_asignaciones"."motivo_cierre")) > 0))
);
--> statement-breakpoint
CREATE TABLE "act_documentos_archivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archivo_id" uuid NOT NULL,
	"hoja" text NOT NULL,
	"bloque" text NOT NULL,
	"procedencia" text NOT NULL,
	"tipo" text NOT NULL,
	"numero" text NOT NULL,
	"fecha" date,
	"responsable_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"eliminado_en" timestamp with time zone,
	"responsable_original" text NOT NULL,
	"documento" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_filas_importadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hoja_id" uuid NOT NULL,
	"fila_excel" integer NOT NULL,
	"celdas" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_gestion_activa" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"gestion" integer NOT NULL,
	"cerrada_en" timestamp with time zone,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_gestion_activa_id_ck" CHECK ("act_gestion_activa"."id" = 1),
	CONSTRAINT "act_gestion_activa_anio_ck" CHECK ("act_gestion_activa"."gestion" BETWEEN 2000 AND 2100)
);
--> statement-breakpoint
CREATE TABLE "act_gestiones_historial" (
	"gestion" integer PRIMARY KEY NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"iniciada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_en" timestamp with time zone,
	"cerrada_por" text,
	CONSTRAINT "act_gestiones_historial_anio_ck" CHECK ("act_gestiones_historial"."gestion" BETWEEN 2000 AND 2100),
	CONSTRAINT "act_gestiones_historial_estado_ck" CHECK ("act_gestiones_historial"."estado" IN ('activa','cerrada')),
	CONSTRAINT "act_gestiones_historial_cierre_ck" CHECK (("act_gestiones_historial"."estado" = 'activa' AND "act_gestiones_historial"."cerrada_en" IS NULL AND "act_gestiones_historial"."cerrada_por" IS NULL) OR ("act_gestiones_historial"."estado" = 'cerrada' AND "act_gestiones_historial"."cerrada_en" IS NOT NULL AND "act_gestiones_historial"."cerrada_por" IS NOT NULL))
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
CREATE TABLE "act_mantenimientos_vehiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activo_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"kilometraje" text,
	"descripcion" text NOT NULL,
	"taller" text,
	"unidad" text,
	"factura" text,
	"importe" text,
	"observaciones" text,
	"registrado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_procedencias" (
	"clave" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"prefijo" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_procedencias_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "act_procedencias_prefijo_unique" UNIQUE("prefijo")
);
--> statement-breakpoint
CREATE TABLE "act_responsable_nombres" (
	"clave" text PRIMARY KEY NOT NULL,
	"responsable_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_responsables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"cargo" text,
	"oficina" text,
	"telefono" text,
	"correo" text,
	"eliminado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_responsables_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "act_responsable_nombre_ck" CHECK (length(trim("act_responsables"."nombre")) >= 3)
);
--> statement-breakpoint
ALTER TABLE "act_acta_bienes" ADD CONSTRAINT "act_acta_bienes_acta_id_act_actas_id_fk" FOREIGN KEY ("acta_id") REFERENCES "public"."act_actas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_acta_bienes" ADD CONSTRAINT "act_acta_bienes_activo_id_act_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."act_activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_acta_bienes" ADD CONSTRAINT "act_acta_bienes_asignacion_id_act_asignaciones_id_fk" FOREIGN KEY ("asignacion_id") REFERENCES "public"."act_asignaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_actas" ADD CONSTRAINT "act_actas_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_activos" ADD CONSTRAINT "act_activos_fila_origen_id_act_filas_importadas_id_fk" FOREIGN KEY ("fila_origen_id") REFERENCES "public"."act_filas_importadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_archivo_pdf" ADD CONSTRAINT "act_archivo_pdf_documento_id_act_documentos_archivo_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."act_documentos_archivo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_asignaciones" ADD CONSTRAINT "act_asignaciones_activo_id_act_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."act_activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_asignaciones" ADD CONSTRAINT "act_asignaciones_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_asignaciones" ADD CONSTRAINT "act_asignaciones_cerrado_por_users_id_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_documentos_archivo" ADD CONSTRAINT "act_documentos_archivo_archivo_id_act_archivos_actas_id_fk" FOREIGN KEY ("archivo_id") REFERENCES "public"."act_archivos_actas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_documentos_archivo" ADD CONSTRAINT "act_documentos_archivo_responsable_id_act_responsables_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."act_responsables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_filas_importadas" ADD CONSTRAINT "act_filas_importadas_hoja_id_act_hojas_importadas_id_fk" FOREIGN KEY ("hoja_id") REFERENCES "public"."act_hojas_importadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_gestiones_historial" ADD CONSTRAINT "act_gestiones_historial_cerrada_por_users_id_fk" FOREIGN KEY ("cerrada_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_hojas_importadas" ADD CONSTRAINT "act_hojas_importadas_importacion_id_act_importaciones_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."act_importaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_mantenimientos_vehiculos" ADD CONSTRAINT "act_mantenimientos_vehiculos_activo_id_act_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."act_activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_mantenimientos_vehiculos" ADD CONSTRAINT "act_mantenimientos_vehiculos_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_responsable_nombres" ADD CONSTRAINT "act_responsable_nombres_responsable_id_act_responsables_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."act_responsables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "act_acta_bien_uq" ON "act_acta_bienes" USING btree ("acta_id","activo_id");--> statement-breakpoint
CREATE INDEX "act_acta_bien_activo_idx" ON "act_acta_bienes" USING btree ("activo_id");--> statement-breakpoint
CREATE INDEX "act_actas_fecha_idx" ON "act_actas" USING btree ("fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "act_actas_serie_tipo_numero_uq" ON "act_actas" USING btree ("procedencia_serie","gestion_serie",case when "tipo"='devolucion' then 'devolucion' else 'asignacion' end,"numero");--> statement-breakpoint
CREATE UNIQUE INDEX "act_activos_fila_origen_uq" ON "act_activos" USING btree ("fila_origen_id");--> statement-breakpoint
CREATE INDEX "act_activos_codigo_idx" ON "act_activos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "act_activos_origen_idx" ON "act_activos" USING btree ("origen");--> statement-breakpoint
CREATE INDEX "act_activos_responsable_idx" ON "act_activos" USING btree ("responsable");--> statement-breakpoint
CREATE INDEX "act_archivo_pdf_region_idx" ON "act_archivo_pdf" USING btree ("departamento","regional","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "act_asignacion_activa_tipo_uq" ON "act_asignaciones" USING btree ("activo_id","tipo") WHERE "act_asignaciones"."estado" = 'activa' AND "act_asignaciones"."eliminado_en" IS NULL;--> statement-breakpoint
CREATE INDEX "act_asignaciones_activo_idx" ON "act_asignaciones" USING btree ("activo_id","creado_en");--> statement-breakpoint
CREATE INDEX "act_asignaciones_estado_fecha_idx" ON "act_asignaciones" USING btree ("estado","fecha_devolucion_prevista");--> statement-breakpoint
CREATE UNIQUE INDEX "act_documento_archivo_origen_uq" ON "act_documentos_archivo" USING btree ("archivo_id","hoja","bloque");--> statement-breakpoint
CREATE INDEX "act_documentos_responsable_idx" ON "act_documentos_archivo" USING btree ("responsable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "act_filas_hoja_numero_uq" ON "act_filas_importadas" USING btree ("hoja_id","fila_excel");--> statement-breakpoint
CREATE UNIQUE INDEX "act_hojas_importacion_nombre_uq" ON "act_hojas_importadas" USING btree ("importacion_id","nombre");--> statement-breakpoint
CREATE INDEX "act_mantenimientos_vehiculo_fecha_idx" ON "act_mantenimientos_vehiculos" USING btree ("activo_id","fecha");--> statement-breakpoint
CREATE VIEW "public"."act_inventario_vigente" AS (select "act_activos"."id", "act_activos"."fila_origen_id", "act_activos"."origen", "act_activos"."numero_origen", "act_activos"."codigo", "act_activos"."codigo_historico", "act_activos"."descripcion", "act_activos"."estado", "act_activos"."ubicacion", "act_activos"."regional", "act_activos"."responsable", "act_activos"."acta", "act_activos"."observaciones", "act_activos"."comentario", "act_activos"."grupo_contable", "act_activos"."grupo_contable_codigo", "act_activos"."auxiliar_grupo", "act_activos"."auxiliar_grupo_alterno", "act_activos"."vida_util", "act_activos"."porcentaje_depreciacion", "act_activos"."costo_historico", "act_activos"."costo_migrado", "act_activos"."costo_final_actualizado", "act_activos"."depreciacion_gestion", "act_activos"."depreciacion_acumulada", "act_activos"."valor_neto", "act_activos"."fecha_historica", "act_activos"."fecha_migracion", "act_activos"."indicador_r", "act_activos"."rube", "act_activos"."incidencias_importacion", "act_activos"."creado_en", "act_filas_importadas"."fila_excel", "act_hojas_importadas"."nombre" from "act_activos" inner join "act_filas_importadas" on "act_activos"."fila_origen_id" = "act_filas_importadas"."id" inner join "act_hojas_importadas" on "act_filas_importadas"."hoja_id" = "act_hojas_importadas"."id" where "act_hojas_importadas"."vigencia" = 'vigente');
--> statement-breakpoint
CREATE VIEW "public"."act_custodia_actual" AS (
  SELECT v.id, v.codigo, v.codigo_historico, v.descripcion, v.origen, v.estado,
    COALESCE(m.responsable_destino, f.responsable_destino, v.responsable) AS responsable,
    COALESCE(m.ubicacion_destino, f.ubicacion_destino, v.ubicacion) AS ubicacion,
    v.incidencias_importacion, v.fila_excel,
    COALESCE(m.id, f.id) AS asignacion_id, COALESCE(m.tipo, f.tipo)::text AS asignacion_tipo,
    m.fecha_devolucion_prevista
  FROM "act_inventario_vigente" v
  LEFT JOIN "act_asignaciones" m ON m.activo_id = v.id AND m.tipo = 'momentanea' AND m.estado = 'activa' AND m.eliminado_en IS NULL
  LEFT JOIN "act_asignaciones" f ON f.activo_id = v.id AND f.tipo = 'fija' AND f.estado = 'activa' AND f.eliminado_en IS NULL
);--> statement-breakpoint