import { createHash, randomUUID } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { actActas, actActaBienes, actActivos, actAsignaciones, actCustodiaActual, actDocumentosArchivo, actGestionActiva, actProcedencias, actResponsables } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { AsignacionError, hoyBolivia } from "./asignaciones-modelo";
import { registrarAsignacion, registrarDevolucion } from "./asignaciones-servicio";
import { generarActaPdf } from "./actas-pdf";
import { referenciaActa, type ActaBien, type GuardarActa } from "./actas-modelo";
import { CARGO_ACTIVOS, FIRMANTE_ACTIVOS, ciudadRegional, oficinaRegional } from "./actas-plantilla";
import { siguienteNumeroActa } from "./actas-correlativos";

type Contexto={userId:string;ipAddress?:string|null;userAgent?:string|null};
const normalizar= (s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
export async function registrarActa(input:GuardarActa,ctx:Contexto,database:typeof db=db){
  if(input.cabecera.formato){
    const c=input.cabecera;
    const oficina=oficinaRegional(c.regional!,c.piso);
    const entregarAAlmacenes=input.tipo==="devolucion"&&c.recibirEnAlmacenes===true;
    input={...input,cabecera:{...c,ci:"",responsable:c.responsable.trim().toUpperCase(),cargo:c.cargo.trim().toUpperCase(),ciudad:ciudadRegional(c.regional!),oficina,ubicacionDestino:entregarAAlmacenes?"ALMACENES":oficina,motivo:input.tipo==="devolucion"?"Devolución de activos fijos según acta.":"Asignación de activos fijos según acta.",entregadoPor:input.tipo==="devolucion"?c.responsable:FIRMANTE_ACTIVOS,cargoEntrega:input.tipo==="devolucion"?c.cargo:CARGO_ACTIVOS,ciEntrega:"",recibidoPor:input.tipo==="devolucion"?(entregarAAlmacenes?"ALMACENES":FIRMANTE_ACTIVOS):c.responsable,cargoRecepcion:input.tipo==="devolucion"?(entregarAAlmacenes?"RESPONSABLE DE ALMACENES":CARGO_ACTIVOS):c.cargo,ciRecepcion:"",recibirEnAlmacenes:entregarAAlmacenes,observacionesGenerales:""}};
  }
  const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return database.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.solicitudId}))`);
    const [existing]=await tx.select({id:actActas.id,hash:actActas.solicitudHash,user:actActas.creadoPor}).from(actActas).where(eq(actActas.solicitudId,input.solicitudId));
    if(existing){if(existing.hash!==hash||existing.user!==ctx.userId)throw new AsignacionError("La solicitud ya fue usada. Actualiza el formulario.");return {id:existing.id};}
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('act-gestion-activa'))`);
    const [gestionActiva]=await tx.select({gestion:actGestionActiva.gestion}).from(actGestionActiva).limit(1);
    const gestionFecha=Number(input.cabecera.fecha.slice(0,4));
    if(!gestionActiva||gestionFecha!==gestionActiva.gestion)throw new AsignacionError(`La gestión habilitada es ${gestionActiva?.gestion??"no definida"}. Actualiza el formulario para emitir el acta del año vigente.`);
    const hoy=hoyBolivia();
    if(gestionFecha===Number(hoy.slice(0,4))&&input.cabecera.fecha>hoy)throw new AsignacionError("La fecha de la operación no puede ser futura.");
    if(input.cabecera.formato){const [procedencia]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,input.cabecera.entidad)).for("share");if(!procedencia?.activa)throw new AsignacionError("Selecciona una procedencia vigente.");input={...input,cabecera:{...input.cabecera,procedenciaNombre:procedencia.nombre}};}
    const actasOrigen=input.cabecera.actasOrigen??[];
    if(actasOrigen.length){
      if(input.tipo!=="devolucion"||new Set(actasOrigen.map(a=>a.fuente+":"+a.id)).size!==actasOrigen.length)throw new AsignacionError("Las actas de origen solo se pueden vincular una vez a una devolución.");
      const bienesDevueltos=input.bienes.map(b=>({id:b.activoId,codigos:(b.codigo||"").split("/").map(normalizar).filter(Boolean),descripcion:normalizar(b.descripcion||"")}));
      const filasOrigenes:{id:string|null;codigos:string[];descripcion:string}[]=[];
      const coincideBien=(fila:{id:string|null;codigos:string[];descripcion:string},bien:typeof bienesDevueltos[number])=>Boolean(fila.id&&bien.id===fila.id)||Boolean(fila.codigos.length&&fila.codigos.every(c=>bien.codigos.includes(c)))||Boolean(fila.descripcion&&fila.descripcion===bien.descripcion);
      for(const origen of actasOrigen){
        let proc:string|undefined,persona:string|undefined,filas:{id:string|null;codigos:string[];descripcion:string}[]=[];
        if(origen.fuente==="excel"){
          const [doc]=await tx.select().from(actDocumentosArchivo).where(eq(actDocumentosArchivo.id,origen.id));
          if(!doc||doc.eliminadoEn||!(["asignacion","actualizacion"].includes(doc.tipo)))throw new AsignacionError("Una asignación de origen ya no está disponible para devolución.");
          proc=doc.procedencia;
          const [catalogado]=doc.responsableId?await tx.select({nombre:actResponsables.nombre}).from(actResponsables).where(eq(actResponsables.id,doc.responsableId)):[];
          persona=catalogado?.nombre||doc.responsableOriginal;
          filas=doc.documento.bienes.map(b=>({id:b.vinculo==="exacto"&&b.coincidencias.length===1?b.coincidencias[0]!.id:null,codigos:b.codigos,descripcion:b.descripcion}));
        }else{
          const [doc]=await tx.select().from(actActas).where(eq(actActas.id,origen.id));
          if(!doc||!["fija","momentanea"].includes(doc.tipo))throw new AsignacionError("Una asignación de origen ya no está disponible para devolución.");
          proc=doc.cabecera.entidad;persona=doc.cabecera.responsable;
          filas=doc.bienes.map(b=>({id:b.activoId,codigos:b.codigo?[b.codigo]:[],descripcion:b.descripcion}));
        }
        if(proc!==input.cabecera.entidad||normalizar(persona||"")!==normalizar(input.cabecera.responsable))throw new AsignacionError("La devolución debe conservar el responsable y la procedencia de cada acta de origen.");
        filasOrigenes.push(...filas);
        if(!filas.some(f=>bienesDevueltos.some(b=>coincideBien(f,b))))throw new AsignacionError("La devolución debe incluir al menos un bien del acta de asignación vinculada.");
      }
      if(bienesDevueltos.some(b=>!filasOrigenes.some(f=>coincideBien(f,b))))throw new AsignacionError("La devolución contiene un bien que no pertenece a las asignaciones seleccionadas.");
    }
    const ids=input.bienes.flatMap(b=>b.activoId?[b.activoId]:[]).sort();
    if(ids.length)await tx.select({id:actActivos.id}).from(actActivos).where(inArray(actActivos.id,ids)).orderBy(asc(actActivos.id)).for("update");
    const current=ids.length?await tx.select().from(actCustodiaActual).where(inArray(actCustodiaActual.id,ids)):[];
    if(current.length!==ids.length)throw new AsignacionError("Uno de los bienes ya no pertenece al inventario vigente.");
    const id=randomUUID();const gestion=Number(input.cabecera.fecha.slice(0,4));
    let numero:number;
    if(input.cabecera.formato){
      const serie=input.tipo==="devolucion"?"devolucion":"asignacion";
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`acta-serie:${input.cabecera.entidad}:${gestion}:${serie}`}))`);
      numero=await siguienteNumeroActa(input.cabecera.entidad,gestion,serie,tx);
    }else{
      const serial=await tx.execute<{numero:number}>(sql`SELECT nextval(pg_get_serial_sequence('act_actas','numero'))::int AS numero`);numero=serial.rows[0]!.numero;
    }
    const referencia=referenciaActa({numero,tipo:input.tipo,cabecera:input.cabecera});
    const snapshots:ActaBien[]=[];const movimientos:{activoId:string;asignacionId:string|null}[]=[];
    for(const b of input.bienes){
      if(!b.activoId){
        snapshots.push({activoId:null,codigo:b.codigo||null,descripcion:b.descripcion!,origen:input.cabecera.entidad,placa:b.placa,estado:b.estado,observaciones:b.observaciones,accesorios:b.accesorios});
        continue;
      }
      const record=current.find(a=>a.id===b.activoId)!;
      if(input.cabecera.formato&&record.origen!==input.cabecera.entidad)throw new AsignacionError("Todos los bienes deben pertenecer a la procedencia seleccionada.");
      if((record.asignacionId??null)!==b.asignacionEsperada)throw new AsignacionError(`La custodia de ${record.codigo||"un bien"} cambió. Busca nuevamente el bien.`);
      snapshots.push({activoId:b.activoId,codigo:b.codigo?.trim()||record.codigo,descripcion:b.descripcion?.trim()||record.descripcion,origen:record.origen,placa:b.placa,estado:b.estado,observaciones:b.observaciones,accesorios:b.accesorios});
      let movimientoId:string|null=null;
      let asignacionVinculada:string|null=null;
      if(input.tipo!=="devolucion"){
        const result=await registrarAsignacion({solicitudId:randomUUID(),activoId:b.activoId,asignacionFijaEsperada:b.fijaEsperada,tipo:input.tipo,responsableDestino:input.cabecera.responsable,ubicacionDestino:input.cabecera.ubicacionDestino,fechaInicio:input.cabecera.fecha,fechaDevolucionPrevista:input.cabecera.fechaDevolucion,motivo:input.cabecera.motivo,referenciaActa:referencia},ctx,tx);
        movimientoId=result.id;asignacionVinculada=result.id;
      }else{
        if(record.asignacionId){
          await registrarDevolucion({asignacionId:record.asignacionId,fechaCierre:input.cabecera.fecha,motivoCierre:`${referencia}: ${input.cabecera.motivo}`,recibirEnAlmacenes:input.cabecera.recibirEnAlmacenes===true},ctx,tx);movimientoId=record.asignacionId;asignacionVinculada=record.asignacionId;
        }
        // Por defecto una momentánea vuelve a su fija. Si se recibe en Almacenes,
        // se cierran ambas custodias previas y cada bien queda bajo Almacenes.
        if(input.cabecera.recibirEnAlmacenes){
          if(!record.asignacionId){
            const almacen=await registrarAsignacion({solicitudId:randomUUID(),activoId:b.activoId,asignacionFijaEsperada:null,tipo:"fija",responsableDestino:"ALMACENES",ubicacionDestino:"ALMACENES",fechaInicio:input.cabecera.fecha,fechaDevolucionPrevista:null,motivo:`Recepción en Almacenes por devolución: ${input.cabecera.motivo}`,referenciaActa:referencia},ctx,tx);
            movimientoId=almacen.id;
          }
        }else if(record.asignacionTipo!=="momentanea"){
          const recepcion=await registrarAsignacion({solicitudId:randomUUID(),activoId:b.activoId,asignacionFijaEsperada:null,tipo:"fija",responsableDestino:input.cabecera.recibidoPor,ubicacionDestino:input.cabecera.ubicacionDestino,fechaInicio:input.cabecera.fecha,fechaDevolucionPrevista:null,motivo:`Recepción por devolución: ${input.cabecera.motivo}`,referenciaActa:referencia},ctx,tx);
          movimientoId=recepcion.id;
        }
      }
      movimientos.push({activoId:b.activoId,asignacionId:input.tipo==="devolucion"?asignacionVinculada:movimientoId});
    }
    const pdf=await generarActaPdf({id,numero,tipo:input.tipo,cabecera:input.cabecera,bienes:snapshots});
    await tx.insert(actActas).values({id,solicitudId:input.solicitudId,solicitudHash:hash,numero,procedenciaSerie:input.cabecera.formato?input.cabecera.entidad:null,gestionSerie:input.cabecera.formato?gestion:null,tipo:input.tipo,fecha:input.cabecera.fecha,cabecera:input.cabecera,bienes:snapshots,documentoPdf:pdf,pdfSha256:createHash("sha256").update(pdf).digest("hex"),creadoPor:ctx.userId});
    if(movimientos.length)await tx.insert(actActaBienes).values(movimientos.map(m=>({...m,actaId:id})));
    await tx.insert(auditLogs).values({userId:ctx.userId,module:"activos",action:"emitir_acta",entity:"act_actas",entityId:id,ipAddress:ctx.ipAddress,userAgent:ctx.userAgent,details:{tipo:input.tipo,referencia,activoIds:ids,cantidad:ids.length}});
    return {id};
  });
}

export async function buscarBienesActa(q:string,entidad?:string,exacto=false){
  const pattern=`%${q.trim().slice(0,200).replace(/[\\%_]/g,"\\$&")}%`;
  const rows=await db.select({id:actCustodiaActual.id,codigo:actCustodiaActual.codigo,descripcion:actCustodiaActual.descripcion,origen:actCustodiaActual.origen,estado:actCustodiaActual.estado,observaciones:actActivos.observaciones,responsable:actCustodiaActual.responsable,ubicacion:actCustodiaActual.ubicacion,asignacionId:actCustodiaActual.asignacionId,asignacionTipo:actCustodiaActual.asignacionTipo,retornoResponsable:actAsignaciones.responsableAnterior,retornoUbicacion:actAsignaciones.ubicacionAnterior})
    .from(actCustodiaActual).innerJoin(actActivos,eq(actActivos.id,actCustodiaActual.id)).leftJoin(actAsignaciones,eq(actAsignaciones.id,actCustodiaActual.asignacionId))
    .where(sql`(${exacto?sql`upper(trim(${actCustodiaActual.codigo})) = ${q.trim().toUpperCase()}`:sql`(${actCustodiaActual.codigo} ILIKE ${pattern} OR ${actCustodiaActual.descripcion} ILIKE ${pattern} OR ${actCustodiaActual.responsable} ILIKE ${pattern})`}) AND (${entidad??null}::text IS NULL OR ${actCustodiaActual.origen}=${entidad??null})`)
    .orderBy(asc(actCustodiaActual.origen),asc(actCustodiaActual.filaExcel)).limit(25);
  return rows.map(r=>({...r,fijaEsperada:r.asignacionTipo==="fija"?r.asignacionId:null}));
}
export type BienSeleccionable=Awaited<ReturnType<typeof buscarBienesActa>>[number];

export async function fichaActa(id:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
  const [a]=await db.select({id:actActas.id,numero:actActas.numero,tipo:actActas.tipo,cabecera:actActas.cabecera,bienes:actActas.bienes,fecha:actActas.fecha}).from(actActas).where(eq(actActas.id,id));return a??null;
}
