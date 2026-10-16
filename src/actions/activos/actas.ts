"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { guardarActaSchema } from "./actas-modelo";
import { buscarBienesActa, registrarActa, type BienSeleccionable } from "./actas-servicio";
import { AsignacionError } from "./asignaciones-modelo";

export async function buscarActivosParaActa(q:string):Promise<{ok:true;data:BienSeleccionable[]}|{ok:false;error:string}>{
  const session=await getSession();if(!session||!(await hasPermission(session.user.id,"activos:read")))return {ok:false,error:"No tienes acceso al inventario."};
  if(typeof q!=="string"||q.trim().length<2)return {ok:false,error:"Escribe al menos dos caracteres para buscar."};
  try{return {ok:true,data:await buscarBienesActa(q)};}catch{return {ok:false,error:"No se pudo consultar el inventario."};}
}
export async function guardarActa(input:unknown):Promise<{ok:true;data:{id:string}}|{ok:false;error:string}>{
  const session=await getSession();if(!session)return {ok:false,error:"Tu sesión terminó. Vuelve a iniciar sesión."};
  if(!(await hasPermission(session.user.id,"activos:read"))||!(await hasPermission(session.user.id,"activos:update"))){await audit({userId:session.user.id,module:"activos",action:"emitir_acta",entity:"act_actas",result:"denied"});return {ok:false,error:"No tienes permiso para emitir actas."};}
  try{
    const parsed=guardarActaSchema.safeParse(input);if(!parsed.success)throw new AsignacionError(parsed.error.issues[0]?.message||"Revisa los datos del acta.");
    const h=await headers();const result=await registrarActa(parsed.data,{userId:session.user.id,ipAddress:h.get("x-forwarded-for")?.split(",")[0]?.trim()??null,userAgent:h.get("user-agent")});
    revalidatePath("/activos","layout");return {ok:true,data:result};
  }catch(e){const message=e instanceof AsignacionError?e.message:"No pudimos confirmar el guardado. Vuelve a intentarlo con el mismo formulario.";if(!(e instanceof AsignacionError))console.error("[activos/actas]",e);await audit({userId:session.user.id,module:"activos",action:"emitir_acta",entity:"act_actas",result:"failure",details:{message}});return {ok:false,error:message};}
}
