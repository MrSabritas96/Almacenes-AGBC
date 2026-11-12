import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { actActivos, actFilasImportadas, actHojasImportadas, actImportaciones } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { generarDetalleHistoricoPdf } from "@/actions/activos/historial-vida-detalle-pdf";

export const runtime = "nodejs";
const PAGE_SIZE = 30;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Inicia sesión.", { status: 401 });
  if (!(await hasPermission(session.user.id, "activos:read"))) return new Response("Sin permiso.", { status: 403 });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 160);
  const group = (params.get("grupo") ?? "").trim().slice(0, 160);
  const requestedPage = Number(params.get("pagina") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1_000_000) : 1;
  const base = [
    inArray(actHojasImportadas.tipo, ["inventario", "historico"]),
    inArray(actHojasImportadas.vigencia, ["vigente", "historico"]),
  ];
  const filtered = [...base];
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    filtered.push(or(
      ilike(actActivos.codigo, pattern),
      ilike(actActivos.codigoHistorico, pattern),
      ilike(actActivos.descripcion, pattern),
      ilike(actActivos.grupoContable, pattern),
      ilike(actActivos.responsable, pattern),
      ilike(actActivos.origen, pattern),
    )!);
  }
  if (group) filtered.push(sql`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable') = ${group}`);
  const where = and(...filtered);

  const [countRows, records] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` })
      .from(actActivos)
      .innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`)
      .innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`)
      .where(where),
    db.select({
      codigo: actActivos.codigo,
      codigoHistorico: actActivos.codigoHistorico,
      grupo: actActivos.grupoContable,
      grupoCodigo: actActivos.grupoContableCodigo,
      descripcion: actActivos.descripcion,
      fechaHistorica: actActivos.fechaHistorica,
      vidaUtil: actActivos.vidaUtil,
      porcentaje: actActivos.porcentajeDepreciacion,
      costoHistorico: actActivos.costoHistorico,
      costoMigrado: actActivos.costoMigrado,
      costoActualizado: actActivos.costoFinalActualizado,
      depreciacionGestion: actActivos.depreciacionGestion,
      depreciacionAcumulada: actActivos.depreciacionAcumulada,
      valorNeto: actActivos.valorNeto,
      origen: actActivos.origen,
      hoja: actHojasImportadas.nombre,
      vigencia: actHojasImportadas.vigencia,
      archivo: actImportaciones.archivoNombre,
      importadoEn: actImportaciones.creadoEn,
    }).from(actActivos)
      .innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`)
      .innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`)
      .innerJoin(actImportaciones, sql`${actHojasImportadas.importacionId} = ${actImportaciones.id}`)
      .where(where)
      .orderBy(desc(actImportaciones.creadoEn), asc(actActivos.grupoContable), asc(actActivos.codigo))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = countRows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const currentRecords = page === currentPage ? records : await db.select({
    codigo: actActivos.codigo,
    codigoHistorico: actActivos.codigoHistorico,
    grupo: actActivos.grupoContable,
    grupoCodigo: actActivos.grupoContableCodigo,
    descripcion: actActivos.descripcion,
    fechaHistorica: actActivos.fechaHistorica,
    vidaUtil: actActivos.vidaUtil,
    porcentaje: actActivos.porcentajeDepreciacion,
    costoHistorico: actActivos.costoHistorico,
    costoMigrado: actActivos.costoMigrado,
    costoActualizado: actActivos.costoFinalActualizado,
    depreciacionGestion: actActivos.depreciacionGestion,
    depreciacionAcumulada: actActivos.depreciacionAcumulada,
    valorNeto: actActivos.valorNeto,
    origen: actActivos.origen,
    hoja: actHojasImportadas.nombre,
    vigencia: actHojasImportadas.vigencia,
    archivo: actImportaciones.archivoNombre,
    importadoEn: actImportaciones.creadoEn,
  }).from(actActivos)
    .innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`)
    .innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`)
    .innerJoin(actImportaciones, sql`${actHojasImportadas.importacionId} = ${actImportaciones.id}`)
    .where(where)
    .orderBy(desc(actImportaciones.creadoEn), asc(actActivos.grupoContable), asc(actActivos.codigo))
    .limit(PAGE_SIZE)
    .offset((currentPage - 1) * PAGE_SIZE);

  const logo = await readFile(join(process.cwd(), "public", "logo-correos.png"));
  const pdf = await generarDetalleHistoricoPdf(currentRecords, logo, { total, page: currentPage, pages, group, query: q });
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="detalle-contable-historico-pagina-${currentPage}.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
