"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { cerrarGestionYHabilitarSiguiente, consultarCierreGestion } from "@/actions/activos/gestion";
import { DevolucionConjunta } from "./devolucion-conjunta";
import { NuevaActaModal } from "./nueva-acta-modal";

type Estado = Extract<Awaited<ReturnType<typeof consultarCierreGestion>>, { ok: true }>;

export function CierreGestion({ inicial }: { inicial: Estado }) {
  const [estado, setEstado] = useState(inicial);
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function actualizar() {
    start(async () => {
      const resultado = await consultarCierreGestion();
      if (resultado.ok) { setEstado(resultado); setError(""); }
      else setError(resultado.error);
      router.refresh();
    });
  }

  function cerrar() {
    start(async () => {
      setError("");
      const resultado = await cerrarGestionYHabilitarSiguiente();
      if (resultado.ok) {
        setConfirmar(false);
        router.refresh();
        const actualizado = await consultarCierreGestion();
        if (actualizado.ok) setEstado(actualizado);
      } else setError(resultado.error);
    });
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Control anual de custodia</p>
          <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Cierre de gestión {estado.gestion}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">Revisa las asignaciones pendientes y registra una devolución conjunta por responsable. Cuando todas estén devueltas, podrás cerrar la gestión y habilitar automáticamente las actas de {estado.gestion + 1}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={actualizar} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"><RefreshCw className="h-4 w-4"/>Actualizar pendientes</button>
          <NuevaActaModal hoy={estado.hoy} gestionActiva={estado.gestion} fechaInicial={estado.fechaInicial} fechaMinima={estado.fechaMinima} fechaMaxima={estado.fechaMaxima} responsables={estado.catalogoResponsables} etiqueta={`Nueva asignación ${estado.gestion}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-blue-800">Actas pendientes</p><p className="mt-1 text-2xl font-bold text-blue-950">{estado.totalActas}</p></div>
        <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs text-amber-800">Bienes por devolver</p><p className="mt-1 text-2xl font-bold text-amber-950">{estado.totalBienes}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-600">Responsables pendientes</p><p className="mt-1 text-2xl font-bold text-slate-900">{estado.responsables.length}</p></div>
      </div>
    </section>

    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <header className="border-b border-ink-200 px-5 py-4"><h2 className="font-bold text-ink-900">Devoluciones por responsable</h2><p className="mt-1 text-sm text-ink-500">Cada acta se agrupa por responsable y procedencia. Los documentos PDF originales quedan intactos.</p></header>
      {estado.responsables.length ? <ul className="divide-y divide-ink-100">{estado.responsables.map((responsable) => <li key={responsable.responsable} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><p className="font-semibold text-ink-900">{responsable.responsable}</p><p className="mt-1 text-sm text-ink-500">{responsable.actas} actas · {responsable.bienes} bienes pendientes</p></div><DevolucionConjunta responsableInicial={responsable.responsable}/></li>)}</ul> : <div className="flex items-center gap-3 p-6 text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0"/><p className="text-sm">No quedan asignaciones pendientes para la gestión {estado.gestion}. Ya puedes habilitar {estado.gestion + 1}.</p></div>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <header className="border-b border-ink-200 px-5 py-4"><h2 className="font-bold text-ink-900">Historial de gestiones</h2><p className="mt-1 text-sm text-ink-500">Las actas y sus PDF se conservan vinculados al año en que se emitieron.</p></header>
      <div className="divide-y divide-ink-100">{estado.historial.map((item)=><div key={item.gestion} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold text-ink-900">Gestión {item.gestion}</p><p className="mt-1 text-sm text-ink-500">{item.estado==="cerrada"?`Cerrada el ${item.cerradaEn?new Date(item.cerradaEn).toISOString().slice(0,10):""}`:"En curso"}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.estado==="cerrada"?"bg-slate-100 text-slate-700":"bg-emerald-100 text-emerald-800"}`}>{item.estado==="cerrada"?"Historial":"Activa"}</span><Link href={`/activos/archivo-actas?gestion=${item.gestion}`} className="rounded-lg border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">Ver actas</Link></div></div>)}</div>
    </section>

    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-blue-700"/><div><h2 className="font-bold text-blue-950">Habilitar la siguiente gestión</h2><p className="mt-1 text-sm text-blue-900">La acción se habilita cuando no haya asignaciones pendientes. Después, las nuevas actas usarán fecha y correlativo de {estado.gestion + 1} por procedencia y tipo.</p></div></div><button type="button" onClick={() => setConfirmar(true)} disabled={pending || estado.totalActas > 0} className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">Cerrar {estado.gestion} y habilitar {estado.gestion + 1}</button></div>
      {confirmar && <div role="dialog" aria-modal="true" aria-label="Confirmar cierre de gestión" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-950">¿Confirmas el cierre de la gestión {estado.gestion}? Las nuevas actas quedarán habilitadas para {estado.gestion + 1}.</p><div className="mt-3 flex gap-2"><button type="button" onClick={cerrar} disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Cerrando…" : `Confirmar ${estado.gestion} → ${estado.gestion + 1}`}</button><button type="button" onClick={() => setConfirmar(false)} disabled={pending} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold">Cancelar</button></div></div>}
    </section>
  </div>;
}
