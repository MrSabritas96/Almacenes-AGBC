import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { eq,asc,isNull,or } from "drizzle-orm";
import { db } from "@/db";
import { actDocumentosArchivo as actas,actArchivoPdf as pdfs,actResponsables as responsables } from "@/db/schema/activos.schema";
import { accesoArchivo,uuidArchivo } from "@/actions/activos/archivo-consultas";
import { hasPermission } from "@/lib/rbac";
import { EditarArchivo } from "@/components/modules/activos/editar-archivo";
import { cambioArchivoSchema } from "@/actions/activos/archivo-gestion-modelo";
import { ArrowLeft } from "lucide-react";
export default async function Editar({params}:{params:Promise<{id:string}>}){
 const s=await accesoArchivo();if(!(await hasPermission(s.user.id,"activos:update")))redirect("/activos/archivo-actas");
 const {id}=await params;if(!uuidArchivo(id))notFound();
 const [r]=await db.select({a:actas,p:{numero:pdfs.numero,fecha:pdfs.fecha,regional:pdfs.regional}}).from(actas).innerJoin(pdfs,eq(pdfs.documentoId,actas.id)).where(eq(actas.id,id));
 if(!r||r.a.eliminadoEn)notFound();
 const lista=await db.select({id:responsables.id,nombre:responsables.nombre}).from(responsables).where(or(isNull(responsables.eliminadoEn),r.a.responsableId?eq(responsables.id,r.a.responsableId):undefined)).orderBy(asc(responsables.nombre));
 const datos=cambioArchivoSchema.parse({id,version:r.a.version,numero:r.p.numero,tipo:r.a.tipo==="devolucion"?"devolucion":"asignacion",procedencia:r.a.procedencia,responsableId:r.a.responsableId,fecha:r.p.fecha,regional:r.p.regional});
 return <div className="mx-auto max-w-4xl space-y-5"><header className="rounded-2xl border border-ink-200 bg-white p-6 shadow-2xs"><Link href="/activos/archivo-actas" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-2xs hover:bg-slate-50"><ArrowLeft className="h-4 w-4"/>Volver a Actas</Link><h1 className="text-2xl font-bold">Editar acta · {datos.numero}</h1></header><EditarArchivo datos={datos} responsables={lista}/></div>;
}
