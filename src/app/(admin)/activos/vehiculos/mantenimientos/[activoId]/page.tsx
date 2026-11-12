import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Download, FileSpreadsheet, MapPin, Plus, Wrench } from "lucide-react";
import { consultarFicha } from "@/actions/activos/consultas";
import { consultarHojasKardexVehiculos, consultarMantenimientosRegistrados } from "@/actions/activos/vehiculos-excel-consultas";
import { EstadoActivo } from "@/components/modules/activos/presentacion";

function placaDesdeDescripcion(descripcion: string) {
  return descripcion.match(/\bPLACA\s*:?\s*([A-Z0-9-]{4,})/i)?.[1]?.replace(/-/g, "").toUpperCase() ?? "";
}

export default async function MantenimientosVehiculoPage({ params }: { params: Promise<{ activoId: string }> }) {
  const { activoId } = await params;
  const activo = await consultarFicha(activoId);
  if (!activo) notFound();
  const placa = placaDesdeDescripcion(activo.descripcion);
  const [hojasTodas, registrados] = await Promise.all([
    consultarHojasKardexVehiculos(),
    consultarMantenimientosRegistrados(activoId),
  ]);
  const hojas = hojasTodas.filter((hoja) => placa && hoja.placa.replace(/-/g, "").toUpperCase() === placa);
  const mantenimientosExcel = hojas.flatMap((hoja) => hoja.servicios.map((servicio) => ({ ...servicio, id: `${hoja.id}-${servicio.fila}`, archivo: hoja.archivo, hoja: hoja.hoja, hojaId: hoja.id })));

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="rounded-2xl border border-blue-100 border-t-4 border-t-amber-400 bg-white p-6 shadow-sm">
        <div className="mb-5"><Link href="/activos/vehiculos" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"><ArrowLeft className="h-4 w-4"/>Atrás</Link></div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white"><Wrench className="h-6 w-6"/></span>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-blue-800">Vehículos y motocicletas · Historial</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{placa || activo.codigo || "Vehículo"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{activo.descripcion}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EstadoActivo estado={activo.estado}/>
            <Link href={`/activos/vehiculos/mantenimiento/nuevo?activo=${activo.id}`} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800"><Plus className="h-4 w-4"/>Nuevo mantenimiento</Link>
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p><span className="font-semibold text-slate-500">Código:</span> {activo.codigo || "Sin código"}</p>
          <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-600"/>{activo.ubicacion || "Sin ubicación"}</p>
          <p><span className="font-semibold text-slate-500">Responsable actual:</span> {activo.responsable || "Sin responsable"}</p>
          <p><span className="font-semibold text-slate-500">Registros:</span> {mantenimientosExcel.length + registrados.length}</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-lg font-bold text-slate-900">Mantenimientos registrados en el sistema</h2><p className="text-sm text-slate-500">Registros nuevos asociados a este activo.</p></div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{registrados.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr>{["Fecha","Kilometraje","Trabajo realizado","Taller / proveedor","Unidad","Factura","Importe","Observaciones","Registrado por"].map((label)=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{registrados.map((item)=><tr key={item.id} className="align-top hover:bg-blue-50/40"><td className="whitespace-nowrap px-4 py-4">{String(item.fecha)}</td><td className="px-4 py-4">{item.kilometraje || "—"}</td><td className="min-w-64 max-w-lg px-4 py-4">{item.descripcion}</td><td className="px-4 py-4">{item.taller || "—"}</td><td className="px-4 py-4">{item.unidad || "—"}</td><td className="px-4 py-4">{item.factura || "—"}</td><td className="px-4 py-4">{item.importe || "—"}</td><td className="min-w-48 px-4 py-4">{item.observaciones || "—"}</td><td className="px-4 py-4">{item.registradoPor}</td></tr>)}{registrados.length===0&&<tr><td colSpan={9} className="px-6 py-10 text-center text-slate-500">Todavía no se registraron mantenimientos desde el sistema.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-lg font-bold text-slate-900">Mantenimientos de los Excel</h2><p className="text-sm text-slate-500">Historial importado de las hojas asociadas a la placa {placa || "del activo"}.</p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">{mantenimientosExcel.length} registros</span>
        </div>
        {hojas.map((hoja)=><div key={hoja.id} className="border-b border-slate-100 last:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 px-5 py-3"><p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileSpreadsheet className="h-4 w-4 text-emerald-700"/>{hoja.archivo} · Hoja {hoja.hoja}</p><div className="flex flex-wrap gap-3"><Link href={`/activos/vehiculos/kardex/${hoja.id}`} className="text-sm font-bold text-blue-700 hover:underline">Ver Excel</Link><a href={`/activos/vehiculos/kardex/${hoja.id}/pdf`} className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline"><Download className="h-4 w-4"/>Descargar PDF</a></div></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr>{["Fecha","Kilometraje","Trabajo realizado","Taller / proveedor","Unidad","Factura","Importe","Observaciones"].map((label)=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{hoja.servicios.map((item)=><tr key={`${hoja.id}-${item.fila}`} className="align-top hover:bg-blue-50/40"><td className="whitespace-nowrap px-4 py-4">{item.fecha || "—"}</td><td className="px-4 py-4">{item.kilometraje || "—"}</td><td className="min-w-64 max-w-lg px-4 py-4">{item.descripcion}</td><td className="px-4 py-4">{item.taller || "—"}</td><td className="px-4 py-4">{item.unidad || "—"}</td><td className="px-4 py-4">{item.factura || "—"}</td><td className="px-4 py-4">{item.importe || "—"}</td><td className="min-w-48 px-4 py-4">{item.observaciones || "—"}</td></tr>)}{hoja.servicios.length===0&&<tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500">Esta hoja no tiene detalle de mantenimiento.</td></tr>}</tbody>
            </table>
          </div>
        </div>)}
        {hojas.length===0&&<p className="px-6 py-10 text-center text-slate-500">No hay hojas Excel de mantenimiento asociadas a esta placa. Puedes registrar aquí los nuevos mantenimientos.</p>}
      </section>
      <p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="h-4 w-4"/>Los registros del Excel se conservan como fuente original; los nuevos registros se guardan en el historial del sistema.</p>
    </div>
  );
}
