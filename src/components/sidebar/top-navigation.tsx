"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Boxes, CalendarClock, Car, FileSpreadsheet, History, Landmark, LayoutDashboard } from "lucide-react";
import toast from "react-hot-toast";
import { Brand } from "@/components/almacenes/brand";
import { SidebarAccount } from "@/components/almacenes/sidebar-account";
import { authClient } from "@/lib/auth/client";
import { RefreshButton } from "./refresh-button";
import { confirmLeave } from "./use-can-leave";

const activos = [
  { href: "/activos/dashboard", label: "Mi dashboard", icon: LayoutDashboard },
  { href: "/activos", label: "Inventario", icon: Landmark },
  { href: "/activos/categorias", label: "Categorías", icon: Boxes },
  { href: "/activos/historial-vida", label: "Historial de vida", icon: History },
  { href: "/activos/archivo-actas", label: "Actas", icon: FileSpreadsheet },
  { href: "/activos/asignaciones", label: "Asignaciones", icon: FileSpreadsheet },
  { href: "/activos/responsables", label: "Responsables", icon: Landmark },
  { href: "/activos/vehiculos", label: "Vehículos", icon: Car },
  { href: "/activos/cierre-gestion", label: "Cierre de gestión", icon: CalendarClock, requiereGestion: true },
];

export function ActivosSidebar({ gestionar, name, role }: { gestionar: boolean; name: string; role: string }) {
  const pathname = usePathname();
  const [leaving, startLogout] = useTransition();
  const sections = activos.filter(item => gestionar || !item.requiereGestion);
  const current = sections.find(({ href }) => href !== "/activos" &&
    (pathname === href || pathname.startsWith(`${href}/`)))?.href ?? "/activos";

  async function logout() {
    if (leaving || !confirmLeave()) return;
    startLogout(async () => {
      try {
        const result = await authClient.signOut();
        if (result.error) throw new Error();
        window.location.replace("/login");
      } catch {
        toast.error("No se pudo cerrar la sesión. Intenta nuevamente.");
      }
    });
  }

  return (
    <>
      <Brand href="/activos/dashboard" />
      <div className="workspace-label">GESTIÓN DE ACTIVOS</div>
      <nav className="sidebar-menu" aria-label="Menú principal">
        {sections.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-label={label} title={label}
            className={current === href ? "nav-link active" : "nav-link"}
            aria-current={current === href ? "page" : undefined}>
            <Icon size={19} aria-hidden="true" />
            <span className="nav-label">{label}</span>
          </Link>
        ))}
      </nav>
      <SidebarAccount name={name} role={role} leaving={leaving} onLogout={logout} />
    </>
  );
}

export function ActivosRefresh() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  return (
    <div className="navbar-actions">
      <RefreshButton refreshing={refreshing} onRefresh={() => startRefresh(() => router.refresh())} />
      <span className="sr-only" role="status">{refreshing ? "Actualizando datos…" : ""}</span>
    </div>
  );
}
