"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  Search,
  UserPlus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Briefcase,
  Phone,
  Mail,
  AlertTriangle,
  Users,
  Loader2,
  Info,
  CheckCircle2,
  Building,
  Filter,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import { guardarResponsable, eliminarResponsable } from "@/actions/activos/responsables";
import { SelectorDropdown } from "./selector-dropdown";

export type Registro = {
  id: string;
  nombre: string;
  cargo: string | null;
  oficina: string | null;
  telefono: string | null;
  correo: string | null;
  ubicaciones: string[];
  regionales?: string[];
};

type FormState = {
  id?: string;
  nombre: string;
  cargo: string;
  oficina: string;
  telefono: string;
  correo: string;
};

const vacio: FormState = {
  id: undefined,
  nombre: "",
  cargo: "",
  oficina: "",
  telefono: "",
  correo: "",
};

// Generador de paletas de avatar sobrias y ejecutivas
const AVATAR_PALETTES = [
  { bg: "bg-indigo-50 border-indigo-200/80 text-indigo-700" },
  { bg: "bg-blue-50 border-blue-200/80 text-blue-700" },
  { bg: "bg-teal-50 border-teal-200/80 text-teal-700" },
  { bg: "bg-emerald-50 border-emerald-200/80 text-emerald-700" },
  { bg: "bg-purple-50 border-purple-200/80 text-purple-700" },
  { bg: "bg-amber-50 border-amber-200/80 text-amber-700" },
  { bg: "bg-rose-50 border-rose-200/80 text-rose-700" },
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index] ?? AVATAR_PALETTES[0]!;
}

function getInitials(nombre: string) {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const p0 = parts[0] ?? "";
  if (parts.length <= 1) return (p0.substring(0, 2) || "R").toUpperCase();
  const pLast = parts[parts.length - 1] ?? "";
  const initial1 = p0.charAt(0);
  const initial2 = pLast.charAt(0);
  return (initial1 + initial2).toUpperCase() || "R";
}

