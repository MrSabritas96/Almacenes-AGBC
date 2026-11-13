"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { catalogoProcedencias } from "./procedencias-consultas";
import { guardarProcedenciaServicio,eliminarProcedenciaServicio,ProcedenciaError } from "./procedencias-servicio";
async function acceso(){const s=await getSession();if(!s||!(await hasPermission(s.user.id,"activos:read"))||!(await hasPermission(s.user.id,"activos:update")))throw new ProcedenciaError("No tienes permiso para administrar procedencias.");return s;}
export async function consultarProcedenciasGestion(){try{await acceso();return {ok:true as const,data:await catalogoProcedencias()};}catch(e){return {ok:false as const,error:e instanceof ProcedenciaError?e.message:"No se pudo cargar el catálogo."};}}
export async function guardarProcedencia(input:unknown){try{const s=await acceso();await guardarProcedenciaServicio(input,s.user.id);revalidatePath("/activos","layout");return {ok:true as const};}catch(e){console.error("guardarProcedencia",e);return {ok:false as const,error:e instanceof ProcedenciaError?e.message:"No se pudo guardar la procedencia."};}}
export async function eliminarProcedencia(clave:string,version:number){try{const s=await acceso();await eliminarProcedenciaServicio(clave,version,s.user.id);revalidatePath("/activos","layout");return {ok:true as const};}catch(e){return {ok:false as const,error:e instanceof ProcedenciaError?e.message:"No se pudo eliminar la procedencia."};}}
