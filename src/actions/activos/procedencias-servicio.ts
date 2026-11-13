import { randomUUID } from "node:crypto";
import { eq,sql } from "drizzle-orm";
import { db } from "@/db";
import { actProcedencias } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { z } from "zod";
export class ProcedenciaError extends Error {}
const cambio=z.object({clave:z.string().max(80).nullable(),version:z.number().int().positive().optional(),nombre:z.string().trim().min(2).max(80).regex(/^[\p{L}\p{N} .()\/-]+$/u,"Usa letras, números, espacios o guiones.").transform(s=>s.replace(/\s+/g," ").toUpperCase())});
export async function guardarProcedenciaServicio(input:unknown,userId:string,database:typeof db=db){
 const parsed=cambio.safeParse(input);if(!parsed.success)throw new ProcedenciaError(parsed.error.issues[0]?.message||"Revisa el nombre.");const v=parsed.data;
 return database.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('catalogo-procedencias'))`);
  const existentes=await tx.select().from(actProcedencias);
  const normalizar=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  const coincidencia=existentes.find(p=>normalizar(p.nombre)===normalizar(v.nombre));
  if(!v.clave&&coincidencia&&!coincidencia.activa){await tx.update(actProcedencias).set({nombre:v.nombre,activa:true,version:coincidencia.version+1}).where(eq(actProcedencias.clave,coincidencia.clave));await tx.insert(auditLogs).values({userId,module:"activos",action:"restaurar_procedencia",entity:"act_procedencias",entityId:coincidencia.clave,details:{nombre:v.nombre}});return {clave:coincidencia.clave};}
  if(coincidencia&&coincidencia.clave!==v.clave)throw new ProcedenciaError("Ya existe una procedencia con ese nombre.");
  let clave=v.clave;
  if(clave){const [anterior]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,clave)).for("update");if(!anterior?.activa||anterior.version!==v.version)throw new ProcedenciaError("La procedencia cambió. Actualiza la lista.");await tx.update(actProcedencias).set({nombre:v.nombre,version:anterior.version+1}).where(eq(actProcedencias.clave,clave));await tx.insert(auditLogs).values({userId,module:"activos",action:"editar_procedencia",entity:"act_procedencias",entityId:clave,details:{antes:anterior.nombre,despues:v.nombre,claveConservada:true}});}
  else{clave=randomUUID();const base=v.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30)||"PROCEDENCIA";let prefijo=base+"-AF-";let i=1;while(existentes.some(p=>p.prefijo===prefijo))prefijo=base+"-AF-"+(i++)+"-";await tx.insert(actProcedencias).values({clave,nombre:v.nombre,prefijo});await tx.insert(auditLogs).values({userId,module:"activos",action:"crear_procedencia",entity:"act_procedencias",entityId:clave,details:{nombre:v.nombre,prefijo}});}
  return {clave};
 });
}
export async function eliminarProcedenciaServicio(clave:string,version:number,userId:string,database:typeof db=db){
 return database.transaction(async tx=>{
  const [p]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,clave)).for("update");if(!p?.activa||p.version!==version)throw new ProcedenciaError("La procedencia cambió. Actualiza la lista.");
  const uso=await tx.execute<{usada:boolean}>(sql`select exists(select 1 from act_activos where origen=${clave} union all select 1 from act_documentos_archivo where procedencia=${clave} union all select 1 from act_actas where procedencia_serie=${clave} or cabecera->>'entidad'=${clave}) usada`);
  if(uso.rows[0]?.usada)throw new ProcedenciaError("No se puede eliminar: tiene activos o actas asociados. Puedes editar su nombre.");
  await tx.update(actProcedencias).set({activa:false,version:p.version+1}).where(eq(actProcedencias.clave,clave));await tx.insert(auditLogs).values({userId,module:"activos",action:"eliminar_procedencia",entity:"act_procedencias",entityId:clave,details:{nombre:p.nombre}});
 });
}
