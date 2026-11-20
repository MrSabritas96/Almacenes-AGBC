import { sql } from "drizzle-orm";
import { db } from "@/db";

export type SerieActa = "asignacion" | "devolucion";

/** Correlativo independiente por procedencia, gestión y clase de operación. */
export async function siguienteNumeroActa(entidad: string, gestion: number, tipo: SerieActa, database: Pick<typeof db,"execute"> = db) {
  const resultado = await database.execute<{ numero: number }>(sql`
    SELECT (greatest(
      (SELECT coalesce(max(substring(ref.numero FROM '^[^0-9]*([0-9]+)([[:space:]/-]|$)')::integer),0)
       FROM act_documentos_archivo d LEFT JOIN act_archivo_pdf p ON p.documento_id=d.id
       CROSS JOIN LATERAL (VALUES (coalesce(p.numero,d.numero)), (d.documento->>'numero')) ref(numero)
       WHERE d.procedencia=${entidad}
         AND (( ${tipo}='devolucion' AND d.tipo='devolucion') OR (${tipo}='asignacion' AND d.tipo IN ('asignacion','actualizacion')))
         AND ref.numero ~ ${`/[[:space:]]*${gestion}[[:space:]]*$`}),
      (SELECT coalesce(max(numero),0) FROM act_actas
       WHERE procedencia_serie=${entidad} AND gestion_serie=${gestion}
         AND ((${tipo}='devolucion' AND tipo='devolucion') OR (${tipo}='asignacion' AND tipo IN ('fija','momentanea'))))
    ) + 1)::integer AS numero
  `);
  return resultado.rows[0]!.numero;
}
