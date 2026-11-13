import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actActas } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { referenciaActa } from "@/actions/activos/actas-modelo";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const session=await getSession();if(!session)return new Response("Inicia sesión para consultar el acta.",{status:401});if(!(await hasPermission(session.user.id,"activos:read")))return new Response("Sin permiso.",{status:403});const{id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response("Acta no encontrada.",{status:404});
 const[a]=await db.select({numero:actActas.numero,tipo:actActas.tipo,cabecera:actActas.cabecera,pdf:actActas.documentoPdf}).from(actActas).where(eq(actActas.id,id));if(!a)return new Response("Acta no encontrada.",{status:404});
 const filename=referenciaActa(a).replace(/[^A-Za-z0-9-]/g,"-")+".pdf";return new Response(new Uint8Array(a.pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`${new URL(request.url).searchParams.get("ver")==="1"?"inline":"attachment"}; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
