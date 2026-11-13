"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CheckCircle2, Layers, Search, X } from "lucide-react";
import {
  consultarAsignacionesParaDevolucion,
  cargarDevolucionConjunta,
} from "@/actions/activos/devolucion-desde-acta";
import { useProcedencias } from "./procedencias-contexto";
import { FormularioActa } from "./formulario-acta";

type Acta = Extract<
  Awaited<ReturnType<typeof consultarAsignacionesParaDevolucion>>,
  { ok: true }
>["actas"][number];
type Preparada = Extract<
  Awaited<ReturnType<typeof cargarDevolucionConjunta>>,
  { ok: true }
>;
type ActaPreparada = { procedencia: string; solicitudId: string; resultado: Preparada };

const normal = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function DevolucionConjunta({ responsableInicial }: { responsableInicial: string }) {
  const [abierto, setAbierto] = useState(false);
  const [actas, setActas] = useState<Acta[]>([]);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargandoLista, setCargandoLista] = useState(false);
  const [responsableFiltro, setResponsableFiltro] = useState("");
  const [procedenciaFiltro, setProcedenciaFiltro] = useState("");
  const [error, setError] = useState("");
  const [cargas, setCargas] = useState<ActaPreparada[] | null>(null);
  const [completadas, setCompletadas] = useState<{ id: string; procedencia: string }[]>([]);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const { nombre } = useProcedencias();

  useEffect(() => {
    if (!abierto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = antes;
    };
  }, [abierto]);

  function abrir() {
    setError("");
    setBusqueda("");
    setResponsableFiltro(normal(responsableInicial));
    setProcedenciaFiltro("");
    setSeleccion([]);
    setActas([]);
    setCargas(null);
    setCompletadas([]);
    setAbierto(true);
    setCargandoLista(true);
    void (async () => {
      try {
        const resultado = await consultarAsignacionesParaDevolucion();
        if (resultado.ok) {
          setActas(resultado.actas);
          const delResponsable = resultado.actas.filter((acta) => normal(acta.responsable) === normal(responsableInicial) && acta.bienes > 0);
          setSeleccion(delResponsable.map((acta) => acta.id));
        }
        else setError(resultado.error);
      } catch {
        setError("No se pudo cargar la lista. Vuelve a intentarlo.");
      } finally {
        setCargandoLista(false);
      }
    })();
  }

  const responsables = useMemo(() => {
    const unicos = new Map<string, string>();
    for (const acta of actas) {
      if (acta.bienes > 0) unicos.set(normal(acta.responsable), acta.responsable);
    }
    return [...unicos.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [actas]);

  const procedencias = useMemo(() => {
    const unicas = new Map<string, string>();
    for (const acta of actas) {
      if (acta.bienes > 0 && (!responsableFiltro || normal(acta.responsable) === responsableFiltro)) {
        unicas.set(acta.procedencia, nombre(acta.procedencia));
      }
    }
    return [...unicas.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [actas, nombre, responsableFiltro]);

  const candidatasGrupo = actas.filter(
    (acta) =>
      acta.bienes > 0 &&
      responsableFiltro !== "" &&
      normal(acta.responsable) === responsableFiltro &&
      (!procedenciaFiltro || acta.procedencia === procedenciaFiltro)
  );
  // El acta y su correlativo pertenecen a una procedencia; al elegir "Todas"
  // se preparará un documento independiente por cada procedencia.
  const procedenciasDelGrupo = new Set(candidatasGrupo.map((acta) => acta.procedencia));
  const grupo = candidatasGrupo;
  const visibles = actas.filter((acta) => {
    const coincideResponsable = !responsableFiltro || normal(acta.responsable) === responsableFiltro;
    const coincideProcedencia = !procedenciaFiltro || acta.procedencia === procedenciaFiltro;
    const coincideBusqueda = normal(`${acta.numero} ${acta.responsable} ${nombre(acta.procedencia)}`).includes(normal(busqueda));
    return acta.bienes > 0 && coincideResponsable && coincideProcedencia && coincideBusqueda;
  });
  const elegidas = actas.filter((acta) => seleccion.includes(acta.id));
  const seleccionadasEnProcedencia = (clave: string) => elegidas.filter((acta) => acta.procedencia === clave).length;
  const seleccionTodas = grupo.length > 0 && grupo.every((acta) => seleccion.includes(acta.id));
  const seleccionParcial = grupo.some((acta) => seleccion.includes(acta.id)) && !seleccionTodas;
  function cambiarResponsable(valor: string) {
    setError("");
    setResponsableFiltro(valor);
    setProcedenciaFiltro("");
    const delResponsable = actas.filter((acta) => normal(acta.responsable) === valor && acta.bienes > 0);
    setSeleccion(delResponsable.map((acta) => acta.id));
  }

  function cambiarProcedencia(valor: string) {
    setError("");
    setProcedenciaFiltro(valor);
    const compatibles = actas.filter((acta) => acta.bienes > 0 && normal(acta.responsable) === responsableFiltro && (!valor || acta.procedencia === valor));
    setSeleccion(compatibles.map((acta) => acta.id));
  }

  function seleccionarTodas(marcar: boolean) {
    setError("");
    if (!marcar) {
      const ids = new Set(grupo.map((acta) => acta.id));
      setSeleccion((prev) => prev.filter((id) => !ids.has(id)));
      return;
    }
    const ids = [...new Set([...seleccion, ...grupo.map((acta) => acta.id)])];
    const porProcedencia = new Map<string, number>();
    for (const acta of grupo) porProcedencia.set(acta.procedencia, (porProcedencia.get(acta.procedencia) || 0) + 1);
    const excedida = [...porProcedencia.entries()].find(([, cantidad]) => cantidad > 20);
    if (excedida) {
      setError(`${nombre(excedida[0])} tiene ${excedida[1]} actas. El máximo es 20 por procedencia y devolución.`);
      return;
    }
    setSeleccion(ids);
  }

  function cambiarActa(acta: Acta, marcar: boolean) {
    setError("");
    const responsable = normal(acta.responsable);
    if (!responsableFiltro) {
      setResponsableFiltro(responsable);
      setProcedenciaFiltro(acta.procedencia);
      setSeleccion(marcar ? [acta.id] : []);
      return;
    }
    if (!procedenciaFiltro) {
      setProcedenciaFiltro(acta.procedencia);
      setSeleccion(marcar ? [acta.id] : []);
      return;
    }
    setSeleccion((prev) => marcar ? [...new Set([...prev, acta.id])] : prev.filter((id) => id !== acta.id));
  }

  function preparar() {
    start(async () => {
      setError("");
      try {
        const grupos = new Map<string, Acta[]>();
        for (const acta of elegidas) grupos.set(acta.procedencia, [...(grupos.get(acta.procedencia) || []), acta]);
        const preparados: ActaPreparada[] = [];
        for (const [procedencia, actasGrupo] of grupos) {
          const resultado = await cargarDevolucionConjunta(actasGrupo.map((acta) => ({ id: acta.id, fuente: acta.fuente })));
          if (!resultado.ok) {
            setError(`${nombre(procedencia)}: ${resultado.error}`);
            return;
          }
          preparados.push({ procedencia, solicitudId: crypto.randomUUID(), resultado });
        }
        setCompletadas([]);
        setCargas(preparados);
      } catch {
        setError("No se pudo preparar la devolución. Intenta nuevamente.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-xl border border-amber-600 bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-amber-400"
      >
        <Layers className="h-4 w-4" aria-hidden="true" />
        Devolución conjunta
      </button>
      {abierto && createPortal(
        <dialog
          ref={dialog}
          onClose={() => setAbierto(false)}
          aria-labelledby="titulo-devolucion-conjunta"
          className="fixed inset-0 m-auto max-h-[94dvh] w-[min(1200px,96vw)] max-w-none overflow-y-auto rounded-2xl border border-blue-100 bg-slate-50 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55"
        >
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b-4 border-amber-400 bg-blue-950 px-5 py-4 text-white">
            <div>
              <h2 id="titulo-devolucion-conjunta" className="text-xl font-bold">Devolución conjunta</h2>
              <p className="mt-1 text-xs text-blue-100">
                {cargas
                  ? `${cargas.length} actas por procedencia · ${cargas.reduce((suma, item) => suma + item.resultado.borrador.bienes.length, 0)} bienes distintos · ${completadas.length}/${cargas.length} guardadas`
                  : "Selecciona un responsable y una procedencia para reunir sus asignaciones."}
              </p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Cerrar devolución conjunta" className="rounded-lg p-2 hover:bg-white/10">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-4 p-4 sm:p-6">
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
            {cargas ? (
              <>
                <button type="button" onClick={() => { setCargas(null); setCompletadas([]); setError(""); }} className="text-sm font-semibold text-blue-700">
                  ← Cambiar asignaciones seleccionadas
                </button>
                {completadas.length < cargas.length ? (() => {
                  const actual = cargas[completadas.length]!;
                  return <section key={actual.solicitudId} className="space-y-3"><h3 className="font-bold text-blue-950">Devolución de {nombre(actual.procedencia)} · acta {completadas.length + 1} de {cargas.length}</h3><FormularioActa hoy={actual.resultado.hoy} gestionActiva={actual.resultado.gestion} fechaInicial={actual.resultado.fechaInicial} fechaMinima={actual.resultado.fechaMinima} fechaMaxima={actual.resultado.fechaMaxima} solicitudId={actual.solicitudId} responsables={actual.resultado.responsables} inicial={actual.resultado.borrador} onSaved={cargas.length > 1 ? (id) => setCompletadas((prev) => [...prev, { id, procedencia: actual.procedencia }]) : undefined} /></section>;
                })() : <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-2 font-bold text-emerald-900"><CheckCircle2 className="h-5 w-5"/>Devoluciones guardadas</div><p className="mt-2 text-sm text-emerald-800">Se generaron las actas correspondientes a todas las procedencias seleccionadas.</p><ul className="mt-3 space-y-2">{completadas.map((item) => <li key={item.id}><Link className="font-semibold text-blue-700 underline" href={`/activos/asignaciones/actas/${item.id}`} target="_blank">Ver acta de {nombre(item.procedencia)}</Link></li>)}</ul></section>}
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                    <span>1. Responsable</span>
                    <select
                      value={responsableFiltro}
                      onChange={(evento) => cambiarResponsable(evento.target.value)}
                      disabled={cargandoLista || responsables.length === 0}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Selecciona al responsable</option>
                      {responsables.map(([id, etiqueta]) => <option key={id} value={id}>{etiqueta}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                    <span>2. Procedencia</span>
                    <select
                      value={procedenciaFiltro}
                      onChange={(evento) => cambiarProcedencia(evento.target.value)}
                      disabled={cargandoLista || !responsableFiltro || procedencias.length === 0}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="">Todas las procedencias</option>
                      {procedencias.map(([id, etiqueta]) => <option key={id} value={id}>{etiqueta}</option>)}
                    </select>
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2.5">
                  <Search className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                  <input
                    aria-label="Buscar asignaciones"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="Filtrar por número de acta o nombre"
                  />
                </label>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                  {responsableFiltro ? (
                    <>
                      <strong>{responsables.find(([id]) => id === responsableFiltro)?.[1]}</strong> · {procedenciaFiltro ? nombre(procedenciaFiltro) : "Todas las procedencias"}
                      <p className="mt-1 text-xs">{procedenciaFiltro ? "Todas las asignaciones pendientes de esta procedencia están seleccionadas automáticamente." : "Todas las asignaciones pendientes están seleccionadas automáticamente; se preparará un acta separada por procedencia para conservar cada correlativo."} Revisa los bienes antes de generar las actas.</p>
                      {grupo.length > 20 && <p className="mt-1 text-xs font-semibold text-amber-800">Este grupo tiene {grupo.length} actas y supera el máximo de 20 por documento. Selecciona hasta 20 para preparar una devolución.</p>}
                    </>
                  ) : (
                    <p>Elige responsable y procedencia. Así se incluirán todas sus asignaciones compatibles en una misma devolución.</p>
                  )}
                  <p className="mt-2 text-xs">Máximo 20 actas y 100 bienes distintos por procedencia y devolución.</p>
                </div>

                {cargandoLista && !actas.length ? (
                  <p role="status" className="p-6 text-center text-sm">Cargando asignaciones…</p>
                ) : (
                  <div className="max-h-[42dvh] overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="sticky top-0 bg-blue-100 text-xs text-blue-950">
                        <tr>
                          <th className="px-3 py-3">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                aria-label="Seleccionar todas las asignaciones del responsable y procedencia elegidos"
                                title="Seleccionar todas las asignaciones del grupo elegido"
                                checked={seleccionTodas}
                                ref={(input) => { if (input) input.indeterminate = seleccionParcial; }}
                                disabled={cargandoLista || !grupo.length}
                                onChange={(evento) => seleccionarTodas(evento.target.checked)}
                              />
                              <span>Seleccionar todas</span>
                            </label>
                          </th>
                          {(["Acta / procedencia", "Responsable", "Bienes"] as const).map((titulo) => <th key={titulo} className="px-3 py-3">{titulo}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibles.map((acta) => (
                          <tr key={acta.id} className={seleccion.includes(acta.id) ? "bg-amber-50" : "hover:bg-blue-50"}>
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar ${acta.numero} de ${acta.responsable}`}
                                checked={seleccion.includes(acta.id)}
                                disabled={cargandoLista || acta.bienes === 0 || (!seleccion.includes(acta.id) && seleccionadasEnProcedencia(acta.procedencia) >= 20)}
                                onChange={(evento) => cambiarActa(acta, evento.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-semibold">{acta.numero}</p>
                              <p className="text-xs">{nombre(acta.procedencia)} · {acta.fecha || "Sin fecha"}</p>
                            </td>
                            <td className="px-3 py-3">{acta.responsable}</td>
                            <td className="px-3 py-3">{acta.bienes}</td>
                          </tr>
                        ))}
                        {!visibles.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">{actas.length ? "No hay asignaciones que coincidan con los filtros." : "No hay asignaciones pendientes de devolución para la gestión actual."}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}

                <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                  <div className="text-sm">
                    <strong>{seleccion.length} actas seleccionadas · {elegidas.reduce((total, acta) => total + acta.bienes, 0)} bienes</strong>
                    <button type="button" disabled={pending || !seleccion.length} onClick={() => setSeleccion([])} className="ml-3 text-xs font-semibold text-blue-700 disabled:text-slate-400">Quitar selección</button>
                  </div>
                  <button type="button" disabled={pending || seleccion.length === 0} onClick={preparar} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                    {pending ? "Preparando…" : "Preparar devolución"}
                  </button>
                </footer>
              </>
            )}
          </div>
        </dialog>,
        document.body
      )}
    </>
  );
}
