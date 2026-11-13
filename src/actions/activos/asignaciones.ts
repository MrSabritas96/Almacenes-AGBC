"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { AsignacionError, nuevaAsignacionSchema, devolucionAsignacionSchema } from "./asignaciones-modelo";
import { registrarAsignacion, registrarDevolucion } from "./asignaciones-servicio";

type Resultado = { ok: true; data: { id: string; activoId: string } } | { ok: false; error: string };
type Contexto = { userId: string; ipAddress: string | null; userAgent: string | null };

async function ejecutar(action: string, operacion: (ctx: Contexto) => Promise<{ id: string; activoId: string }>): Promise<Resultado> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Tu sesión terminó. Vuelve a iniciar sesión." };
  if (!(await hasPermission(session.user.id, "activos:update")) || !(await hasPermission(session.user.id, "activos:read"))) {
    await audit({ userId: session.user.id, action, module: "activos", entity: "act_asignaciones", result: "denied" });
    return { ok: false, error: "No tienes permiso para gestionar asignaciones de activos." };
  }
  try {
    const h = await headers();
    const result = await operacion({ userId: session.user.id, ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"), userAgent: h.get("user-agent") });
    // El servicio registra la auditoría de éxito dentro de la transacción.
    revalidatePath("/activos");
    revalidatePath("/activos/asignaciones");
    revalidatePath(`/activos/${result.activoId}`);
    return { ok: true, data: result };
  } catch (error) {
    const message = error instanceof AsignacionError ? error.message : "No se pudo guardar la operación. Vuelve a intentarlo.";
    if (!(error instanceof AsignacionError)) console.error("[activos/asignaciones]", error);
    await audit({ userId: session.user.id, action, module: "activos", entity: "act_asignaciones", result: "failure", details: { message } });
    return { ok: false, error: message };
  }
}

export async function crearAsignacion(input: unknown): Promise<Resultado> {
  return ejecutar("asignar", async ctx => {
    const parsed = nuevaAsignacionSchema.safeParse(input);
    if (!parsed.success) throw new AsignacionError(parsed.error.issues[0]?.message ?? "Revisa los datos de la asignación.");
    return registrarAsignacion(parsed.data, ctx);
  });
}

export async function devolverAsignacion(input: unknown): Promise<Resultado> {
  return ejecutar("devolver", async ctx => {
    const parsed = devolucionAsignacionSchema.safeParse(input);
    if (!parsed.success) throw new AsignacionError(parsed.error.issues[0]?.message ?? "Revisa los datos de devolución.");
    return registrarDevolucion(parsed.data, ctx);
  });
}
