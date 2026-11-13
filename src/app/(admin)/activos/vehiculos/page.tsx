import Link from "next/link";
import Image from "next/image";
import { Car, Eye, MapPin, Printer, Search, UserRound, Wrench } from "lucide-react";
import { consultarCategorias } from "@/actions/activos/categorias-consultas";
import { NombreProcedencia } from "@/components/modules/activos/procedencias-contexto";
import { EstadoActivo, cantidad } from "@/components/modules/activos/presentacion";

type Params = Record<string, string | string[] | undefined>;

export default async function VehiculosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const data = await consultarCategorias({ ...params, categoria: "vehiculos" }, false, true);
  const field = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-blue-100 border-t-4 border-t-amber-400 bg-white p-6 shadow-sm">
        <div className="pointer-events-none absolute bottom-0 right-5 hidden h-[132px] w-[108px] md:block" aria-hidden="true">
          <Image src="/mascota-saludo.webp" alt="" fill sizes="108px" className="object-contain object-bottom" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-800">Gestión de activos · AGBC</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white"><Car className="h-6 w-6" aria-hidden="true" /></span>
          <div className="relative z-10 md:pr-28">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Vehículos y motocicletas</h1>
            <p className="mt-1 text-sm text-slate-600">Inventario de unidades por regional, responsable y estado.</p>
          </div>
        </div>
      </header>

      <form action="/activos/vehiculos#inventario-vehiculos" method="get" className="grid items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold text-slate-800">Código, placa o descripción
          <span className="relative mt-1.5 block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true"/><input name="q" defaultValue={data.q} maxLength={200} placeholder="Ej. placa, Toyota o motocicleta" className={`${field} pl-10`}/></span>
        </label>
        <label className="text-sm font-semibold text-slate-800">Regional
          <select name="regional" defaultValue={data.regional} className={field}><option value="">Todas las regionales</option>{data.regionalesVehiculos.map(nombre=><option key={nombre} value={nombre}>{nombre}</option>)}</select>
        </label>
        <div className="flex gap-3">
          <button type="submit" className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800">Buscar</button>
          <Link href="/activos/vehiculos" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Limpiar</Link>
          <button type="submit" formAction="/activos/vehiculos/imprimir" formTarget="_blank" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"><Printer className="h-4 w-4 text-accent-400" aria-hidden="true"/>Imprimir</button>
        </div>
      </form>

      <section id="inventario-vehiculos" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div><h2 className="text-lg font-bold text-slate-900">Inventario de vehículos</h2><p className="text-sm text-slate-500">{cantidad(data.total)} {data.total===1?"unidad encontrada":"unidades encontradas"}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <caption className="sr-only">Inventario vigente de vehículos y motocicletas</caption>
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr>{["Código / procedencia","Placa","Vehículo o motocicleta","Chasis","Regional / ubicación","Responsable actual / conductor","Estado","Acciones"].map(h=><th key={h} className="px-4 py-3.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.registros.map(r=>{
                const fuente=r.fuentesExcel.find(f=>f.marca||f.modelo||f.anio||f.chasis)||r.fuentesExcel[0];
                const regionalesExcel=[...new Set(r.fuentesExcel.map(f=>f.regional).filter(Boolean))];
                const tieneMantenimiento=r.mantenimientosRegistrados>0||r.fuentesExcel.some(f=>f.servicios.length>0);
                return <tr key={r.id} className="align-top hover:bg-blue-50/40">
                <td className="px-4 py-4"><Link href={`/activos/${r.id}`} className="font-semibold text-blue-700 hover:underline">{r.codigo||"Sin código"}</Link><p className="mt-1 text-xs text-slate-500"><NombreProcedencia clave={r.origen}/></p></td>
                <td className="px-4 py-4 font-semibold text-slate-800">{r.placa||fuente?.placa||"Sin placa"}</td>
                <td className="max-w-md px-4 py-4 leading-relaxed text-slate-700"><p>{r.descripcion}</p></td>
                <td className="px-4 py-4 text-slate-600">{r.chasisInventario||fuente?.chasis||"Sin dato"}{r.chasisInventario&&fuente?.chasis&&r.chasisInventario!==fuente.chasis&&<p className="mt-1 text-xs text-amber-700">Documento: {fuente.chasis}</p>}</td>
                <td className="px-4 py-4"><p className="flex items-center gap-1.5 font-medium text-slate-800"><MapPin className="h-4 w-4 text-blue-600" aria-hidden="true"/>{r.regionalNombre}</p><p className="mt-1 text-xs text-slate-500">{r.ubicacion||"Sin ubicación"}</p>{regionalesExcel.some(x=>x.toLocaleUpperCase("es")!==r.regionalNombre.toLocaleUpperCase("es"))&&<p className="mt-1 text-xs text-amber-700">Documento: {regionalesExcel.join(", ")}</p>}</td>
                <td className="px-4 py-4"><p className="flex items-center gap-1.5 text-slate-700"><UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true"/>{r.responsable||"Sin responsable"}</p></td>
                <td className="px-4 py-4"><div className="flex items-center gap-2"><EstadoActivo estado={r.estado}/>{tieneMantenimiento&&<span aria-label="Tiene registros de mantenimiento" title="Tiene registros de mantenimiento" className="inline-block h-3 w-3 rounded-full bg-amber-400 ring-2 ring-amber-100"/>}</div></td>
                <td className="px-4 py-4"><div className="flex items-center gap-2"><Link href={`/activos/${r.id}`} aria-label={`Ver ficha de ${r.codigo||r.placa||"vehículo"}`} title="Ver ficha del vehículo" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><Eye className="h-5 w-5" aria-hidden="true"/></Link><Link href={`/activos/vehiculos/mantenimientos/${r.id}`} aria-label={`Ver mantenimientos de ${r.codigo||r.placa||"vehículo"}`} title="Ver registros de mantenimiento" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 text-accent-400 shadow-sm transition hover:bg-brand-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"><Wrench className="h-5 w-5" aria-hidden="true"/></Link></div></td>
              </tr>})}
              {data.registros.length===0&&<tr><td colSpan={8} className="px-6 py-14 text-center text-slate-500">No se encontraron vehículos ni motocicletas con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-600"><span>Página {data.pagina} de {data.paginas}</span><div className="flex gap-4">{data.pagina>1&&<Link href={`/activos/vehiculos?${new URLSearchParams({q:data.q,regional:data.regional,responsable:data.responsable,pagina:String(data.pagina-1)})}#inventario-vehiculos`} className="font-semibold text-blue-700">Anterior</Link>}{data.pagina<data.paginas&&<Link href={`/activos/vehiculos?${new URLSearchParams({q:data.q,regional:data.regional,responsable:data.responsable,pagina:String(data.pagina+1)})}#inventario-vehiculos`} className="font-semibold text-blue-700">Siguiente</Link>}</div></div>
      </section>
    </div>
  );
}
