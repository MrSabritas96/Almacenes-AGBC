"use client";
import { AdministrarProcedencias } from "./administrar-procedencias";
import { useProcedencias } from "./procedencias-contexto";
import Link from "next/link";
import { Search, SlidersHorizontal, Users, Tags, CheckCircle2, MapPin } from "lucide-react";
import type { FiltrosActivos } from "@/actions/activos/consultas";
import { SelectorDropdown } from "./selector-dropdown";

type Opciones = Record<"origen" | "estado" | "regional" | "ubicacion" | "responsable", string[]>;

export function FiltrosInventario({ filtros, opciones }: { filtros: FiltrosActivos; opciones: Opciones }) {
  const { nombre, gestionar } = useProcedencias();

  const opcionesOrigen = [
    { valor: "", label: "Todas las procedencias" },
    ...(filtros.origen && !opciones.origen.includes(filtros.origen)
      ? [{ valor: filtros.origen, label: `${filtros.origen} (sin coincidencias)` }]
      : []),
    ...opciones.origen.map((v) => ({ valor: v, label: nombre(v) })),
  ];

  const opcionesEstado = [
    { valor: "", label: "Todos los estados" },
    ...(filtros.estado && !opciones.estado.includes(filtros.estado)
      ? [{ valor: filtros.estado, label: `${filtros.estado} (sin coincidencias)` }]
      : []),
    ...opciones.estado.map((v) => ({ valor: v, label: v })),
  ];

  const opcionesRegional = [
    { valor: "", label: "Todas las regionales" },
    ...(filtros.regional && !opciones.regional.includes(filtros.regional)
      ? [{ valor: filtros.regional, label: `${filtros.regional} (sin coincidencias)` }]
      : []),
    ...opciones.regional.map((v) => ({ valor: v, label: v === "OFICINA CENTRAL" ? "La Paz" : v })),
  ];

  return (
    <form id="filtros-inventario" action="/activos#filtros-inventario" method="get" className="rounded-2xl border border-ink-200 bg-white p-5 shadow-2xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <span className="text-ink-900">Buscar en el inventario</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/activos/responsables"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-700/20 bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-subtle hover:border-amber-600 hover:bg-amber-500 hover:text-amber-950 hover:shadow-md active:bg-amber-600 active:text-black active:scale-95 transition-all duration-150"
            title="Gestionar catálogo de custodios y responsables"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Administrar responsables</span>
          </Link>
          {gestionar && <AdministrarProcedencias />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-4">
          <label htmlFor="activos-busqueda" className="mb-1.5 block text-sm font-semibold text-ink-800">
            Código, descripción o responsable
          </label>
          <div className="relative">
            <Search className="absolute top-3 left-3 h-4 w-4 text-ink-500" aria-hidden="true" />
            <input
              id="activos-busqueda"
              name="q"
              defaultValue={filtros.q}
              maxLength={200}
              placeholder="Ej. AGBC-02-01-0001, escritorio o apellido"
              className="w-full rounded-xl border border-ink-200 py-2.5 pr-3 pl-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-2 focus:outline-brand-100"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink-800">Procedencia</label>
          <SelectorDropdown
            name="origen"
            defaultValue={filtros.origen}
            opciones={opcionesOrigen}
            placeholder="Todas las procedencias"
            icon={Tags}
            mostrarContadorBadge={false}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink-800">Estado</label>
          <SelectorDropdown
            name="estado"
            defaultValue={filtros.estado}
            opciones={opcionesEstado}
            placeholder="Todos los estados"
            icon={CheckCircle2}
            mostrarContadorBadge={false}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink-800">Regional</label>
          <SelectorDropdown
            name="regional"
            defaultValue={filtros.regional}
            opciones={opcionesRegional}
            placeholder="Todas las regionales"
            icon={MapPin}
            mostrarContadorBadge={false}
          />
        </div>
        <div className="flex items-end justify-end gap-3">
          <Link href="/activos" className="rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-100">
            Limpiar
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 shadow-sm active:scale-[0.98] transition-all"
          >
            Buscar
          </button>
        </div>
      </div>
    </form>
  );
}
