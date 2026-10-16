import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { actActivos, actAsignaciones, actInventarioVigente } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { AsignacionError, hoyBolivia, type NuevaAsignacion, type DevolucionAsignacion } from "./asignaciones-modelo";

type Contexto = { userId: string; ipAddress?: string | null; userAgent?: string | null };

export async function registrarAsignacion(input: NuevaAsignacion, ctx: Contexto, database: typeof db = db) {
  const hoy = hoyBolivia();
  if (input.fechaInicio > hoy) throw new AsignacionError("La asignación se registra al entregar el bien; el inicio no puede ser futuro.");
  if (input.fechaDevolucionPrevista && input.fechaDevolucionPrevista < hoy) throw new AsignacionError("La devolución prevista no puede estar en el pasado.");
  return database.transaction(async tx => {
    // Todas las operaciones de custodia bloquean el mismo bien: evita carreras entre solicitudes.
    const [bien] = await tx.select().from(actActivos).where(eq(actActivos.id, input.activoId)).for("update");
    if (!bien) throw new AsignacionError("No se encontró el activo.");
    const [vigente] = await tx.select({ id: actInventarioVigente.id }).from(actInventarioVigente).where(eq(actInventarioVigente.id, input.activoId));
    if (!vigente) throw new AsignacionError("Solo se pueden asignar bienes del inventario vigente.");
    const [repetida] = await tx.select().from(actAsignaciones).where(eq(actAsignaciones.solicitudId, input.solicitudId));
    if (repetida) {
      const same = repetida.activoId === input.activoId && repetida.creadoPor === ctx.userId && repetida.tipo === input.tipo
        && repetida.responsableDestino === input.responsableDestino && repetida.ubicacionDestino === input.ubicacionDestino
        && repetida.fechaInicio === input.fechaInicio && repetida.fechaDevolucionPrevista === input.fechaDevolucionPrevista
        && repetida.motivo === input.motivo && repetida.referenciaActa === (input.referenciaActa || null);
      if (!same) throw new AsignacionError("La solicitud ya fue utilizada. Actualiza la ficha y vuelve a intentarlo.");
      return { id: repetida.id, activoId: repetida.activoId };
    }
    const activas = await tx.select().from(actAsignaciones).where(and(eq(actAsignaciones.activoId, input.activoId), eq(actAsignaciones.estado, "activa")));
    const fija = activas.find(a => a.tipo === "fija");
    if (activas.some(a => a.tipo === "momentanea")) throw new AsignacionError("El bien tiene una asignación momentánea activa. Registra primero su devolución.");
    if ((fija?.id ?? null) !== input.asignacionFijaEsperada) throw new AsignacionError("La custodia fija cambió mientras completabas el formulario. Actualiza la ficha.");
    const [ultimo] = await tx.select({ fecha: sql<string>`greatest(${actAsignaciones.fechaInicio}, coalesce(${actAsignaciones.fechaCierre}, ${actAsignaciones.fechaInicio}))::text` })
      .from(actAsignaciones).where(eq(actAsignaciones.activoId, input.activoId)).orderBy(desc(sql`greatest(${actAsignaciones.fechaInicio}, coalesce(${actAsignaciones.fechaCierre}, ${actAsignaciones.fechaInicio}))`)).limit(1);
    if (ultimo && input.fechaInicio < ultimo.fecha) throw new AsignacionError("El inicio no puede ser anterior al último movimiento registrado.");
    const anterior = { responsableAnterior: fija?.responsableDestino ?? bien.responsable, ubicacionAnterior: fija?.ubicacionDestino ?? bien.ubicacion };
    if (input.tipo === "fija" && fija) {
      await tx.update(actAsignaciones).set({ estado: "reemplazada", fechaCierre: input.fechaInicio, cerradoPor: ctx.userId, motivoCierre: "Reemplazada por una nueva asignación fija." }).where(eq(actAsignaciones.id, fija.id));
    }
    const [asignacion] = await tx.insert(actAsignaciones).values({ solicitudId: input.solicitudId, activoId: input.activoId, tipo: input.tipo,
      responsableDestino: input.responsableDestino, ubicacionDestino: input.ubicacionDestino,
      fechaInicio: input.fechaInicio, fechaDevolucionPrevista: input.fechaDevolucionPrevista, motivo: input.motivo,
      ...anterior, referenciaActa: input.referenciaActa || null, creadoPor: ctx.userId }).returning({ id: actAsignaciones.id });
    if (!asignacion) throw new Error("La inserción no devolvió un identificador.");
    // Auditoría de éxito dentro de la misma transacción: custodia e historial se confirman juntos.
    await tx.insert(auditLogs).values({ userId: ctx.userId, module: "activos", action: "asignar", entity: "act_asignaciones", entityId: asignacion.id,
      ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
      details: { activoId: input.activoId, tipo: input.tipo, responsableDestino: input.responsableDestino, ubicacionDestino: input.ubicacionDestino, reemplaza: fija && input.tipo === "fija" ? fija.id : null } });
    return { id: asignacion.id, activoId: input.activoId };
  });
}

