import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { consultarCierreGestion } from "@/actions/activos/gestion";
import { CierreGestion } from "@/components/modules/activos/cierre-gestion";

export default async function Page() {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read")) || !(await hasPermission(session.user.id, "activos:update"))) redirect("/activos/archivo-actas");
  const inicial = await consultarCierreGestion();
  if (!inicial.ok) return <p role="alert" className="rounded-xl bg-rose-50 p-5 text-rose-800">{inicial.error}</p>;
  return <main className="mx-auto max-w-7xl space-y-6"><CierreGestion inicial={inicial}/></main>;
}
