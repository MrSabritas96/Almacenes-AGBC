import Link from "next/link";
import {
  ArrowRight, CalendarClock, ClipboardList, FilePlus2, FileSpreadsheet, Handshake, TriangleAlert, Users,
} from "lucide-react";
import { consultarDashboardActivos } from "@/actions/activos/dashboard-consultas";
import { cantidad, fecha } from "@/components/modules/activos/presentacion";

export default async function DashboardActivos() {
  const { inventario, asignacionesActivas, devolucionesVencidas, totalActas, totalResponsables,
    devoluciones, recientes, gestion, puedeGestionar } =
    await consultarDashboardActivos();
  const indicadores = [
    { label: "Activos vigentes", value: inventario.total, href: "/activos", icon: ClipboardList },
    { label: "Requieren revisión", value: inventario.revision, href: "/activos?revision=1", icon: TriangleAlert },
    { label: "Asignaciones activas", value: asignacionesActivas, href: "/activos/asignaciones?estado=activa", icon: Handshake },
    { label: "Devoluciones vencidas", value: devolucionesVencidas, href: "/activos/asignaciones?estado=vencida", icon: CalendarClock },
    { label: "Actas registradas", value: totalActas, href: "/activos/archivo-actas", icon: FileSpreadsheet },
    { label: "Responsables activos", value: totalResponsables, href: "/activos/responsables", icon: Users },
  ];

  return (
    <div className="mx-auto max-w-[1500px] view-enter">
      <header className="overview-banner">
        <div className="min-w-0">
          <span className="eyebrow">GESTIÓN ACTIVA {gestion.gestion} · ACTIVOS FIJOS</span>
          <h1 className="my-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Mi dashboard</h1>
          <p>Consulta el estado del inventario y las devoluciones pendientes.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/activos" className="secondary-button">
              Ver inventario <ArrowRight size={17} aria-hidden="true" />
            </Link>
            {puedeGestionar && <Link href="/activos/asignaciones/actas/nueva" className="primary-button">
              <FilePlus2 size={17} aria-hidden="true" /> Nueva acta
            </Link>}
          </div>
        </div>
        <ClipboardList className="banner-parcels shrink-0" size={68} aria-hidden="true" />
      </header>

      <section className="stat-grid" aria-label="Resumen de Activos Fijos">
        {indicadores.map(({ label, value, href, icon: Icon }) => (
          <Link key={href} href={href} className="stat-card min-w-0">
            <div>
              <span className="min-w-0">{label}</span>
              <Icon size={18} className="hidden shrink-0 sm:block" aria-hidden="true" />
            </div>
            <strong>{cantidad(value)}</strong>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="data-panel min-w-0" aria-labelledby="dashboard-devoluciones">
          <div className="panel-heading flex-wrap">
            <h2 id="dashboard-devoluciones"><CalendarClock size={18} aria-hidden="true" /> Devoluciones vencidas</h2>
            <Link href="/activos/asignaciones?estado=vencida" className="text-link">Ver todas <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          {devoluciones.length ? (
            <ul className="divide-y divide-slate-100">
              {devoluciones.map(item => (
                <li key={item.id}>
                  <Link href={`/activos/${item.activoId}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-blue-50/50">
                    <span className="min-w-0 wrap-anywhere text-sm">
                      <strong className="block">{item.codigo || item.descripcion}</strong>
                      <span className="text-xs text-ink-600">{item.responsable}</span>
                    </span>
                    <span className="status-badge status-waiting">Venció el {fecha(item.fecha)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-4 text-sm text-ink-600">No hay devoluciones vencidas.</p>}
        </section>

        <section className="data-panel min-w-0" aria-labelledby="dashboard-actas">
          <div className="panel-heading flex-wrap">
            <h2 id="dashboard-actas"><FileSpreadsheet size={18} aria-hidden="true" /> Actas recientes</h2>
            <Link href="/activos/archivo-actas" className="text-link">Ver archivo <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          {recientes.length ? (
            <ul className="divide-y divide-slate-100">
              {recientes.map(item => (
                <li key={item.id}>
                  <Link
                    href={item.fuente === "sistema" ? `/activos/asignaciones/actas/${item.id}` : `/activos/archivo-actas/${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-blue-50/50"
                  >
                    <strong className="min-w-0 wrap-anywhere text-sm">{item.numero}</strong>
                    <span className="text-xs text-ink-600 tabular-nums">{fecha(item.fecha)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-4 text-sm text-ink-600">No hay actas con fecha registrada.</p>}
        </section>
      </div>
    </div>
  );
}
