DROP INDEX "act_asignacion_activa_tipo_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX "act_asignacion_activa_tipo_uq" ON "act_asignaciones" USING btree ("activo_id", "tipo") WHERE "act_asignaciones"."estado" = 'activa' AND "act_asignaciones"."eliminado_en" IS NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW "public"."act_custodia_actual" AS (
  SELECT v.id, v.codigo, v.codigo_historico, v.descripcion, v.origen, v.estado,
    COALESCE(m.responsable_destino, f.responsable_destino, v.responsable) AS responsable,
    COALESCE(m.ubicacion_destino, f.ubicacion_destino, v.ubicacion) AS ubicacion,
    v.incidencias_importacion, v.fila_excel,
    COALESCE(m.id, f.id) AS asignacion_id, COALESCE(m.tipo, f.tipo)::text AS asignacion_tipo,
    m.fecha_devolucion_prevista
  FROM "act_inventario_vigente" v
  LEFT JOIN "act_asignaciones" m ON m.activo_id = v.id AND m.tipo = 'momentanea' AND m.estado = 'activa' AND m.eliminado_en IS NULL
  LEFT JOIN "act_asignaciones" f ON f.activo_id = v.id AND f.tipo = 'fija' AND f.estado = 'activa' AND f.eliminado_en IS NULL
);
