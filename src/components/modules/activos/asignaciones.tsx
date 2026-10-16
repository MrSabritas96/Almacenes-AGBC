"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CornerDownLeft, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { crearAsignacion, devolverAsignacion } from "@/actions/activos/asignaciones";
import type { Asignacion } from "@/actions/activos/asignaciones-modelo";
import { fecha } from "./presentacion";

const inputStyle = "w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-100";

export function EstadoAsignacion({ asignacion, hoy }: { asignacion: Pick<Asignacion, "tipo" | "estado" | "fechaDevolucionPrevista">; hoy: string }) {
  const vencida = asignacion.estado === "activa" && asignacion.tipo === "momentanea" && !!asignacion.fechaDevolucionPrevista && asignacion.fechaDevolucionPrevista < hoy;
  const label = vencida ? "Vencida · pendiente de devolución" : asignacion.estado === "activa" ? "Activa" : asignacion.estado === "devuelta" ? "Devuelta" : "Reemplazada";
  const color = vencida ? "bg-rose-50 text-rose-800" : asignacion.estado === "activa" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{label}</span>;
}

function FormularioDevolucion({ asignacion, hoy }: { asignacion: Asignacion; hoy: string }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await devolverAsignacion({ asignacionId: asignacion.id, fechaCierre: data.get("fechaCierre"), motivoCierre: data.get("motivoCierre") });
        if (!result.ok) { setError(result.error); return; }
        toast.success("Devolución registrada. La custodia fue restablecida.");
        setAbierto(false); router.refresh();
      } catch { setError("No pudimos confirmar la devolución. Vuelve a intentarlo."); }
    });
  }
  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"><CornerDownLeft className="h-4 w-4" aria-hidden="true" />{asignacion.tipo === "momentanea" ? "Registrar devolución momentánea" : "Devolver asignación fija"}</button>;
  return <form onSubmit={enviar} className="mt-4 space-y-3 rounded-xl border border-ink-200 bg-white p-4">
    <p className="text-sm font-medium">{asignacion.tipo === "momentanea" ? "Confirmar devolución al responsable fijo o a la custodia de origen" : "Finalizar la fija y volver a la custodia de origen del Excel"}</p>
    <div><label htmlFor={`cierre-${asignacion.id}`} className="mb-1 block text-sm">Fecha de devolución</label><input id={`cierre-${asignacion.id}`} name="fechaCierre" type="date" required min={asignacion.fechaInicio} max={hoy} defaultValue={hoy} className={inputStyle} /></div>
    <div><label htmlFor={`motivo-${asignacion.id}`} className="mb-1 block text-sm">Detalle de la devolución</label><textarea id={`motivo-${asignacion.id}`} name="motivoCierre" required minLength={5} maxLength={2000} rows={2} placeholder="Ej. Bien recibido y verificado por el responsable fijo" className={inputStyle} /></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><button type="submit" disabled={pending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{pending ? "Guardando…" : "Confirmar devolución"}</button><button type="button" disabled={pending} onClick={() => setAbierto(false)} className="rounded-xl px-4 py-2 text-sm text-ink-500 hover:bg-ink-100">Cancelar</button></div>
  </form>;
}

type Props = {
  activoId: string; solicitudId: string; hoy: string; puedeGestionar: boolean;
  responsableActual: string | null; ubicacionActual: string | null;
  responsableOrigen: string | null; ubicacionOrigen: string | null;
  fija?: Asignacion; momentanea?: Asignacion;
  responsables: string[]; ubicaciones: string[];
};

