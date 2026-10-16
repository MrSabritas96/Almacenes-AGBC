CREATE TYPE "public"."act_estado_asignacion" AS ENUM('activa', 'devuelta', 'reemplazada');--> statement-breakpoint
CREATE TYPE "public"."act_tipo_asignacion" AS ENUM('fija', 'momentanea');--> statement-breakpoint
CREATE TABLE "act_asignaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
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
ALTER TABLE "act_asignaciones" ADD CONSTRAINT "act_asignaciones_activo_id_act_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."act_activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_asignaciones" ADD CONSTRAINT "act_asignaciones_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_asignaciones" ADD CONSTRAINT "act_asignaciones_cerrado_por_users_id_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "act_asignacion_activa_tipo_uq" ON "act_asignaciones" USING btree ("activo_id","tipo") WHERE "act_asignaciones"."estado" = 'activa';--> statement-breakpoint
CREATE INDEX "act_asignaciones_activo_idx" ON "act_asignaciones" USING btree ("activo_id","creado_en");--> statement-breakpoint
CREATE INDEX "act_asignaciones_estado_fecha_idx" ON "act_asignaciones" USING btree ("estado","fecha_devolucion_prevista");--> statement-breakpoint
CREATE VIEW "public"."act_custodia_actual" AS (
  SELECT v.id, v.codigo, v.codigo_historico, v.descripcion, v.origen, v.estado,
    COALESCE(m.responsable_destino, f.responsable_destino, v.responsable) AS responsable,
    COALESCE(m.ubicacion_destino, f.ubicacion_destino, v.ubicacion) AS ubicacion,
    v.incidencias_importacion, v.fila_excel,
    COALESCE(m.id, f.id) AS asignacion_id, COALESCE(m.tipo, f.tipo)::text AS asignacion_tipo,
    m.fecha_devolucion_prevista
  FROM "act_inventario_vigente" v
  LEFT JOIN "act_asignaciones" m ON m.activo_id = v.id AND m.tipo = 'momentanea' AND m.estado = 'activa'
  LEFT JOIN "act_asignaciones" f ON f.activo_id = v.id AND f.tipo = 'fija' AND f.estado = 'activa'
);