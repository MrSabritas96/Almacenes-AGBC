import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID,createHash } from "node:crypto";
import { writeFileSync,mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq,and,sql } from "drizzle-orm";
import { db,pool,schema } from "@/db";
import { actActas,actActivos,actAsignaciones,actCustodiaActual,actImportaciones,actHojasImportadas,actFilasImportadas } from "@/db/schema/activos.schema";
import { registrarActa } from "@/actions/activos/actas-servicio";
import { generarActaPdf } from "@/actions/activos/actas-pdf";
import { guardarActaSchema,type GuardarActa,type DocumentoActa } from "@/actions/activos/actas-modelo";
import { hoyBolivia } from "@/actions/activos/asignaciones-modelo";

async function main(){
 const qaDir=mkdtempSync(join(tmpdir(),"agbc-actas-qa-"));
 const [user]=await db.select().from(schema.users).where(eq(schema.users.email,"admin@agbc.local"));assert(user);
 const ctx={userId:user.id};const hoy=hoyBolivia();const due=new Date(hoy+"T00:00:00Z");due.setUTCDate(due.getUTCDate()+7);
 const rollback=new Error("ROLLBACK_PRUEBA_EXITOSA");
 try{await db.transaction(async tx=>{
   const source=randomUUID(),hoja=randomUUID(),ids=[randomUUID(),randomUUID(),randomUUID()];const bytes=Buffer.from(source);
   await tx.insert(actImportaciones).values({id:source,archivoNombre:"PRUEBA DE ACTAS",archivoSha256:createHash("sha256").update(bytes).digest("hex"),archivoOriginal:bytes,resumen:{prueba:true}});
   await tx.insert(actHojasImportadas).values({id:hoja,importacionId:source,nombre:"PRUEBA DE ACTAS",orden:999,tipo:"prueba",vigencia:"vigente",filasConDatos:3,registrosActivos:3});
   for(const[i,id]of ids.entries()){const fila=randomUUID();await tx.insert(actFilasImportadas).values({id:fila,hojaId:hoja,filaExcel:i+1,celdas:{prueba:true}});await tx.insert(actActivos).values({id,filaOrigenId:fila,origen:"PRUEBA DE ACTAS",codigo:`PRUEBA-PDF-${i+1}`,descripcion:`Computadora portátil de prueba ${i+1}, conservación de símbolos y acentos: ñ, á, ó.`,estado:"BUENO",responsable:"RESPONSABLE ORIGEN PRUEBA",ubicacion:"OFICINA ORIGEN PRUEBA"});}
   const make=async(tipo:GuardarActa["tipo"],selected:string[],owner:string,receiver=owner)=>{
     const bienes=[];for(const id of selected){const [r]=await tx.select().from(actCustodiaActual).where(eq(actCustodiaActual.id,id));assert(r);const[fija]=await tx.select().from(actAsignaciones).where(and(eq(actAsignaciones.activoId,id),eq(actAsignaciones.tipo,"fija"),eq(actAsignaciones.estado,"activa")));bienes.push({activoId:id,asignacionEsperada:r.asignacionId,fijaEsperada:fija?.id??null,placa:"",estado:"BUENO",observaciones:"Equipo verificado; teclado y pantalla completos.",accesorios:"Cargador y funda de transporte."});}
     return guardarActaSchema.parse({solicitudId:randomUUID(),tipo,cabecera:{responsable:owner,cargo:"ENCARGADO DE PRUEBA",ci:"123456 PRUEBA",entidad:"AGBC",ciudad:"La Paz",oficina:"Oficina de prueba",ubicacionDestino:"DESTINO DE PRUEBA",fecha:hoy,fechaDevolucion:tipo==="momentanea"?due.toISOString().slice(0,10):null,motivo:"PRUEBA CONTROLADA DE FORMULARIO Y PDF",entregadoPor:"ENTREGA PRUEBA",cargoEntrega:"ACTIVOS FIJOS",ciEntrega:"",recibidoPor:receiver,cargoRecepcion:"RECEPCIÓN PRUEBA",ciRecepcion:"",observacionesGenerales:"Documento de prueba, no pertenece al inventario real."},bienes});
   };
   const input=await make("fija",ids.slice(0,2),"RESPONSABLE FIJO PRUEBA");const fijo=await registrarActa(input,ctx,tx);
   const [saved]=await tx.select().from(actActas).where(eq(actActas.id,fijo.id));assert(saved);assert(saved.documentoPdf.toString("ascii",0,5)==="%PDF-");assert.equal(saved.bienes.length,2);
   writeFileSync(join(qaDir,"acta-fija-prueba.pdf"),saved.documentoPdf);
   assert.equal((await registrarActa(input,ctx,tx)).id,fijo.id);
   await assert.rejects(()=>registrarActa({...input,cabecera:{...input.cabecera,responsable:"SOLICITUD ALTERADA"}},ctx,tx));
   const temporalInput=await make("momentanea",[ids[0]!],"RESPONSABLE TEMPORAL PRUEBA");const temporal=await registrarActa(temporalInput,ctx,tx);
   const[tmpDoc]=await tx.select().from(actActas).where(eq(actActas.id,temporal.id));assert(tmpDoc);writeFileSync(join(qaDir,"acta-momentanea-prueba.pdf"),tmpDoc.documentoPdf);
   const dev=await registrarActa(await make("devolucion",[ids[0]!],"RESPONSABLE TEMPORAL PRUEBA","RESPONSABLE FIJO PRUEBA"),ctx,tx);
   const[devDoc]=await tx.select().from(actActas).where(eq(actActas.id,dev.id));assert(devDoc);writeFileSync(join(qaDir,"acta-devolucion-prueba.pdf"),devDoc.documentoPdf);
   const[actual]=await tx.select().from(actCustodiaActual).where(eq(actCustodiaActual.id,ids[0]!));assert.equal(actual?.responsable,"RESPONSABLE FIJO PRUEBA");
   await registrarActa(await make("momentanea",[ids[1]!],"SEGUNDA TEMPORAL PRUEBA"),ctx,tx);
   const before=(await tx.select({n:sql<number>`count(*)::int`}).from(actActas))[0]!.n;
   await assert.rejects(async()=>registrarActa(await make("fija",ids.slice(0,2),"NO DEBE CAMBIAR CUSTODIA"),ctx,tx));
   const[unchanged]=await tx.select().from(actCustodiaActual).where(eq(actCustodiaActual.id,ids[0]!));assert.equal(unchanged?.responsable,"RESPONSABLE FIJO PRUEBA");
   assert.equal((await tx.select({n:sql<number>`count(*)::int`}).from(actActas))[0]!.n,before);
   await registrarActa(await make("devolucion",[ids[2]!],"RESPONSABLE ORIGEN PRUEBA","RECEPCIÓN ACTIVOS FIJOS PRUEBA"),ctx,tx);
   const[reception]=await tx.select().from(actCustodiaActual).where(eq(actCustodiaActual.id,ids[2]!));assert.equal(reception?.responsable,"RECEPCIÓN ACTIVOS FIJOS PRUEBA");
   await tx.update(actActivos).set({descripcion:"DESCRIPCIÓN MODIFICADA EN PRUEBA"}).where(eq(actActivos.id,ids[0]!));
   const[immutable]=await tx.select().from(actActas).where(eq(actActas.id,fijo.id));assert(immutable?.documentoPdf.equals(saved.documentoPdf));assert.equal(immutable?.bienes[0]?.descripcion,saved.bienes[0]?.descripcion);
   const long:DocumentoActa={id:randomUUID(),numero:999999,tipo:"fija",cabecera:{...saved.cabecera,entregadoPor:"RESPONSABLE DE NOMBRE LARGO ".repeat(5),cargoEntrega:"CARGO DE PRUEBA ".repeat(8)},bienes:Array.from({length:8},(_,i)=>({...saved.bienes[0]!,activoId:randomUUID(),codigo:`PRUEBA-LARGA-${i}`,descripcion:"Descripción extensa del bien para comprobar saltos de página. ".repeat(12),observaciones:"Observación extensa de prueba para verificar que no se recorte el contenido. ".repeat(15)}))};
   writeFileSync(join(qaDir,"acta-larga-prueba.pdf"),await generarActaPdf(long));
   console.log(JSON.stringify({pdfsTresTipos:true,seleccionVariosBienes:true,datosYPdfGuardadosJuntos:true,idempotencia:true,custodiaRestaurada:true,devolucionOrigenExcel:true,falloParcialRevierteTodosLosBienes:true,pdfHistoricoInmutable:true,saltosDePagina:true,qaDir}));
   throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
