import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq,isNull,sql } from "drizzle-orm";
import { db,pool,schema } from "@/db";
import { actActas,actDocumentosArchivo,actCustodiaActual,actAsignaciones } from "@/db/schema/activos.schema";
import { prepararDevolucion,prepararDevolucionConjunta } from "../devolucion-desde-acta-servicio";
import { registrarActa } from "../actas-servicio";
import { guardarActaSchema } from "../actas-modelo";
import { hoyBolivia } from "../asignaciones-modelo";
import { oficinaRegional,ciudadRegional,FIRMANTE_ACTIVOS,CARGO_ACTIVOS } from "../actas-plantilla";
async function main(){
 const [user]=await db.select().from(schema.users).where(eq(schema.users.email,"admin@agbc.local"));assert(user);const hoy=hoyBolivia();const rollback=new Error("REVERTIR");
 try{await db.transaction(async tx=>{
  const [excel]=await tx.select().from(actDocumentosArchivo).where(sql`${actDocumentosArchivo.numero} like '%049%' and ${actDocumentosArchivo.eliminadoEn} is null and ${actDocumentosArchivo.tipo} in ('asignacion','actualizacion')`).limit(1);assert(excel);
  const ex=await prepararDevolucion(excel.id,"excel",tx);assert.equal(ex.bienes.length,excel.documento.bienes.length);assert.equal(ex.bienes[0]!.descripcion,excel.documento.bienes[0]!.descripcion);assert.equal(ex.bienes[0]!.observaciones,excel.documento.bienes[0]!.observaciones);assert.equal(ex.datos.entidad,excel.procedencia);
  const [bien]=await tx.select().from(actCustodiaActual).where(sql`${actCustodiaActual.origen}='AGBC' and ${actCustodiaActual.asignacionId} is null`).limit(1);assert(bien);
  const cabecera={formato:"institucional-2026",regional:"La Paz",piso:"Piso mezzanine",responsable:"RESPONSABLE PRUEBA DEVOLUCION",cargo:"ENCARGADO DE PRUEBA",ci:"",entidad:"AGBC",ciudad:"La Paz",oficina:oficinaRegional("La Paz","Piso mezzanine"),ubicacionDestino:"Oficina de prueba",fecha:hoy,fechaDevolucion:null,motivo:"Asignación de prueba revertida",entregadoPor:FIRMANTE_ACTIVOS,cargoEntrega:CARGO_ACTIVOS,ciEntrega:"",recibidoPor:"RESPONSABLE PRUEBA DEVOLUCION",cargoRecepcion:"ENCARGADO DE PRUEBA",ciRecepcion:"",observacionesGenerales:""};
  const origen=await registrarActa(guardarActaSchema.parse({solicitudId:randomUUID(),tipo:"fija",cabecera,bienes:[{activoId:bien.id,codigo:bien.codigo,descripcion:bien.descripcion,estado:"BUENO",placa:"",observaciones:"Observación conservada",accesorios:"Accesorio de prueba",asignacionEsperada:null,fijaEsperada:null},{activoId:null,codigo:"MANUAL-PRUEBA",descripcion:"Bien documental de prueba",estado:"REGULAR",placa:"",observaciones:"Nota manual",accesorios:"",asignacionEsperada:null,fijaEsperada:null}]}),{userId:user.id},tx);
  const [source]=await tx.select().from(actActas).where(eq(actActas.id,origen.id));assert(source);
  const draft=await prepararDevolucion(origen.id,"sistema",tx);assert.equal(draft.bienes.length,2);assert.equal(draft.bienes[0]!.activoId,bien.id);assert(draft.bienes[0]!.asignacionEsperada);assert.equal(draft.bienes[0]!.observaciones,"Observación conservada");assert.equal(draft.bienes[0]!.accesorios,"Accesorio de prueba");assert.equal(draft.bienes[1]!.activoId,null);
  const segunda=await registrarActa(guardarActaSchema.parse({solicitudId:randomUUID(),tipo:"fija",cabecera,bienes:[{activoId:null,codigo:"MANUAL-PRUEBA",descripcion:"Bien documental de prueba",estado:"MALO",placa:"",observaciones:"Otra nota manual",accesorios:"Cable",asignacionEsperada:null,fijaEsperada:null},{activoId:null,codigo:"CONJUNTA-PRUEBA",descripcion:"Otro bien para la devolución conjunta",estado:"BUENO",placa:"",observaciones:"",accesorios:"",asignacionEsperada:null,fijaEsperada:null}]}),{userId:user.id},tx);
  const seleccion=[{id:origen.id,fuente:"sistema" as const},{id:segunda.id,fuente:"sistema" as const}];const unica=await prepararDevolucionConjunta([seleccion[0]],tx);assert.equal(unica.bienes.length,2);
  const conjunta=await prepararDevolucionConjunta(seleccion,tx);assert.equal(conjunta.bienes.length,3);const duplicada=conjunta.bienes.find(b=>b.codigo==="MANUAL-PRUEBA")!;assert(duplicada.observaciones.includes("Nota manual"));assert(duplicada.observaciones.includes("Otra nota manual"));assert.equal(duplicada.estado,"");assert(conjunta.avisos.some(a=>a.includes("estados diferentes")));
  await assert.rejects(()=>prepararDevolucionConjunta([seleccion[0],seleccion[0]],tx),/repetidas/);
  const otro=await registrarActa(guardarActaSchema.parse({solicitudId:randomUUID(),tipo:"fija",cabecera:{...cabecera,responsable:"OTRA PERSONA DE PRUEBA"},bienes:[{...conjunta.bienes[2],activoId:null,asignacionEsperada:null,fijaEsperada:null}]}),{userId:user.id},tx);
  await assert.rejects(()=>prepararDevolucionConjunta([seleccion[0],{id:otro.id,fuente:"sistema"}],tx),/mismo responsable/);
  const input=guardarActaSchema.parse({solicitudId:randomUUID(),tipo:"devolucion",cabecera:{...cabecera,...draft.datos,fecha:hoy,ciudad:ciudadRegional(draft.datos.regional)},bienes:draft.bienes});
  const dev=await registrarActa(input,{userId:user.id},tx);const [retorno]=await tx.select().from(actActas).where(eq(actActas.id,dev.id));assert(retorno);assert.equal(retorno.tipo,"devolucion");assert.equal(retorno.bienes.length,2);assert.equal((await tx.select().from(actAsignaciones).where(eq(actAsignaciones.id,draft.bienes[0]!.asignacionEsperada!)))[0]!.estado,"devuelta");
  const [conservado]=await tx.select().from(actActas).where(eq(actActas.id,source.id));assert.equal(conservado!.pdfSha256,source.pdfSha256);assert.deepEqual(conservado!.bienes,source.bienes);
  await assert.rejects(()=>prepararDevolucion(dev.id,"sistema",tx),/asignación/);
  const repetida=await prepararDevolucion(origen.id,"sistema",tx);assert.equal(repetida.bienes[0]!.activoId,null);assert(repetida.avisos.length);
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 console.log("Excel completo, devolución automática desde sistema, filas manuales, custodia, PDF original y bloqueo de vínculos antiguos: OK. Prueba revertida.");
}
main().finally(()=>pool.end());
