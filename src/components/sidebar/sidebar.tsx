import Link from "next/link";
import { Boxes, Landmark, LayoutDashboard, Scale } from "lucide-react";
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
    <aside className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto bg-ink-900 p-3 text-slate-300 md:h-screen md:w-64 md:flex-col md:p-5">
      <div className="hidden px-2 pb-6 text-lg font-bold text-white md:block">Almacenes AGBC</div>
      {visible.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} id={`nav-${label.toLowerCase()}`}
          className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm hover:bg-ink-700 hover:text-white">
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </aside>
  );
}
