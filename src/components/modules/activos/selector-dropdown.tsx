"use client";

import { useState, useRef, useEffect, useId } from "react";
import {
  ChevronDown,
  Check,
  Search,
  X,
  MapPin,
  Globe2,
  LucideIcon,
} from "lucide-react";

export type OpcionDropdown = {
  valor: string;
  label: string;
  count?: number;
  detalle?: string;
};

type Props = {
  name: string;
  defaultValue?: string;
  opciones: OpcionDropdown[];
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: LucideIcon;
  className?: string;
  id?: string;
  mostrarContadorBadge?: boolean;
  onChange?: (valor: string) => void;
};

export function SelectorDropdown({
  name,
  defaultValue = "",
  opciones,
  placeholder = "Seleccionar opción",
  searchPlaceholder = "Buscar...",
  icon: IconComponent = MapPin,
  className = "",
  id,
  mostrarContadorBadge = true,
  onChange,
}: Props) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const [seleccionado, setSeleccionado] = useState(defaultValue);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  // Sincronizar si cambia defaultValue exteriormente
  useEffect(() => {
    setSeleccionado(defaultValue);
  }, [defaultValue]);

  // Manejar clic fuera para cerrar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setAbierto(false);
        setBusqueda("");
      }
    }

    if (abierto) {
      document.addEventListener("mousedown", handleClickOutside);
      // Enfocar automáticamente el input de búsqueda al abrir
      setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [abierto]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && abierto) {
        setAbierto(false);
        setBusqueda("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [abierto]);

  const opcionActual = opciones.find((o) => o.valor === seleccionado);

  // Opciones filtradas por búsqueda interna
  const opcionesFiltradas = opciones.filter((o) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    return (
      o.label.toLowerCase().includes(q) ||
      (o.detalle && o.detalle.toLowerCase().includes(q))
    );
  });

  const handleSeleccionar = (val: string) => {
    setSeleccionado(val);
    setAbierto(false);
    setBusqueda("");
    onChange?.(val);
  };

  return (
    <div ref={dropdownRef} className={`relative mt-1.5 ${className}`}>
      {/* Input oculto para que el <form> capture el valor en GET/POST */}
      <input type="hidden" name={name} value={seleccionado} />

      {/* Botón Gatillo (Trigger) con diseño profesional */}
      <button
        id={selectId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((prev) => !prev)}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-sm text-left shadow-2xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/25 ${
          abierto
            ? "border-brand-500 ring-2 ring-brand-500/20"
            : "border-ink-200 hover:border-brand-300 hover:bg-slate-50/50"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors ${
              seleccionado
                ? "bg-brand-50 text-brand-600"
                : "bg-ink-100 text-ink-500 group-hover:text-brand-600"
            }`}
          >
            {seleccionado === "" ? (
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <IconComponent className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>

          <span
            className={`truncate font-medium ${
              opcionActual?.valor
                ? "text-ink-900 font-semibold"
                : "text-ink-700"
            }`}
          >
            {opcionActual ? opcionActual.label : placeholder}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mostrarContadorBadge && typeof opcionActual?.count === "number" && (
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 border border-brand-200/60 tabular-nums">
              {opcionActual.count}
            </span>
          )}

          <ChevronDown
            className={`h-4 w-4 text-ink-400 transition-transform duration-200 ${
              abierto ? "rotate-180 text-brand-600" : "group-hover:text-ink-700"
            }`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Menú Desplegable Profesional Flotante */}
      {abierto && (
        <div
          role="listbox"
          aria-labelledby={selectId}
          className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[280px] rounded-2xl border border-ink-200 bg-white p-2 shadow-xl animate-fade-in ring-1 ring-black/5"
        >
          {/* Buscador interno si hay más de 5 opciones */}
          {opciones.length > 5 && (
            <div className="relative mb-2 px-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-2.5 h-3.5 w-3.5 text-ink-400"
                aria-hidden="true"
              />
              <input
                ref={inputBusquedaRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-ink-200 bg-slate-50/70 py-1.5 pl-9 pr-7 text-xs text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-2 text-ink-400 hover:text-ink-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Lista de Opciones */}
          <div className="max-h-64 overflow-y-auto space-y-1 p-0.5 scrollbar-thin">
            {opcionesFiltradas.length === 0 ? (
              <div className="py-4 text-center text-xs text-ink-400 italic">
                No hay coincidencias para &ldquo;{busqueda}&rdquo;
              </div>
            ) : (
              opcionesFiltradas.map((op) => {
                const esActiva = op.valor === seleccionado;
                return (
                  <button
                    key={op.valor || "__todas__"}
                    type="button"
                    role="option"
                    aria-selected={esActiva}
                    onClick={() => handleSeleccionar(op.valor)}
                    className={`group/item flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition-colors text-left ${
                      esActiva
                        ? "bg-brand-50 text-brand-900 font-bold border border-brand-200/70 shadow-2xs"
                        : "text-ink-800 hover:bg-slate-100/80 hover:text-ink-900"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                          esActiva
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-ink-400 group-hover/item:text-brand-600"
                        }`}
                      >
                        {op.valor === "" ? (
                          <Globe2 className="h-3 w-3" />
                        ) : (
                          <IconComponent className="h-3 w-3" />
                        )}
                      </span>
                      <span className="truncate">{op.label}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {mostrarContadorBadge && typeof op.count === "number" && (
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                            esActiva
                              ? "bg-brand-200/60 text-brand-900 font-bold"
                              : "bg-slate-100 text-slate-600 group-hover/item:bg-slate-200"
                          }`}
                        >
                          {op.count}
                        </span>
                      )}

                      {esActiva && (
                        <Check
                          className="h-3.5 w-3.5 text-brand-600 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
