import type { Asignacion } from "@/actions/activos/asignaciones-modelo";

export function EstadoAsignacion({ asignacion, hoy }: { asignacion: Pick<Asignacion, "tipo" | "estado" | "fechaDevolucionPrevista">; hoy: string }) {
  const vencida = asignacion.estado === "activa" && asignacion.tipo === "momentanea" && !!asignacion.fechaDevolucionPrevista && asignacion.fechaDevolucionPrevista < hoy;
  const label = vencida ? "Vencida · pendiente de devolución" : asignacion.estado === "activa" ? "Activa" : asignacion.estado === "devuelta" ? "Devuelta" : "Reemplazada";
  const color = vencida ? "bg-rose-50 text-rose-800" : asignacion.estado === "activa" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{label}</span>;
}
