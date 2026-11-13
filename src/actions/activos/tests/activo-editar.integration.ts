import "dotenv/config";
import assert from "node:assert/strict";
import { eq,sql } from "drizzle-orm";
import { db,pool,schema } from "@/db";
import { actActivos,actInventarioVigente,actActas,actFilasImportadas } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { datosEditables,revisionActivo,editarActivoServicio } from "../activo-editar-servicio";
async function main(){
 const [user]=await db.select().from(schema.users).where(eq(schema.users.email,"admin@agbc.local"));assert(user);
 const rollback=new Error("PRUEBA_REVERTIDA");
 try{await db.transaction(async tx=>{
  const [a,b]=await tx.select().from(actInventarioVigente).limit(2);assert(a&&b&&b.codigo);
  const actas=await tx.select({hash:actActas.pdfSha256}).from(actActas);
  const [fuente]=await tx.select().from(actFilasImportadas).where(eq(actFilasImportadas.id,a.filaOrigenId));
  const entrada={id:a.id,revision:revisionActivo(a),codigo:a.codigo??"",descripcion:"Descripción de prueba revertida",estado:"REGULAR",observaciones:"Observaciones de prueba revertida"};
  await editarActivoServicio(entrada,user.id,tx);
  const [despues]=await tx.select().from(actActivos).where(eq(actActivos.id,a.id));assert(despues);assert.equal(despues.descripcion,entrada.descripcion);assert.equal(despues.estado,"REGULAR");assert.equal(despues.observaciones,entrada.observaciones);assert.equal(despues.responsable,a.responsable);assert.equal(despues.origen,a.origen);
  await assert.rejects(()=>editarActivoServicio(entrada,user.id,tx),/cambió/);
  await assert.rejects(()=>editarActivoServicio({...entrada,revision:revisionActivo(despues),codigo:b.codigo!},user.id,tx),/otro activo/);
  await assert.rejects(()=>editarActivoServicio({...entrada,revision:revisionActivo(despues),estado:"INVALIDO"},user.id,tx),/estado válido/);
  await editarActivoServicio({...entrada,revision:revisionActivo(despues),codigo:"PRUEBA-EDICION-"+a.id},user.id,tx);
  const [codigoEditado]=await tx.select().from(actActivos).where(eq(actActivos.id,a.id));assert.equal(codigoEditado!.codigo,"PRUEBA-EDICION-"+a.id.toUpperCase());
  assert.deepEqual(await tx.select({hash:actActas.pdfSha256}).from(actActas),actas);
  const [fuenteDespues]=await tx.select().from(actFilasImportadas).where(eq(actFilasImportadas.id,a.filaOrigenId));assert.deepEqual(fuenteDespues,fuente);
  const logs=await tx.select().from(auditLogs).where(eq(auditLogs.entityId,a.id));assert(logs.some(l=>l.action==="editar_activo"));assert.deepEqual(datosEditables(despues),{codigo:a.codigo,descripcion:entrada.descripcion,estado:entrada.estado,observaciones:entrada.observaciones});
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 console.log("Edición, conflicto concurrente, código duplicado, validación de estado, auditoría y conservación de PDF/Excel: OK. Prueba revertida.");
 await db.execute(sql`select 1`);
}
main().finally(()=>pool.end());
