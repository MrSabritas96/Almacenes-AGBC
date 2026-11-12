import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db } from "@/db";
import { actResponsables as responsables } from "@/db/schema/activos.schema";
import { actListadoActas as actas, actListadoPdfs as originales } from "@/actions/activos/archivo-listado";
import { filtrosArchivo } from "@/actions/activos/archivo-filtros";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Inicia sesión", { status: 401 });
  if (!(await hasPermission(session.user.id, "activos:read"))) return new Response("Sin permiso", { status: 403 });

  const url = new URL(request.url);
  if(url.searchParams.get("categoria")==="papelera")return new Response("Restaura el acta antes de imprimirla.",{status:400});
  const { where, orden, procedencia, tipo } = filtrosArchivo(Object.fromEntries(url.searchParams));
  // Select all matching IDs in the same order as the list; pagination never limits printing.
  const documentos = await db.select({ id: actas.id, listo: sql<boolean>`${originales.pdfOriginal} is not null` })
    .from(actas)
    .leftJoin(responsables, eq(actas.responsableId, responsables.id))
    .leftJoin(originales, eq(actas.id, originales.documentoId))
    .where(where).orderBy(...orden);
  if (!documentos.length) return new Response("No hay actas que coincidan con esta búsqueda.", { status: 404 });
  if (documentos.some(d => !d.listo)) return new Response("Hay actas cuyo PDF todavía está en preparación. Vuelve a intentarlo cuando estén disponibles; no se omitirá ninguna acta.", { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "60" } });

  try {
    const conjunto = await PDFDocument.create();
    conjunto.setTitle("Actas del archivo · impresión conjunta");
    conjunto.setSubject("Actas originales en orden correlativo, incluidos sus anexos");
    conjunto.setCreator("Almacenes AGBC");
    for (const documento of documentos) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      // Read one source PDF at a time, retaining its original page sizes and vehicle annexes.
      const [row] = await db.select({ pdf: originales.pdfOriginal }).from(originales).where(eq(originales.documentoId, documento.id));
      if (!row?.pdf) throw new Error(`PDF no disponible: ${documento.id}`);
      const original = await PDFDocument.load(row.pdf);
      const paginas = await conjunto.copyPages(original, original.getPageIndices());
      for (const pagina of paginas) conjunto.addPage(pagina);
      await conjunto.flush();
    }
    const pdf = await conjunto.save();
    const nombre = ["actas", procedencia, tipo].filter(Boolean).join("-").replace(/[^A-Za-z0-9-]/g, "-") + ".pdf";
    return new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Actas-Total": String(documentos.length),
      "X-Paginas-Total": String(conjunto.getPageCount()),
    } });
  } catch (error) {
    console.error("No se pudo preparar la impresión conjunta de actas", error);
    return new Response("No se pudo preparar el PDF completo. Vuelve al listado e inténtalo de nuevo.", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
