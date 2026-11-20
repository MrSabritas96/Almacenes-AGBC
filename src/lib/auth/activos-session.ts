import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession as getSessionByToken } from "./session";
import { hasPermission } from "@/lib/rbac";

export const getSession = cache(async () => {
  const session = await getSessionByToken();
  return session && await hasPermission(session.user.id, "activos:read") ? session : null;
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
