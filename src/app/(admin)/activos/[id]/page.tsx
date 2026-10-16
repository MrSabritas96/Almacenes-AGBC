import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MapPin, TriangleAlert, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { consultarFicha, leerFiltros, parametrosFiltros, type ParametrosActivos } from "@/actions/activos/consultas";
import { detalleIncidencias, EstadoActivo, fecha, importe } from "@/components/modules/activos/presentacion";
import { consultarAsignacionesActivo } from "@/actions/activos/asignaciones-consultas";

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs text-ink-500">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium">{children ?? "Sin dato"}</dd></div>;
}

export default async function FichaActivo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParametrosActivos> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const activo = await consultarFicha(id);
  if (!activo) notFound();
  const asignaciones = await consultarAsignacionesActivo(id);
  const query = parametrosFiltros(leerFiltros(search));
  const issues = detalleIncidencias(activo.incidenciasImportacion);
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-up">
      <Link href={`/activos${query ? `?${query}` : ""}`} className="inline-flex items-center gap-2 rounded-lg py-2 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Volver al inventario</Link>
      <header className="rounded-2xl border border-ink-200 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Ficha del activo · {activo.origen}</p><EstadoActivo estado={activo.estado} /></div><h1 className="mt-3 break-words text-2xl font-bold">{activo.codigo || "Activo sin código"}</h1><p className="mt-3 leading-relaxed text-ink-500">{activo.descripcion}</p></header>
      {issues.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="revision-ficha"><h2 id="revision-ficha" className="flex items-center gap-2 font-semibold text-amber-900"><TriangleAlert className="h-5 w-5" aria-hidden="true" />Datos que requieren revisión</h2><ul className="mt-3 space-y-2 text-sm text-amber-900">{issues.map((issue, index) => <li key={index}><span className="font-medium capitalize">{issue.campo}:</span> {issue.mensaje}</li>)}</ul><p className="mt-3 text-xs text-amber-800">Los valores originales se conservan. Un dato incompleto no se reemplaza por cero.</p></section>}
      <section className="rounded-2xl border border-ink-200 bg-white p-6" aria-labelledby="custodia-actual"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="custodia-actual" className="flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 text-brand-600" aria-hidden="true" />Custodia actual</h2><Link href="/activos/asignaciones" className="text-sm font-medium text-brand-600 hover:underline">Ir a Asignaciones</Link></div><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Campo label="Responsable actual">{asignaciones.custodia?.responsable ?? activo.responsable}</Campo><Campo label="Ubicación actual">{asignaciones.custodia?.ubicacion ?? activo.ubicacion}</Campo></dl></section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-200 bg-white p-6"><h2 className="mb-5 flex items-center gap-2 font-semibold"><FileText className="h-5 w-5 text-brand-600" aria-hidden="true" />Datos del bien</h2><dl className="grid grid-cols-2 gap-5"><Campo label="Código">{activo.codigo}</Campo><Campo label="Código histórico">{activo.codigoHistorico}</Campo><Campo label="Grupo contable">{activo.grupoContable}</Campo><Campo label="Código de grupo contable">{activo.grupoContableCodigo}</Campo><Campo label="Auxiliar de grupo">{activo.auxiliarGrupo}</Campo><Campo label="Auxiliar alterno">{activo.auxiliarGrupoAlterno}</Campo><Campo label="Fecha histórica">{fecha(activo.fechaHistorica)}</Campo><Campo label="Fecha de migración">{fecha(activo.fechaMigracion)}</Campo><Campo label="Vida útil (años)">{activo.vidaUtil}</Campo><Campo label="Depreciación (%)">{activo.porcentajeDepreciacion}</Campo></dl></section>
        <section className="rounded-2xl border border-ink-200 bg-white p-6"><h2 className="mb-5 flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 text-brand-600" aria-hidden="true" />Datos de custodia del Excel</h2><dl className="space-y-5"><Campo label="Ubicación de origen">{activo.ubicacion}</Campo><Campo label="Responsable de origen">{activo.responsable}</Campo><Campo label="Referencia de acta de origen">{activo.acta}</Campo><Campo label="Observaciones">{activo.observaciones}</Campo><Campo label="Comentario">{activo.comentario}</Campo></dl></section>
      </div>
      <section className="rounded-2xl border border-ink-200 bg-white p-6"><h2 className="flex items-center gap-2 font-semibold"><Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" />Información contable</h2><p className="mt-2 text-xs text-ink-500">Importes registrados en el Excel de origen. La depreciación corresponde a ese corte.</p><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Campo label="Costo histórico / en libros">{importe(activo.costoHistorico)}</Campo><Campo label="Costo migrado">{importe(activo.costoMigrado)}</Campo><Campo label="Costo final actualizado">{importe(activo.costoFinalActualizado)}</Campo><Campo label="Depreciación de gestión">{importe(activo.depreciacionGestion)}</Campo><Campo label="Depreciación acumulada">{importe(activo.depreciacionAcumulada)}</Campo><Campo label="Valor neto">{importe(activo.valorNeto)}</Campo></dl></section>
      <footer className="rounded-xl bg-ink-200/50 px-5 py-4 text-xs text-ink-500">Origen: {activo.hojaOrigen} · Fila {activo.filaExcel} del Excel · Registro {activo.numeroOrigen || "sin numeración"}. Esta ficha conserva los datos de la importación vigente.</footer>
    </div>
  );
}
