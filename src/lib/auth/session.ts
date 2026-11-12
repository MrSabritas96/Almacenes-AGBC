import { headers } from "next/headers";
import { auth } from "./index";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function getSession(token?: string) {
  // Una sesión explícita nunca debe heredar la cookie global de otra pestaña.
  const requestHeaders = token === undefined ? await headers() : new Headers({ authorization: `Bearer ${token}` });
  if (token !== undefined && !token) return null;
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const [user] = await db.select({ active: schema.users.isActive }).from(schema.users).where(eq(schema.users.id, session.user.id));
  return user?.active ? session : null;
}
