"use server";
import { and,asc,inArray,isNull,sql,eq,desc } from "drizzle-orm";
import { db } from "@/db";
import { actDocumentosArchivo,actResponsables } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { prepararDevolucion,prepararDevolucionConjunta } from "./devolucion-desde-acta-servicio";
import { AsignacionError } from "./asignaciones-modelo";
import { coberturaDevolucion } from "./actas-vinculo";
import { gestionActiva } from "./gestion-consultas";
export async function cargarDevolucionDesdeActa(id:string,fuente:"excel"|"sistema"){
 try{const s=await getSession();if(!s||!await hasPermission(s.user.id,"activos:read")||!await hasPermission(s.user.id,"activos:update"))throw new AsignacionError("No tienes permiso para crear devoluciones.");if(!["excel","sistema"].includes(fuente))throw new AsignacionError("Origen no válido.");const borrador=await prepararDevolucion(id,fuente);const responsables=await db.select({nombre:actResponsables.nombre,cargo:actResponsables.cargo}).from(actResponsables).where(isNull(actResponsables.eliminadoEn)).orderBy(asc(actResponsables.nombre));return {ok:true as const,borrador,responsables,...await gestionActiva()};}catch(e){console.error("cargarDevolucionDesdeActa",e);return {ok:false as const,error:e instanceof AsignacionError?e.message:"No se pudieron cargar los bienes de la asignación."};}
}

export async function consultarAsignacionesParaDevolucion(){
 try{const s=await getSession();if(!s||!await hasPermission(s.user.id,"activos:read")||!await hasPermission(s.user.id,"activos:update"))throw new AsignacionError("No tienes permiso para crear devoluciones.");
 const {actListadoActas:a}=await import("./archivo-listado");
 const anioNumero=sql<number|null>`substring(${a.numero} from '[/ -](20[0-9]{2})$')::int`;
 const anioDocumento=sql<number|null>`extract(year from ${a.fecha})::int`;
 const gestionActual=(await gestionActiva()).gestion;
 const rows=await db.select({id:a.id,fuente:a.fuente,numero:a.numero,procedencia:a.procedencia,responsable:sql<string>`coalesce(${actResponsables.nombre},${a.responsableOriginal})`,responsableOriginal:a.responsableOriginal,responsableId:a.responsableId,fecha:a.fecha,documento:a.documento,bienes:sql<number>`jsonb_array_length(${a.documento}->'bienes')`,devolucionReferencia:a.devolucionReferencia}).from(a).leftJoin(actResponsables,eq(actResponsables.id,a.responsableId)).where(sql`${a.eliminadoEn} is null and ${a.tipo} in ('asignacion','actualizacion') and coalesce(${anioNumero},${anioDocumento})=${gestionActual}`).orderBy(desc(a.fecha),desc(a.id));
 const procedencias=[...new Set(rows.filter(r=>r.fuente==="excel").map(r=>r.procedencia))];
 const devoluciones=procedencias.length?await db.select({id:actDocumentosArchivo.id,numero:actDocumentosArchivo.numero,fecha:actDocumentosArchivo.fecha,procedencia:actDocumentosArchivo.procedencia,responsableId:actDocumentosArchivo.responsableId,responsableOriginal:actDocumentosArchivo.responsableOriginal,documento:actDocumentosArchivo.documento}).from(actDocumentosArchivo).where(and(eq(actDocumentosArchivo.tipo,"devolucion"),isNull(actDocumentosArchivo.eliminadoEn),inArray(actDocumentosArchivo.procedencia,procedencias))):[];
 const actas=rows.map(r=>{const fuente=r.fuente==="sistema"?"sistema" as const:"excel" as const;if(fuente==="sistema")return {...r,bienes:r.devolucionReferencia?0:r.bienes,fuente};const cobertura=coberturaDevolucion({id:r.id,numero:r.numero,fecha:r.fecha,procedencia:r.procedencia,responsableId:r.responsableId,responsableOriginal:r.responsable,documento:r.documento},devoluciones);return {...r,bienes:cobertura.pendientes.length,fuente};}).filter(r=>r.bienes>0);
 return {ok:true as const,actas};
 }catch(e){return {ok:false as const,error:e instanceof AsignacionError?e.message:"No se pudo cargar la lista de asignaciones."};}
}
export async function cargarDevolucionConjunta(input:unknown){
 try{const s=await getSession();if(!s||!await hasPermission(s.user.id,"activos:read")||!await hasPermission(s.user.id,"activos:update"))throw new AsignacionError("No tienes permiso para crear devoluciones.");const borrador=await prepararDevolucionConjunta(input);const responsables=await db.select({nombre:actResponsables.nombre,cargo:actResponsables.cargo}).from(actResponsables).where(isNull(actResponsables.eliminadoEn)).orderBy(asc(actResponsables.nombre));return {ok:true as const,borrador,responsables,...await gestionActiva()};}catch(e){console.error("cargarDevolucionConjunta",e);return {ok:false as const,error:e instanceof AsignacionError?e.message:"No se pudo preparar la devolución conjunta."};}
}
