import { catalogoProcedencias } from "./procedencias-consultas";
import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actActivos, actCustodiaActual as activos, actInventarioVigente } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export type ParametrosActivos = Record<string, string | string[] | undefined>;
export type FiltrosActivos = {
  q: string; origen: string; estado: string; ubicacion: string; regional: string;
  responsable: string; revision: boolean; pagina: number;
};
export const TAMANO_PAGINA = 25;
const ESTADOS_INVENTARIO = ["BUENO", "REGULAR", "MALO"];

export function leerFiltros(params: ParametrosActivos): FiltrosActivos {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim().slice(0, 200);
  };
  const page = Number(value("pagina"));
  return { q: value("q"), origen: value("origen"), estado: ESTADOS_INVENTARIO.includes(value("estado").toUpperCase()) ? value("estado").toUpperCase() : "",
    ubicacion: value("ubicacion").replace(/\s+/g, " ").trim().toUpperCase(), responsable: value("responsable").replace(/\s+/g, " ").trim().toUpperCase().replace(/[ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ]/g, letra => "AAAAEEEEIIIIOOOOUUUU"["ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ".indexOf(letra)] ?? letra),
    regional: value("regional").replace(/\s+/g, " ").trim().toUpperCase().replace(/[ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ]/g, letra => "AAAAEEEEIIIIOOOOUUUU"["ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ".indexOf(letra)] ?? letra),
    revision: value("revision") === "1",
    pagina: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000000) : 1 };
}

export function parametrosFiltros(f: FiltrosActivos, pagina = f.pagina) {
  const params = new URLSearchParams();
  for (const key of ["q", "origen", "estado", "ubicacion", "responsable", "regional"] as const) {
    if (f[key]) params.set(key, f[key]);
  }
  if (f.revision) params.set("revision", "1");
  if (pagina > 1) params.set("pagina", String(pagina));
  return params.toString();
}

async function verificarAcceso() {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read"))) redirect("/dashboard");
}

// La misma expresión reúne variantes del Excel sin modificar sus filas originales.
const ubicacionNormalizada = sql<string | null>`nullif(upper(trim(regexp_replace(replace(${activos.ubicacion}, chr(160), ' '), '[[:space:]]+', ' ', 'g'))), '')`;
const regionalNormalizada = sql<string | null>`nullif(translate(upper(trim(regexp_replace(replace(${actActivos.regional}, chr(160), ' '), '[[:space:]]+', ' ', 'g'))), 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ', 'AAAAEEEEIIIIOOOOUUUU'), '')`;

const responsableClaveOrigen = sql<string | null>`nullif(translate(upper(trim(regexp_replace(replace(${activos.responsable}, chr(160), ' '), '[[:space:]]+', ' ', 'g'))), 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ', 'AAAAEEEEIIIIOOOOUUUU'), '')`;

// Resuelve las variantes históricas al nombre editable del catálogo.
export const responsableNormalizado = sql<string | null>`coalesce((select r.nombre from act_responsable_nombres n join act_responsables r on r.id=n.responsable_id where n.clave=${responsableClaveOrigen} and r.eliminado_en is null), ${responsableClaveOrigen})`;

const tieneIncidencias = sql`${activos.incidenciasImportacion} <> '[]'::jsonb`;

export async function consultarInventario(filtros: FiltrosActivos, completo = false) {
  await verificarAcceso();
  const conditions = [];
  if (filtros.q) {
    // Búsqueda literal: % y _ escritos por el usuario no actúan como comodines.
    const pattern = `%${filtros.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(activos.codigo, pattern), ilike(activos.codigoHistorico, pattern),
      ilike(activos.descripcion, pattern), ilike(responsableNormalizado, pattern)));
  }
  if (filtros.origen) conditions.push(eq(activos.origen, filtros.origen));
  if (filtros.regional) conditions.push(eq(regionalNormalizada, filtros.regional));
  if (filtros.responsable) conditions.push(sql`${responsableNormalizado} = coalesce((select r.nombre from act_responsable_nombres n join act_responsables r on r.id=n.responsable_id where n.clave=${filtros.responsable} and r.eliminado_en is null), ${filtros.responsable})`);
  if (filtros.ubicacion) conditions.push(eq(ubicacionNormalizada, filtros.ubicacion));
  if (filtros.estado) conditions.push(sql`upper(trim(${activos.estado})) = ${filtros.estado}`);
  if (filtros.revision) conditions.push(tieneIncidencias);
  const where = and(...conditions);
  const [summaryRows, countRows, origins, regionRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`,
      buenos: sql<number>`count(*) filter (where upper(trim(${activos.estado})) = 'BUENO')::int`,
      revision: sql<number>`count(*) filter (where ${tieneIncidencias})::int`,
      sinCodigo: sql<number>`count(*) filter (where ${activos.codigo} is null or upper(trim(${activos.codigo})) in ('SIN CODIGO', 'SIN CÓDIGO', 'S/C', 'S/N'))::int`,
    }).from(activos),
    db.select({ total: sql<number>`count(*)::int` }).from(activos).innerJoin(actActivos, eq(actActivos.id, activos.id)).where(where),
    catalogoProcedencias().then(rows=>rows.filter(p=>p.activa).map(p=>({value:p.clave}))),
    db.selectDistinct({ value: regionalNormalizada }).from(activos).innerJoin(actActivos, eq(actActivos.id, activos.id)).where(sql`nullif(trim(${actActivos.regional}), '') is not null`).orderBy(regionalNormalizada),
  ]);
  const total = countRows[0]?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const pagina = Math.min(filtros.pagina, paginas);
  const registrosQuery = db.select({ id: activos.id, codigo: activos.codigo,
    regional: regionalNormalizada,
    descripcion: activos.descripcion, origen: activos.origen, estado: activos.estado,
    ubicacion: ubicacionNormalizada, responsable: responsableNormalizado,
    incidencias: activos.incidenciasImportacion,
    asignacionTipo: activos.asignacionTipo,
  }).from(activos).innerJoin(actActivos, eq(actActivos.id, activos.id)).where(where).orderBy(asc(activos.origen), asc(activos.filaExcel), asc(activos.id));
  const registros = await (completo ? registrosQuery : registrosQuery.limit(TAMANO_PAGINA).offset((pagina - 1) * TAMANO_PAGINA));
  const values = (rows: { value: string | null }[]) => rows.flatMap(r => r.value ? [r.value] : []);
  const responsablesPorUbicacion: Record<string, string[]> = {};
  return { registros, total, paginas, pagina, responsablesPorUbicacion,
    resumen: summaryRows[0] ?? { total: 0, buenos: 0, revision: 0, sinCodigo: 0 },
    opciones: { origen: values(origins), estado: ESTADOS_INVENTARIO, regional: values(regionRows), ubicacion: [] as string[], responsable: [] as string[] },
  };
}

export async function consultarFicha(id: string) {
  await verificarAcceso();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [record] = await db.select().from(actInventarioVigente).where(eq(actInventarioVigente.id, id)).limit(1);
  return record ?? null;
}
