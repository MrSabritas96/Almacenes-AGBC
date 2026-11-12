export default function Loading() {
  return <main className="dashboard-loading" role="status" aria-busy="true" aria-label="Cargando tu espacio de trabajo">
    <p className="sr-only">Cargando tu espacio de trabajo…</p>
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-subtitle" />
    <div className="skeleton skeleton-banner" />
    <div className="skeleton-stats">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" />)}</div>
    <div className="skeleton skeleton-table" />
  </main>;
}
