import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actDocumentosArchivo as actas,actArchivoPdf as pdfs,actResponsables,actProcedencias } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import type { CambioArchivo, EstadoArchivo } from "./archivo-gestion-modelo";
export class ArchivoGestionError extends Error {}
const geografia:Record<string,{departamento:string;ciudad:string}>={"Oficina Central":{departamento:"La Paz",ciudad:"La Paz"},"El Alto":{departamento:"La Paz",ciudad:"El Alto"},"Sucre":{departamento:"Chuquisaca",ciudad:"Sucre"},"Beni":{departamento:"Beni",ciudad:"Trinidad"},"Pando":{departamento:"Pando",ciudad:"Cobija"}};
export async function cambiarArchivo(input:CambioArchivo,userId:string,database:typeof db=db){
 return database.transaction(async tx=>{
  const [a]=await tx.select().from(actas).where(eq(actas.id,input.id)).for("update");
  if(!a||a.eliminadoEn)throw new ArchivoGestionError("El acta ya no está disponible.");
  if(a.version!==input.version)throw new ArchivoGestionError("El acta cambió. Actualiza la página antes de editarla.");
  const [procedencia]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,input.procedencia)).for("share");if(!procedencia?.activa)throw new ArchivoGestionError("Selecciona una procedencia vigente.");
  if(input.responsableId){const [r]=await tx.select().from(actResponsables).where(eq(actResponsables.id,input.responsableId));if(!r||(r.eliminadoEn&&input.responsableId!==a.responsableId))throw new ArchivoGestionError("Selecciona un responsable vigente.");}
  const [p]=await tx.select({numero:pdfs.numero,fecha:pdfs.fecha,regional:pdfs.regional,ciudad:pdfs.ciudad,departamento:pdfs.departamento,ambito:pdfs.ambito,tipo:pdfs.tipo}).from(pdfs).where(eq(pdfs.documentoId,a.id));
  if(!p)throw new ArchivoGestionError("El documento aún no tiene PDF preparado.");
  const g=geografia[input.regional]??{departamento:input.regional,ciudad:input.regional};
  await tx.update(actas).set({numero:input.numero,tipo:input.tipo,procedencia:input.procedencia,fecha:input.fecha,responsableId:input.responsableId,version:a.version+1}).where(eq(actas.id,a.id));
  await tx.update(pdfs).set({numero:input.numero,tipo:input.tipo,fecha:input.fecha,regional:input.regional,...g,ambito:input.regional==="Oficina Central"?"oficina_central":"regional"}).where(eq(pdfs.documentoId,a.id));
  await tx.insert(auditLogs).values({userId,module:"activos",action:"editar_acta_archivo",entity:"act_documentos_archivo",entityId:a.id,details:{antes:{numero:a.numero,tipo:a.tipo,procedencia:a.procedencia,fecha:a.fecha,responsableId:a.responsableId,version:a.version,clasificacion:p},despues:input,pdfOriginalConservado:true}});
 });
}
export async function cambiarEstadoArchivo(input:EstadoArchivo,userId:string,database:typeof db=db){
 return database.transaction(async tx=>{
  const [a]=await tx.select().from(actas).where(eq(actas.id,input.id)).for("update");
  if(!a)throw new ArchivoGestionError("Acta no encontrada.");
  if(a.version!==input.version)throw new ArchivoGestionError("El acta cambió. Actualiza la página y vuelve a intentarlo.");
  if(input.restaurar?!a.eliminadoEn:!!a.eliminadoEn)throw new ArchivoGestionError(input.restaurar?"El acta ya está restaurada.":"El acta ya está en la papelera.");
  await tx.update(actas).set({eliminadoEn:input.restaurar?null:new Date(),version:a.version+1}).where(eq(actas.id,a.id));
  await tx.insert(auditLogs).values({userId,module:"activos",action:input.restaurar?"restaurar_acta_archivo":"eliminar_acta_archivo",entity:"act_documentos_archivo",entityId:a.id,details:{numero:a.numero,version:a.version,pdfOriginalConservado:true}});
 });
}
