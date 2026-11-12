DROP INDEX IF EXISTS "act_actas_serie_numero_uq";
CREATE UNIQUE INDEX IF NOT EXISTS "act_actas_serie_tipo_numero_uq"
  ON "act_actas" USING btree (
    "procedencia_serie",
    "gestion_serie",
    (CASE WHEN "tipo" = 'devolucion' THEN 'devolucion' ELSE 'asignacion' END),
    "numero"
  );
