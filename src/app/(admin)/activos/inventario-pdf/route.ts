import { consultarInventario, leerFiltros } from "@/actions/activos/consultas";
import { generarInventarioPdf } from "@/actions/activos/inventario-pdf";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
export const runtime="nodejs";
export async function GET(request: Request) {
 const session=await getSession();if(!session)return new Response("Inicia sesión.",{status:401});
 if(!(await hasPermission(session.user.id,"activos:read")))return new Response("Sin permiso.",{status:403});
 const params: Record<string,string>={};new URL(request.url).searchParams.forEach((value,key)=>{params[key]=value;});
 const filtros=leerFiltros(params);const data=await consultarInventario(filtros,true);
 const pdf=await generarInventarioPdf(data.registros,filtros);
 const filename=`inventario-${filtros.origen||"todos"}-${filtros.estado||"todos"}`.replace(/[^a-zA-Z0-9-]/g,"-")+".pdf";
 return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
