"use server";

import { revalidatePath } from "next/cache";
import { asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { actGestionActiva, actGestionesHistorial, actResponsables } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { consultarAsignacionesParaDevolucion } from "./devolucion-desde-acta";
import { gestionActiva } from "./gestion-consultas";

export async function consultarCierreGestion() {
  const session = await getSession();
  if (!session || !(await hasPermission(session.user.id, "activos:read"))) {
    return { ok: false as const, error: "No tienes acceso al cierre de gestión." };
  }
  const [gestion, pendientes] = await Promise.all([gestionActiva(), consultarAsignacionesParaDevolucion()]);
  if (!pendientes.ok) return pendientes;
  const [historial, catalogoResponsables] = await Promise.all([
    db.select({ gestion: actGestionesHistorial.gestion, estado: actGestionesHistorial.estado, iniciadaEn: actGestionesHistorial.iniciadaEn, cerradaEn: actGestionesHistorial.cerradaEn }).from(actGestionesHistorial).orderBy(desc(actGestionesHistorial.gestion)),
    db.select({ nombre: actResponsables.nombre, cargo: actResponsables.cargo }).from(actResponsables).where(isNull(actResponsables.eliminadoEn)).orderBy(asc(actResponsables.nombre)),
  ]);
  const grupos = new Map<string, { responsable: string; actas: number; bienes: number }>();
  for (const acta of pendientes.actas) {
    const key = acta.responsable.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const actual = grupos.get(key) ?? { responsable: acta.responsable, actas: 0, bienes: 0 };
    actual.actas += 1;
    actual.bienes += acta.bienes;
    grupos.set(key, actual);
  }
  return { ok: true as const, ...gestion, historial, catalogoResponsables, totalActas: pendientes.actas.length, totalBienes: pendientes.actas.reduce((n, a) => n + a.bienes, 0), responsables: [...grupos.values()].sort((a, b) => a.responsable.localeCompare(b.responsable, "es")) };
}

export async function cerrarGestionYHabilitarSiguiente() {
  const session = await getSession();
  if (!session || !(await hasPermission(session.user.id, "activos:update"))) {
    return { ok: false as const, error: "No tienes permiso para cerrar la gestión." };
  }
  try {
    const siguiente = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('act-gestion-activa'))`);
      const [actual] = await tx.select({ gestion: actGestionActiva.gestion }).from(actGestionActiva).limit(1).for("update");
      if (!actual) throw new Error("No se encontró la gestión activa.");
      const resumen = await consultarAsignacionesParaDevolucion();
      if (!resumen.ok) throw new Error(resumen.error);
      if (resumen.actas.length) {
        const nombres = [...new Set(resumen.actas.map((a) => a.responsable))].slice(0, 3).join(", ");
        throw new Error(`Quedan ${resumen.actas.length} asignaciones pendientes de devolución (${nombres}). Registra las devoluciones antes de cerrar.`);
      }
      const nuevo = actual.gestion + 1;
      const fechaCierre = new Date();
      const [cierre] = await tx.update(actGestionesHistorial).set({ estado: "cerrada", cerradaEn: fechaCierre, cerradaPor: session.user.id }).where(eq(actGestionesHistorial.gestion, actual.gestion)).returning({ gestion: actGestionesHistorial.gestion });
      if (!cierre) throw new Error(`No se encontró el historial de la gestión ${actual.gestion}.`);
      await tx.insert(actGestionesHistorial).values({ gestion: nuevo, estado: "activa" });
      await tx.update(actGestionActiva).set({ gestion: nuevo, cerradaEn: fechaCierre, actualizadaEn: fechaCierre }).where(eq(actGestionActiva.id, 1));
      await tx.insert(auditLogs).values({ userId: session.user.id, module: "activos", action: "cerrar_gestion", entity: "act_gestiones_historial", entityId: String(actual.gestion), details: { gestionCerrada: actual.gestion, gestionHabilitada: nuevo } });
      return nuevo;
    });
    revalidatePath("/activos", "layout");
    return { ok: true as const, gestion: siguiente };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "No se pudo cerrar la gestión." };
  }
}
