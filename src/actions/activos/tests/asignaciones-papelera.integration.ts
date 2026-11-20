import "dotenv/config";
import assert from "node:assert/strict";
import { eq,sql } from "drizzle-orm";
import { db,pool,schema } from "@/db";
import { actAsignaciones,actActas,actCustodiaActual } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { cambiarPapeleraAsignacion } from "../asignaciones-papelera-servicio";
async function main(){
 const [user]=await db.select().from(schema.users).where(eq(schema.users.email,"admin@agbc.local"));assert(user);
 const rollback=new Error("REVERTIR");
 try{await db.transaction(async tx=>{
  const [activa]=await tx.select().from(actAsignaciones).where(eq(actAsignaciones.estado,"activa"));
  const [cerrada]=await tx.select().from(actAsignaciones).where(eq(actAsignaciones.estado,"devuelta"));assert(activa&&cerrada);
  const documentos=await tx.select({id:actActas.id,hash:actActas.pdfSha256}).from(actActas);
  const custodia=await tx.select().from(actCustodiaActual).where(eq(actCustodiaActual.id,cerrada.activoId));
  await assert.rejects(()=>cambiarPapeleraAsignacion({id:activa.id,restaurar:false},user.id,tx),/activa/);
  await cambiarPapeleraAsignacion({id:cerrada.id,restaurar:false},user.id,tx);
  const [oculta]=await tx.select().from(actAsignaciones).where(eq(actAsignaciones.id,cerrada.id));assert(oculta?.eliminadoEn);assert.equal(oculta.estado,cerrada.estado);
  assert.deepEqual(await tx.select().from(actCustodiaActual).where(eq(actCustodiaActual.id,cerrada.activoId)),custodia);
  assert.deepEqual(await tx.select({id:actActas.id,hash:actActas.pdfSha256}).from(actActas),documentos);
  await cambiarPapeleraAsignacion({id:cerrada.id,restaurar:true},user.id,tx);
  const [restaurada]=await tx.select().from(actAsignaciones).where(eq(actAsignaciones.id,cerrada.id));assert.deepEqual(restaurada,cerrada);
  const logs=await tx.select().from(auditLogs).where(eq(auditLogs.entityId,cerrada.id));assert(logs.some(l=>l.action==="eliminar_asignacion"));assert(logs.some(l=>l.action==="restaurar_asignacion"));
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 await db.execute(sql`select 1`);console.log("Papelera y restauración, bloqueo de asignación activa, custodia y PDF conservados, auditoría: OK. Prueba revertida.");
}
main().finally(()=>pool.end());
