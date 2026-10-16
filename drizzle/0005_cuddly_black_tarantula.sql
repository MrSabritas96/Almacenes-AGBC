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
ALTER TABLE "act_responsable_nombres" ADD CONSTRAINT "act_responsable_nombres_responsable_id_act_responsables_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."act_responsables"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO act_responsables(nombre)
SELECT DISTINCT nullif(translate(upper(trim(regexp_replace(replace(responsable,chr(160),' '),'[[:space:]]+',' ','g'))),'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ','AAAAEEEEIIIIOOOOUUUU'),'') AS nombre
FROM (SELECT responsable FROM act_activos UNION SELECT responsable_destino FROM act_asignaciones) fuentes
WHERE length(trim(coalesce(responsable,''))) >= 3
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO act_responsable_nombres(clave,responsable_id)
SELECT nombre,id FROM act_responsables ON CONFLICT DO NOTHING;
