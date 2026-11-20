import { ActivosRefresh, ActivosSidebar } from "@/components/sidebar/top-navigation";
import { ModuleNavigation } from "@/components/sidebar/module-navigation";
import { SidebarPanel, SidebarToggle } from "@/components/almacenes/sidebar-panel";
import { catalogoProcedencias } from "@/actions/activos/procedencias-consultas";
import { ProcedenciasProvider } from "@/components/modules/activos/procedencias-contexto";
import { requireSession } from "@/lib/auth/activos-session";
import { getUserPermissions } from "@/lib/rbac";
import { labels } from "@/lib/warehouse-types";

export const dynamic = "force-dynamic";

export default async function ActivosLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [catalogo, permisos] = await Promise.all([
    catalogoProcedencias(),
    getUserPermissions(session.user.id),
  ]);

  const superadmin = permisos.has("*");
  const gestionar = superadmin || permisos.has("activos:update");
  const role = superadmin ? labels.superadmin : gestionar ? "Gestión de activos" : "Consulta de activos";

  return (
    <ProcedenciasProvider catalogo={catalogo} gestionar={gestionar}>
      <SidebarPanel userId={session.user.id} className="activos-workspace" content={
        <div className="dashboard-body app-main activos-body">
          <header className="dashboard-topbar app-header activos-topbar print:hidden">
            <SidebarToggle />
            <ModuleNavigation current="activos" canSwitch={superadmin} />
            <ActivosRefresh />
          </header>
          <main className="min-w-0 w-full flex-1 px-4 py-7 sm:px-6 lg:px-8 print:p-0">{children}</main>
          <footer className="border-t-4 border-accent-400 bg-brand-900 px-4 py-4 text-brand-50 sm:px-6 lg:px-8 print:hidden">
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-1 text-[10px] font-medium sm:flex-row sm:items-center sm:justify-between sm:text-xs">
              <span>Pst: <strong className="font-bold text-white">MPardesCondori</strong></span>
              <span className="font-semibold text-accent-300">Cel. 78948640 · Año 2026</span>
            </div>
          </footer>
        </div>
      }>
        <ActivosSidebar gestionar={gestionar} name={session.user.name} role={role} />
      </SidebarPanel>
    </ProcedenciasProvider>
  );
}
