import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq,sql } from "drizzle-orm";
import { db,pool,schema } from "@/db";
import { actProcedencias,actActas,actActivos } from "@/db/schema/activos.schema";
import { guardarProcedenciaServicio,eliminarProcedenciaServicio } from "../procedencias-servicio";
import { seriesCodigosActivo } from "../activo-codigos";
import { registrarActivoManual } from "../activo-nuevo-servicio";
import { nuevoActivoSchema } from "../activo-nuevo-modelo";
import { registrarActa } from "../actas-servicio";
import { guardarActaSchema,referenciaActa } from "../actas-modelo";
import { hoyBolivia } from "../asignaciones-modelo";
async function main(){
 const [user]=await db.select().from(schema.users).where(eq(schema.users.email,"admin@agbc.local"));assert(user);
 const antes=await db.execute(sql`select (select count(*) from act_activos) activos,(select count(*) from act_actas) actas,(select count(*) from act_procedencias) procedencias`);
 const rollback=new Error("ROLLBACK_PRUEBA");
 try{await db.transaction(async tx=>{
  const nueva=await guardarProcedenciaServicio({clave:null,nombre:"Procedencia de prueba "+randomUUID().slice(0,8)},user.id,tx);
  let [p]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,nueva.clave));assert(p);
  await assert.rejects(()=>guardarProcedenciaServicio({clave:null,nombre:p!.nombre},user.id,tx),/Ya existe/);
  const series=await seriesCodigosActivo(p.clave,tx);assert.equal(series.length,1);assert.equal(series[0]!.siguiente,p.prefijo+"0001");
  const activo=await registrarActivoManual(nuevoActivoSchema.parse({solicitudId:randomUUID(),serie:p.prefijo,codigo:"",descripcion:"Escritorio de prueba revertida",categoria:"muebles",origen:p.clave,estado:"BUENO",regional:"La Paz",ubicacion:"Depósito de prueba",responsableId:null,observaciones:"Prueba"}),user.id,tx);
  const [a]=await tx.select().from(actActivos).where(eq(actActivos.id,activo.id));assert.equal(a!.origen,p.clave);assert.equal(a!.codigo,p.prefijo+"0001");assert.equal((await seriesCodigosActivo(p.clave,tx))[0]!.siguiente,p.prefijo+"0002");
  await assert.rejects(()=>eliminarProcedenciaServicio(p!.clave,p!.version,user.id,tx),/activos o actas/);
  const [anterior]=await tx.select().from(actActas).limit(1);assert(anterior);
  const input=guardarActaSchema.parse({solicitudId:randomUUID(),tipo:"fija",cabecera:{...anterior.cabecera,entidad:p.clave,procedenciaNombre:"Nombre no confiable",fecha:hoyBolivia(),fechaDevolucion:null},bienes:[{activoId:null,codigo:"MANUAL-PRUEBA",descripcion:"Mesa de prueba para catálogo",placa:"",estado:"BUENO",observaciones:"",accesorios:"",asignacionEsperada:null,fijaEsperada:null}]});
  const acta=await registrarActa(input,{userId:user.id},tx);const [d]=await tx.select().from(actActas).where(eq(actActas.id,acta.id));assert(d);assert.equal(d.numero,1);assert.equal(d.cabecera.procedenciaNombre,p.nombre);assert(referenciaActa(d).includes(p.nombre));assert.equal((await registrarActa(input,{userId:user.id},tx)).id,d.id);
  const pdfAntes=d.pdfSha256,nombreAnterior=p.nombre;await guardarProcedenciaServicio({clave:p.clave,version:p.version,nombre:p.nombre+" EDITADA"},user.id,tx);[p]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,nueva.clave));assert(p!.nombre.endsWith("EDITADA"));const [historica]=await tx.select().from(actActas).where(eq(actActas.id,d.id));assert.equal(historica!.pdfSha256,pdfAntes);assert.equal(historica!.cabecera.procedenciaNombre,nombreAnterior);
  const vacia=await guardarProcedenciaServicio({clave:null,nombre:"Sin uso "+randomUUID().slice(0,8)},user.id,tx);await eliminarProcedenciaServicio(vacia.clave,1,user.id,tx);const [baja]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,vacia.clave));assert.equal(baja!.activa,false);const restaurada=await guardarProcedenciaServicio({clave:null,nombre:baja!.nombre},user.id,tx);assert.equal(restaurada.clave,vacia.clave);
  await assert.rejects(()=>eliminarProcedenciaServicio("AGBC",1,user.id,tx),/activos o actas/);
  console.log(JSON.stringify({alta:true,edicion:true,duplicadosBloqueados:true,codigoAutomatico:true,actaConProcedenciaNueva:true,correlativoDesdeUno:true,pdfHistoricoConservado:true,eliminacionSinUso:true,eliminacionConDatosBloqueada:true,pruebaRevertida:true}));throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 const despues=await db.execute(sql`select (select count(*) from act_activos) activos,(select count(*) from act_actas) actas,(select count(*) from act_procedencias) procedencias`);assert.deepEqual(antes.rows,despues.rows);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
