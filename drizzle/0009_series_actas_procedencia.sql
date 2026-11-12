ALTER TABLE "act_actas" DROP CONSTRAINT "act_actas_numero_unique";--> statement-breakpoint
ALTER TABLE "act_actas" ADD COLUMN "procedencia_serie" text;--> statement-breakpoint
ALTER TABLE "act_actas" ADD COLUMN "gestion_serie" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "act_actas_serie_numero_uq" ON "act_actas" USING btree ("procedencia_serie","gestion_serie","numero");