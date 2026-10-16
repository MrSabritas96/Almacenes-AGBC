import Link from "next/link";

export default function FichaNoEncontrada() {
  return <div className="mx-auto max-w-xl rounded-2xl border border-ink-200 bg-white p-8"><h1 className="text-xl font-semibold">Registro no encontrado</h1><p className="mt-3 text-sm text-ink-500">El registro solicitado no está disponible en el inventario vigente.</p><Link href="/activos" className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white">Volver al inventario</Link></div>;
}