export async function registrarDevolucion(input: DevolucionAsignacion, ctx: Contexto, database: typeof db = db) {
  if (input.fechaCierre > hoyBolivia()) throw new AsignacionError("La devolución no puede registrarse con una fecha futura.");
  return database.transaction(async tx => {
    const [referencia] = await tx.select({ activoId: actAsignaciones.activoId }).from(actAsignaciones).where(eq(actAsignaciones.id, input.asignacionId));
    if (!referencia) throw new AsignacionError("No se encontró la asignación.");
    await tx.select({ id: actActivos.id }).from(actActivos).where(eq(actActivos.id, referencia.activoId)).for("update");
    const [asignacion] = await tx.select().from(actAsignaciones).where(eq(actAsignaciones.id, input.asignacionId));
    if (!asignacion) throw new AsignacionError("No se encontró la asignación.");
    if (asignacion.estado === "devuelta") return { id: asignacion.id, activoId: asignacion.activoId };
    if (asignacion.estado !== "activa") throw new AsignacionError("La asignación ya fue reemplazada y no puede devolverse.");
    if (input.fechaCierre < asignacion.fechaInicio) throw new AsignacionError("La devolución no puede ser anterior al inicio.");
    if (asignacion.tipo === "fija") {
      const [temporal] = await tx.select({ id: actAsignaciones.id }).from(actAsignaciones).where(and(eq(actAsignaciones.activoId, asignacion.activoId), eq(actAsignaciones.tipo, "momentanea"), eq(actAsignaciones.estado, "activa")));
      if (temporal) throw new AsignacionError("Primero devuelve la asignación momentánea para poder finalizar la fija.");
      const [ultimo] = await tx.select({ fecha: actAsignaciones.fechaCierre }).from(actAsignaciones).where(and(eq(actAsignaciones.activoId, asignacion.activoId), sql`${actAsignaciones.fechaCierre} IS NOT NULL`)).orderBy(desc(actAsignaciones.fechaCierre)).limit(1);
      if (ultimo?.fecha && input.fechaCierre < ultimo.fecha) throw new AsignacionError("La devolución no puede ser anterior al último movimiento registrado.");
    }
    await tx.update(actAsignaciones).set({ estado: "devuelta", fechaCierre: input.fechaCierre, motivoCierre: input.motivoCierre, cerradoPor: ctx.userId }).where(eq(actAsignaciones.id, asignacion.id));
    await tx.insert(auditLogs).values({ userId: ctx.userId, module: "activos", action: "devolver", entity: "act_asignaciones", entityId: asignacion.id,
      ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { activoId: asignacion.activoId, tipo: asignacion.tipo, fechaCierre: input.fechaCierre, motivoCierre: input.motivoCierre } });
    return { id: asignacion.id, activoId: asignacion.activoId };
  });
}
