import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { actActivos, actFilasImportadas, actHojasImportadas } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { generarReporteConjuntoPdf } from "@/actions/activos/historial-vida-reporte-pdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Inicia sesión.", { status: 401 });
  if (!(await hasPermission(session.user.id, "activos:read"))) return new Response("Sin permiso.", { status: 403 });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 160);
  const selectedGroup = (params.get("grupo") ?? "").trim().slice(0, 160);
  const conditions = [
    inArray(actHojasImportadas.tipo, ["inventario", "historico"]),
    inArray(actHojasImportadas.vigencia, ["vigente", "historico"]),
  ];
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(
      ilike(actActivos.codigo, pattern),
      ilike(actActivos.codigoHistorico, pattern),
      ilike(actActivos.descripcion, pattern),
      ilike(actActivos.grupoContable, pattern),
      ilike(actActivos.responsable, pattern),
      ilike(actActivos.origen, pattern),
    )!);
  }
  const groupSql = sql<string>`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable')`;
  if (selectedGroup) conditions.push(sql`${groupSql} = ${selectedGroup}`);

  const rows = await db.select({
    grupo: groupSql,
    vigencia: actHojasImportadas.vigencia,
    cantidad: sql<number>`count(*)::int`,
    vidaMin: sql<string | null>`min(${actActivos.vidaUtil})`,
    vidaMax: sql<string | null>`max(${actActivos.vidaUtil})`,
    costoHistorico: sql<string | null>`sum(${actActivos.costoHistorico})`,
    costoActualizado: sql<string | null>`sum(${actActivos.costoFinalActualizado})`,
    depreciacionGestion: sql<string | null>`sum(${actActivos.depreciacionGestion})`,
    depreciacionAcumulada: sql<string | null>`sum(${actActivos.depreciacionAcumulada})`,
    valorNeto: sql<string | null>`sum(${actActivos.valorNeto})`,
  }).from(actActivos)
    .innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`)
    .innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`)
    .where(and(...conditions))
    .groupBy(groupSql, actHojasImportadas.vigencia)
    .orderBy(asc(groupSql), asc(actHojasImportadas.vigencia));

  const total = rows.reduce((sum, row) => sum + row.cantidad, 0);
  const emitido = new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", dateStyle: "long" }).format(new Date());
  const logo = await readFile(join(process.cwd(), "public", "logo-correos.png"));
  const pdf = await generarReporteConjuntoPdf(rows, logo, { listado: selectedGroup || "Todos los grupos contables", emitido, total });
  const filename = "resumen-activos-grupo-contable.pdf";

  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
