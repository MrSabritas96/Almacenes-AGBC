import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { actActivos, actAsignaciones, actResponsables } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/activos-session";
import { hasPermission } from "@/lib/rbac";
import { actListadoActas } from "./archivo-listado";
import { hoyBolivia } from "./asignaciones-modelo";
import { consultarResumenInventario } from "./consultas";
import { gestionActiva } from "./gestion-consultas";

export async function consultarDashboardActivos() {
  const session = await requireSession();
  const hoy = hoyBolivia();
  const activas = and(eq(actAsignaciones.estado, "activa"), isNull(actAsignaciones.eliminadoEn));
  const vencidas = and(
    eq(actAsignaciones.tipo, "momentanea"),
    lt(actAsignaciones.fechaDevolucionPrevista, hoy),
  );

  const [inventario, [asignaciones], [actas], [responsables], devoluciones, recientes, gestion, puedeGestionar] =
    await Promise.all([
      consultarResumenInventario(),
      db.select({
        activas: sql<number>`count(*)::int`,
        vencidas: sql<number>`count(*) filter (where ${vencidas})::int`,
      }).from(actAsignaciones).where(activas),
      db.select({ total: sql<number>`count(*)::int` })
        .from(actListadoActas).where(isNull(actListadoActas.eliminadoEn)),
      db.select({ total: sql<number>`count(*)::int` })
        .from(actResponsables).where(isNull(actResponsables.eliminadoEn)),
      db.select({
        id: actAsignaciones.id,
        activoId: actActivos.id,
        codigo: actActivos.codigo,
        descripcion: actActivos.descripcion,
        responsable: actAsignaciones.responsableDestino,
        fecha: actAsignaciones.fechaDevolucionPrevista,
      }).from(actAsignaciones).innerJoin(actActivos, eq(actActivos.id, actAsignaciones.activoId))
        .where(and(activas, vencidas))
        .orderBy(asc(actAsignaciones.fechaDevolucionPrevista), asc(actAsignaciones.id)).limit(5),
      db.select({
        id: actListadoActas.id,
        numero: actListadoActas.numero,
        fecha: actListadoActas.fecha,
        fuente: actListadoActas.fuente,
      })
        .from(actListadoActas).where(and(isNull(actListadoActas.eliminadoEn), isNotNull(actListadoActas.fecha)))
        .orderBy(desc(actListadoActas.fecha), desc(actListadoActas.id)).limit(5),
      gestionActiva(),
      hasPermission(session.user.id, "activos:update"),
    ]);

  return {
    inventario,
    asignacionesActivas: asignaciones?.activas ?? 0,
    devolucionesVencidas: asignaciones?.vencidas ?? 0,
    totalActas: actas?.total ?? 0,
    totalResponsables: responsables?.total ?? 0,
    devoluciones, recientes, gestion, puedeGestionar,
  };
}
