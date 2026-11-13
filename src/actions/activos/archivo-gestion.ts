"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { cambioArchivoSchema, estadoArchivoSchema } from "./archivo-gestion-modelo";
import { cambiarArchivo, cambiarEstadoArchivo, ArchivoGestionError } from "./archivo-gestion-servicio";
async function gestor(){const s=await getSession();return s&&(await hasPermission(s.user.id,"activos:read"))&&(await hasPermission(s.user.id,"activos:update"))?s:null;}
export async function editarArchivo(input:unknown){
 const s=await gestor();if(!s)return {ok:false,error:"No tienes permiso para editar actas."};
 const p=cambioArchivoSchema.safeParse(input);if(!p.success)return {ok:false,error:"Revisa los datos del acta."};
 try{await cambiarArchivo(p.data,s.user.id);}catch(e){console.error("editarArchivo",e);return {ok:false,error:e instanceof ArchivoGestionError?e.message:"No se pudo guardar el acta."};}
 revalidatePath("/activos","layout");return {ok:true};
}
export async function enviarArchivoPapelera(input:unknown){
 const s=await gestor();if(!s)return {ok:false,error:"No tienes permiso para gestionar actas."};
 const p=estadoArchivoSchema.safeParse(input);if(!p.success)return {ok:false,error:"Acta inválida."};
 try{await cambiarEstadoArchivo(p.data,s.user.id);}catch(e){console.error("estadoArchivo",e);return {ok:false,error:e instanceof ArchivoGestionError?e.message:"No se pudo cambiar el estado del acta."};}
 revalidatePath("/activos","layout");return {ok:true};
}
