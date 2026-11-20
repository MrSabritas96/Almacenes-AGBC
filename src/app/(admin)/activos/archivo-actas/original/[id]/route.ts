import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actArchivosActas } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/activos-session";
import { hasPermission } from "@/lib/rbac";
import { uuidArchivo } from "@/actions/activos/archivo-consultas";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const s=await getSession();if(!s)return new Response("Inicia sesión",{status:401});if(!(await hasPermission(s.user.id,"activos:read")))return new Response("Sin permiso",{status:403});const{id}=await params;if(!uuidArchivo(id))return new Response("No encontrado",{status:404});const [r]=await db.select().from(actArchivosActas).where(eq(actArchivosActas.id,id));if(!r)return new Response("No encontrado",{status:404});const esPdf=r.original.subarray(0,5).toString()==="%PDF-";return new Response(new Uint8Array(r.original),{headers:{"Content-Type":esPdf?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="archivo-original"; filename*=UTF-8''${encodeURIComponent(r.nombre)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
