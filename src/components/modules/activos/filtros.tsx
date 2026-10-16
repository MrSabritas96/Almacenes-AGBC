"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import type { FiltrosActivos } from "@/actions/activos/consultas";

type Opciones = Record<"origen" | "estado" | "ubicacion" | "responsable", string[]>;
export function FiltrosInventario({ filtros, opciones, responsablesPorUbicacion }: { filtros: FiltrosActivos; opciones: Opciones; responsablesPorUbicacion: Record<string, string[]> }) {
  const [ubicacion, setUbicacion] = useState(filtros.ubicacion);
  const [responsable, setResponsable] = useState(filtros.responsable);
  const responsables = ubicacion ? responsablesPorUbicacion[ubicacion] ?? [] : opciones.responsable;
  const opcionesActuales = { ...opciones, responsable: responsables };
  const seleccion = { ...filtros, ubicacion, responsable };
  function cambiarUbicacion(value: string) {
    setUbicacion(value);
    const nombres = value ? responsablesPorUbicacion[value] ?? [] : opciones.responsable;
    setResponsable(value && nombres.length === 1 ? nombres[0] ?? "" : "");
  }
  return (
    <form action="/activos" method="get" className="rounded-2xl border border-ink-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-brand-600" aria-hidden="true" />Buscar en el inventario<Link href="/activos/responsables" className="ml-auto text-xs text-brand-600 hover:underline">Administrar responsables</Link></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-4">
          <label htmlFor="activos-busqueda" className="mb-1.5 block text-sm font-medium">Código, descripción o responsable</label>
          <div className="relative"><Search className="absolute top-3 left-3 h-4 w-4 text-ink-500" aria-hidden="true" /><input id="activos-busqueda" name="q" defaultValue={filtros.q} maxLength={200} placeholder="Ej. AGBC-02-01-0001, escritorio o apellido" className="w-full rounded-xl border border-ink-200 py-2.5 pr-3 pl-10 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-100" /></div>
        </div>
        {([ ["origen", "Procedencia"], ["estado", "Estado"], ["ubicacion", "Ubicación"], ["responsable", "Responsable"] ] as const).map(([key, label]) => (
          <div key={key}><label htmlFor={`filtro-${key}`} className="mb-1.5 block text-sm font-medium">{label}</label>
            <select id={`filtro-${key}`} name={key} defaultValue={key === "ubicacion" || key === "responsable" ? undefined : filtros[key]} value={key === "ubicacion" || key === "responsable" ? seleccion[key] : undefined} onChange={event => { if (key === "ubicacion") cambiarUbicacion(event.target.value); else if (key === "responsable") setResponsable(event.target.value); }} className="w-full min-w-0 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-100">
              <option value="">Todos</option>
              {seleccion[key] && !opcionesActuales[key].includes(seleccion[key]) && <option value={seleccion[key]}>{seleccion[key]} (sin coincidencias)</option>}
              {opcionesActuales[key].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        ))}
      </div>
      {ubicacion && <p aria-live="polite" className="mt-3 text-xs text-ink-500">{responsables.length === 1 ? "Responsable seleccionado automáticamente para esta ubicación." : responsables.length > 1 ? "Esta ubicación tiene varios responsables. Selecciona uno o deja Todos para ver todos sus bienes." : "Esta ubicación no tiene un responsable registrado."}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 pt-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="revision" value="1" defaultChecked={filtros.revision} className="h-4 w-4 accent-brand-600" />Solo registros que requieren revisión</label>
        <div className="flex items-center gap-3"><Link href="/activos" className="rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-100">Limpiar</Link><button type="submit" className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">Aplicar filtros</button></div>
      </div>
    </form>
  );
}

