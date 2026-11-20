import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Wrench } from "lucide-react";
import { consultarCategorias } from "@/actions/activos/categorias-consultas";
import { NuevoMantenimientoForm } from "@/components/modules/activos/nuevo-mantenimiento-form";

export default async function NuevoMantenimientoVehiculoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await consultarCategorias({ categoria: "vehiculos" }, false, true);
  if (!data.puedeCrear) redirect("/activos/vehiculos");
  const activoInicial = typeof params.activo === "string" ? params.activo : "";
  const dateParts = new Intl.DateTimeFormat("en", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const fechaHoy = `${dateParts.find((part) => part.type === "year")?.value}-${dateParts.find((part) => part.type === "month")?.value}-${dateParts.find((part) => part.type === "day")?.value}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-2xl border border-blue-100 border-t-4 border-t-amber-400 bg-white p-6 shadow-sm">
        <div className="mb-5"><Link href="/activos/vehiculos" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"><ArrowLeft className="h-4 w-4"/>Atrás</Link></div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white"><Wrench className="h-6 w-6"/></span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-blue-800">Vehículos y motocicletas</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Nuevo mantenimiento</h1>
        <p className="mt-2 text-sm text-slate-600">Registra el servicio en el historial del vehículo seleccionado. El inventario vigente y el Archivo original se conservan sin cambios.</p>
      </header>
      {data.vehiculosParaMantenimiento.length === 0
        ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">No hay vehículos vigentes disponibles en el inventario.</div>
        : <NuevoMantenimientoForm vehiculos={data.vehiculosParaMantenimiento} activoInicial={activoInicial} fechaHoy={fechaHoy}/>}
    </div>
  );
}
