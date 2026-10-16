import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actActivos, actAsignaciones, actCustodiaActual } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { hoyBolivia } from "./asignaciones-modelo";
import type { ParametrosActivos } from "./consultas";

async function acceso() {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read"))) redirect("/dashboard");
  return { puedeGestionar: await hasPermission(session.user.id, "activos:update") };
}

export async function consultarAsignacionesActivo(activoId: string) {
  const permisos = await acceso();
  const [historial, custodia, responsables, ubicaciones] = await Promise.all([
    db.select().from(actAsignaciones).where(eq(actAsignaciones.activoId, activoId)).orderBy(desc(actAsignaciones.creadoEn), desc(actAsignaciones.id)),
    db.select().from(actCustodiaActual).where(eq(actCustodiaActual.id, activoId)).limit(1),
    db.selectDistinct({ valor: actCustodiaActual.responsable }).from(actCustodiaActual).orderBy(asc(actCustodiaActual.responsable)),
    db.selectDistinct({ valor: actCustodiaActual.ubicacion }).from(actCustodiaActual).orderBy(asc(actCustodiaActual.ubicacion)),
  ]);
  return { ...permisos, historial, custodia: custodia[0], hoy: hoyBolivia(),
    responsables: responsables.flatMap(r => r.valor ? [r.valor] : []), ubicaciones: ubicaciones.flatMap(r => r.valor ? [r.valor] : []) };
}

export async function consultarListaAsignaciones(params: ParametrosActivos) {
  const permisos = await acceso();
  const value = (key: string) => { const raw = params[key]; return (Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim().slice(0, 200); };
  const q = value("q"), tipo = value("tipo"), estado = value("estado");
  const hoy = hoyBolivia(); const condiciones = [];
  if (q) { const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`; condiciones.push(or(ilike(actActivos.codigo, pattern), ilike(actActivos.descripcion, pattern), ilike(actAsignaciones.responsableDestino, pattern))); }
  if (tipo === "fija" || tipo === "momentanea") condiciones.push(eq(actAsignaciones.tipo, tipo));
  if (["activa", "devuelta", "reemplazada"].includes(estado)) condiciones.push(sql`${actAsignaciones.estado} = ${estado}`);
  if (estado === "vencida") condiciones.push(and(eq(actAsignaciones.estado, "activa"), eq(actAsignaciones.tipo, "momentanea"), sql`${actAsignaciones.fechaDevolucionPrevista} < ${hoy}`));
  const where = and(...condiciones);
  const [conteo, resumen] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(actAsignaciones).innerJoin(actActivos, eq(actActivos.id, actAsignaciones.activoId)).where(where),
    db.select({ fijas: sql<number>`count(*) filter (where ${actAsignaciones.estado} = 'activa' AND ${actAsignaciones.tipo} = 'fija')::int`,
      momentaneas: sql<number>`count(*) filter (where ${actAsignaciones.estado} = 'activa' AND ${actAsignaciones.tipo} = 'momentanea')::int`,
      vencidas: sql<number>`count(*) filter (where ${actAsignaciones.estado} = 'activa' AND ${actAsignaciones.tipo} = 'momentanea' AND ${actAsignaciones.fechaDevolucionPrevista} < ${hoy})::int`,
    }).from(actAsignaciones),
  ]);
  const total = conteo[0]?.n ?? 0, paginas = Math.max(1, Math.ceil(total / 25));
  const requested = Number(value("pagina")); const pagina = Math.min(paginas, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  const registros = await db.select({ asignacion: actAsignaciones, codigo: actActivos.codigo, descripcion: actActivos.descripcion, origen: actActivos.origen })
    .from(actAsignaciones).innerJoin(actActivos, eq(actActivos.id, actAsignaciones.activoId)).where(where)
    .orderBy(desc(actAsignaciones.creadoEn), desc(actAsignaciones.id)).limit(25).offset((pagina - 1) * 25);
  return { ...permisos, registros, total, pagina, paginas, hoy, filtros: { q, tipo, estado }, resumen: resumen[0] ?? { fijas: 0, momentaneas: 0, vencidas: 0 } };
}
