export default function CargandoActivos() {
  return <div role="status" className="mx-auto max-w-7xl space-y-6"><p className="text-sm text-ink-500">Cargando inventario de activos…</p><div className="h-12 w-72 animate-pulse rounded-xl bg-ink-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-28 animate-pulse rounded-2xl bg-ink-200" />)}</div><div className="h-96 animate-pulse rounded-2xl bg-white" /></div>;
}
