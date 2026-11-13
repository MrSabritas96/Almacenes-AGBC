"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actActivos, actInventarioVigente, actMantenimientosVehiculos } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { clasificarActivo } from "./categorias-modelo";

const maintenanceSchema = z.object({
  activoId: z.uuid("Selecciona un vehículo del inventario."),
  fecha: z.iso.date("Ingresa una fecha válida."),
  kilometraje: z.string().trim().max(40).optional().default(""),
  descripcion: z.string().trim().min(3, "Describe el trabajo realizado.").max(3000),
  taller: z.string().trim().max(250).optional().default(""),
  unidad: z.string().trim().max(150).optional().default(""),
  factura: z.string().trim().max(120).optional().default(""),
  importe: z.string().trim().max(80).optional().default(""),
  observaciones: z.string().trim().max(2000).optional().default(""),
});

export type EstadoNuevoMantenimiento = { ok: boolean; error?: string; activoId?: string };
const initialState: EstadoNuevoMantenimiento = { ok: false };

export async function registrarMantenimientoVehiculo(_previous: EstadoNuevoMantenimiento, formData: FormData): Promise<EstadoNuevoMantenimiento> {
  const session = await getSession();
  if (!session || !(await hasPermission(session.user.id, "activos:create"))) return { ok: false, error: "No tienes permiso para registrar mantenimientos." };

  const parsed = maintenanceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." };

  const [vehicle] = await db.select({
    id: actInventarioVigente.id,
    grupo: actActivos.grupoContable,
    descripcion: actActivos.descripcion,
  }).from(actInventarioVigente)
    .innerJoin(actActivos, eq(actActivos.id, actInventarioVigente.id))
    .where(eq(actInventarioVigente.id, parsed.data.activoId))
    .limit(1);
  if (!vehicle || clasificarActivo(vehicle.grupo, vehicle.descripcion).categoria !== "vehiculos") {
    return { ok: false, error: "El activo seleccionado ya no está disponible como vehículo vigente." };
  }

  await db.insert(actMantenimientosVehiculos).values({
    activoId: vehicle.id,
    fecha: parsed.data.fecha,
    kilometraje: parsed.data.kilometraje || null,
    descripcion: parsed.data.descripcion,
    taller: parsed.data.taller || null,
    unidad: parsed.data.unidad || null,
    factura: parsed.data.factura || null,
    importe: parsed.data.importe || null,
    observaciones: parsed.data.observaciones || null,
    registradoPor: session.user.id,
  });

  revalidatePath("/activos/vehiculos");
  revalidatePath(`/activos/vehiculos/mantenimientos/${vehicle.id}`);
  return { ok: true, activoId: vehicle.id };
}

export { initialState as estadoInicialMantenimiento };
