import { EditarActivo } from "@/components/modules/activos/editar-activo";
import { NombreProcedencia } from "@/components/modules/activos/procedencias-contexto";
import Link from "next/link";
import {
  Eye,
  CircleCheck,
  ClipboardList,
  FileQuestion,
  TriangleAlert,
  PrinterIcon,
} from "lucide-react";
import {
  consultarInventario,
  leerFiltros,
  parametrosFiltros,
  TAMANO_PAGINA,
  type ParametrosActivos,
} from "@/actions/activos/consultas";
import { FiltrosInventario } from "@/components/modules/activos/filtros";
import {
  cantidad,
  EstadoActivo,
  hayIncidencias,
} from "@/components/modules/activos/presentacion";

export default async function ActivosPage({
  searchParams,
}: {
  searchParams: Promise<ParametrosActivos>;
}) {
  const filtros = leerFiltros(await searchParams);
  const data    = await consultarInventario(filtros);
  const query   = parametrosFiltros(filtros, data.pagina);

  const cards = [
    {
      label: "Registros vigentes",
      value: data.resumen.total,
      icon: ClipboardList,
      color: "text-blue-700 bg-blue-50 border-blue-200",
      dot: "bg-blue-500",
    },
    {
      label: "En buen estado",
      value: data.resumen.buenos,
      icon: CircleCheck,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      dot: "bg-emerald-500",
    },
    {
      label: "Requieren revisión",
      value: data.resumen.revision,
      icon: TriangleAlert,
      color: "text-amber-700 bg-amber-50 border-amber-200",
      dot: "bg-amber-400",
    },
    {
      label: "Sin código identificable",
      value: data.resumen.sinCodigo,
      icon: FileQuestion,
      color: "text-slate-600 bg-slate-50 border-slate-200",
      dot: "bg-slate-400",
    },
  ];

  const paginaUrl = (pagina: number) =>
    `/activos?${parametrosFiltros(filtros, pagina)}`;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 animate-fade-up">

      {/* ── Cabecera institucional ─────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-blue-100 shadow-sm"
        style={{
          background: "linear-gradient(135deg, hsl(222 82% 14%) 0%, hsl(220 78% 20%) 50%, hsl(218 74% 25%) 100%)",
          borderBottom: "3px solid hsl(44 96% 52%)",
        }}
      >
        {/* Halo decorativo dorado */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(44 96% 52% / 0.15) 0%, transparent 70%)" }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            {/* Etiqueta superior */}
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "hsl(44 96% 65%)" }}>
              Gestión de Activos
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Inventario vigente
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm" style={{ color: "hsl(214 60% 80%)" }}>
              Consulta los bienes de todas las procedencias por código,
              ubicación o responsable.
            </p>
          </div>

        </div>
      </header>

      {/* ── Tarjetas de resumen ───────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color, dot }) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-3 rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${color.split(" ").slice(2).join(" ")}`}
          >
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-800">
                {cantidad(value)}
              </p>
            </div>
            <span className={`rounded-xl border p-3 ${color}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <FiltrosInventario key={query} filtros={filtros} opciones={data.opciones} />

      {/* Aviso modo revisión */}
      {filtros.revision && (
        <aside className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Filtro de revisión activo: solo se muestran bienes con incidencias en los datos.</p>
          <Link
            href={`/activos?${parametrosFiltros({ ...filtros, revision: false }, 1)}`}
            className="font-semibold underline"
          >
            Mostrar todos los bienes de esta búsqueda
          </Link>
        </aside>
      )}

      {/* ── Tabla de activos ──────────────────────────────────────────── */}
      <section
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        aria-labelledby="lista-activos"
      >
        {/* Cabecera de la tabla */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4"
          style={{ background: "linear-gradient(to right, hsl(220 33% 98%), white, hsl(214 100% 97% / 0.4))" }}
        >
          <div className="flex items-center gap-2">
            {/* Ícono azul */}
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="lista-activos" className="text-sm font-bold text-slate-800">
                Listado de activos
              </h2>
              <p className="text-xs text-slate-500">
                {cantidad(data.total)} {data.total === 1 ? "resultado" : "resultados"}
              </p>
            </div>
          </div>

          {data.total > 0 && (
            <a
              href={`/activos/inventario-pdf${query ? `?${query}` : ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
              style={{ background: "linear-gradient(135deg, #20539A 0%, #102542 100%)" }}
            >
              <PrinterIcon className="h-4 w-4 text-accent-400" aria-hidden="true" />
              Imprimir
            </a>
          )}
        </div>

        {/* Sin resultados */}
        {data.registros.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <ClipboardList className="h-6 w-6 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-slate-800">No hay registros que coincidan</h3>
            <p className="mt-2 text-sm text-slate-500">
              Prueba otro código o cambia los filtros.
            </p>
            <Link
              href="/activos"
              className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
            >
              Ver todo el inventario
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">
                Registros del inventario vigente, con ubicación y responsable
              </caption>
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  {[
                    "Código / procedencia",
                    "Descripción",
                    "Estado",
                    "Ubicación",
                    "Responsable",
                    "Acciones",
                  ].map((label, idx, arr) => (
                    <th
                      key={label}
                      scope="col"
                      className={`px-4 py-3.5 ${idx === arr.length - 1 ? "text-right" : ""}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.registros.map((record) => (
                  <tr
                    key={record.id}
                    className="align-top transition-colors hover:bg-blue-50/30"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/activos/${record.id}${query ? `?${query}` : ""}`}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {record.codigo || "Sin código"}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{<NombreProcedencia clave={record.origen}/>}</p>
                      {hayIncidencias(record.incidencias) && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                          Revisar datos
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3.5 md:max-w-sm">
                      <p
                        className="line-clamp-3 leading-relaxed text-slate-700"
                        title={record.descripcion}
                      >
                        {record.descripcion}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <EstadoActivo estado={record.estado} />
                    </td>
                    <td className="max-w-44 px-4 py-3.5 text-slate-500">
                      {record.ubicacion || "Sin ubicación"}
                    </td>
                    <td className="max-w-44 px-4 py-3.5">
                      <p className="text-slate-700">{record.responsable || "Sin responsable"}</p>
                      {record.asignacionTipo && <p className="mt-0.5 text-[11px] text-slate-400">
                        {record.asignacionTipo === "momentanea" ? "Asignación momentánea" : "Asignación fija"}
                      </p>}
                    </td>
                    <td className="px-4 py-3.5 text-right"><div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/activos/${record.id}${query ? `?${query}` : ""}`}
                        aria-label={`Ver ficha de ${record.codigo || record.descripcion}`}
                        title="Ver ficha del activo"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <EditarActivo id={record.id} codigo={record.codigo}/></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {data.total > 0 && (
          <nav
            aria-label="Paginación del inventario"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5"
          >
            <p className="text-xs text-slate-500">
              {cantidad((data.pagina - 1) * TAMANO_PAGINA + 1)}–
              {cantidad(Math.min(data.pagina * TAMANO_PAGINA, data.total))} de{" "}
              {cantidad(data.total)} registros
            </p>
            <div className="flex items-center gap-2">
              {data.pagina > 1 ? (
                <Link
                  href={paginaUrl(data.pagina - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                >
                  Anterior
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-300">
                  Anterior
                </span>
              )}
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                {data.pagina} / {data.paginas}
              </span>
              {data.pagina < data.paginas ? (
                <Link
                  href={paginaUrl(data.pagina + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                >
                  Siguiente
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-300">
                  Siguiente
                </span>
              )}
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
