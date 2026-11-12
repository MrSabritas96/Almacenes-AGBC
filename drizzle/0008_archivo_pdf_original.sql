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
ALTER TABLE "act_archivo_pdf" ADD CONSTRAINT "act_archivo_pdf_documento_id_act_documentos_archivo_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."act_documentos_archivo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "act_archivo_pdf_region_idx" ON "act_archivo_pdf" USING btree ("departamento","regional","tipo");