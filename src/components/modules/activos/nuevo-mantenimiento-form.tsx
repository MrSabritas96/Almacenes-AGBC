"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Wrench } from "lucide-react";
import { estadoInicialMantenimiento, registrarMantenimientoVehiculo } from "@/actions/activos/mantenimientos-vehiculos";

type VehiculoOption = { id: string; codigo: string | null; placa: string; descripcion: string; regional: string; estado: string | null };

export function NuevoMantenimientoForm({ vehiculos, activoInicial, fechaHoy }: { vehiculos: VehiculoOption[]; activoInicial: string; fechaHoy: string }) {
  const [state, action, pending] = useActionState(registrarMantenimientoVehiculo, estadoInicialMantenimiento);
  const field = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold text-slate-800">Vehículo o motocicleta <span className="text-rose-600">*</span>
        <select name="activoId" required defaultValue={activoInicial} className={field}>
          <option value="">Selecciona una unidad del inventario</option>
          {vehiculos.map((item) => <option key={item.id} value={item.id}>{[item.placa || "Sin placa", item.codigo || "Sin código", item.descripcion, item.regional].filter(Boolean).join(" · ")}</option>)}
        </select>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-800">Fecha del mantenimiento <span className="text-rose-600">*</span>
          <input name="fecha" type="date" required defaultValue={fechaHoy} className={field}/>
        </label>
        <label className="block text-sm font-semibold text-slate-800">Kilometraje
          <input name="kilometraje" inputMode="numeric" maxLength={40} placeholder="Ej. 48.500 km" className={field}/>
        </label>
      </div>

      <label className="block text-sm font-semibold text-slate-800">Trabajo realizado <span className="text-rose-600">*</span>
        <textarea name="descripcion" required minLength={3} maxLength={3000} rows={3} placeholder="Describe el servicio, reparación o repuesto" className={field}/>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-800">Taller o proveedor<input name="taller" maxLength={250} className={field}/></label>
        <label className="block text-sm font-semibold text-slate-800">Unidad<input name="unidad" maxLength={150} placeholder="Ej. Servicio, repuesto" className={field}/></label>
        <label className="block text-sm font-semibold text-slate-800">N.º de factura<input name="factura" maxLength={120} className={field}/></label>
        <label className="block text-sm font-semibold text-slate-800">Importe<input name="importe" maxLength={80} placeholder="Ej. 850,00 Bs" className={field}/></label>
      </div>

      <label className="block text-sm font-semibold text-slate-800">Observaciones
        <textarea name="observaciones" maxLength={2000} rows={2} className={field}/>
      </label>

      {state.error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{state.error}</p>}
      {state.ok && state.activoId && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5"/>Mantenimiento registrado correctamente.</span><Link className="font-bold underline" href={`/activos/vehiculos/mantenimientos/${state.activoId}`}>Ver historial</Link></div>}

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <Link href="/activos/vehiculos" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</Link>
        <button type="submit" disabled={pending || vehiculos.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Wrench className="h-4 w-4"/>{pending ? "Guardando…" : "Guardar mantenimiento"}</button>
      </div>
    </form>
  );
}
