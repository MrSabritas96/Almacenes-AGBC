import { createHash, randomUUID } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { actActas, actActaBienes, actActivos, actAsignaciones, actCustodiaActual } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { AsignacionError, hoyBolivia } from "./asignaciones-modelo";
import { registrarAsignacion, registrarDevolucion } from "./asignaciones-servicio";
import { generarActaPdf } from "./actas-pdf";
import { referenciaActa, type ActaBien, type GuardarActa } from "./actas-modelo";

type Contexto={userId:string;ipAddress?:string|null;userAgent?:string|null};
export async function registrarActa(input:GuardarActa,ctx:Contexto,database:typeof db=db){
  if(input.cabecera.fecha>hoyBolivia())throw new AsignacionError("La fecha de la operación no puede ser futura.");
  const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return database.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.solicitudId}))`);
    const [existing]=await tx.select({id:actActas.id,hash:actActas.solicitudHash,user:actActas.creadoPor}).from(actActas).where(eq(actActas.solicitudId,input.solicitudId));
    if(existing){if(existing.hash!==hash||existing.user!==ctx.userId)throw new AsignacionError("La solicitud ya fue usada. Actualiza el formulario.");return {id:existing.id};}
    const ids=input.bienes.map(b=>b.activoId).sort();
    await tx.select({id:actActivos.id}).from(actActivos).where(inArray(actActivos.id,ids)).orderBy(asc(actActivos.id)).for("update");
    const current=await tx.select().from(actCustodiaActual).where(inArray(actCustodiaActual.id,ids));
    if(current.length!==ids.length)throw new AsignacionError("Uno de los bienes ya no pertenece al inventario vigente.");
    const id=randomUUID();const serial=await tx.execute<{numero:number}>(sql`SELECT nextval(pg_get_serial_sequence('act_actas','numero'))::int AS numero`);
    const numero=serial.rows[0]!.numero;const referencia=referenciaActa({numero,tipo:input.tipo,cabecera:input.cabecera});
    const snapshots:ActaBien[]=[];const movimientos:{activoId:string;asignacionId:string|null}[]=[];
    for(const b of input.bienes){
      const record=current.find(a=>a.id===b.activoId)!;
      if((record.asignacionId??null)!==b.asignacionEsperada)throw new AsignacionError(`La custodia de ${record.codigo||"un bien"} cambió. Busca nuevamente el bien.`);
      snapshots.push({activoId:b.activoId,codigo:record.codigo,descripcion:record.descripcion,origen:record.origen,placa:b.placa,estado:b.estado,observaciones:b.observaciones,accesorios:b.accesorios});
      let movimientoId:string|null=null;
      if(input.tipo!=="devolucion"){
        const result=await registrarAsignacion({solicitudId:randomUUID(),activoId:b.activoId,asignacionFijaEsperada:b.fijaEsperada,tipo:input.tipo,responsableDestino:input.cabecera.responsable,ubicacionDestino:input.cabecera.ubicacionDestino,fechaInicio:input.cabecera.fecha,fechaDevolucionPrevista:input.cabecera.fechaDevolucion,motivo:input.cabecera.motivo,referenciaActa:referencia},ctx,tx);
        movimientoId=result.id;
      }else{
        if(record.asignacionId){
          await registrarDevolucion({asignacionId:record.asignacionId,fechaCierre:input.cabecera.fecha,motivoCierre:`${referencia}: ${input.cabecera.motivo}`},ctx,tx);movimientoId=record.asignacionId;
        }
        // Una momentánea vuelve a su fija. En los demás casos se registra la custodia de recepción.
        if(record.asignacionTipo!=="momentanea"){
          const recepcion=await registrarAsignacion({solicitudId:randomUUID(),activoId:b.activoId,asignacionFijaEsperada:null,tipo:"fija",responsableDestino:input.cabecera.recibidoPor,ubicacionDestino:input.cabecera.ubicacionDestino,fechaInicio:input.cabecera.fecha,fechaDevolucionPrevista:null,motivo:`Recepción por devolución: ${input.cabecera.motivo}`,referenciaActa:referencia},ctx,tx);
          movimientoId=recepcion.id;
        }
      }
      movimientos.push({activoId:b.activoId,asignacionId:movimientoId});
    }
    const pdf=await generarActaPdf({id,numero,tipo:input.tipo,cabecera:input.cabecera,bienes:snapshots});
    await tx.insert(actActas).values({id,solicitudId:input.solicitudId,solicitudHash:hash,numero,tipo:input.tipo,fecha:input.cabecera.fecha,cabecera:input.cabecera,bienes:snapshots,documentoPdf:pdf,pdfSha256:createHash("sha256").update(pdf).digest("hex"),creadoPor:ctx.userId});
    await tx.insert(actActaBienes).values(movimientos.map(m=>({...m,actaId:id})));
    await tx.insert(auditLogs).values({userId:ctx.userId,module:"activos",action:"emitir_acta",entity:"act_actas",entityId:id,ipAddress:ctx.ipAddress,userAgent:ctx.userAgent,details:{tipo:input.tipo,referencia,activoIds:ids,cantidad:ids.length}});
    return {id};
  });
}

export async function buscarBienesActa(q:string){
  const pattern=`%${q.trim().slice(0,200).replace(/[\\%_]/g,"\\$&")}%`;
  const rows=await db.select({id:actCustodiaActual.id,codigo:actCustodiaActual.codigo,descripcion:actCustodiaActual.descripcion,origen:actCustodiaActual.origen,estado:actCustodiaActual.estado,responsable:actCustodiaActual.responsable,ubicacion:actCustodiaActual.ubicacion,asignacionId:actCustodiaActual.asignacionId,asignacionTipo:actCustodiaActual.asignacionTipo,retornoResponsable:actAsignaciones.responsableAnterior,retornoUbicacion:actAsignaciones.ubicacionAnterior})
    .from(actCustodiaActual).leftJoin(actAsignaciones,eq(actAsignaciones.id,actCustodiaActual.asignacionId))
    .where(sql`(${actCustodiaActual.codigo} ILIKE ${pattern} OR ${actCustodiaActual.descripcion} ILIKE ${pattern} OR ${actCustodiaActual.responsable} ILIKE ${pattern})`)
    .orderBy(asc(actCustodiaActual.origen),asc(actCustodiaActual.filaExcel)).limit(25);
  return rows.map(r=>({...r,fijaEsperada:r.asignacionTipo==="fija"?r.asignacionId:null}));
}
export type BienSeleccionable=Awaited<ReturnType<typeof buscarBienesActa>>[number];

export async function fichaActa(id:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
  const [a]=await db.select({id:actActas.id,numero:actActas.numero,tipo:actActas.tipo,cabecera:actActas.cabecera,bienes:actActas.bienes,fecha:actActas.fecha}).from(actActas).where(eq(actActas.id,id));return a??null;
}
