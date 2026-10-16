import Link from "next/link";
import { Boxes, ChevronDown, ClipboardList, Landmark, LayoutDashboard, Scale } from "lucide-react";
import { getUserPermissions } from "@/lib/rbac";

const items = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, perm: null },
  { href: "/activos", label: "Activos", icon: Landmark, perm: "activos:read" },
  { href: "/almacenes", label: "Almacenes", icon: Boxes, perm: "almacenes:read" },
  { href: "/conciliaciones", label: "Conciliaciones", icon: Scale, perm: "conciliaciones:read" },
];

/** Menú lateral filtrado por permisos RBAC. */
export async function Sidebar({ userId }: { userId: string }) {
  const perms = await getUserPermissions(userId);
  const visible = items.filter((i) => !i.perm || perms.has("*") || perms.has(i.perm));
  return (
    <aside className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto bg-ink-900 p-3 text-slate-300 md:sticky md:top-0 md:h-screen md:w-48 md:self-start md:flex-col md:p-3.5 md:py-5 md:overflow-y-auto">
      <div className="hidden px-2 pb-5 text-base font-bold text-white md:block">Almacenes AGBC</div>
      {visible.map(({ href, label, icon: Icon }) => (
        <div key={href} className="shrink-0">
          {href === "/activos" ? (
            <details className="group">
              <summary id="nav-activos" className="flex cursor-pointer list-none items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm hover:bg-ink-700 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400 [&::-webkit-details-marker]:hidden">
                <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
                Activos
                <ChevronDown className="ml-auto h-4 w-4 shrink-0 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <nav aria-label="Opciones de Activos" className="ml-6 mt-1 space-y-1 border-l border-slate-600 pl-1">
                <Link href="/activos" id="nav-inventario" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-xs hover:bg-ink-700 hover:text-white">
                  <Landmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Inventario
                </Link>
                <Link href="/activos/asignaciones" id="nav-asignaciones" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-xs hover:bg-ink-700 hover:text-white">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Asignaciones
                </Link>
                <Link href="/activos/responsables" id="nav-responsables" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-xs hover:bg-ink-700 hover:text-white">Responsables</Link>
                <Link href="/activos/archivo-actas" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-xs hover:bg-ink-700 hover:text-white">Actas de Excel</Link>
              </nav>
            </details>
          ) : (
            <Link href={href} id={`nav-${label.toLowerCase()}`} className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm hover:bg-ink-700 hover:text-white">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {label}
            </Link>
          )}
        </div>
      ))}
    </aside>
  );
}