export function CatalogoResponsables({
  registros,
  puedeGestionar,
}: {
  registros: Registro[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const contenidoFormulario=useRef<HTMLDivElement>(null);
  const confirmacionEliminar=useRef<HTMLDivElement>(null);
  const cancelarEliminar=useRef<HTMLButtonElement>(null);
  const nombreInput=useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(vacio);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [eliminar, setEliminar] = useState<Registro | null>(null);
  const [buscar, setBuscar] = useState("");
  const [filtroUbicacion, setFiltroUbicacion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();

  // Paginación
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(20);

  const pendienteRef=useRef(false);
  useEffect(()=>{pendienteRef.current=pendiente;},[pendiente]);

  // Mantener el desplazamiento dentro de la ventana y devolver el foco al cerrarla.
  useEffect(() => {
    if(!modalAbierto&&!eliminar)return;
    const focoAnterior=document.activeElement as HTMLElement|null;
    const overflowAnterior=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const frame=requestAnimationFrame(()=>{
      if(modalAbierto){
        if(contenidoFormulario.current)contenidoFormulario.current.scrollTop=0;
        nombreInput.current?.focus({preventScroll:true});
      } else if(eliminar){
        cancelarEliminar.current?.focus({preventScroll:true});
      }
    });
    const handleKeyDown=(e:KeyboardEvent)=>{
      if(e.key==="Escape"&&!pendienteRef.current){setModalAbierto(false);setEliminar(null);}
      if(e.key==="Tab"){
        const dialog=eliminar?confirmacionEliminar.current:contenidoFormulario.current?.closest('[role="dialog"]');
        const elementos=dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]');
        if(!elementos?.length)return;
        const primero=elementos[0]!,ultimo=elementos[elementos.length-1]!;
        if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo.focus({preventScroll:true});}
        else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero.focus({preventScroll:true});}
      }
    };
    window.addEventListener("keydown",handleKeyDown);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("keydown",handleKeyDown);document.body.style.overflow=overflowAnterior;focoAnterior?.focus({preventScroll:true});};
  },[modalAbierto,eliminar]);

  // Lista única de ubicaciones/regionales para filtro rápido
  const listaUbicaciones = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => {
      if (r.oficina) set.add(r.oficina.trim().toUpperCase());
      r.ubicaciones.forEach((u) => {
        if (u) set.add(u.trim().toUpperCase());
      });
      r.regionales?.forEach((reg) => {
        if (reg) set.add(reg.trim().toUpperCase());
      });
    });
    return Array.from(set).filter(Boolean).sort();
  }, [registros]);

  const ubicacionesSugeridas =
    registros.find((r) => r.id === form.id)?.ubicaciones ?? [];

  const normalizar = (txt: string) =>
    txt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const terminoBusqueda = normalizar(buscar.trim());
  const filtroUbNormalizado = normalizar(filtroUbicacion.trim());

  const lista = useMemo(() => {
    return registros.filter((r) => {
      // Filtro por texto
      if (terminoBusqueda) {
        const combinacion = normalizar(
          `${r.nombre} ${r.cargo ?? ""} ${r.oficina ?? ""} ${r.ubicaciones.join(" ")} ${r.regionales?.join(" ") ?? ""}`
        );
        if (!combinacion.includes(terminoBusqueda)) return false;
      }

      // Filtro por ubicación / regional
      if (filtroUbNormalizado) {
        const oficinasNorm = normalizar(
          `${r.oficina ?? ""} ${r.ubicaciones.join(" ")} ${r.regionales?.join(" ") ?? ""}`
        );
        if (!oficinasNorm.includes(filtroUbNormalizado)) return false;
      }

      return true;
    });
  }, [registros, terminoBusqueda, filtroUbNormalizado]);

  // Reiniciar página si cambian los filtros
  useEffect(() => {
    setPagina(1);
  }, [buscar, filtroUbicacion]);

  // Paginación calculada
  const totalPaginas = porPagina === 0 ? 1 : Math.ceil(lista.length / porPagina);
  const inicioItem = porPagina === 0 ? 0 : (pagina - 1) * porPagina;
  const finItem = porPagina === 0 ? lista.length : inicioItem + porPagina;
  const itemsPaginados = useMemo(() => {
    if (porPagina === 0) return lista;
    return lista.slice(inicioItem, finItem);
  }, [lista, inicioItem, finItem, porPagina]);

  // Rango de páginas visibles
  const paginasVisibles = useMemo(() => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    if (pagina <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPaginas];
    }
    if (pagina >= totalPaginas - 3) {
      return [1, "...", totalPaginas - 4, totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas];
    }
    return [1, "...", pagina - 1, pagina, pagina + 1, "...", totalPaginas];
  }, [pagina, totalPaginas]);

  const abrirNuevo = () => {
    setForm(vacio);
    setFormError(null);
    setModalAbierto(true);
    setEliminar(null);
  };

  const abrirEditar = (r: Registro) => {
    setForm({
      id: r.id,
      nombre: r.nombre,
      cargo: r.cargo ?? "",
      oficina: r.oficina ?? "",
      telefono: r.telefono ?? "",
      correo: r.correo ?? "",
    });
    setFormError(null);
    setModalAbierto(true);
    setEliminar(null);
  };

  const cerrarModal = () => {
    if (pendiente) return;
    setModalAbierto(false);
    setFormError(null);
  };

  const handleGuardar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    start(async () => {
      try {
        const res = await guardarResponsable(form);
        if (res.ok) {
          toast.success(
            form.id
              ? "Responsable actualizado correctamente."
              : "Nuevo responsable registrado con éxito."
          );
          setModalAbierto(false);
          router.refresh();
        } else {
          setFormError(res.error ?? "No se pudo guardar el responsable.");
          toast.error(res.error ?? "Error al guardar el responsable.");
        }
      } catch {
        const errorMsg = "Ocurrió un error inesperado al procesar la solicitud.";
        setFormError(errorMsg);
        toast.error(errorMsg);
      }
    });
  };

  const handleEliminar = () => {
    if (!eliminar) return;

    start(async () => {
      try {
        const res = await eliminarResponsable(eliminar.id);
        if (res.ok) {
          toast.success("Responsable eliminado del catálogo con éxito.");
          setEliminar(null);
          router.refresh();
        } else {
          toast.error(res.error ?? "No se pudo eliminar el responsable.");
        }
      } catch {
        toast.error("Error inesperado al intentar eliminar.");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Barra de control superior integrada: Búsqueda, Filtro y Acción Principal */}
      <div className="rounded-2xl border border-ink-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Buscador inteligente */}
            <div className="relative flex-1 max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-400">
                <Search className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="w-full rounded-xl border border-ink-200 bg-ink-50/40 py-2.5 pl-10 pr-9 text-sm text-ink-900 placeholder:text-ink-400 shadow-2xs transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar por nombre, cargo o ubicación..."
              />
              {buscar && (
                <button
                  type="button"
                  onClick={() => setBuscar("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400 hover:text-ink-700 transition-colors"
                  title="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtro por Ubicación / Regional */}
            {listaUbicaciones.length > 0 && (
              <div className="relative sm:w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <select
                  value={filtroUbicacion}
                  onChange={(e) => setFiltroUbicacion(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-ink-200 bg-ink-50/40 py-2.5 pl-9 pr-8 text-xs font-medium text-ink-800 shadow-2xs transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Todas las ubicaciones ({listaUbicaciones.length})</option>
                  {listaUbicaciones.map((ub) => (
                    <option key={ub} value={ub}>
                      {ub}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400">
                  <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                </div>
              </div>
            )}

            {/* Botón reset si hay filtros activos */}
            {(buscar || filtroUbicacion) && (
              <button
                type="button"
                onClick={() => {
                  setBuscar("");
                  setFiltroUbicacion("");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 shadow-2xs hover:bg-ink-50 hover:text-ink-900 transition-all shrink-0"
                title="Restablecer todos los filtros"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Botón principal de Nuevo Responsable con diseño profesional */}
          {puedeGestionar && (
            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:shadow-brand-600/25 active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shrink-0"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Nuevo responsable</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor principal de la tabla con estética SaaS ejecutiva */}
      <section className="overflow-hidden rounded-2xl border border-ink-200/90 bg-white shadow-sm">
        {/* Cabecera de la tabla */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-ink-50/70 via-white to-brand-50/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 border border-brand-100 text-brand-600 shadow-2xs">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink-900">
                  Listado de responsables
                </h2>
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-200/60 shadow-2xs">
                  {lista.length} {lista.length === 1 ? "registro" : "registros"}
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                Custodios asignados y autorizados para bienes del inventario.
              </p>
            </div>
          </div>

          {/* Indicador de filtro activo */}
          {(buscar || filtroUbicacion) && (
            <div className="flex items-center gap-2 text-xs text-ink-600 bg-ink-100/60 px-3 py-1 rounded-lg border border-ink-200/60">
              <span>Filtrando por:</span>
              {buscar && (
                <span className="font-semibold text-brand-700">"{buscar}"</span>
              )}
              {buscar && filtroUbicacion && <span>·</span>}
              {filtroUbicacion && (
                <span className="font-semibold text-brand-700">{filtroUbicacion}</span>
              )}
            </div>
          )}
        </div>

        {/* Tabla estructurada */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[38%] min-w-[280px]" />
              <col className="w-[20%] min-w-[160px]" />
              <col className="w-[20%] min-w-[170px]" />
              <col className="w-[22%] min-w-[240px]" />
            </colgroup>
            <thead className="border-b border-ink-100 bg-ink-50/50 text-[11px] font-bold uppercase tracking-wider text-ink-500">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  Responsable
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Cargo
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Ubicación de referencia
                </th>
                <th scope="col" className="px-5 py-3.5 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {itemsPaginados.map((r) => {
                const initials = getInitials(r.nombre);
                const avatar = getAvatarStyle(r.nombre);

                return (
                  <tr
                    key={r.id}
                    className="group transition-colors hover:bg-brand-50/25"
                  >
                    {/* Responsable: Avatar con color dinámico e Identidad */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${avatar.bg} font-bold text-xs shadow-2xs transition-transform group-hover:scale-105`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink-900 group-hover:text-brand-900 transition-colors text-sm">
                            {r.nombre}
                          </p>
                          {r.correo ? (
                            <p className="truncate text-[11px] text-ink-400 mt-0.5">
                              {r.correo}
                            </p>
                          ) : (
                            <p className="text-[11px] text-ink-400 mt-0.5 italic">
                              Sin correo registrado
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="px-5 py-3.5">
                      {r.cargo ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-ink-800 bg-ink-50/90 border border-ink-200/60 max-w-full">
                          <Briefcase className="h-3 w-3 text-ink-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{r.cargo}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-0.5 text-[11px] text-ink-400 italic border border-dashed border-ink-200">
                          Por completar
                        </span>
                      )}
                    </td>

                    {/* Ubicación de referencia */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        {r.oficina ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-ink-800 bg-ink-50/90 border border-ink-200/60 max-w-full">
                            <MapPin className="h-3 w-3 text-brand-500 shrink-0" aria-hidden="true" />
                            <span className="truncate">{r.oficina}</span>
                          </div>
                        ) : r.ubicaciones.length > 1 ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-800 bg-amber-50/80 border border-amber-200/70">
                            <Building className="h-3 w-3 text-amber-600 shrink-0" aria-hidden="true" />
                            <span>Múltiples ubicaciones</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-0.5 text-[11px] text-ink-400 italic border border-dashed border-ink-200">
                            Por completar
                          </span>
                        )}

                        {r.ubicaciones.length > 1 && (
                          <p
                            className="truncate text-[11px] text-ink-500"
                            title={r.ubicaciones.join(" · ")}
                          >
                            {r.ubicaciones.slice(0, 2).join(" · ")}
                            {r.ubicaciones.length > 2 && ` (+${r.ubicaciones.length - 2})`}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Botones de acción mejorados y profesionales */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Botón para consultar actas */}
                        <Link
                          href={`/activos/archivo-actas?responsable=${r.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                          aria-label={`Ver actas de ${r.nombre}`}
                          title="Ver actas del responsable"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        {puedeGestionar ? (
                          <>
                            {/* Botón Editar con estilo corporativo */}
                            <button
                              type="button"
                              disabled={pendiente}
                              onClick={() => abrirEditar(r)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-700 bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
                              aria-label={`Editar responsable ${r.nombre}`}
                              title="Editar datos del responsable"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>

                            {/* Botón Eliminar con estilo de peligro sutil */}
                            <button
                              type="button"
                              disabled={pendiente}
                              onClick={() => setEliminar(r)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-700 bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50"
                              aria-label={`Eliminar responsable ${r.nombre}`}
                              title="Eliminar responsable del catálogo"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-ink-400 italic">Solo lectura</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Estado vacío */}
        {lista.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 mb-3 shadow-inner">
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-ink-800">
              No se encontraron responsables
            </h3>
            <p className="mt-1 text-xs text-ink-500 max-w-sm">
              {buscar || filtroUbicacion
                ? "No existen registros que coincidan con los filtros aplicados."
                : "Aún no se han registrado responsables en el catálogo."}
            </p>
            {(buscar || filtroUbicacion) && (
              <button
                type="button"
                onClick={() => {
                  setBuscar("");
                  setFiltroUbicacion("");
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors shadow-2xs"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restablecer filtros</span>
              </button>
            )}
          </div>
        )}

        {/* Barra de Paginación Moderna y Ejecutiva */}
        {lista.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/40 px-5 py-3 text-xs text-ink-500">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Mostrando <strong className="font-semibold text-ink-800">{inicioItem + 1}</strong> a{" "}
                <strong className="font-semibold text-ink-800">
                  {Math.min(finItem, lista.length)}
                </strong>{" "}
                de <strong className="font-semibold text-ink-800">{lista.length}</strong> responsables
              </span>

              {/* Selector de cantidad por página */}
              <div className="flex items-center gap-1.5">
                <span className="text-ink-400">Mostrar:</span>
                <select
                  value={porPagina}
                  onChange={(e) => {
                    setPorPagina(Number(e.target.value));
                    setPagina(1);
                  }}
                  className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 shadow-2xs focus:border-brand-500 focus:outline-none"
                >
                  <option value={15}>15 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={30}>30 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={0}>Todos ({lista.length})</option>
                </select>
              </div>
            </div>

            {/* Controles de página */}
            {totalPaginas > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagina === 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-2xs hover:bg-ink-50 hover:border-ink-300 disabled:opacity-40 disabled:hover:bg-white transition-all"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {paginasVisibles.map((p, idx) =>
                    typeof p === "number" ? (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPagina(p)}
                        className={`h-7 min-w-7 rounded-lg text-xs font-semibold transition-all ${
                          pagina === p
                            ? "bg-brand-600 text-white shadow-2xs font-bold"
                            : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                        }`}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={idx} className="px-1 text-ink-400 font-bold">
                        …
                      </span>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={pagina === totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-2xs hover:bg-ink-50 hover:border-ink-300 disabled:opacity-40 disabled:hover:bg-white transition-all"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* SUB-VENTANA (MODAL): Nuevo / Editar Responsable */}
      {modalAbierto && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-responsable-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm animate-fade-in"
        >
          {/* Fondo interactivo para cerrar */}
          <div
            className="fixed inset-0"
            onClick={cerrarModal}
            aria-hidden="true"
          />

          <div className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-2xl">
            {/* Cabecera del modal */}
            <div className="flex shrink-0 items-center justify-between border-b border-ink-100 bg-gradient-to-r from-ink-50/80 via-white to-brand-50/40 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-sm">
                  {form.id ? (
                    <Pencil className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <UserPlus className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <h3
                    id="modal-responsable-titulo"
                    className="text-base font-bold text-ink-900"
                  >
                    {form.id ? "Editar Responsable" : "Nuevo Responsable"}
                  </h3>
                  <p className="text-xs text-ink-500">
                    {form.id
                      ? "Modifica los datos del responsable en el inventario."
                      : "Registra un nuevo custodio o responsable de bienes."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={cerrarModal}
                disabled={pendiente}
                className="rounded-xl p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Cerrar ventana"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenido del formulario */}
            <form onSubmit={handleGuardar} className="flex min-h-0 flex-1 flex-col">
              <div ref={contenidoFormulario} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">No se pudo procesar:</p>
                    <p className="mt-0.5">{formError}</p>
                  </div>
                </div>
              )}

              {/* Información Principal */}
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="resp-nombre"
                    className="block text-xs font-semibold text-ink-700 mb-1"
                  >
                    Nombre completo <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="resp-nombre"
                    ref={nombreInput}
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder="Ej. JUAN PÉREZ GÓMEZ"
                    value={form.nombre}
                    onChange={(e) =>
                      setForm({ ...form, nombre: e.target.value.toUpperCase() })
                    }
                    className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
                  />
                  <p className="mt-1 text-[11px] text-ink-400">
                    Se almacena en mayúsculas estandarizadas para búsqueda y actas institucionales.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="resp-cargo"
                      className="block text-xs font-semibold text-ink-700 mb-1"
                    >
                      Cargo o puesto
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                        <Briefcase className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <input
                        id="resp-cargo"
                        type="text"
                        maxLength={200}
                        placeholder="Ej. Jefe de Almacén"
                        value={form.cargo}
                        onChange={(e) =>
                          setForm({ ...form, cargo: e.target.value })
                        }
                        className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="resp-oficina"
                      className="block text-xs font-semibold text-ink-700 mb-1"
                    >
                      Ubicación de referencia
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <input
                        id="resp-oficina"
                        type="text"
                        maxLength={200}
                        list="ubicaciones-responsable"
                        placeholder="Ej. Regional Cochabamba"
                        value={form.oficina}
                        onChange={(e) =>
                          setForm({ ...form, oficina: e.target.value })
                        }
                        className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
                      />
                    </div>
                    <datalist id="ubicaciones-responsable">
                      {ubicacionesSugeridas.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {ubicacionesSugeridas.length > 1 && (
                  <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-3 text-xs text-brand-900">
                    <p className="font-semibold text-brand-800">
                      Ubicaciones registradas en sus bienes:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ubicacionesSugeridas.map((ubi) => (
                        <button
                          key={ubi}
                          type="button"
                          onClick={() => setForm({ ...form, oficina: ubi })}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                            form.oficina === ubi
                              ? "bg-brand-600 text-white shadow-sm"
                              : "bg-white text-ink-700 border border-ink-200 hover:border-brand-300 hover:bg-brand-50"
                          }`}
                        >
                          {ubi}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-brand-700">
                      Haz clic en una opción para fijarla como su ubicación principal.
                    </p>
                  </div>
                )}
              </div>

              {/* Datos de contacto */}
              <div className="border-t border-ink-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
                  Datos de contacto (opcional)
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="resp-telefono"
                      className="block text-xs font-semibold text-ink-700 mb-1"
                    >
                      Teléfono / Interno
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                        <Phone className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <input
                        id="resp-telefono"
                        type="tel"
                        maxLength={200}
                        placeholder="Ej. 2145000 int. 102"
                        value={form.telefono}
                        onChange={(e) =>
                          setForm({ ...form, telefono: e.target.value })
                        }
                        className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="resp-correo"
                      className="block text-xs font-semibold text-ink-700 mb-1"
                    >
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <input
                        id="resp-correo"
                        type="email"
                        maxLength={200}
                        placeholder="responsable@agbc.gob.bo"
                        value={form.correo}
                        onChange={(e) =>
                          setForm({ ...form, correo: e.target.value })
                        }
                        className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mensaje informativo */}
              <div className="flex items-start gap-2.5 rounded-xl bg-ink-50 p-3 text-[11px] text-ink-600 border border-ink-200/50">
                <Info className="h-4 w-4 shrink-0 text-brand-600 mt-0.5" />
                <span>
                  Al editar el nombre se conservan sus bienes y el historial previo.
                  Los documentos y actas emitidos preservan la identidad firmada en su fecha correspondiente.
                </span>
              </div>

              </div>
              {/* Acciones siempre visibles fuera del área desplazable */}
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-ink-100 bg-white px-5 py-3">
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={cerrarModal}
                  className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink-700 shadow-2xs hover:bg-ink-50 hover:border-ink-300 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pendiente}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:shadow-brand-600/25 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {pendiente ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{form.id ? "Guardar cambios" : "Registrar responsable"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* SUB-VENTANA (MODAL): Confirmación de Eliminación */}
      {eliminar && createPortal(
        <div
          ref={confirmacionEliminar}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm animate-fade-in"
        >
          <div
            className="fixed inset-0"
            onClick={() => !pendiente && setEliminar(null)}
            aria-hidden="true"
          />

          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl border border-ink-100 z-10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-2xs">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3
                  id="modal-eliminar-titulo"
                  className="text-base font-bold text-ink-900"
                >
                  ¿Eliminar responsable?
                </h3>
                <p className="mt-2 text-xs text-ink-600 leading-relaxed">
                  ¿Estás seguro de que deseas eliminar a{" "}
                  <strong className="text-ink-900 font-bold">{eliminar.nombre}</strong>{" "}
                  del catálogo? Se conservará el historial. Si tiene bienes a su cargo actualmente,
                  el sistema rechazará la eliminación por seguridad.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
              <button
                ref={cancelarEliminar}
                type="button"
                disabled={pendiente}
                onClick={() => setEliminar(null)}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 shadow-2xs hover:bg-ink-50 hover:border-ink-300 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={handleEliminar}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:shadow-rose-600/25 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {pendiente ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Eliminando…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirmar eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
