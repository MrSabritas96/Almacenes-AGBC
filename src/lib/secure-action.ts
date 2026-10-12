import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Envoltorio estándar para TODA Server Action con mutación:
 * valida sesión -> verifica permiso RBAC -> ejecuta -> audita.
 *
 * Uso (en src/actions/<modulo>/*.ts):
 *   export const crearActivo = secureAction(
 *     { permission: "activos:create", module: "activos", action: "create" },
 *     async (input: Input, ctx) => { ... return data; },
 *   );
 */
export function secureAction<I, O>(
  meta: { permission: string; module: string; action: string; entity?: string },
  handler: (input: I, ctx: { userId: string }) => Promise<O>,
) {
  return async (input: I): Promise<ActionResult<O>> => {
    const session = await getSession();
    if (!session) return { ok: false, error: "No autenticado" };
    const userId = session.user.id;

    if (!(await hasPermission(userId, meta.permission))) {
      await audit({ userId, action: meta.action, module: meta.module, result: "denied",
        details: { permission: meta.permission } });
      return { ok: false, error: "No tienes permiso para esta acción" };
    }

    try {
      const data = await handler(input, { userId });
      await audit({ userId, action: meta.action, module: meta.module, entity: meta.entity });
      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      await audit({ userId, action: meta.action, module: meta.module, entity: meta.entity,
        result: "failure", details: { message } });
      return { ok: false, error: message };
    }
  };
}
