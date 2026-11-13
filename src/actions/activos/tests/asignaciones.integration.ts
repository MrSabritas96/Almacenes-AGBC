import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, pool, schema } from "@/db";
import { actImportaciones, actHojasImportadas, actFilasImportadas, actActivos, actAsignaciones, actCustodiaActual } from "@/db/schema/activos.schema";
import { registrarAsignacion, registrarDevolucion } from "@/actions/activos/asignaciones-servicio";
import { nuevaAsignacionSchema, devolucionAsignacionSchema, hoyBolivia, type NuevaAsignacion } from "@/actions/activos/asignaciones-modelo";

async function main() {
  const hoy = hoyBolivia();
  const plus = (days: number) => {const d = new Date(hoy + "T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.email, "admin@agbc.local"));
  assert(admin);
  const actor={userId:admin.id};
  const ids={importacion:randomUUID(),hoja:randomUUID(),fila:randomUUID(),activo:randomUUID()};
  const bytes=Buffer.from(`PRUEBA AUTOMATICA DE ASIGNACIONES ${ids.activo}`);
  await db.transaction(async tx=>{
    await tx.insert(actImportaciones).values({id:ids.importacion,archivoNombre:"PRUEBA-AUTOMATICA-NO-INVENTARIO.xlsx",archivoSha256:createHash("sha256").update(bytes).digest("hex"),archivoOriginal:bytes,resumen:{prueba:true}});
    await tx.insert(actHojasImportadas).values({id:ids.hoja,importacionId:ids.importacion,nombre:"PRUEBA AUTOMATICA",orden:999,tipo:"prueba",vigencia:"vigente",filasConDatos:1,registrosActivos:1});
    await tx.insert(actFilasImportadas).values({id:ids.fila,hojaId:ids.hoja,filaExcel:1,celdas:{prueba:true}});
    await tx.insert(actActivos).values({id:ids.activo,filaOrigenId:ids.fila,origen:"PRUEBA AUTOMATICA",codigo:"PRUEBA-ASIGNACIONES",descripcion:"Registro de prueba temporal, ajeno al inventario real",responsable:"ORIGEN PRUEBA",ubicacion:"UBICACION ORIGEN PRUEBA"});
  });
  const make = (tipo: "fija"|"momentanea", fija: string|null, receptor:string): NuevaAsignacion => nuevaAsignacionSchema.parse({solicitudId:randomUUID(),activoId:ids.activo,asignacionFijaEsperada:fija,tipo,responsableDestino:receptor,ubicacionDestino:"DESTINO PRUEBA",fechaInicio:hoy,fechaDevolucionPrevista:tipo==="momentanea"?plus(7):null,motivo:"PRUEBA AUTOMATICA AISLADA",referenciaActa:null});
  const custodia=async()=>{const[r]=await db.select().from(actCustodiaActual).where(eq(actCustodiaActual.id,ids.activo));assert(r);return r;};
  const close=async(id:string)=>registrarDevolucion(devolucionAsignacionSchema.parse({asignacionId:id,fechaCierre:hoy,motivoCierre:"DEVOLUCION DE PRUEBA AUTOMATICA"}),actor);
  try {
    assert.equal((await custodia()).responsable,"ORIGEN PRUEBA");
    const inputF1=make("fija",null,"FIJO PRUEBA UNO");
    const f1=await registrarAsignacion(inputF1,actor);assert.equal((await custodia()).responsable,"FIJO PRUEBA UNO");
    assert.equal((await registrarAsignacion(inputF1,actor)).id,f1.id);
    await assert.rejects(()=>registrarAsignacion({...inputF1,responsableDestino:"OTRO RECEPTOR"},actor));
    const m1=await registrarAsignacion(make("momentanea",f1.id,"TEMPORAL PRUEBA"),actor);assert.equal((await custodia()).responsable,"TEMPORAL PRUEBA");
    await assert.rejects(()=>registrarAsignacion(make("momentanea",f1.id,"OTRA TEMPORAL"),actor));
    await assert.rejects(()=>registrarAsignacion(make("fija",f1.id,"OTRA FIJA"),actor));
    await assert.rejects(()=>close(f1.id));
    await close(m1.id);assert.equal((await custodia()).responsable,"FIJO PRUEBA UNO");
    await close(m1.id);
    const f2=await registrarAsignacion(make("fija",f1.id,"FIJO PRUEBA DOS"),actor);
    const[previous]=await db.select().from(actAsignaciones).where(eq(actAsignaciones.id,f1.id));assert.equal(previous?.estado,"reemplazada");
    assert.equal((await custodia()).responsable,"FIJO PRUEBA DOS");
    await assert.rejects(()=>registrarAsignacion(make("fija",f1.id,"FORMULARIO DESACTUALIZADO"),actor));
    await close(f2.id);assert.equal((await custodia()).responsable,"ORIGEN PRUEBA");
    const races=await Promise.allSettled([registrarAsignacion(make("momentanea",null,"CARRERA PRUEBA UNO"),actor),registrarAsignacion(make("momentanea",null,"CARRERA PRUEBA DOS"),actor)]);
    assert.equal(races.filter(r=>r.status==="fulfilled").length,1);assert.equal(races.filter(r=>r.status==="rejected").length,1);
    const winner=races.find(r=>r.status==="fulfilled");assert(winner?.status==="fulfilled");
    await assert.rejects(()=>db.insert(actAsignaciones).values({solicitudId:randomUUID(),activoId:ids.activo,tipo:"momentanea",responsableDestino:"DUPLICADA PRUEBA",ubicacionDestino:"DESTINO",fechaInicio:hoy,fechaDevolucionPrevista:plus(1),motivo:"PRUEBA INDICE UNICO",creadoPor:admin.id}));
    await close(winner.value.id);assert.equal((await custodia()).responsable,"ORIGEN PRUEBA");
    await assert.rejects(()=>db.insert(actAsignaciones).values({solicitudId:randomUUID(),activoId:ids.activo,tipo:"momentanea",responsableDestino:"SIN PLAZO PRUEBA",ubicacionDestino:"DESTINO",fechaInicio:hoy,motivo:"PRUEBA RESTRICCION PLAZO",creadoPor:admin.id}));
    assert.equal(nuevaAsignacionSchema.safeParse({...make("momentanea",null,"PRUEBA"),fechaDevolucionPrevista:null}).success,false);
    assert.equal(nuevaAsignacionSchema.safeParse({...make("momentanea",null,"PRUEBA"),fechaInicio:"2026-02-30"}).success,false);
    await assert.rejects(()=>registrarAsignacion({...make("momentanea",null,"PRUEBA"),fechaInicio:plus(1)},actor));
    await assert.rejects(()=>registrarAsignacion({...make("momentanea",null,"PRUEBA"),fechaDevolucionPrevista:plus(-1)},actor));
    const [expired]=await db.insert(actAsignaciones).values({solicitudId:randomUUID(),activoId:ids.activo,tipo:"momentanea",responsableDestino:"VENCIDA PRUEBA",ubicacionDestino:"DESTINO VENCIDO",fechaInicio:plus(-3),fechaDevolucionPrevista:plus(-1),motivo:"PRUEBA DE VENCIMIENTO",creadoPor:admin.id}).returning();assert(expired);
    assert.equal((await custodia()).responsable,"VENCIDA PRUEBA");
    const [overdue]=await db.select({n:sql<number>`count(*)::int`}).from(actAsignaciones).where(and(eq(actAsignaciones.activoId,ids.activo),eq(actAsignaciones.estado,"activa"),sql`${actAsignaciones.fechaDevolucionPrevista}<${hoy}`));assert.equal(overdue?.n,1);
    await close(expired.id);assert.equal((await custodia()).responsable,"ORIGEN PRUEBA");
    await db.update(actHojasImportadas).set({vigencia:"historico"}).where(eq(actHojasImportadas.id,ids.hoja));
    await assert.rejects(()=>registrarAsignacion(make("fija",null,"BIEN NO VIGENTE"),actor));
    const[original]=await db.select().from(actActivos).where(eq(actActivos.id,ids.activo));assert.equal(original?.responsable,"ORIGEN PRUEBA");assert.equal(original?.ubicacion,"UBICACION ORIGEN PRUEBA");
    const [audits]=await db.select({n:sql<number>`count(*)::int`}).from(schema.auditLogs).where(and(eq(schema.auditLogs.module,"activos"),sql`${schema.auditLogs.details}->>'activoId'=${ids.activo}`));assert.equal(audits?.n,8);
    console.log(JSON.stringify({cicloFijaMomentaneaDevolucion:true,retornoSinFija:true,reemplazoConHistorial:true,solicitudIdempotente:true,bloqueoMientrasMomentanea:true,carreraConcurrenteControlada:true,restriccionesBD:true,fechasValidadas:true,vencidaNoDevueltaAutomaticamente:true,soloInventarioVigente:true,datosExcelIntactos:true,auditoriaAtomica:true}));
  } finally {
    // Solo se eliminan las filas creadas para esta prueba, por sus UUID recién generados.
    await db.transaction(async tx=>{
      await tx.delete(schema.auditLogs).where(and(eq(schema.auditLogs.module,"activos"),sql`${schema.auditLogs.details}->>'activoId'=${ids.activo}`));
      await tx.delete(actAsignaciones).where(eq(actAsignaciones.activoId,ids.activo));
      await tx.delete(actActivos).where(eq(actActivos.id,ids.activo));
      await tx.delete(actFilasImportadas).where(eq(actFilasImportadas.id,ids.fila));
      await tx.delete(actHojasImportadas).where(eq(actHojasImportadas.id,ids.hoja));
      await tx.delete(actImportaciones).where(eq(actImportaciones.id,ids.importacion));
    });
  }
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>pool.end());
