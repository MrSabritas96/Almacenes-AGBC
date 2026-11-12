"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  ChevronDown,
  FileSpreadsheet,
  History,
  CalendarClock,
  Car,
  Landmark,
  LayoutDashboard,
  Menu,
  Scale,
  Warehouse,
  X,
} from "lucide-react";

const icons = {
  inicio: LayoutDashboard,
  activos: Landmark,
  almacenes: Boxes,
  conciliaciones: Scale,
};
type Item = { href: string; label: string; icon: keyof typeof icons };

const subActivos = [
  { href: "/activos", label: "Inventario", icon: Landmark, id: "nav-inventario", children: [
    { href: "/activos/historial-vida", label: "Historial de vida", icon: History, id: "nav-historial-vida" },
  ] },
  { href: "/activos/archivo-actas", label: "Actas", icon: FileSpreadsheet, id: "nav-archivo-actas", children: [] },
  { href: "/activos/vehiculos", label: "Vehículos", icon: Car, id: "nav-vehiculos", children: [] },
  { href: "/activos/cierre-gestion", label: "Cierre de gestión", icon: CalendarClock, id: "nav-cierre-gestion", children: [] },
];

export function TopNavigation({ items }: { items: Item[] }) {
  const pathname       = usePathname();
  const [abierto,  setAbierto]  = useState(false);
  const [movil,    setMovil]    = useState(false);
  const desplegable  = useRef<HTMLDivElement>(null);
  const botonActivos = useRef<HTMLButtonElement>(null);

  /* ── Cierres por clic fuera y tecla Escape ────────────────────────────── */
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      if (e.target instanceof Node && !desplegable.current?.contains(e.target))
        setAbierto(false);
    };
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (desplegable.current?.contains(document.activeElement))
          botonActivos.current?.focus();
        setAbierto(false);
        setMovil(false);
      }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", teclado);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", teclado);
    };
  }, []);

  const cerrar = () => { setAbierto(false); setMovil(false); };

  const activo = (href: string) =>
    href === "/activos"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  /* ── Estilo de enlace de navegación ──────────────────────────────────── */
  const navCls = (estaActivo: boolean) =>
    [
      "relative flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium",
      "transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300",
      estaActivo
        ? "bg-white/[0.12] text-white font-semibold"
        : "text-blue-100/80 hover:bg-white/[0.07] hover:text-white",
    ].join(" ");

  return (
    /* ===== HEADER CORPORATIVO ============================================= */
    <header
      className="sticky top-0 z-40 shrink-0"
      style={{
        background: "linear-gradient(135deg, #0c1d3d 0%, #112450 45%, #163060 100%)",
        borderBottom: "3px solid #f5b700",
        boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
      }}
    >
      {/* Brillo superior sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)" }}
      />
      {/* Halo dorado esquina derecha */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(245,183,0,0.12) 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto flex min-h-[4rem] w-full flex-wrap items-center justify-between gap-x-6 px-4 sm:px-6 lg:px-8">

        {/* ── LOGO (esquina izquierda) ─────────────────────────────────── */}
        <Link
          href="/dashboard"
          className="flex min-h-16 items-center gap-3"
          style={{ textDecoration: "none" }}
          aria-label="Inicio – Almacenes AGBC"
        >
          {/* Ícono dorado */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, #f5c200 0%, #d4960a 100%)",
              boxShadow: "0 2px 10px rgba(245,183,0,0.4), 0 1px 3px rgba(0,0,0,0.35)",
              color: "#0c1d3d",
            }}
          >
            <Warehouse className="h-5 w-5" aria-hidden="true" />
          </div>

          {/* Textos */}
          <div className="flex select-none flex-col leading-none">
            <span
              className="text-[1.0625rem] font-extrabold tracking-tight text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              Almacenes AGBC
            </span>
            <span
              className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.13em]"
              style={{ color: "#f5c870" }}
            >
              Sistema de gestión
            </span>
          </div>

          {/* Separador vertical */}
          <div
            aria-hidden="true"
            className="ml-1 hidden h-8 w-px sm:block"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(255,255,255,0.22), transparent)",
            }}
          />
        </Link>

        {/* ── Botón menú móvil ─────────────────────────────────────────── */}
        <button
          type="button"
          className="rounded-lg p-2 text-blue-200 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-yellow-300 md:hidden"
          aria-label={movil ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={movil}
          aria-controls="navegacion-principal"
          onClick={() => setMovil(!movil)}
        >
          {movil ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* ── NAVEGACIÓN PRINCIPAL ─────────────────────────────────────── */}
        <nav
          id="navegacion-principal"
          aria-label="Navegación principal"
          className={[
            movil ? "flex" : "hidden",
            "w-full flex-col gap-1 border-t py-3",
            "md:flex md:w-auto md:flex-row md:items-center md:border-0 md:py-0",
          ].join(" ")}
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          {items.map(({ href, label, icon }) => {
            const Icon = icons[icon];

            /* ── Enlace simple (no Activos) ──────────────────────────── */
            if (href !== "/activos")
              return (
                <Link
                  key={href}
                  href={href}
                  id={`nav-${label.toLowerCase()}`}
                  className={navCls(activo(href))}
                  aria-current={activo(href) ? "page" : undefined}
                  onClick={cerrar}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                  {/* Subrayado dorado activo */}
                  {activo(href) && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-[5px] h-[2px] rounded-full"
                      style={{ background: "#f5b700" }}
                    />
                  )}
                </Link>
              );

            /* ── Desplegable Activos ──────────────────────────────────── */
            return (
              <div key={href} ref={desplegable} className="relative">
                <button
                  ref={botonActivos}
                  type="button"
                  id="nav-activos"
                  aria-expanded={abierto}
                  aria-controls="opciones-activos"
                  className={`${navCls(pathname.startsWith("/activos"))} w-full justify-between gap-2`}
                  onClick={() => setAbierto(!abierto)}
                >
                  <span className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Activos
                  </span>
                  <ChevronDown
                    className="h-4 w-4 transition-transform duration-200"
                    style={{ transform: abierto ? "rotate(180deg)" : "none" }}
                    aria-hidden="true"
                  />
                  {pathname.startsWith("/activos") && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-[5px] h-[2px] rounded-full"
                      style={{ background: "#f5b700" }}
                    />
                  )}
                </button>

                {/* ── Menú desplegable ─────────────────────────────────── */}
                {abierto && (
                  <nav
                    id="opciones-activos"
                    aria-label="Opciones de Activos"
                    className="mt-2 space-y-0.5 rounded-xl p-1.5 md:absolute md:right-0 md:top-full md:min-w-[14rem]"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Cabecera del menú */}
                    <div
                      className="mb-1 px-3 py-2"
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "#1d4ed8" }}
                      >
                        Gestión de Activos
                      </p>
                    </div>

                    {subActivos.map(({ href: dest, label: nom, icon: SubIcon, id, children }) => (
                      <div key={dest}>
                      <Link
                        href={dest}
                        id={id}
                        aria-current={activo(dest) ? "page" : undefined}
                        onClick={cerrar}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-blue-500"
                        style={
                          activo(dest)
                            ? {
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                fontWeight: 600,
                              }
                            : {
                                color: "#475569",
                              }
                        }
                        onMouseEnter={(e) => {
                          if (!activo(dest)) {
                            (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                            (e.currentTarget as HTMLElement).style.color = "#1e293b";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!activo(dest)) {
                            (e.currentTarget as HTMLElement).style.background = "";
                            (e.currentTarget as HTMLElement).style.color = "#475569";
                          }
                        }}
                      >
                        {/* Ícono con fondo */}
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={
                            activo(dest)
                              ? { background: "#1d4ed8", color: "#ffffff" }
                              : { background: "#f1f5f9", color: "#64748b" }
                          }
                        >
                          <SubIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <span>{nom}</span>
                        {/* Punto dorado en item activo */}
                        {activo(dest) && (
                          <span
                            aria-hidden="true"
                            className="ml-auto h-1.5 w-1.5 rounded-full"
                            style={{ background: "#f5b700" }}
                          />
                        )}
                      </Link>
                      {children?.map(({ href: childHref, label: childLabel, icon: ChildIcon, id: childId }) => (
                        <Link
                          key={childHref}
                          href={childHref}
                          id={childId}
                          aria-current={activo(childHref) ? "page" : undefined}
                          onClick={cerrar}
                          className="ml-5 flex items-center gap-3 rounded-lg border-l-2 py-2 pl-4 pr-3 text-[13px] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-blue-500"
                          style={activo(childHref) ? { borderColor: "#f5b700", background: "#eff6ff", color: "#1d4ed8", fontWeight: 600 } : { borderColor: "#e2e8f0", color: "#64748b" }}
                        >
                          <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{childLabel}</span>
                          {activo(childHref) && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: "#f5b700" }} />}
                        </Link>
                      ))}
                      </div>
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Decoración derecha ───────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="hidden items-center gap-2 lg:flex"
          style={{ color: "rgba(245,183,0,0.6)", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          <div style={{ width: "1.5rem", height: "1px", background: "rgba(245,183,0,0.4)" }} />
          AGBC
        </div>
      </div>
    </header>
  );
}
