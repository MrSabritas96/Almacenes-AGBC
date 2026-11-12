CREATE TABLE IF NOT EXISTS "act_gestion_activa" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"gestion" integer NOT NULL,
	"cerrada_en" timestamp with time zone,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "act_gestion_activa_id_ck" CHECK ("id" = 1),
	CONSTRAINT "act_gestion_activa_anio_ck" CHECK ("gestion" BETWEEN 2000 AND 2100)
);

INSERT INTO "act_gestion_activa" ("id", "gestion")
VALUES (1, EXTRACT(YEAR FROM now() AT TIME ZONE 'America/La_Paz')::integer)
ON CONFLICT ("id") DO NOTHING;
