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
	"responsable_original" text NOT NULL,
	"documento" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "act_documentos_archivo" ADD CONSTRAINT "act_documentos_archivo_archivo_id_act_archivos_actas_id_fk" FOREIGN KEY ("archivo_id") REFERENCES "public"."act_archivos_actas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "act_documentos_archivo" ADD CONSTRAINT "act_documentos_archivo_responsable_id_act_responsables_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."act_responsables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "act_documento_archivo_origen_uq" ON "act_documentos_archivo" USING btree ("archivo_id","hoja","bloque");--> statement-breakpoint
CREATE INDEX "act_documentos_responsable_idx" ON "act_documentos_archivo" USING btree ("responsable_id");