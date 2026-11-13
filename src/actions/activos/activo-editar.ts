"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { consultarFicha } from "./consultas";
import { datosEditables,revisionActivo,editarActivoServicio,EditarActivoError } from "./activo-editar-servicio";
async function acceso(){const s=await getSession();if(!s||!await hasPermission(s.user.id,"activos:read")||!await hasPermission(s.user.id,"activos:update"))throw new EditarActivoError("No tienes permiso para editar activos.");return s;}
export async function consultarActivoEdicion(id:string){try{await acceso();const a=await consultarFicha(id);if(!a)throw new EditarActivoError("No se encontró el activo.");return {ok:true as const,data:{id:a.id,...datosEditables(a),revision:revisionActivo(a)}};}catch(e){return {ok:false as const,error:e instanceof EditarActivoError?e.message:"No se pudo cargar el activo."};}}
export async function guardarActivoEdicion(input:unknown){try{const s=await acceso();await editarActivoServicio(input,s.user.id);revalidatePath("/activos","layout");return {ok:true as const};}catch(e){console.error("guardarActivoEdicion",e);return {ok:false as const,error:e instanceof EditarActivoError?e.message:"No se pudo guardar el activo. Intenta nuevamente."};}}
