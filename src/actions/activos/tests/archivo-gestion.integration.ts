import "dotenv/config";
import assert from "node:assert/strict";
import { eq,sql } from "drizzle-orm";
import { db,pool,schema } from "@/db";
import { actDocumentosArchivo as actas,actArchivoPdf as pdfs } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { cambiarArchivo,cambiarEstadoArchivo } from "../archivo-gestion-servicio";
import { cambioArchivoSchema } from "../archivo-gestion-modelo";
import { siguienteNumeroActa } from "../actas-correlativos";
async function main(){
 const [user]=await db.select().from(schema.users).where(eq(schema.users.email,"admin@agbc.local"));assert(user);
 const rollback=new Error("ROLLBACK_PRUEBA");
 const before=(await db.execute<{n:number}>(sql`select count(*)::int n from act_documentos_archivo where eliminado_en is null`)).rows[0]!.n;
 try{await db.transaction(async tx=>{
  const [r]=await tx.select({a:actas,p:pdfs}).from(actas).innerJoin(pdfs,eq(pdfs.documentoId,actas.id)).where(eq(actas.procedencia,"PACTA")).limit(1);assert(r&&r.p.pdfOriginal);
  const next=await siguienteNumeroActa("PACTA",2026,"asignacion",tx);
  const data=cambioArchivoSchema.parse({id:r.a.id,version:r.a.version,numero:"999 PACTA/2026",tipo:"asignacion",procedencia:"PACTA",responsableId:r.a.responsableId,fecha:"2026-10-21",regional:"Cochabamba"});
  await cambiarArchivo(data,user.id,tx);
  let [a]=await tx.select().from(actas).where(eq(actas.id,r.a.id));assert(a);assert.equal(a.version,r.a.version+1);assert.equal(a.numero,"999 PACTA/2026");assert.deepEqual(a.documento,r.a.documento);
  let [p]=await tx.select().from(pdfs).where(eq(pdfs.documentoId,r.a.id));assert(p);assert(p.pdfOriginal!.equals(r.p.pdfOriginal));assert.equal(p.regional,"Cochabamba");assert.equal(p.pdfSha256,r.p.pdfSha256);
  assert.equal(await siguienteNumeroActa("PACTA",2026,"asignacion",tx),1000);
  await assert.rejects(()=>cambiarArchivo(data,user.id,tx),/cambió/);
  const logs=await tx.select().from(auditLogs).where(eq(auditLogs.entityId,r.a.id));assert(logs.some(l=>l.action==="editar_acta_archivo"));
  await cambiarEstadoArchivo({id:a.id,version:a.version,restaurar:false},user.id,tx);
  [a]=await tx.select().from(actas).where(eq(actas.id,r.a.id));assert(a?.eliminadoEn);assert.equal((await tx.execute<{n:number}>(sql`select count(*)::int n from act_documentos_archivo where eliminado_en is null`)).rows[0]!.n,before-1);
  assert.equal(await siguienteNumeroActa("PACTA",2026,"asignacion",tx),1000);
  await assert.rejects(()=>cambiarEstadoArchivo({id:a!.id,version:r.a.version,restaurar:true},user.id,tx),/cambió/);
  await cambiarEstadoArchivo({id:a.id,version:a.version,restaurar:true},user.id,tx);
  [a]=await tx.select().from(actas).where(eq(actas.id,r.a.id));assert.equal(a!.eliminadoEn,null);
  [p]=await tx.select().from(pdfs).where(eq(pdfs.documentoId,r.a.id));assert(p!.pdfOriginal!.equals(r.p.pdfOriginal));
  assert(next>0);throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 assert.equal((await db.execute<{n:number}>(sql`select count(*)::int n from act_documentos_archivo where eliminado_en is null`)).rows[0]!.n,before);
 console.log(JSON.stringify({editar:true,papelera:true,restaurar:true,pdfYTranscripcionSinCambios:true,conflictosConcurrentesProtegidos:true,correlativoSinReutilizarEliminados:true,auditoria:true,pruebasRevertidas:true,actasVigentes:before}));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