export function GestionAsignaciones(props: Props) {
  const [tipo, setTipo] = useState<"fija" | "momentanea">("momentanea");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget, data = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        const result = await crearAsignacion({ solicitudId: props.solicitudId, activoId: props.activoId, asignacionFijaEsperada: props.fija?.id ?? null, tipo,
          responsableDestino: data.get("responsableDestino"), ubicacionDestino: data.get("ubicacionDestino"),
          fechaInicio: data.get("fechaInicio"), fechaDevolucionPrevista: tipo === "momentanea" ? data.get("fechaDevolucionPrevista") : null,
          motivo: data.get("motivo"), referenciaActa: String(data.get("referenciaActa") || "") || null });
        if (!result.ok) { setError(result.error); return; }
        toast.success(tipo === "momentanea" ? "Asignación momentánea registrada." : "Asignación fija registrada.");
        form.reset(); router.refresh();
      } catch { setError("No pudimos confirmar la asignación. Vuelve a intentarlo con este formulario."); }
    });
  }
  const retorno = props.fija?.responsableDestino ?? props.responsableOrigen ?? "custodia de origen sin responsable registrado";
  return <section className="space-y-5 rounded-2xl border border-ink-200 bg-white p-6" aria-labelledby="asignaciones-del-activo">
    <div><h2 id="asignaciones-del-activo" className="flex items-center gap-2 text-lg font-semibold"><UserRound className="h-5 w-5 text-brand-600" aria-hidden="true" />Asignaciones del activo</h2><p className="mt-2 text-sm text-ink-500">Custodia actual: <span className="font-medium text-ink-900">{props.responsableActual || "Sin responsable"}</span> · {props.ubicacionActual || "Sin ubicación"}</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl bg-ink-100 p-4"><h3 className="font-semibold">Asignación fija</h3>{props.fija ? <><p className="mt-2 text-sm">{props.fija.responsableDestino}</p><p className="mt-1 text-sm text-ink-500">{props.fija.ubicacionDestino} · Desde {fecha(props.fija.fechaInicio)}</p><div className="mt-3"><EstadoAsignacion asignacion={props.fija} hoy={props.hoy} /></div>{props.puedeGestionar && !props.momentanea && <FormularioDevolucion asignacion={props.fija} hoy={props.hoy} />}</> : <><p className="mt-2 text-sm text-ink-500">Todavía no hay una fija registrada en el sistema.</p><p className="mt-2 text-xs text-ink-500">Referencia del Excel: {props.responsableOrigen || "Sin responsable"} · {props.ubicacionOrigen || "Sin ubicación"}</p></>}</div>
      <div className="rounded-xl bg-brand-50 p-4"><h3 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-brand-600" aria-hidden="true" />Asignación momentánea</h3>{props.momentanea ? <><p className="mt-2 text-sm">{props.momentanea.responsableDestino}</p><p className="mt-1 text-sm text-ink-500">{props.momentanea.ubicacionDestino}</p><p className="mt-2 text-sm">Devolución prevista: <strong>{fecha(props.momentanea.fechaDevolucionPrevista)}</strong></p><div className="mt-3"><EstadoAsignacion asignacion={props.momentanea} hoy={props.hoy} /></div><p className="mt-3 text-xs text-ink-500">Al devolver vuelve a: {retorno}.</p>{props.puedeGestionar && <FormularioDevolucion asignacion={props.momentanea} hoy={props.hoy} />}</> : <p className="mt-2 text-sm text-ink-500">No hay una asignación momentánea activa.</p>}</div>
    </div>
    {props.momentanea && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Registra la devolución momentánea antes de crear otra asignación o cambiar la fija.</p>}
    {props.puedeGestionar && !props.momentanea && <form onSubmit={enviar} className="space-y-4 border-t border-ink-200 pt-5">
      <fieldset disabled={pending} className="space-y-4"><legend className="mb-3 font-semibold">Nueva asignación</legend>
        <div className="flex flex-wrap gap-3">{([ ["momentanea", "Momentánea", "Entrega temporal, con devolución prevista"], ["fija", "Fija", "Responsable habitual, sin fecha de vencimiento"] ] as const).map(([value,label,description]) => <label key={value} className={`flex flex-1 cursor-pointer items-start gap-3 rounded-xl border p-4 ${tipo === value ? "border-brand-500 bg-brand-50" : "border-ink-200"}`}><input type="radio" name="tipo" value={value} checked={tipo === value} onChange={() => { setTipo(value); setError(null); }} className="mt-1 accent-brand-600" /><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-ink-500">{description}</span></span></label>)}</div>
        <p className="text-xs text-ink-500">{tipo === "momentanea" ? `Al devolver el bien, vuelve a ${retorno}.` : props.fija ? "La fija actual se guardará como reemplazada. El historial se conserva." : "Esta será la primera asignación fija registrada para este bien."}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="responsable-destino" className="mb-1.5 block text-sm font-medium">Responsable receptor</label><input id="responsable-destino" name="responsableDestino" list="responsables-asignacion" autoComplete="off" required minLength={3} maxLength={200} placeholder="Nombre completo del receptor" className={inputStyle} /><datalist id="responsables-asignacion">{props.responsables.map(value => <option key={value} value={value} />)}</datalist></div>
          <div><label htmlFor="ubicacion-destino" className="mb-1.5 block text-sm font-medium">Ubicación de destino</label><input id="ubicacion-destino" name="ubicacionDestino" list="ubicaciones-asignacion" autoComplete="off" required minLength={2} maxLength={200} placeholder="Oficina, área o regional" className={inputStyle} /><datalist id="ubicaciones-asignacion">{props.ubicaciones.map(value => <option key={value} value={value} />)}</datalist></div>
          <div><label htmlFor="fecha-inicio-asignacion" className="mb-1.5 block text-sm font-medium">Fecha de entrega</label><input id="fecha-inicio-asignacion" name="fechaInicio" type="date" required defaultValue={props.hoy} max={props.hoy} className={inputStyle} /></div>
          {tipo === "momentanea" && <div><label htmlFor="fecha-devolucion-prevista" className="mb-1.5 block text-sm font-medium">Fecha prevista de devolución</label><input id="fecha-devolucion-prevista" name="fechaDevolucionPrevista" type="date" required min={props.hoy} className={inputStyle} /></div>}
          <div className={tipo === "fija" ? "" : "sm:col-span-2"}><label htmlFor="referencia-acta-asignacion" className="mb-1.5 block text-sm font-medium">Referencia de acta (opcional)</label><input id="referencia-acta-asignacion" name="referenciaActa" maxLength={200} placeholder="Número o referencia del acta" className={inputStyle} /></div>
          <div className="sm:col-span-2"><label htmlFor="motivo-asignacion" className="mb-1.5 block text-sm font-medium">Motivo de la asignación</label><textarea id="motivo-asignacion" name="motivo" required minLength={5} maxLength={2000} rows={3} placeholder="Describe para qué se entrega el bien" className={inputStyle} /></div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={pending} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{pending ? "Guardando…" : tipo === "momentanea" ? "Registrar asignación momentánea" : "Registrar asignación fija"}</button>
      </fieldset>
    </form>}
    {!props.puedeGestionar && <p className="text-sm text-ink-500">Tu acceso permite consultar las asignaciones. Para registrarlas se requiere permiso de actualización de Activos.</p>}
  </section>;
}
