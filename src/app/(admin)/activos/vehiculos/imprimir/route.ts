import { consultarCategorias } from "@/actions/activos/categorias-consultas";
import { generarInventarioVehiculosPdf } from "@/actions/activos/vehiculos-inventario-pdf";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Inicia sesión", { status: 401 });
  if (!(await hasPermission(session.user.id, "activos:read"))) return new Response("Sin permiso", { status: 403 });

  const url = new URL(request.url);
  const filtros = { categoria: "vehiculos", q: url.searchParams.get("q") ?? "", regional: url.searchParams.get("regional") ?? "" };
  const data = await consultarCategorias(filtros, true, true);
  const pdf = await generarInventarioVehiculosPdf(data.registros, { regional: data.regional, q: data.q });
  const filename = `inventario-vehiculos-${data.regional || "todas-regionales"}`.replace(/[^a-zA-Z0-9-]/g, "-") + ".pdf";
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
