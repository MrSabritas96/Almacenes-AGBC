import { headers } from "next/headers";
import { db, schema } from "@/db";

export type AuditInput = {
  userId?: string | null;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  result?: "success" | "failure" | "denied";
  details?: Record<string, unknown>;
};

/** Registra en audit_logs. Nunca lanza: un fallo de auditoría no debe romper la operación. */
export async function audit(input: AuditInput) {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    await db.insert(schema.auditLogs).values({
      userId: input.userId ?? null,
      action: input.action,
      module: input.module,
      entity: input.entity,
      entityId: input.entityId,
      result: input.result ?? "success",
      details: input.details,
      ipAddress: ip,
      userAgent: h.get("user-agent"),
    });
  } catch (err) {
    console.error("[audit] error", err);
  }
}
