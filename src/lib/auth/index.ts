import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db, pool, schema } from "@/db";
import { APIError } from "better-auth/api";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, disableSignUp: true },
  advanced: { database: { generateId: false } },
  databaseHooks: {
    session: { create: { before: async (session) => {
      const { rows } = await pool.query(`select u.id from users u where u.id=$1 and u.is_active
        and exists(select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=u.id and r.name<>'empleado_agbc')`, [session.userId]);
      if (!rows[0]) throw new APIError("FORBIDDEN", { message: "Esta cuenta no tiene acceso administrativo. Usa el formulario de solicitud." });
      return { data: session };
    } } },
  },
  plugins: [username({ displayUsername: false }), bearer(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
