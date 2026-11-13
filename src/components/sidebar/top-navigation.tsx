"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Boxes,
  CalendarClock,
  Car,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  History,
  Landmark,
  LayoutDashboard,
  Menu,
  Scale,
} from "lucide-react";

const icons = {
  inicio: LayoutDashboard,
  activos: Landmark,
  almacenes: Boxes,
  conciliaciones: Scale,
};
type Item = { href: string; label: string; icon: keyof typeof icons };

const activos = [
  { href: "/activos", label: "Inventario", icon: Landmark },
  { href: "/activos/historial-vida", label: "Historial de vida", icon: History, nested: true },
  { href: "/activos/archivo-actas", label: "Actas", icon: FileSpreadsheet },
  { href: "/activos/vehiculos", label: "Vehículos", icon: Car },
  { href: "/activos/cierre-gestion", label: "Cierre de gestión", icon: CalendarClock },
];

const STORAGE_KEY = "agbc-menu-lateral-oculto";

export function TopNavigation({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(window.localStorage.getItem(STORAGE_KEY) !== "false");
  }, []);

  const changeVisibility = (next: boolean) => {
    setHidden(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
  };

  const isActive = (href: string) => href === "/activos"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (active: boolean, nested = false) => [
    "group flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-all",
    nested ? "ml-4 min-h-10 border-transparent text-[13px]" : "border-transparent",
    active
      ? "border-[#f5c400] bg-[#fff3b3] text-[#102f5e] shadow-sm"
      : "bg-[#123e79] text-white hover:border-[#f5c400]/70 hover:bg-[#0d315f]",
  ].join(" ");

  return (
    <>
      <aside
        className={`sticky top-0 z-40 flex h-screen shrink-0 flex-col overflow-hidden border-r border-[#d3a900] transition-[width,transform,opacity] duration-300 ease-in-out ${hidden ? "pointer-events-none w-0 -translate-x-full border-r-0 opacity-0" : "w-[250px] translate-x-0 opacity-100"}`}
        style={{ background: "linear-gradient(180deg, #ffd322 0%, #f4c400 68%, #e8b900 100%)" }}
        aria-label="Menú principal"
        aria-hidden={hidden}
      >
        <div className="flex h-[104px] shrink-0 items-center px-4">
          <Link href="/dashboard" className="flex w-full flex-col items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123e79]" aria-label="Inicio – Almacenes AGBC" tabIndex={hidden ? -1 : undefined}>
            <img src="/logo-correos.png" alt="Correos de Bolivia" className="h-[48px] w-[174px] rounded-lg object-contain" />
            <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#123e79]">Sistema de gestión</span>
          </Link>
        </div>

        <div className="mb-2 flex items-center justify-between border-y border-[#c9a400]/50 px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#123e79]">Navegación</span>
          <button
            type="button"
            onClick={() => changeVisibility(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#123e79]/20 bg-[#fff6cf] text-[#123e79] shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123e79]"
            aria-label="Ocultar menú lateral"
            title="Ocultar menú lateral"
            tabIndex={hidden ? -1 : undefined}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-2 pb-3" aria-label="Secciones del sistema" inert={hidden}>
          {items.map(({ href, label, icon }) => {
            const Icon = icons[icon];
            if (href === "/activos") {
              return (
                <div key={href} className="space-y-1">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#123e79]/75">Gestión de activos</p>
                  {activos.map(({ href: destination, label: name, icon: SubIcon, nested }) => {
                    const active = isActive(destination);
                    return (
                      <Link
                        key={destination}
                        href={destination}
                        className={linkClass(active, Boolean(nested))}
                        aria-current={active ? "page" : undefined}
                        tabIndex={hidden ? -1 : undefined}
                      >
                        <SubIcon className={`h-4 w-4 shrink-0 ${active ? "text-[#123e79]" : "text-[#ffd322]"}`} aria-hidden="true" />
                        <span className="truncate">{name}</span>
                        {active && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#e6af00]" aria-hidden="true" />}
                      </Link>
                    );
                  })}
                </div>
              );
            }
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={linkClass(active)}
                aria-current={active ? "page" : undefined}
                tabIndex={hidden ? -1 : undefined}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#123e79]" : "text-[#ffd322]"}`} aria-hidden="true" />
                <span className="truncate">{label}</span>
                {active && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#e6af00]" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[#c9a400]/60 p-3">
          <div className="rounded-xl border border-[#123e79]/15 bg-[#ffdf55]/70 px-3 py-2 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#123e79]">Agencia Boliviana de Correos</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[#123e79]/75">Gestión institucional</p>
          </div>
        </div>
      </aside>

      {hidden && (
        <button
          type="button"
          onClick={() => changeVisibility(false)}
          className="fixed left-0 top-1/2 z-50 flex h-12 w-9 -translate-y-1/2 items-center justify-center rounded-r-xl border border-l-0 border-[#c9a400] bg-[#ffd322] text-[#123e79] shadow-md transition hover:w-11 hover:bg-[#ffe36a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123e79]"
          aria-label="Mostrar menú lateral"
          title="Mostrar menú lateral"
        >
          <span className="sr-only">Mostrar menú lateral</span>
          <Menu className="h-5 w-5" aria-hidden="true" />
          <ChevronRight className="absolute right-0.5 h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </>
  );
}
