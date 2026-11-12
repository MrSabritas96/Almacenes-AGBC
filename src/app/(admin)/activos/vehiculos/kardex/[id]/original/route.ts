import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actHojasImportadas, actImportaciones } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Inicia sesión", { status: 401 });
  if (!(await hasPermission(session.user.id, "activos:read"))) return new Response("Sin permiso", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response("Archivo no encontrado", { status: 404 });
  const [hoja] = await db.select({ importacionId: actHojasImportadas.importacionId }).from(actHojasImportadas).where(eq(actHojasImportadas.id, id)).limit(1);
  if (!hoja) return new Response("Archivo no encontrado", { status: 404 });
  const [archivo] = await db.select({ nombre: actImportaciones.archivoNombre, bytes: actImportaciones.archivoOriginal }).from(actImportaciones).where(eq(actImportaciones.id, hoja.importacionId)).limit(1);
  if (!archivo) return new Response("Archivo no encontrado", { status: 404 });
  const nombre = archivo.nombre.replace(/[\\/\r\n\"]+/g, "_");
  return new Response(new Uint8Array(archivo.bytes), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
