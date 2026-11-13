import { EditarActivo } from "@/components/modules/activos/editar-activo";
import { catalogoProcedencias } from "@/actions/activos/procedencias-consultas";
import { NombreProcedencia } from "@/components/modules/activos/procedencias-contexto";
import Link from "next/link";
import { NuevoActivoModal } from "@/components/modules/activos/nuevo-activo-modal";
import {
  Eye,
  Armchair,
  Monitor,
  Radio,
  Printer,
  Car,
  Projector,
  Building2,
  FileKey,
  Wrench,
  HelpCircle,
  Boxes,
  ChevronRight,
  ArrowLeft,
  Search,
  MapPin,
  Tags,
  CheckCircle2,
} from "lucide-react";
import { consultarCategorias } from "@/actions/activos/categorias-consultas";
import { cantidad, EstadoActivo } from "@/components/modules/activos/presentacion";
import { SelectorDropdown } from "@/components/modules/activos/selector-dropdown";

const iconos = {
  muebles: Armchair,
  computacion: Monitor,
  comunicacion: Radio,
  oficina: Printer,
  vehiculos: Car,
  educacional: Projector,
  instalaciones: Building2,
  intangibles: FileKey,
  herramientas: Wrench,
  pendiente: HelpCircle,
};

export default async function Categorias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const catalogo = await catalogoProcedencias();
  const d = await consultarCategorias(await searchParams);
  const seleccion = d.categorias.find((c) => c.id === d.categoria);

  function enlace(categoria = d.categoria, pagina = 1) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      categoria,
      q: d.q,
      origen: d.origen,
      estado: d.estado,
      regional: categoria === "vehiculos" ? d.regional : "",
      pagina: pagina > 1 ? String(pagina) : "",
    })) {
      if (v) p.set(k, v);
    }
    return `/activos/categorias${p.size ? `?${p}` : ""}#${
      categoria === "vehiculos" ? "buscar-vehiculos" : "listado-categorias"
    }`;
  }

  // Opciones para los selectores modernos con formato profesional
  const opcionesRegionales = [
    { valor: "", label: "Todas las regionales", count: d.totalBusqueda },
    ...d.regionales.map((r) => ({
      valor: r.nombre,
      label: r.nombre,
      count: r.total,
    })),
  ];

  const opcionesProcedencias = [
    { valor: "", label: "Todas las procedencias" },
    ...d.origenes.map((o) => ({
      valor: o,
      label: catalogo.find((p) => p.clave === o)?.nombre || o,
    })),
  ];

  const opcionesEstados = [
    { valor: "", label: "Todos los estados" },
    { valor: "BUENO", label: "BUENO" },
    { valor: "REGULAR", label: "REGULAR" },
    { valor: "MALO", label: "MALO" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      {/* 1. Header con identidad institucional AGBC */}
      <div>
        <header className="rounded-2xl border border-ink-200 border-t-4 border-t-amber-400 bg-white p-6 shadow-2xs">
          <Link href="/activos/asignaciones" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-2xs transition-colors hover:bg-slate-50"><ArrowLeft className="h-4 w-4"/>Volver a Asignaciones</Link>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Gestión de activos institucionales
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
                Activos por categorías
              </h1>
              <p className="mt-1 text-sm text-ink-500 max-w-2xl leading-relaxed">
                {cantidad(d.totalInventario)} registros vigentes de todas las procedencias. Selecciona una categoría para consultar sus bienes clasificados.
              </p>
            </div>
            <Link
              href="/activos"
              className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-xs font-bold text-brand-800 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Inventario completo
            </Link>
          </div>
        </header>
      </div>

      {/* Nota descriptiva */}
      <p className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-relaxed text-blue-900">
        {cantidad(d.oficiales)} registros tienen categoría oficial.{" "}
        {d.registradas > 0 && (
          <>{cantidad(d.registradas)} tienen categoría registrada manualmente. </>
        )}
        Para los demás se sugiere una categoría según su descripción; cada sugerencia se identifica en el listado. Los casos dudosos quedan en &laquo;Por clasificar&raquo;.
      </p>

      {/* 2. Filtros generales con selectores profesionales */}
      <form className="grid items-end gap-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-2xs sm:grid-cols-2 lg:grid-cols-4">
        {d.categoria && <input type="hidden" name="categoria" value={d.categoria} />}
        {d.regional && <input type="hidden" name="regional" value={d.regional} />}

        <div>
          <label className="text-xs font-bold text-ink-700">
            Código, descripción o responsable
          </label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-ink-400"
              aria-hidden="true"
            />
            <input
              name="q"
              defaultValue={d.q}
              className="w-full rounded-xl border border-ink-200 bg-slate-50/50 py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="Buscar un activo…"
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-ink-700">Procedencia</label>
          <SelectorDropdown
            name="origen"
            defaultValue={d.origen}
            opciones={opcionesProcedencias}
            placeholder="Todas las procedencias"
            icon={Tags}
            mostrarContadorBadge={false}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-ink-700">Estado</label>
          <SelectorDropdown
            name="estado"
            defaultValue={d.estado}
            opciones={opcionesEstados}
            placeholder="Todos los estados"
            icon={CheckCircle2}
            mostrarContadorBadge={false}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700 active:scale-[0.98] transition-all"
          >
            <Search className="h-4 w-4" />
            <span>Buscar</span>
          </button>
          {d.puedeCrear && (
            <NuevoActivoModal
              categoria={d.categoria}
              origen={d.origen}
              responsables={d.responsables}
            />
          )}
        </div>
      </form>

      {/* 3. Navegación por Tarjetas de Categorías */}
      <nav aria-label="Categorías de activos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Link
          href={enlace("")}
          aria-current={!d.categoria ? "page" : undefined}
          className={`flex items-center gap-3 rounded-2xl border p-4 shadow-2xs transition-all ${
            !d.categoria
              ? "border-brand-500 bg-brand-50/80 ring-2 ring-brand-500/20"
              : "border-ink-200 bg-white hover:border-brand-300 hover:bg-slate-50/60"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200/50">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-ink-900 text-sm">Todos los activos</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand-900">
              {cantidad(d.totalInventario)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-400" />
        </Link>

        {d.categorias.map((c) => {
          const Icon = iconos[c.icono];
          const seleccionada = d.categoria === c.id;
          return (
            <Link
              key={c.id}
              href={enlace(c.id)}
              aria-current={seleccionada ? "page" : undefined}
              className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xs transition-all ${
                seleccionada
                  ? "border-brand-500 bg-brand-50/80 ring-2 ring-brand-500/20"
                  : "border-ink-200 bg-white hover:border-brand-300 hover:bg-slate-50/60"
              }`}
            >
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  seleccionada
                    ? "bg-brand-600 text-white border-brand-700"
                    : "bg-slate-50 text-brand-600 border-slate-200/80"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink-900 truncate">{c.nombre}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
                  {cantidad(c.total)}
                </p>
                <p className="mt-0.5 text-xs text-ink-400 line-clamp-1">{c.detalle}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-400" />
            </Link>
          );
        })}
      </nav>

      {/* 4. Buscador específico para Vehículos con Selector Regional Profesional */}
      {d.categoria === "vehiculos" && (
        <section
          id="buscar-vehiculos"
          className="rounded-2xl border border-ink-200 bg-white p-6 shadow-2xs border-t-4 border-t-amber-400"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200/60 shadow-2xs">
                <Car className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink-900">
                  Buscar vehículos por regional
                </h2>
                <p className="text-xs text-ink-500">
                  Filtra camionetas, vagonetas y motocicletas asignadas por regional o sede institucional.
                </p>
              </div>
            </div>

            {d.regional && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 shadow-2xs">
                <MapPin className="h-3.5 w-3.5 text-amber-600" />
                Regional: {d.regional}
              </span>
            )}
          </div>

          <form
            action="/activos/categorias#listado-categorias"
            className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_auto]"
          >
            <input type="hidden" name="categoria" value="vehiculos" />
            {d.origen && <input type="hidden" name="origen" value={d.origen} />}
            {d.estado && <input type="hidden" name="estado" value={d.estado} />}

            <div>
              <label className="text-xs font-bold text-ink-700">
                Código, placa o descripción
              </label>
              <div className="relative mt-1.5">
                <Search
                  className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-ink-400"
                  aria-hidden="true"
                />
                <input
                  name="q"
                  defaultValue={d.q}
                  placeholder="Ej. placa, código, Toyota o motocicleta"
                  className="w-full rounded-xl border border-ink-200 bg-slate-50/50 py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  maxLength={200}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink-700">Regional</label>
              <SelectorDropdown
                name="regional"
                defaultValue={d.regional}
                opciones={opcionesRegionales}
                placeholder="Todas las regionales"
                icon={MapPin}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98]"
              >
                <Search className="h-4 w-4" />
                <span>Buscar vehículos</span>
              </button>
              {(d.q || d.regional) && (
                <Link
                  href={enlace("vehiculos")}
                  className="inline-flex items-center rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-ink-600 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Limpiar
                </Link>
              )}
            </div>
          </form>
        </section>
      )}

      {/* 5. Tabla de Listado de Activos */}
      <section
        id="listado-categorias"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-5 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-ink-900">
              {seleccion?.nombre ?? "Todos los activos"}
              {d.regional && (
                <span className="ml-2 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {d.regional}
                </span>
              )}
            </h2>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-800 border border-brand-200">
              {cantidad(d.total)} registros
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] table-auto text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
              <tr>
                {[
                  "Código / Procedencia",
                  "Descripción",
                  "Categoría",
                  "Estado",
                  "Ubicación / Responsable",
                  "Acciones",
                ].map((h) => (
                  <th key={h} className={`px-5 py-3.5 ${h === "Acciones" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {d.registros.map((r) => (
                <tr key={r.id} className="align-top hover:bg-brand-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-brand-700">{r.codigo || "Sin código"}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      <NombreProcedencia clave={r.origen} />
                    </p>
                  </td>
                  <td className="max-w-sm px-5 py-3.5 text-ink-800">{r.descripcion}</td>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-ink-900">
                      {d.categorias.find((c) => c.id === r.categoria)?.nombre}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        r.criterio === "excel" || r.criterio === "registrada"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : r.criterio === "sugerida"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {r.criterio === "excel"
                        ? "Categoría oficial"
                        : r.criterio === "registrada"
                        ? "Categoría manual"
                        : r.criterio === "sugerida"
                        ? "Sugerida · por revisar"
                        : "Por clasificar"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <EstadoActivo estado={r.estado} />
                  </td>
                  <td className="max-w-xs px-5 py-3.5">
                    <p className="font-bold text-ink-900">{r.regionalNombre}</p>
                    <p className="text-xs text-ink-500">{r.ubicacion || "Sin ubicación"}</p>
                    <p className="mt-1 text-xs text-ink-600 font-medium">
                      {r.responsable || "Sin responsable"}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/activos/${r.id}`}
                        aria-label={`Ver ficha de ${r.codigo || r.descripcion}`}
                        title="Ver ficha del activo"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <EditarActivo id={r.id} codigo={r.codigo} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!d.registros.length && (
          <p className="p-10 text-center text-sm text-ink-500">
            No hay activos en esta categoría con los filtros seleccionados.
          </p>
        )}

        {/* Paginación */}
        <nav
          aria-label="Paginación de activos por categoría"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-4 text-xs text-ink-600 bg-slate-50/50"
        >
          <span>
            Página <strong>{d.pagina}</strong> de <strong>{d.paginas}</strong>
          </span>
          <div className="flex gap-2">
            {d.pagina > 1 && (
              <Link
                href={enlace(d.categoria, d.pagina - 1)}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-bold text-brand-800 hover:bg-brand-50 shadow-2xs"
              >
                Anterior
              </Link>
            )}
            {d.pagina < d.paginas && (
              <Link
                href={enlace(d.categoria, d.pagina + 1)}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-bold text-brand-800 hover:bg-brand-50 shadow-2xs"
              >
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      </section>
    </div>
  );
}
