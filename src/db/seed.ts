import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, pool, schema } from "./index";

const MODULES = ["activos", "almacenes", "conciliaciones"] as const;
const ACTIONS = ["read", "create", "update", "delete"] as const;

async function main() {
  // Permisos: modulo:accion + permisos de sistema
  const keys = [
    ...MODULES.flatMap((m) => ACTIONS.map((a) => ({ key: `${m}:${a}`, module: m }))),
    { key: "sistema:backup", module: "sistema" },
    { key: "sistema:audit", module: "sistema" },
    { key: "sistema:users", module: "sistema" },
  ];
  await db.insert(schema.permissions).values(keys).onConflictDoNothing();

  // Roles base
  const roleDefs = [
    { name: "superadmin", description: "Acceso total", isSystem: true },
    { name: "admin_activos", description: "Administra Activos", isSystem: true },
    { name: "admin_almacenes", description: "Administra Almacenes", isSystem: true },
    { name: "admin_conciliaciones", description: "Administra Conciliaciones", isSystem: true },
  ];
  await db.insert(schema.roles).values(roleDefs).onConflictDoNothing();

  const allPerms = await db.select().from(schema.permissions);
  const allRoles = await db.select().from(schema.roles);
  for (const m of MODULES) {
    const role = allRoles.find((r) => r.name === `admin_${m}`);
    if (!role) continue;
    const values = allPerms.filter((p) => p.module === m).map((p) => ({ roleId: role.id, permissionId: p.id }));
    await db.insert(schema.rolePermissions).values(values).onConflictDoNothing();
  }

  // Superadmin inicial
  const email = process.env.SEED_ADMIN_EMAIL!;
  let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user) {
    await auth.api.signUpEmail({
      body: { email, password: process.env.SEED_ADMIN_PASSWORD!, name: process.env.SEED_ADMIN_NAME ?? "Admin" },
    });
    [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  }
  const superRole = allRoles.find((r) => r.name === "superadmin");
  if (user && superRole) {
    await db.insert(schema.userRoles).values({ userId: user.id, roleId: superRole.id }).onConflictDoNothing();
  }
  console.log("Seed completado. Superadmin:", email);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
