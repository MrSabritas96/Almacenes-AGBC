import Link from "next/link";
import { and, asc, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { BookOpenCheck, FileSpreadsheet, PackageSearch } from "lucide-react";
import { db } from "@/db";
import { actActivos, actFilasImportadas, actHojasImportadas, actImportaciones } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { AtrasHistorialVida } from "@/components/modules/activos/atras-historial-vida";
import { ImprimirHistorialVida } from "@/components/modules/activos/imprimir-historial-vida";
import { LogoCorreosImpresion } from "@/components/modules/activos/logo-correos-impresion";

const PAGE_SIZE = 30;
type SearchParams = Record<string, string | string[] | undefined>;
const param = (params: SearchParams, key: string) => {
  const raw = params[key];
  return (Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim().slice(0, 160);
};
const money = (value: string | null) => value == null || value === "" ? "—" : new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(Number(value));
export default async function HistorialVidaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read"))) redirect("/dashboard");

  const params = await searchParams;
  const q = param(params, "q");
  const grupo = param(params, "grupo");
  const requestedPage = Number(param(params, "pagina"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1_000_000) : 1;
  const base = [inArray(actHojasImportadas.tipo, ["inventario", "historico"]), inArray(actHojasImportadas.vigencia, ["vigente", "historico"])];
  const search = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : "";
  const filtered = [...base];
  if (search) filtered.push(or(ilike(actActivos.codigo, search), ilike(actActivos.codigoHistorico, search), ilike(actActivos.descripcion, search), ilike(actActivos.grupoContable, search), ilike(actActivos.responsable, search), ilike(actActivos.origen, search))!);
  if (grupo) filtered.push(sql`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable') = ${grupo}`);
  const where = and(...filtered);

  const [countRows, groupRows, rows, sourceRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(actActivos).innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`).innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`).where(where),
    db.select({ grupo: sql<string>`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable')`, total: sql<number>`count(*)::int`, vidaMin: sql<string | null>`min(${actActivos.vidaUtil})`, vidaMax: sql<string | null>`max(${actActivos.vidaUtil})` }).from(actActivos).innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`).innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`).where(and(...base)).groupBy(sql`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable')`).orderBy(asc(sql`coalesce(nullif(trim(${actActivos.grupoContable}), ''), 'Sin grupo contable')`)),
    db.select({ id: actActivos.id, codigo: actActivos.codigo, codigoHistorico: actActivos.codigoHistorico, descripcion: actActivos.descripcion, grupo: actActivos.grupoContable, grupoCodigo: actActivos.grupoContableCodigo, origen: actActivos.origen, estado: actActivos.estado, vidaUtil: actActivos.vidaUtil, porcentaje: actActivos.porcentajeDepreciacion, costoHistorico: actActivos.costoHistorico, costoMigrado: actActivos.costoMigrado, costoActualizado: actActivos.costoFinalActualizado, depreciacionGestion: actActivos.depreciacionGestion, depreciacionAcumulada: actActivos.depreciacionAcumulada, valorNeto: actActivos.valorNeto, fechaHistorica: actActivos.fechaHistorica, fechaMigracion: actActivos.fechaMigracion, regional: actActivos.regional, ubicacion: actActivos.ubicacion, responsable: actActivos.responsable, hoja: actHojasImportadas.nombre, vigencia: actHojasImportadas.vigencia, tipoHoja: actHojasImportadas.tipo, archivo: actImportaciones.archivoNombre, importadoEn: actImportaciones.creadoEn })
      .from(actActivos).innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`).innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`).innerJoin(actImportaciones, sql`${actHojasImportadas.importacionId} = ${actImportaciones.id}`).where(where).orderBy(desc(actImportaciones.creadoEn), asc(actActivos.grupoContable), asc(actActivos.codigo)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ vigencia: actHojasImportadas.vigencia, total: sql<number>`count(*)::int` }).from(actActivos).innerJoin(actFilasImportadas, sql`${actActivos.filaOrigenId} = ${actFilasImportadas.id}`).innerJoin(actHojasImportadas, sql`${actFilasImportadas.hojaId} = ${actHojasImportadas.id}`).where(and(...base)).groupBy(actHojasImportadas.vigencia),
  ]);

  const total = countRows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = sourceRows.find((row) => row.vigencia === "vigente")?.total ?? 0;
  const historical = sourceRows.find((row) => row.vigencia === "historico")?.total ?? 0;
  const queryString = (nextPage: number, nextGroup = grupo) => {
    const searchParams = new URLSearchParams();
    if (q) searchParams.set("q", q);
    if (nextGroup) searchParams.set("grupo", nextGroup);
    if (nextPage > 1) searchParams.set("pagina", String(nextPage));
    const value = searchParams.toString();
    return `/activos/historial-vida${value ? `?${value}` : ""}`;
  };
  const reportParams = new URLSearchParams();
  if (q) reportParams.set("q", q);
  if (grupo) reportParams.set("grupo", grupo);
  const reportUrl = `/activos/historial-vida/reporte-conjunto${reportParams.size ? `?${reportParams.toString()}` : ""}`;
  const pdfParams = new URLSearchParams();
  if (q) pdfParams.set("q", q);
  if (grupo) pdfParams.set("grupo", grupo);
  if (page > 1) pdfParams.set("pagina", String(page));
  const pdfUrl = `/api/activos/historial-vida/pdf${pdfParams.size ? `?${pdfParams.toString()}` : ""}`;
  return <main className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
    <header className="rounded-2xl border border-blue-100 border-b-4 border-b-amber-400 bg-gradient-to-r from-[#0c1d3d] to-[#163060] px-6 py-6 text-white shadow-sm">
      <div className="mb-5"><AtrasHistorialVida /></div>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-300">Control contable del activo</p>
      <h1 className="mt-2 text-3xl font-extrabold">Historial de vida de los activos</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-100">Consulta por grupo contable los costos, depreciaciones, valor neto, vida útil y fecha histórica registrados en las hojas de inventario.</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Grupos contables registrados</p><p className="mt-2 text-3xl font-bold text-slate-900">{groupRows.length}</p></div>
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Registros vigentes</p><p className="mt-2 text-3xl font-bold text-emerald-700">{current.toLocaleString("es-BO")}</p></div>
      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Registros de hojas históricas</p><p className="mt-2 text-3xl font-bold text-amber-700">{historical.toLocaleString("es-BO")}</p></div>
    </section>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Resumen por grupo contable">{groupRows.map((item)=><Link key={item.grupo} href={queryString(1, grupo === item.grupo ? "" : item.grupo)} className={`rounded-xl border p-4 transition hover:border-blue-400 hover:bg-blue-50 ${grupo === item.grupo ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}><p className="font-semibold text-slate-900">{item.grupo}</p><p className="mt-1 text-sm text-slate-500">{item.total.toLocaleString("es-BO")} registros fuente</p><p className="mt-1 text-xs font-medium text-blue-800">Vida útil registrada: {item.vidaMin ? item.vidaMin === item.vidaMax ? `${item.vidaMin} años` : `${item.vidaMin}–${item.vidaMax} años` : "sin dato"}</p></Link>)}</section>

    <section id="historial-vida-print" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-lg bg-blue-700 p-2 text-white"><BookOpenCheck className="h-5 w-5"/></span><div><h2 className="font-bold text-slate-900">Detalle contable e histórico</h2><p className="text-sm text-slate-500">{total.toLocaleString("es-BO")} registros · página {Math.min(page, pages)} de {pages}</p></div></div><div className="flex items-center gap-2 print:hidden"><Link href={reportUrl} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-800 shadow-sm transition hover:bg-blue-50"><FileSpreadsheet className="h-4 w-4"/>Reporte conjunto</Link><ImprimirHistorialVida pdfHref={pdfUrl} /></div></header>
      <div className="titulo-impresion px-5 pt-5"><div className="cabecera-detalle-impresion"><LogoCorreosImpresion/><div className="flex-1 text-center"><p className="text-xs font-semibold uppercase tracking-widest text-slate-600">Agencia Boliviana de Correos</p><h1 className="mt-1 text-xl font-bold uppercase text-slate-900">Inventario de activos fijos por grupo contable</h1><p className="mt-1 text-sm text-slate-700">Listado detallado · Emitido el {new Intl.DateTimeFormat("es-BO", { dateStyle: "long" }).format(new Date())}</p></div><div className="reserva-logo-impresion" aria-hidden="true"/></div>{grupo && <p className="mt-2 text-sm font-semibold uppercase text-slate-800">Grupo contable: {grupo}</p>}</div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1800px] border-collapse text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Código", "Grupo contable", "Descripción", "Fecha histórica", "Vida útil", "Costo histórico", "Costo migrado", "Costo actualizado", "Depreciación gestión", "Depreciación acumulada", "Valor neto", "Hoja / corte"].map((label)=><th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row)=><tr key={row.id} className="align-top hover:bg-blue-50/50"><td className="px-4 py-4"><Link href={`/activos/${row.id}`} className="font-bold text-blue-800 hover:underline">{row.codigo || row.codigoHistorico || "Sin código"}</Link><p className="mt-1 text-xs text-slate-500">{row.origen}</p></td><td className="px-4 py-4"><span className="font-semibold text-slate-800">{row.grupo || "Sin grupo"}</span>{row.grupoCodigo && <p className="mt-1 text-xs text-slate-500">{row.grupoCodigo}</p>}</td><td className="max-w-[20rem] whitespace-normal px-4 py-4 text-slate-700">{row.descripcion}</td><td className="whitespace-nowrap px-4 py-4">{row.fechaHistorica ? String(row.fechaHistorica).slice(0, 10) : "—"}</td><td className="whitespace-nowrap px-4 py-4">{row.vidaUtil ? `${row.vidaUtil} años` : "—"}{row.porcentaje && <p className="mt-1 text-xs text-slate-500">{row.porcentaje}%</p>}</td><td className="whitespace-nowrap px-4 py-4">{money(row.costoHistorico)}</td><td className="whitespace-nowrap px-4 py-4">{money(row.costoMigrado)}</td><td className="whitespace-nowrap px-4 py-4">{money(row.costoActualizado)}</td><td className="whitespace-nowrap px-4 py-4">{money(row.depreciacionGestion)}</td><td className="whitespace-nowrap px-4 py-4">{money(row.depreciacionAcumulada)}</td><td className="whitespace-nowrap px-4 py-4 font-semibold">{money(row.valorNeto)}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.vigencia === "vigente" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{row.vigencia === "vigente" ? "Vigente" : "Histórico"}</span><p className="mt-2 font-medium text-slate-700">{row.hoja}</p><p className="text-xs text-slate-500">{row.archivo}</p><p className="text-xs text-slate-500">Importado {new Date(row.importadoEn).toLocaleDateString("es-BO")}</p></td></tr>)}</tbody></table></div> : <div className="flex flex-col items-center gap-2 p-12 text-center text-slate-500"><PackageSearch className="h-9 w-9 text-slate-400"/><p className="font-semibold">No hay registros que coincidan con la búsqueda.</p></div>}
      <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm"><span className="text-slate-600">{total ? `${((Math.min(page, pages) - 1) * PAGE_SIZE + 1).toLocaleString("es-BO")}–${Math.min(page * PAGE_SIZE, total).toLocaleString("es-BO")} de ${total.toLocaleString("es-BO")}` : "0 registros"}</span><div className="flex gap-2"><Link aria-disabled={page <= 1} className={`rounded-lg border px-3 py-2 font-semibold ${page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`} href={queryString(Math.max(1, page - 1))}>Anterior</Link><Link aria-disabled={page >= pages} className={`rounded-lg border px-3 py-2 font-semibold ${page >= pages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`} href={queryString(Math.min(pages, page + 1))}>Siguiente</Link></div></footer>
    </section>
    <style>{`.titulo-impresion { display: none; } .logo-reporte-impresion { display: none; } @media print { @page { size: landscape; margin: 10mm; } body * { visibility: hidden !important; } #historial-vida-print, #historial-vida-print * { visibility: visible !important; } #historial-vida-print { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0; box-shadow: none; } #historial-vida-print .titulo-impresion { display: block !important; } #historial-vida-print .cabecera-detalle-impresion { display: flex; align-items: center; justify-content: space-between; gap: 12px; } #historial-vida-print .logo-reporte-impresion { display: block !important; visibility: visible !important; width: 146px !important; height: 68px !important; object-fit: contain !important; flex: 0 0 146px !important; } #historial-vida-print .reserva-logo-impresion { display: block; width: 146px; flex-shrink: 0; } #historial-vida-print .overflow-x-auto { overflow: visible !important; } #historial-vida-print table { width: 100% !important; min-width: 0 !important; font-size: 7pt !important; } #historial-vida-print th, #historial-vida-print td { padding: 4px 3px !important; } #historial-vida-print footer { display: none !important; } #historial-vida-print a { color: inherit !important; text-decoration: none !important; } }`}</style>
  </main>;
}
