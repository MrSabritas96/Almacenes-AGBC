import { NombreProcedencia } from "@/components/modules/activos/procedencias-contexto";
import { BotonAtras } from "@/components/modules/activos/boton-atras";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { fichaActa } from "@/actions/activos/actas-servicio";
import { referenciaActa } from "@/actions/activos/actas-modelo";
import {
  FileText,
  Printer,
  FilePlus2,
  User,
  Briefcase,
  MapPin,
  Navigation,
  Package,
  CheckCircle2,
} from "lucide-react";

export default async function ActaGuardada({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read")))
    redirect("/dashboard");
  const { id } = await params;
  const a = await fichaActa(id);
  if (!a) notFound();

  const tipoLabel =
    a.tipo === "fija"
      ? "Asignación fija"
      : a.tipo === "momentanea"
        ? "Asignación momentánea"
        : "Acta de devolución";

  const fechaFormateada = a.cabecera.fecha.split("-").reverse().join("/");

  const camposResponsable = [
    { label: "Responsable", value: a.cabecera.responsable, icon: <User className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" /> },
    { label: "Cargo", value: a.cabecera.cargo, icon: <Briefcase className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" /> },
    { label: "Ciudad / oficina", value: `${a.cabecera.ciudad} · ${a.cabecera.oficina}`, icon: <MapPin className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" /> },
    { label: "Destino / recepción", value: a.cabecera.ubicacionDestino, icon: <Navigation className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" /> },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Cabecera del acta ── */}
      <header className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-white shadow-sm">
        {/* Banda decorativa superior azul-amarillo */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-amber-400 to-brand-600" />

        <div className="p-6 pt-7">
          <div className="mb-5"><BotonAtras /></div>
          {/* Estado badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Acta guardada · PDF listo
            </span>
          </div>

          {/* Número de acta */}
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900">
            {referenciaActa(a)}
          </h1>

          {/* Subtítulo tipo · entidad · fecha */}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
            <span className="inline-flex items-center gap-1 rounded-md border border-brand-100 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {tipoLabel}
            </span>
            <span className="text-ink-300">·</span>
            <span>{<NombreProcedencia clave={a.cabecera.entidad}/>}</span>
            <span className="text-ink-300">·</span>
            <span>{fechaFormateada}</span>
          </p>

          {/* Botones de acción */}
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/activos/asignaciones/actas/${id}/pdf?ver=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-brand-500 hover:to-brand-600 hover:shadow-md hover:shadow-brand-600/25 active:scale-[0.98]"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Ver PDF para imprimir
            </a>
            <Link
              href="/activos/asignaciones/actas/nueva"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition-all hover:bg-amber-100 hover:border-amber-400 hover:shadow-sm active:scale-[0.98]"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              Nueva acta
            </Link>
          </div>

          <p className="mt-3 text-xs text-ink-400">
            El PDF conserva los datos de esta operación. Imprime y{" "}
            <span className="font-semibold text-brand-600">completa</span> los
            espacios de firma y sello.
          </p>
        </div>
      </header>

      {/* ── Responsable y documento ── */}
      <section className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-sm">
        {/* Cabecera de sección */}
        <div className="flex items-center gap-3 border-b border-ink-100 bg-gradient-to-r from-brand-50/60 via-white to-amber-50/40 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 shadow-2xs">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-900">
              Responsable y documento
            </h2>
            <p className="text-xs text-ink-500">
              Datos del custodio y destino registrados en el acta.
            </p>
          </div>
        </div>

        {/* Grid de campos */}
        <dl className="grid gap-px bg-ink-100/50 sm:grid-cols-2">
          {camposResponsable.map(({ label, value, icon }) => (
            <div
              key={label}
              className="flex items-start gap-3 bg-white px-6 py-4 transition-colors hover:bg-brand-50/20"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50">
                {icon}
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-ink-400">{label}</dt>
                <dd className="mt-0.5 truncate text-sm font-semibold text-ink-900">
                  {value || (
                    <span className="italic text-ink-400">Sin datos</span>
                  )}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Bienes incluidos ── */}
      <section className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-sm">
        {/* Cabecera de sección */}
        <div className="flex items-center gap-3 border-b border-ink-100 bg-gradient-to-r from-amber-50/50 via-white to-brand-50/30 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 shadow-2xs">
            <Package className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink-900">
              Bienes incluidos
            </h2>
            <span className="inline-flex items-center rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 shadow-2xs">
              {a.bienes.length} {a.bienes.length === 1 ? "ítem" : "ítems"}
            </span>
          </div>
        </div>

        {/* Lista de bienes */}
        <ul className="divide-y divide-ink-100">
          {a.bienes.map((b, index) => (
            <li
              key={b.activoId ?? `manual-${index}`}
              className="group flex items-start gap-4 px-6 py-4 transition-colors hover:bg-amber-50/20"
            >
              {/* Número de ítem */}
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-[11px] font-bold text-ink-500 group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                  <span className="font-mono text-brand-700">
                    {b.codigo || "Sin código"}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-ink-200/70 bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                    {b.estado}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink-500">{b.descripcion}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer de la lista */}
        <div className="border-t border-ink-100 bg-ink-50/40 px-6 py-3">
          <p className="text-xs text-ink-400">
            Total de bienes registrados en esta acta:{" "}
            <strong className="text-ink-700">{a.bienes.length}</strong>
          </p>
        </div>
      </section>
    </div>
  );
}

