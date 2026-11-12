import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { consultarKardexVehiculo } from "@/actions/activos/vehiculos-excel-consultas";

export default async function KardexVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ficha = await consultarKardexVehiculo(id);
  if (!ficha) notFound();
  const datos = [
    ["Placa", ficha.placa],
    ["Regional anotada en Excel", ficha.regional],
    ["Año", ficha.anio],
    ["Chasis", ficha.chasis],
    ["Marca", ficha.marca],
    ["Modelo", ficha.modelo],
    ["Conductor anotado en Excel", ficha.conductor],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="rounded-2xl border border-blue-100 border-t-4 border-t-amber-400 bg-white p-6 shadow-sm">
        <div className="mb-5"><Link href="/activos/vehiculos" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"><ArrowLeft className="h-4 w-4"/>Volver a vehículos</Link></div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white"><FileSpreadsheet className="h-6 w-6"/></span><div><p className="text-xs font-bold uppercase tracking-wider text-blue-800">Registro Excel del vehículo</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Kardex · {ficha.placa}</h1><p className="mt-1 text-sm text-slate-500">{ficha.archivo} · Hoja {ficha.hoja}</p></div></div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/activos/vehiculos/kardex/${ficha.id}/pdf`} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800"><Download className="h-4 w-4"/>Descargar PDF</a>
            <a href={`/activos/vehiculos/kardex/${ficha.id}/original`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4"/>Excel original</a>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Datos de la hoja</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{datos.map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}</dl>
        <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">El responsable, la regional y el estado vigentes se consultan en el inventario. Esta hoja conserva los datos tal como figuran en el Excel.</p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Filas registradas en el Excel · {ficha.servicios.length}</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr>{["Fila","Fecha","Kilometraje","Descripción registrada","Taller / proveedor","Unidad","N.º factura","Importe","Observaciones"].map(label=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{ficha.servicios.map(servicio=><tr key={servicio.fila} className="align-top hover:bg-blue-50/40"><td className="px-4 py-4 text-slate-500">{servicio.fila}</td><td className="px-4 py-4">{servicio.fecha||"—"}</td><td className="px-4 py-4">{servicio.kilometraje||"—"}</td><td className="min-w-64 max-w-lg px-4 py-4">{servicio.descripcion}</td><td className="px-4 py-4">{servicio.taller||"—"}</td><td className="px-4 py-4">{servicio.unidad||"—"}</td><td className="px-4 py-4">{servicio.factura||"—"}</td><td className="px-4 py-4">{servicio.importe||"—"}</td><td className="min-w-56 max-w-md px-4 py-4">{servicio.observaciones||"—"}</td></tr>)}{ficha.servicios.length===0&&<tr><td colSpan={9} className="px-6 py-14 text-center text-slate-500">Esta hoja todavía no tiene filas de detalle.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
