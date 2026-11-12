"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { cambiarPapeleraAsignacion } from "./asignaciones-papelera-servicio";
import { AsignacionError } from "./asignaciones-modelo";
export async function guardarPapeleraAsignacion(input:unknown){try{const s=await getSession();if(!s||!await hasPermission(s.user.id,"activos:read")||!await hasPermission(s.user.id,"activos:update"))throw new AsignacionError("No tienes permiso para gestionar asignaciones.");await cambiarPapeleraAsignacion(input,s.user.id);revalidatePath("/activos/asignaciones");return {ok:true as const};}catch(e){return {ok:false as const,error:e instanceof AsignacionError?e.message:"No se pudo completar la operación. Intenta nuevamente."};}}
