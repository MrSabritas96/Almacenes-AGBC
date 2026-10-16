import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actDocumentosArchivo } from "@/db/schema/activos.schema";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { uuidArchivo } from "@/actions/activos/archivo-consultas";
import { generarActaPdf } from "@/actions/activos/actas-pdf";
import type { DocumentoActa } from "@/actions/activos/actas-modelo";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const s=await getSession();if(!s)return new Response("Inicia sesión",{status:401});if(!(await hasPermission(s.user.id,"activos:read")))return new Response("Sin permiso",{status:403});
 const{id}=await params;if(!uuidArchivo(id))return new Response("No encontrado",{status:404});const [row]=await db.select().from(actDocumentosArchivo).where(eq(actDocumentosArchivo.id,id));if(!row)return new Response("No encontrado",{status:404});
 const d=row.documento;
 // Solo se usan los bienes de este documento: nunca todos los bienes de la persona.
 const acta:DocumentoActa={id,numero:0,tipo:row.tipo==="devolucion"?"devolucion":"fija",cabecera:{responsable:d.responsable,cargo:d.cargo,ci:"",entidad:row.procedencia,ciudad:d.ciudad,oficina:"",ubicacionDestino:"",fecha:d.fecha??"",fechaDevolucion:null,motivo:"",entregadoPor:"",cargoEntrega:"",ciEntrega:"",recibidoPor:"",cargoRecepcion:"",ciRecepcion:"",observacionesGenerales:""},bienes:d.bienes.map((b)=>({activoId:id,codigo:b.codigos.join(" / ")||null,descripcion:b.descripcion,origen:row.procedencia,placa:"",estado:b.estado,observaciones:b.observaciones,accesorios:""}))};
 const pdf=await generarActaPdf(acta,{titulo:d.titulo,referencia:d.numero||"SIN NÚMERO IDENTIFICADO",texto:d.texto,numeros:d.bienes.map(b=>b.numero),pie:`Hoja ${d.hoja} · Bloque ${d.bloque}`});
 const download=new URL(request.url).searchParams.get("descargar")==="1";
 return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`${download?"attachment":"inline"}; filename="acta-${id}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
