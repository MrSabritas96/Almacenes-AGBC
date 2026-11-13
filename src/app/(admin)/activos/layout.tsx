import { hasPermission } from "@/lib/rbac";
import { catalogoProcedencias } from "@/actions/activos/procedencias-consultas";
import { ProcedenciasProvider } from "@/components/modules/activos/procedencias-contexto";
import { Sidebar } from "@/components/sidebar/sidebar";
import { requireSession } from "@/lib/auth/session";

export default async function ActivosLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const procedencias = await catalogoProcedencias();

  return (
    <ProcedenciasProvider catalogo={procedencias} gestionar={await hasPermission(session.user.id, "activos:update")}>
      <div className="flex min-h-screen flex-col" style={{ background: "hsl(220 25% 95%)" }}>
        <Sidebar userId={session.user.id} />
        <main className="min-w-0 w-full flex-1 px-4 py-7 sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t-4 border-accent-400 bg-brand-900 px-4 py-4 text-brand-50 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-1 text-[10px] font-medium sm:flex-row sm:items-center sm:justify-between sm:text-xs">
            <span>Pst: <strong className="font-bold text-white">MPardesCondori</strong></span>
            <span className="font-semibold text-accent-300">Cel. 78948640 · Año 2026</span>
          </div>
        </footer>
      </div>
    </ProcedenciasProvider>
  );
}
