import Link from "next/link";
import { ArrowLeft, CalendarClock, UserRound, TriangleAlert, ShieldCheck, Eye } from "lucide-react";
import { consultarListaAsignaciones } from "@/actions/activos/asignaciones-consultas";
import type { ParametrosActivos } from "@/actions/activos/consultas";
import { EstadoAsignacion } from "@/components/modules/activos/asignaciones";
import { EliminarAsignacion } from "@/components/modules/activos/eliminar-asignacion";
import { cantidad, fecha } from "@/components/modules/activos/presentacion";

export default async function AsignacionesPage({ searchParams }: { searchParams: Promise<ParametrosActivos> }) {
  const data = await consultarListaAsignaciones(await searchParams);
  const pageUrl = (pagina: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(data.filtros)) if (v) params.set(k, v);
    if (pagina > 1) params.set("pagina", String(pagina));
    return `/activos/asignaciones?${params}`;
  };

  const cards = [
    { label: "Fijas activas", value: data.resumen.fijas, icon: UserRound, color: "text-brand-600 bg-brand-50" },
    { label: "Momentáneas activas", value: data.resumen.momentaneas, icon: CalendarClock, color: "text-amber-700 bg-amber-50" },
    { label: "Devoluciones vencidas", value: data.resumen.vencidas, icon: TriangleAlert, color: "text-rose-700 bg-rose-50" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      {/* 1. Breadcrumb bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-ink-600">
          <span className="text-ink-600">Gestión de activos</span>
          <span className="text-ink-300">/</span>
          <span className="font-bold text-brand-900">Asignaciones</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            <span>Control de custodia AGBC</span>
          </span>
        </div>
      </div>

      {/* 2. Header institucional con matiz Azul y Amarillo AGBC */}
      <header className="relative overflow-hidden rounded-2xl border border-ink-200/90 bg-white p-6 shadow-2xs border-t-4 border-t-amber-400">
        <Link href="/activos" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-2xs transition-colors hover:border-brand-300 hover:bg-brand-50">
          <ArrowLeft className="h-4 w-4 text-brand-600" aria-hidden="true" />Volver al inventario
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
                Gestión Institucional AGBC · Asignaciones y Custodia
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
                Asignaciones
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 shadow-2xs">
                {cantidad(data.total)} registradas
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-500 max-w-3xl leading-relaxed">
              Consulta custodias fijas, entregas momentáneas con plazo de devolución y reincorporaciones de bienes al inventario.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/activos"
              className="inline-flex items-center rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-xs font-bold text-brand-800 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Ver inventario
            </Link>
            {data.puedeGestionar && (
              <Link
                href="/activos/asignaciones/actas/nueva"
                className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition-colors"
              >
                Nueva acta
              </Link>
            )}
          </div>
        </div>
      </header>

      <section aria-labelledby="actas-excel-reales" className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/70 px-5 py-4">
          <div>
            <h2 id="actas-excel-reales" className="font-bold text-blue-950">Actas reales cargadas desde Excel · {data.gestionArchivo}</h2>
            <p className="mt-1 text-xs text-slate-600">Expedientes originales de asignación y devolución usados para el seguimiento.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-900">{cantidad(data.totalActasArchivo)} actas</span>
            <Link href="/activos/archivo-actas" className="rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800">Ver archivo completo</Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-blue-100 bg-white px-5 py-3 text-xs font-semibold text-slate-600">
          <span>{cantidad(data.asignacionesArchivo)} asignaciones</span>
          <span>{cantidad(data.devolucionesArchivo)} devoluciones</span>
          <span className="font-normal">Estos documentos son la fuente del seguimiento; sus PDF originales se conservan.</span>
        </div>
        {data.actasArchivo.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>{["Acta / tipo", "Responsable", "Procedencia", "Fecha", "Bienes", "Documento"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.actasArchivo.map((acta) => (
                  <tr key={acta.id} className="hover:bg-blue-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/activos/archivo-actas/${acta.id}`} className="font-bold text-blue-800 hover:underline">{acta.numero}</Link>
                      <p className="mt-1 text-xs text-slate-600">{acta.tipo === "actualizacion" ? "Asignación" : acta.tipo === "devolucion" ? "Devolución" : "Asignación"}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{acta.responsable || "Por identificar"}</td>
                    <td className="px-4 py-3 text-slate-700">{acta.procedencia}</td>
                    <td className="px-4 py-3 text-slate-700">{acta.fecha ? fecha(acta.fecha) : "Sin fecha"}</td>
                    <td className="px-4 py-3"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800">{acta.bienes}</span></td>
                    <td className="px-4 py-3"><Link href={`/activos/archivo-actas/${acta.id}`} className="font-semibold text-blue-700 hover:underline">Ver acta →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-600">No hay actas del Excel para la gestión {data.gestionArchivo}.</p>
        )}
        <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-600">El historial de entregas de abajo conserva los movimientos operativos del sistema; esta tabla muestra las actas originales ya cargadas, sin modificar sus PDF.</p>
      </section>

      <p className="-mb-3 text-xs text-ink-500">Los siguientes contadores y el historial muestran movimientos registrados en el sistema. Las actas reales del Excel se muestran en la tabla anterior.</p>
      {/* Tarjetas de estado */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-5 shadow-2xs">
            <div>
              <p className="text-xs font-medium text-ink-500">{label}</p>
              <p className="mt-2 text-3xl font-extrabold text-ink-900 tabular-nums">{cantidad(value)}</p>
            </div>
            <span className={`rounded-xl p-3 ${color} border border-ink-100 shadow-2xs`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <form method="get" action="/activos/asignaciones" className="grid gap-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-2xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="buscar-asignacion" className="mb-1.5 block text-xs font-bold text-ink-700">Código, descripción o receptor</label>
          <input id="buscar-asignacion" name="q" maxLength={200} defaultValue={data.filtros.q} placeholder="Buscar por código o nombre..." className="w-full rounded-xl border border-ink-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200" />
        </div>
        <div>
          <label htmlFor="tipo-asignacion" className="mb-1.5 block text-xs font-bold text-ink-700">Tipo de asignación</label>
          <select id="tipo-asignacion" name="tipo" defaultValue={data.filtros.tipo} className="w-full rounded-xl border border-ink-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200">
            <option value="">Todos los tipos</option>
            <option value="fija">Fija</option>
            <option value="momentanea">Momentánea</option>
          </select>
        </div>
        <div>
          <label htmlFor="estado-asignacion" className="mb-1.5 block text-xs font-bold text-ink-700">Situación / Estado</label>
          <select id="estado-asignacion" name="estado" defaultValue={data.filtros.estado} className="w-full rounded-xl border border-ink-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200">
            <option value="">Todas las situaciones</option>
            <option value="activa">Activa</option>
            <option value="vencida">Vencida</option>
            <option value="devuelta">Devuelta</option>
            <option value="reemplazada">Reemplazada</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700 active:scale-[0.98] transition-all">Filtrar</button>
          <Link href="/activos/asignaciones" className="rounded-xl border border-ink-200 px-3.5 py-2.5 text-xs font-semibold text-ink-600 hover:bg-ink-100 transition-colors">Limpiar</Link>
        </div>
      </form>

      {/* Listado */}
      <section id="historial-asignaciones" aria-labelledby="lista-asignaciones" className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4 bg-slate-50/60">
          <h2 id="lista-asignaciones" className="font-bold text-ink-900">Historial de entregas</h2>
          <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-800 border border-brand-200">{cantidad(data.total)} {data.total === 1 ? "registro" : "registros"}</span>
        </div>
        {!data.registros.length ? (
          <div className="p-10 text-center">
            <CalendarClock className="mx-auto h-8 w-8 text-ink-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-ink-900">No hay asignaciones que mostrar</p>
            <p className="mt-1 text-sm text-ink-500">Para registrar una entrega, utiliza Nueva acta y selecciona los bienes del inventario.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Asignaciones de bienes y estado de devolución</caption>
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
                <tr>
                  {["Activo", "Tipo / situación", "Receptor / ubicación", "Entrega", "Devolución", "Ficha"].map((label, idx, arr) => (
                    <th key={label} scope="col" className={`py-3.5 font-bold ${idx === arr.length - 1 ? "px-5 text-right" : "px-5"}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.registros.map(({ asignacion: a, codigo, descripcion, origen }) => (
                  <tr key={a.id} className="align-top hover:bg-brand-50/30 transition-colors">
                    <td className="max-w-xs md:max-w-sm px-5 py-3.5">
                      <p className="font-bold text-brand-900">{codigo || "Sin código"}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{origen}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-ink-600">{descripcion}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="mb-1.5 font-semibold text-ink-900">{a.tipo === "fija" ? "Fija" : "Momentánea"}</p>
                      <EstadoAsignacion asignacion={a} hoy={data.hoy} />
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink-900">{a.responsableDestino}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{a.ubicacionDestino}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-700">{fecha(a.fechaInicio)}</td>
                    <td className="px-5 py-3.5 text-xs">
                      {a.fechaDevolucionPrevista && <p className="text-amber-800 font-medium">Prevista: {fecha(a.fechaDevolucionPrevista)}</p>}
                      {a.fechaCierre ? <p className="mt-1 text-emerald-800 font-medium">Registrada: {fecha(a.fechaCierre)}</p> : a.tipo === "fija" ? <span className="text-ink-400">Sin vencimiento</span> : <span className="text-amber-700 font-medium">Pendiente</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right"><div className="flex items-center justify-end gap-2">
                      <Link href={`/activos/${a.activoId}`} aria-label={`Ver activo ${codigo || a.activoId}`} title="Ver ficha del activo" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"><Eye className="h-4 w-4" aria-hidden="true" />

                      </Link>
                      {data.puedeGestionar&&<EliminarAsignacion id={a.id} eliminada={Boolean(a.eliminadoEn)}/>}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.total > 0 && (
          <nav aria-label="Paginación de asignaciones" className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-5 py-4 bg-slate-50/50">
            <p className="text-xs text-ink-500">Página <strong>{data.pagina}</strong> de <strong>{data.paginas}</strong></p>
            <div className="flex gap-2">
              {data.pagina > 1 ? (
                <Link href={pageUrl(data.pagina - 1)} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-800 hover:bg-brand-50 shadow-2xs">Anterior</Link>
              ) : (
                <span className="rounded-lg border border-ink-100 bg-slate-50 px-3 py-1.5 text-xs text-ink-300">Anterior</span>
              )}
              {data.pagina < data.paginas ? (
                <Link href={pageUrl(data.pagina + 1)} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-800 hover:bg-brand-50 shadow-2xs">Siguiente</Link>
              ) : (
                <span className="rounded-lg border border-ink-100 bg-slate-50 px-3 py-1.5 text-xs text-ink-300">Siguiente</span>
              )}
            </div>
          </nav>
        )}
      </section>
      <p className="text-xs text-ink-500">
        Una asignación momentánea vencida permanece activa hasta registrar su devolución formal. El historial conserva entregas, reemplazos y devoluciones.
      </p>
    </div>
  );
}
