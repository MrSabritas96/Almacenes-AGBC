ALTER TABLE "act_documentos_archivo" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "act_documentos_archivo" ADD COLUMN "eliminado_en" timestamp with time zone;