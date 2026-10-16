import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Para páginas/layouts protegidos. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
