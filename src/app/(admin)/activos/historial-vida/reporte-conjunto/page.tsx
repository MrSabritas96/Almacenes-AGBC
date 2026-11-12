import Link from "next/link";
import { and, asc, ilike, inArray, or, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { actActivos, actFilasImportadas, actHojasImportadas } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { ImprimirHistorialVida } from "@/components/modules/activos/imprimir-historial-vida";
import { LogoCorreosImpresion } from "@/components/modules/activos/logo-correos-impresion";

type SearchParams = Record<string, string | string[] | undefined>;
const param = (params: SearchParams, key: string) => {
  const raw = params[key];
  return (Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim().slice(0, 160);
};
const money = (value: string | null) => value == null || value === "" ? "—" : new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(Number(value));

export default async function ReporteConjuntoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read"))) redirect("/dashboard");
  const params = await searchParams;
  const q = param(params, "q");
  const selectedGroup = param(params, "grupo");
  const base = [inArray(actHojasImportadas.tipo, ["inventario", "historico"]), inArray(actHojasImportadas.vigencia, ["vigente", "historico"])];
  const conditions = [...base];
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(actActivos.codigo, pattern), ilike(actActivos.codigoHistorico, pattern), ilike(actActivos.descripcion, pattern), ilike(actActivos.grupoContable, pattern), ilike(actActivos.responsable, pattern), ilike(actActivos.origen, pattern))!);
  }
  if (selectedGroup) conditions.push(sql`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable') = ${selectedGroup}`);
  const grupoSql = sql<string>`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable')`;
  const rows = await db.select({
    grupo: grupoSql,
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
    .groupBy(grupoSql, actHojasImportadas.vigencia)
    .orderBy(asc(grupoSql), asc(actHojasImportadas.vigencia));
  const total = rows.reduce((sum, row) => sum + row.cantidad, 0);
  const detailParams = new URLSearchParams();
  if (q) detailParams.set("q", q);
  if (selectedGroup) detailParams.set("grupo", selectedGroup);
  const detailHref = `/activos/historial-vida${detailParams.size ? `?${detailParams.toString()}` : ""}`;
  const pdfHref = `/api/activos/historial-vida/reporte-conjunto/pdf${detailParams.size ? `?${detailParams.toString()}` : ""}`;

  return <main className="mx-auto w-full max-w-[1600px] space-y-5 pb-8">
    <div id="reporte-conjunto-print" className="space-y-5">
    <header className="rounded-2xl border border-slate-200 border-t-4 border-t-amber-400 bg-white px-6 py-5 shadow-sm">
      <nav className="acciones-reporte-conjunto mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={detailHref} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"><ArrowLeft className="h-4 w-4"/>Atrás</Link>
        <ImprimirHistorialVida pdfHref={pdfHref} />
      </nav>
      <div className="encabezado-reporte-conjunto flex items-center gap-5"><LogoCorreosImpresion/><div className="contenido-encabezado-reporte min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-800">Agencia Boliviana de Correos</p><h1 className="mt-1 text-2xl font-extrabold uppercase leading-tight text-slate-900">Resumen de activos fijos por grupo contable</h1></div></div>
      <div className="datos-encabezado-reporte mt-5 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-3"><p><span className="font-semibold text-slate-600">Entidad</span><span className="mx-2 text-slate-300">|</span>Agencia Boliviana de Correos</p><p><span className="font-semibold text-slate-600">Listado</span><span className="mx-2 text-slate-300">|</span>{selectedGroup || "Todos los grupos contables"}</p><p><span className="font-semibold text-slate-600">Emitido</span><span className="mx-2 text-slate-300">|</span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "long" }).format(new Date())}</p></div>
      <p className="mt-3 text-sm text-slate-600">{total.toLocaleString("es-BO")} registros fuente. Las cifras se separan entre inventario vigente y hojas históricas para no mezclar cortes distintos.</p>
    </header>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
      <div className="overflow-x-auto"><table className="w-full min-w-[1250px] border-collapse text-left text-sm"><thead className="bg-slate-200 text-xs uppercase tracking-wide text-slate-700"><tr>{["Grupo contable", "Vigencia", "Cant.", "Vida útil", "Costo histórico", "Costo actualizado", "Depreciación gestión", "Depreciación acumulada", "Valor neto"].map((label)=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{rows.map((row)=><tr key={`${row.grupo}-${row.vigencia}`} className="align-top"><td className="px-3 py-3 font-semibold uppercase text-slate-900">{row.grupo}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.vigencia === "vigente" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{row.vigencia === "vigente" ? "Vigente" : "Histórico"}</span></td><td className="px-3 py-3 text-right">{row.cantidad.toLocaleString("es-BO")}</td><td className="px-3 py-3 text-right">{row.vidaMin ? row.vidaMin === row.vidaMax ? `${row.vidaMin} años` : `${row.vidaMin}–${row.vidaMax} años` : "—"}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(row.costoHistorico)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(row.costoActualizado)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(row.depreciacionGestion)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(row.depreciacionAcumulada)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-bold">{money(row.valorNeto)}</td></tr>)}{!rows.length && <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-500">No hay datos para el reporte seleccionado.</td></tr>}</tbody></table></div>
    </section>
    </div>
    <style>{`@media print { @page { size: landscape; margin: 12mm; } body { background: white !important; } body * { visibility: hidden !important; } #reporte-conjunto-print, #reporte-conjunto-print * { visibility: visible !important; } #reporte-conjunto-print { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0; box-shadow: none; } #reporte-conjunto-print .acciones-reporte-conjunto { display: none !important; } #reporte-conjunto-print .overflow-x-auto { overflow: visible !important; } #reporte-conjunto-print table { width: 100% !important; min-width: 0 !important; font-size: 8pt !important; } #reporte-conjunto-print th, #reporte-conjunto-print td { padding: 5px 4px !important; } #reporte-conjunto-print header { padding: 0 0 8mm !important; border: 0 !important; box-shadow: none !important; } #reporte-conjunto-print .encabezado-reporte-conjunto { justify-content: space-between; gap: 10px; } #reporte-conjunto-print .logo-reporte-impresion { display: block !important; visibility: visible !important; width: 146px !important; height: 68px !important; object-fit: contain !important; flex: 0 0 146px !important; } #reporte-conjunto-print .contenido-encabezado-reporte { flex:1; text-align:center; } #reporte-conjunto-print .datos-encabezado-reporte { border-top: 1px solid #cbd5e1 !important; padding-top: 5mm !important; } }`}</style>
  </main>;
}
