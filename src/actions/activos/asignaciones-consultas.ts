import "server-only";
import { and, asc, desc, eq, ilike, isNull, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actActivos, actAsignaciones, actCustodiaActual, actDocumentosArchivo, actResponsables } from "@/db/schema/activos.schema";
import { actListadoActas } from "./archivo-listado";
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
  const papelera=permisos.puedeGestionar&&value("papelera")==="1";
  const hoy = hoyBolivia(); const condiciones: (SQL|undefined)[] = [papelera?isNotNull(actAsignaciones.eliminadoEn):isNull(actAsignaciones.eliminadoEn)];
  if (q) { const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`; condiciones.push(or(ilike(actActivos.codigo, pattern), ilike(actActivos.descripcion, pattern), ilike(actAsignaciones.responsableDestino, pattern))); }
  if (tipo === "fija" || tipo === "momentanea") condiciones.push(eq(actAsignaciones.tipo, tipo));
  if (["activa", "devuelta", "reemplazada"].includes(estado)) condiciones.push(sql`${actAsignaciones.estado} = ${estado}`);
  if (estado === "vencida") condiciones.push(and(eq(actAsignaciones.estado, "activa"), eq(actAsignaciones.tipo, "momentanea"), sql`${actAsignaciones.fechaDevolucionPrevista} < ${hoy}`));
  const where = and(...condiciones);
  const gestionArchivo=Number(hoy.slice(0,4));
  const anioNumeroArchivo=sql<number|null>`substring(${actListadoActas.numero} from '[/ -](20[0-9]{2})$')::int`;
  const anioFechaArchivo=sql<number|null>`extract(year from ${actListadoActas.fecha})::int`;
  const archivoWhere=and(eq(actListadoActas.fuente,"excel"),isNull(actListadoActas.eliminadoEn),sql`coalesce(${anioNumeroArchivo},${anioFechaArchivo})=${gestionArchivo}`);
  const [conteo, resumen, [conteoArchivo], actasArchivo] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(actAsignaciones).innerJoin(actActivos, eq(actActivos.id, actAsignaciones.activoId)).where(where),
    db.select({ fijas: sql<number>`count(*) filter (where ${actAsignaciones.estado} = 'activa' AND ${actAsignaciones.tipo} = 'fija')::int`,
      momentaneas: sql<number>`count(*) filter (where ${actAsignaciones.estado} = 'activa' AND ${actAsignaciones.tipo} = 'momentanea')::int`,
      vencidas: sql<number>`count(*) filter (where ${actAsignaciones.estado} = 'activa' AND ${actAsignaciones.tipo} = 'momentanea' AND ${actAsignaciones.fechaDevolucionPrevista} < ${hoy})::int`,
    }).from(actAsignaciones),
    db.select({n:sql<number>`count(*)::int`,asignaciones:sql<number>`count(*) filter(where ${actListadoActas.tipo} in ('asignacion','actualizacion'))::int`,devoluciones:sql<number>`count(*) filter(where ${actListadoActas.tipo}='devolucion')::int`}).from(actListadoActas).where(archivoWhere),
    db.select({id:actListadoActas.id,numero:actListadoActas.numero,tipo:actListadoActas.tipo,procedencia:actListadoActas.procedencia,fecha:actListadoActas.fecha,responsable:sql<string>`coalesce(${actResponsables.nombre},${actListadoActas.responsableOriginal})`,bienes:sql<number>`jsonb_array_length(${actListadoActas.documento}->'bienes')`,devolucionReferencia:actListadoActas.devolucionReferencia}).from(actListadoActas).leftJoin(actResponsables,eq(actResponsables.id,actListadoActas.responsableId)).where(archivoWhere).orderBy(desc(actListadoActas.fecha),desc(actListadoActas.numero)).limit(12),
  ]);
  const total = conteo[0]?.n ?? 0, paginas = Math.max(1, Math.ceil(total / 25));
  const requested = Number(value("pagina")); const pagina = Math.min(paginas, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  const registros = await db.select({ asignacion: actAsignaciones, codigo: actActivos.codigo, descripcion: actActivos.descripcion, origen: actActivos.origen })
    .from(actAsignaciones).innerJoin(actActivos, eq(actActivos.id, actAsignaciones.activoId)).where(where)
    .orderBy(desc(actAsignaciones.creadoEn), desc(actAsignaciones.id)).limit(25).offset((pagina - 1) * 25);
  return { ...permisos, registros, total, pagina, paginas, hoy, papelera, actasArchivo, totalActasArchivo:conteoArchivo?.n??0, asignacionesArchivo:conteoArchivo?.asignaciones??0, devolucionesArchivo:conteoArchivo?.devoluciones??0, gestionArchivo, filtros: { q, tipo, estado, papelera:papelera?"1":"" }, resumen: resumen[0] ?? { fijas: 0, momentaneas: 0, vencidas: 0 } };
}
