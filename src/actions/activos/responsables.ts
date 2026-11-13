"use server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { actResponsables as catalogo, actResponsableNombres as nombres } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { responsableSchema } from "./responsables-modelo";

export async function guardarResponsable(input:unknown):Promise<{ok:boolean;error?:string}> {
 const session=await getSession();
 if(!session||!(await hasPermission(session.user.id,"activos:read"))||!(await hasPermission(session.user.id,"activos:update")))return {ok:false,error:"No tienes permiso para gestionar responsables."};
 const parsed=responsableSchema.safeParse(input);if(!parsed.success)return {ok:false,error:parsed.error.issues[0]?.message??"Revisa los datos."};
 const {id,...datos}=parsed.data;
 try {
  await db.transaction(async tx=>{
   // Serializa altas, cambios de nombre y bajas para proteger las equivalencias.
   await tx.execute(sql`select pg_advisory_xact_lock(735204)`);
   if(id){const [prev]=await tx.select().from(catalogo).where(eq(catalogo.id,id)).for("update");if(!prev||prev.eliminadoEn)throw new Error("inexistente");}
   const [alias]=await tx.select().from(nombres).where(eq(nombres.clave,datos.nombre));
   const [igual]=await tx.select().from(catalogo).where(eq(catalogo.nombre,datos.nombre));
   if((alias&&alias.responsableId!==id)||(igual&&igual.id!==id))throw new Error("duplicado");
   const [saved]=id?await tx.update(catalogo).set(datos).where(eq(catalogo.id,id)).returning():await tx.insert(catalogo).values(datos).returning();
   await tx.insert(nombres).values({clave:datos.nombre,responsableId:saved!.id}).onConflictDoNothing();
  });
 }catch(e){return {ok:false,error:e instanceof Error&&e.message==="duplicado"?"Ese nombre ya existe o pertenece a otro responsable. Edita el registro existente.":"No se pudo guardar. Actualiza la página y revisa los datos."};}
 await audit({userId:session.user.id,module:"activos",action:id?"editar_responsable":"crear_responsable",entity:"act_responsables",entityId:id});
 revalidatePath("/activos","layout");return {ok:true};
}
export async function eliminarResponsable(id:string):Promise<{ok:boolean;error?:string}> {
 const session=await getSession();if(!session||!(await hasPermission(session.user.id,"activos:read"))||!(await hasPermission(session.user.id,"activos:update")))return {ok:false,error:"No tienes permiso para gestionar responsables."};
 if(!/^[0-9a-f-]{36}$/i.test(id))return {ok:false,error:"Responsable inválido."};
 try{await db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(735204)`);
  const [r]=await tx.select().from(catalogo).where(eq(catalogo.id,id)).for("update");if(!r||r.eliminadoEn)throw new Error("No se encuentra el responsable.");
  const linked=await tx.execute(sql`select 1 from act_custodia_actual c join act_responsable_nombres n on n.clave=nullif(translate(upper(trim(regexp_replace(replace(c.responsable,chr(160),' '),'[[:space:]]+',' ','g'))),'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ','AAAAEEEEIIIIOOOOUUUU'),'') where n.responsable_id=${id} limit 1`);
  if(linked.rows.length)throw new Error("Tiene bienes a su cargo. Registra su reasignación o devolución antes de eliminarlo.");
  await tx.update(catalogo).set({eliminadoEn:new Date()}).where(eq(catalogo.id,id));
 });}catch(e){return {ok:false,error:e instanceof Error?e.message:"No se pudo eliminar."};}
 await audit({userId:session.user.id,module:"activos",action:"eliminar_responsable",entity:"act_responsables",entityId:id});revalidatePath("/activos","layout");return {ok:true};
}
