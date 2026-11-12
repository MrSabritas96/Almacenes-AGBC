import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { actDocumentosArchivo, actArchivoPdf } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { uuidArchivo } from "@/actions/activos/archivo-consultas";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const session=await getSession();if(!session)return new Response("Inicia sesión",{status:401});
 if(!(await hasPermission(session.user.id,"activos:read")))return new Response("Sin permiso",{status:403});
 const{id}=await params;if(!uuidArchivo(id))return new Response("No encontrado",{status:404});
 const [row]=await db.select({id:actDocumentosArchivo.id}).from(actDocumentosArchivo).where(and(eq(actDocumentosArchivo.id,id),isNull(actDocumentosArchivo.eliminadoEn)));
 if(!row)return new Response("No encontrado",{status:404});
 const [original]=await db.select({pdf:actArchivoPdf.pdfOriginal,numero:actArchivoPdf.numero,motor:actArchivoPdf.motor}).from(actArchivoPdf).where(eq(actArchivoPdf.documentoId,id));
 if(!original?.pdf)return new Response("El PDF del Excel original está en preparación. Vuelve al listado y actualiza la página.",{status:503,headers:{"Cache-Control":"private, no-store","Retry-After":"60"}});
 const download=new URL(request.url).searchParams.get("descargar")==="1";
 const filename=(original.numero||`acta-${id}`).replace(/[^A-Za-z0-9-]/g,"-")+`-${id.slice(0,8)}.pdf`;
 return new Response(new Uint8Array(original.pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`${download?"attachment":"inline"}; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Acta-Documento":original.motor?.includes("oculto")?"consulta-contenido-oculto":"exportacion-original"}});
}
