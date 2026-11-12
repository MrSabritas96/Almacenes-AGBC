import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { db } from "@/db";
import { actActas } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { referenciaActa } from "@/actions/activos/actas-modelo";

export default async function ActasPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read"))) redirect("/dashboard");
  const manage = await hasPermission(session.user.id, "activos:update");

  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(actActas);
  const paginas = Math.max(1, Math.ceil((total?.n ?? 0) / 25));
  const raw = Number((await searchParams).pagina);
  const pagina = Math.min(paginas, Number.isSafeInteger(raw) && raw > 0 ? raw : 1);

  const rows = await db
    .select({
      id: actActas.id,
      numero: actActas.numero,
      tipo: actActas.tipo,
      cabecera: actActas.cabecera,
      fecha: actActas.fecha,
      cantidad: sql<number>`jsonb_array_length(${actActas.bienes})`,
    })
    .from(actActas)
    .orderBy(desc(actActas.creadoEn), desc(actActas.id))
    .limit(25)
    .offset((pagina - 1) * 25);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border border-ink-200 bg-white p-6 shadow-2xs">
        <Link href="/activos/asignaciones" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-2xs hover:bg-slate-50"><ArrowLeft className="h-4 w-4"/>Volver a Asignaciones</Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Actas guardadas</h1>
          <p className="mt-2 text-sm text-ink-500">
            Consulta y vuelve a imprimir los documentos emitidos.
          </p>
        </div>
        {manage && (
          <Link
            href="/activos/asignaciones/actas/nueva"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            Nueva acta
          </Link>
        )}
        </div>
      </header>
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xs">
        {!rows.length ? (
          <p className="p-10 text-center text-sm text-ink-500">Todavía no hay actas guardadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <caption className="sr-only">Actas emitidas de activos</caption>
              <thead className="bg-ink-100 text-xs text-ink-500">
                <tr>
                  {["Número / tipo", "Responsable", "Fecha", "Bienes", "Documento"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-5 py-3 font-medium ${h === "Documento" ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink-900">{referenciaActa(a)}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {a.tipo === "fija"
                          ? "Asignación fija"
                          : a.tipo === "momentanea"
                          ? "Asignación momentánea"
                          : "Devolución"}
                      </p>
                    </td>
                    <td className="px-5 py-4">{a.cabecera.responsable}</td>
                    <td className="px-5 py-4">{a.fecha.split("-").reverse().join("/")}</td>
                    <td className="px-5 py-4">{a.cantidad}</td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/activos/asignaciones/actas/${a.id}`}
                        aria-label={`Ver acta ${referenciaActa(a)}`}
                        title="Ver y descargar PDF"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(total?.n ?? 0) > 0 && (
          <nav
            aria-label="Paginación de actas"
            className="flex items-center justify-between border-t border-ink-200 p-4 text-sm bg-slate-50/50"
          >
            <span>
              Página {pagina} de {paginas} · {total?.n} actas
            </span>
            <div className="flex gap-4">
              {pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}
              {pagina < paginas && <Link href={`?pagina=${pagina + 1}`}>Siguiente</Link>}
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
