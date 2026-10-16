import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const SUPERADMIN_ROLE = "superadmin";

/** Devuelve el set de permisos (`modulo:accion`) del usuario. superadmin => "*" */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ key: schema.permissions.key, role: schema.roles.name })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .leftJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.roles.id))
    .leftJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
    .where(eq(schema.userRoles.userId, userId));

  const set = new Set<string>();
  for (const r of rows) {
    if (r.role === SUPERADMIN_ROLE) set.add("*");
    if (r.key) set.add(r.key);
  }
  return set;
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.has("*") || perms.has(permission);
}
