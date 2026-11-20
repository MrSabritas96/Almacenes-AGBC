import { createHash } from "node:crypto";
import { and,eq,ne,sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { actActivos,actInventarioVigente } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
export class EditarActivoError extends Error {}
export function datosEditables(a:{codigo:string|null;descripcion:string;estado:string|null;observaciones:string|null}){
 return {codigo:a.codigo,descripcion:a.descripcion,estado:a.estado,observaciones:a.observaciones};
}
export function revisionActivo(a:Parameters<typeof datosEditables>[0]){return createHash("sha256").update(JSON.stringify(datosEditables(a))).digest("hex");}
const cambio=z.object({id:z.string().uuid(),revision:z.string().regex(/^[a-f0-9]{64}$/),codigo:z.string().trim().max(120).transform(s=>s.toUpperCase()),descripcion:z.string().trim().min(3,"Escribe la descripción del activo.").max(10000),estado:z.string().trim().max(40),observaciones:z.string().trim().max(10000)});
export async function editarActivoServicio(input:unknown,userId:string,database:typeof db=db){
 const parsed=cambio.safeParse(input);if(!parsed.success)throw new EditarActivoError(parsed.error.issues[0]?.message||"Revisa los datos.");const v=parsed.data;
 return database.transaction(async tx=>{
  const prefijo=v.codigo.match(/^(.*?)(\d+)$/)?.[1];
  if(prefijo)await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`alta-activo-serie:${prefijo}`}))`);
  if(v.codigo)await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`editar-activo-codigo:${v.codigo}`}))`);
  const [a]=await tx.select().from(actActivos).where(eq(actActivos.id,v.id)).for("update");
  const [vigente]=await tx.select({id:actInventarioVigente.id}).from(actInventarioVigente).where(eq(actInventarioVigente.id,v.id));
  if(!a||!vigente)throw new EditarActivoError("El activo ya no está en el inventario vigente.");
  if(revisionActivo(a)!==v.revision)throw new EditarActivoError("Este activo cambió. Cierra y vuelve a abrir Editar para cargar sus datos actuales.");
  const codigo=v.codigo||null,estado=v.estado||null;
  if(estado!==a.estado&&estado!==null&&!["BUENO","REGULAR","MALO"].includes(estado))throw new EditarActivoError("Selecciona un estado válido.");
  if(codigo!==a.codigo&&codigo){const [duplicado]=await tx.select({id:actActivos.id}).from(actActivos).where(and(ne(actActivos.id,v.id),sql`upper(trim(${actActivos.codigo}))=upper(${codigo})`)).limit(1);if(duplicado)throw new EditarActivoError("Ese código ya pertenece a otro activo. Usa un código diferente.");}
  const despues={codigo,descripcion:v.descripcion,estado,observaciones:v.observaciones||null};
  await tx.update(actActivos).set(despues).where(eq(actActivos.id,v.id));
  await tx.insert(auditLogs).values({userId,module:"activos",action:"editar_activo",entity:"act_activos",entityId:v.id,details:{antes:datosEditables(a),despues}});
  return {id:v.id};
 });
}
