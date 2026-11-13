import { consultarKardexVehiculo } from "@/actions/activos/vehiculos-excel-consultas";
import { generarKardexVehiculoPdf } from "@/actions/activos/vehiculos-kardex-pdf";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Inicia sesión", { status: 401 });
  if (!(await hasPermission(session.user.id, "activos:read"))) return new Response("Sin permiso", { status: 403 });

  const { id } = await params;
  const ficha = await consultarKardexVehiculo(id);
  if (!ficha) return new Response("Registro de mantenimiento no encontrado", { status: 404 });

  const pdf = await generarKardexVehiculoPdf(ficha);
  const filename = `mantenimientos-${ficha.placa}.pdf`.replace(/[^a-zA-Z0-9.-]/g, "-");
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
