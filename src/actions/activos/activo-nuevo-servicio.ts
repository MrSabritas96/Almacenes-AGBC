import { randomUUID,createHash } from "node:crypto";
import { eq,sql } from "drizzle-orm";
import { db } from "@/db";
import { actActivos,actImportaciones,actHojasImportadas,actFilasImportadas,actResponsables,actProcedencias } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { GRUPOS_MANUALES,type NuevoActivo } from "./activo-nuevo-modelo";
import { seriesCodigosActivo } from "./activo-codigos";
export class AltaActivoError extends Error {}
export async function registrarActivoManual(datos:NuevoActivo,userId:string,database:typeof db=db){
 const {codigo:codigoPrevisto,...solicitud}=datos;void codigoPrevisto;
 const solicitudBytes=Buffer.from(JSON.stringify({datos:solicitud,userId}));const hash=createHash("sha256").update(solicitudBytes).digest("hex");const nombre=`Alta manual ${datos.solicitudId}.json`;
 return database.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`alta-activo:${datos.solicitudId}`}))`);
  const [prev]=await tx.select({resumen:actImportaciones.resumen}).from(actImportaciones).where(eq(actImportaciones.archivoNombre,nombre));
  if(prev){const r=prev.resumen as {solicitudHash:string;userId:string;activoId:string};if(r.solicitudHash!==hash||r.userId!==userId)throw new AltaActivoError("La solicitud ya se utilizó. Cierra y vuelve a abrir Nuevo activo.");const [activo]=await tx.select({codigo:actActivos.codigo}).from(actActivos).where(eq(actActivos.id,r.activoId));return {id:r.activoId,codigo:activo!.codigo!};}
  const [procedencia]=await tx.select().from(actProcedencias).where(eq(actProcedencias.clave,datos.origen)).for("share");if(!procedencia?.activa)throw new AltaActivoError("Selecciona una procedencia vigente.");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`alta-activo-serie:${datos.serie}`}))`);
  const serie=(await seriesCodigosActivo(datos.origen,tx)).find(s=>s.prefijo===datos.serie);
  if(!serie)throw new AltaActivoError("No se encuentra esa serie en la procedencia seleccionada.");
  datos={...datos,codigo:serie.siguiente};
  if(datos.codigo.length>120)throw new AltaActivoError("El código supera la longitud permitida.");
  const payload=Buffer.from(JSON.stringify({datos,userId}));
  let responsable:string|null=null;
  if(datos.responsableId){const [r]=await tx.select().from(actResponsables).where(eq(actResponsables.id,datos.responsableId));if(!r||r.eliminadoEn)throw new AltaActivoError("Selecciona un responsable vigente.");responsable=r.nombre;}
  const id=randomUUID(),importacion=randomUUID(),hoja=randomUUID(),fila=randomUUID();
  await tx.insert(actImportaciones).values({id:importacion,archivoNombre:nombre,archivoSha256:createHash("sha256").update(payload).digest("hex"),archivoOriginal:payload,resumen:{tipo:"alta_manual",activoId:id,userId,solicitudHash:hash}});
  await tx.insert(actHojasImportadas).values({id:hoja,importacionId:importacion,nombre:"Altas manuales del sistema",orden:1,tipo:"alta_manual",vigencia:"vigente",filasConDatos:1,registrosActivos:1});
  await tx.insert(actFilasImportadas).values({id:fila,hojaId:hoja,filaExcel:1,celdas:{tipo:"alta_manual",datos,registradoPor:userId}});
  await tx.insert(actActivos).values({id,filaOrigenId:fila,origen:datos.origen,codigo:datos.codigo,descripcion:datos.descripcion,grupoContable:GRUPOS_MANUALES[datos.categoria],estado:datos.estado,regional:datos.regional,ubicacion:datos.ubicacion,responsable,observaciones:datos.observaciones||null});
  await tx.insert(auditLogs).values({userId,module:"activos",action:"crear_activo_manual",entity:"act_activos",entityId:id,details:{codigo:datos.codigo,origen:datos.origen,categoria:datos.categoria,solicitudId:datos.solicitudId}});
  return {id,codigo:datos.codigo};
 });
}
