import { getUserPermissions } from "@/lib/rbac";
import { TopNavigation } from "./top-navigation";
const items = [
 { href: "/dashboard", label: "Inicio", icon: "inicio", perm: null },
 { href: "/activos", label: "Activos", icon: "activos", perm: "activos:read" },
 { href: "/almacenes", label: "Almacenes", icon: "almacenes", perm: "almacenes:read" },
 { href: "/conciliaciones", label: "Conciliaciones", icon: "conciliaciones", perm: "conciliaciones:read" },
] as const;
/** Navegación superior con permisos verificados en el servidor. */
export async function Sidebar({ userId }: { userId: string }) {
 const perms = await getUserPermissions(userId);
 const visible = items.filter(i => !i.perm || perms.has("*") || perms.has(i.perm));
 return <TopNavigation items={visible.map(({href,label,icon})=>({href,label,icon}))}/>;
}
