"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { procedenciaActiva } from "./procedencias-consultas";
import { seriesCodigosActivo } from "./activo-codigos";
import { nuevoActivoSchema } from "./activo-nuevo-modelo";
import { registrarActivoManual,AltaActivoError } from "./activo-nuevo-servicio";
export async function crearActivo(input:unknown){
 const session=await getSession();if(!session||!(await hasPermission(session.user.id,"activos:read"))||!(await hasPermission(session.user.id,"activos:create")))return {ok:false as const,error:"No tienes permiso para registrar activos."};
 const parsed=nuevoActivoSchema.safeParse(input);if(!parsed.success)return {ok:false as const,error:parsed.error.issues[0]?.message??"Revisa los datos."};
 try{const data=await registrarActivoManual(parsed.data,session.user.id);revalidatePath("/activos","layout");return {ok:true as const,data};}catch(e){console.error("crearActivo",e);return {ok:false as const,error:e instanceof AltaActivoError?e.message:"No se pudo guardar. Vuelve a intentarlo con este formulario."};}
}

export async function consultarSeriesActivo(origen:string){
 const session=await getSession();if(!session||!(await hasPermission(session.user.id,"activos:read"))||!(await hasPermission(session.user.id,"activos:create")))return {ok:false as const,error:"No tienes permiso para registrar activos."};
 if(!(await procedenciaActiva(origen)))return {ok:false as const,error:"Procedencia inválida."};
 try{return {ok:true as const,series:await seriesCodigosActivo(origen)};}catch(e){console.error("consultarSeriesActivo",e);return {ok:false as const,error:"No se pudieron consultar los códigos. Cierra y vuelve a abrir el formulario."};}
}
