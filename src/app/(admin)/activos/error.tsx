"use client";

export default function ErrorActivos({ reset }: { reset: () => void }) {
  return <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-ink-200 bg-white p-8"><h2 className="text-xl font-semibold">No se pudo cargar el inventario</h2><p className="mt-3 text-sm text-ink-500">No pudimos completar la consulta. Vuelve a intentarlo en unos momentos.</p><button onClick={reset} className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Reintentar</button></div>;
}
