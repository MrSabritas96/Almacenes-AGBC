import Link from "next/link";
import { asc, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft, Users, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { actResponsables } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { CatalogoResponsables } from "@/components/modules/activos/catalogo-responsables";

export default async function ResponsablesPage() {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read"))) redirect("/dashboard");
  const gestionar = await hasPermission(session.user.id, "activos:update");

  const rows = await db
    .select({
      id: actResponsables.id,
      nombre: actResponsables.nombre,
      cargo: actResponsables.cargo,
      oficina: actResponsables.oficina,
      telefono: actResponsables.telefono,
      correo: actResponsables.correo,
    })
    .from(actResponsables)
    .where(isNull(actResponsables.eliminadoEn))
    .orderBy(asc(actResponsables.nombre));

  const referencias = await db.execute(
    sql`select r.id,r.nombre,r.oficina,coalesce(array_agg(distinct upper(trim(regexp_replace(replace(c.ubicacion,chr(160),' '),'[[:space:]]+',' ','g')))) filter(where nullif(trim(c.ubicacion),'') is not null),'{}') ubicaciones,coalesce(array_agg(distinct a.regional) filter(where nullif(trim(a.regional),'') is not null),'{}') regionales from act_responsables r left join act_responsable_nombres n on n.responsable_id=r.id left join act_custodia_actual c on nullif(translate(upper(trim(regexp_replace(replace(c.responsable,chr(160),' '),'[[:space:]]+',' ','g'))),'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ','AAAAEEEEIIIIOOOOUUUU'),'')=n.clave left join act_activos a on a.id=c.id where r.eliminado_en is null group by r.id`
  );

  const ubicaciones = new Map(
    referencias.rows.map((row) => [
      String(row.id),
      Array.isArray(row.ubicaciones) ? row.ubicaciones.map(String).sort() : [],
    ])
  );

  const regionales = new Map(
    referencias.rows.map((row) => [
      String(row.id),
      Array.isArray(row.regionales) ? row.regionales.map(String) : [],
    ])
  );

  const registros = rows.map((row) => ({
    ...row,
    ubicaciones: ubicaciones.get(row.id) ?? [],
    regionales: regionales.get(row.id) ?? [],
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 animate-fade-up">

      {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-slate-500">Gestión de activos</span>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-blue-900">Responsables</span>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          Catálogo oficial AGBC
        </span>
      </div>

      {/* ── Header institucional azul marino con acento dorado ────────── */}
      <header
        className="relative overflow-hidden rounded-2xl shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, hsl(222 82% 13%) 0%, hsl(220 78% 19%) 50%, hsl(218 74% 24%) 100%)",
          borderBottom: "3px solid hsl(44 96% 52%)",
        }}
      >
        <div className="relative px-6 pt-6"><Link href="/activos" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Volver al inventario</Link></div>
        {/* Halo decorativo dorado */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(44 96% 52% / 0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="space-y-2">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "hsl(44 96% 65%)" }}
            >
              Catálogo Institucional AGBC · Activos y Custodia
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Responsables
              </h1>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: "hsl(44 96% 52% / 0.2)",
                  color: "hsl(44 96% 72%)",
                  border: "1px solid hsl(44 96% 52% / 0.4)",
                }}
              >
                {registros.length.toLocaleString("es-BO")} registrados
              </span>
            </div>

            <p
              className="mt-1 max-w-3xl text-sm leading-relaxed"
              style={{ color: "hsl(214 60% 80%)" }}
            >
              Administra los nombres oficiales utilizados en la búsqueda y custodia del
              inventario. La ubicación de referencia se sincroniza a partir de sus bienes.
            </p>
          </div>

          {/* Tarjeta estadística */}
          <div
            className="flex shrink-0 items-center gap-3.5 rounded-xl p-4 shadow-sm"
            style={{
              background: "hsl(0 0% 100% / 0.08)",
              border: "1px solid hsl(0 0% 100% / 0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
              style={{
                background:
                  "linear-gradient(135deg, hsl(44 96% 54%) 0%, hsl(38 92% 44%) 100%)",
                color: "hsl(222 82% 12%)",
              }}
            >
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "hsl(214 60% 75%)" }}>
                Personal en catálogo
              </p>
              <p className="text-xl font-bold tracking-tight text-white tabular-nums">
                {registros.length.toLocaleString("es-BO")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <CatalogoResponsables registros={registros} puedeGestionar={gestionar} />
    </div>
  );
}
