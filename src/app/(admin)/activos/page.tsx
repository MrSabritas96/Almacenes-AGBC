import Link from "next/link";
import { ArrowRight, CircleCheck, ClipboardList, FileQuestion, TriangleAlert } from "lucide-react";
import { consultarInventario, leerFiltros, parametrosFiltros, TAMANO_PAGINA, type ParametrosActivos } from "@/actions/activos/consultas";
import { FiltrosInventario } from "@/components/modules/activos/filtros";
import { cantidad, EstadoActivo, hayIncidencias } from "@/components/modules/activos/presentacion";

export default async function ActivosPage({ searchParams }: { searchParams: Promise<ParametrosActivos> }) {
  const filtros = leerFiltros(await searchParams);
  const data = await consultarInventario(filtros);
  const query = parametrosFiltros(filtros, data.pagina);
  const cards = [
    { label: "Registros vigentes", value: data.resumen.total, icon: ClipboardList, color: "text-brand-600 bg-brand-50" },
    { label: "En buen estado", value: data.resumen.buenos, icon: CircleCheck, color: "text-emerald-700 bg-emerald-50" },
    { label: "Requieren revisión", value: data.resumen.revision, icon: TriangleAlert, color: "text-amber-700 bg-amber-50" },
    { label: "Sin código identificable", value: data.resumen.sinCodigo, icon: FileQuestion, color: "text-slate-600 bg-slate-100" },
  ];
  const paginaUrl = (pagina: number) => `/activos?${parametrosFiltros(filtros, pagina)}`;
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-semibold tracking-widest text-brand-600 uppercase">Gestión de activos</p><h1 className="text-3xl font-bold tracking-tight">Inventario vigente</h1><p className="mt-2 text-sm text-ink-500">Consulta los bienes de AGBC, EXECOBOL 2024, UPU, PACTA, MOPSV y UPAEP por código, ubicación o responsable.</p></div><Link href="/activos/asignaciones" className="rounded-xl border border-brand-100 bg-white px-5 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50">Asignaciones</Link></header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-5"><div><p className="text-xs text-ink-500">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{cantidad(value)}</p></div><span className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5" aria-hidden="true" /></span></div>)}</div>
      <p className="text-xs text-ink-500">Resumen del inventario completo. Incluye registros con códigos repetidos; las versiones históricas se conservan por separado.</p>
      <FiltrosInventario key={query} filtros={filtros} opciones={data.opciones} responsablesPorUbicacion={data.responsablesPorUbicacion} />
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white" aria-labelledby="lista-activos">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-5 py-4"><h2 id="lista-activos" className="font-semibold">Listado de activos</h2><span className="text-sm text-ink-500">{cantidad(data.total)} {data.total === 1 ? "resultado" : "resultados"}</span></div>
        {data.registros.length === 0 ? <div className="px-6 py-16 text-center"><ClipboardList className="mx-auto mb-3 h-8 w-8 text-ink-500" aria-hidden="true" /><h3 className="font-semibold">No hay registros que coincidan</h3><p className="mt-2 text-sm text-ink-500">Prueba otro código o cambia los filtros.</p><Link href="/activos" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Ver todo el inventario</Link></div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Registros del inventario vigente, con ubicación y responsable</caption><thead className="bg-ink-100 text-xs text-ink-500"><tr>{["Código / procedencia", "Descripción", "Estado", "Ubicación", "Responsable", "Ficha"].map((label, idx, arr) => <th key={label} scope="col" className={`py-3 font-medium ${idx === arr.length - 1 ? "px-4 text-right" : "px-4"}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-ink-100">{data.registros.map(record => <tr key={record.id} className="align-top hover:bg-brand-50/40">
            <td className="px-4 py-3.5"><Link href={`/activos/${record.id}${query ? `?${query}` : ""}`} className="font-semibold text-brand-700 hover:underline">{record.codigo || "Sin código"}</Link><p className="mt-1 text-xs text-ink-500">{record.origen}</p>{hayIncidencias(record.incidencias) && <span className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700"><TriangleAlert className="h-3 w-3" aria-hidden="true" />Revisar datos</span>}</td>
            <td className="max-w-xs md:max-w-sm px-4 py-3.5"><p className="line-clamp-3 leading-relaxed" title={record.descripcion}>{record.descripcion}</p></td>
            <td className="px-4 py-3.5"><EstadoActivo estado={record.estado} /></td><td className="max-w-44 px-4 py-3.5 text-ink-500">{record.ubicacion || "Sin ubicación"}</td><td className="max-w-44 px-4 py-3.5 text-ink-500">{record.responsable || "Sin responsable"}<p className="mt-1 text-xs">{record.asignacionTipo === "momentanea" ? "Asignación momentánea" : record.asignacionTipo === "fija" ? "Asignación fija" : "Referencia del Excel"}</p></td>
            <td className="px-4 py-3.5 text-right"><Link href={`/activos/${record.id}${query ? `?${query}` : ""}`} aria-label={`Ver ficha de ${record.codigo || record.descripcion}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 font-medium text-brand-600 hover:bg-brand-100">Ver <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></td>
          </tr>)}</tbody></table></div>}
        {data.total > 0 && <nav aria-label="Paginación del inventario" className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-5 py-4"><p className="text-xs text-ink-500">{cantidad((data.pagina - 1) * TAMANO_PAGINA + 1)}–{cantidad(Math.min(data.pagina * TAMANO_PAGINA, data.total))} de {cantidad(data.total)}</p><div className="flex items-center gap-3">{data.pagina > 1 ? <Link href={paginaUrl(data.pagina - 1)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm hover:bg-ink-100">Anterior</Link> : <span aria-disabled="true" className="rounded-lg border border-ink-100 px-3 py-2 text-sm text-slate-400">Anterior</span>}<span className="text-xs text-ink-500">{data.pagina} / {data.paginas}</span>{data.pagina < data.paginas ? <Link href={paginaUrl(data.pagina + 1)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm hover:bg-ink-100">Siguiente</Link> : <span aria-disabled="true" className="rounded-lg border border-ink-100 px-3 py-2 text-sm text-slate-400">Siguiente</span>}</div></nav>}
      </section>
    </div>
  );
}
