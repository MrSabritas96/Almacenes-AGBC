CREATE TABLE IF NOT EXISTS "act_gestiones_historial" (
	"gestion" integer PRIMARY KEY NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"iniciada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_en" timestamp with time zone,
	"cerrada_por" text,
	CONSTRAINT "act_gestiones_historial_anio_ck" CHECK ("gestion" BETWEEN 2000 AND 2100),
	CONSTRAINT "act_gestiones_historial_estado_ck" CHECK ("estado" IN ('activa','cerrada')),
	CONSTRAINT "act_gestiones_historial_cierre_ck" CHECK (("estado" = 'activa' AND "cerrada_en" IS NULL AND "cerrada_por" IS NULL) OR ("estado" = 'cerrada' AND "cerrada_en" IS NOT NULL AND "cerrada_por" IS NOT NULL)),
	CONSTRAINT "act_gestiones_historial_cerrada_por_users_id_fk" FOREIGN KEY ("cerrada_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

INSERT INTO "act_gestiones_historial" ("gestion", "estado")
SELECT "gestion", 'activa' FROM "act_gestion_activa" WHERE "id" = 1
ON CONFLICT ("gestion") DO NOTHING;
