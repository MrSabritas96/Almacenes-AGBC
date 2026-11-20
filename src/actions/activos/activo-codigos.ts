import { asc,eq,isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { actActivos,actProcedencias } from "@/db/schema/activos.schema";
import { CATEGORIAS_ACTIVOS,clasificarActivo } from "./categorias-modelo";
export function separarCodigo(codigo:string|null){
 const c=codigo?.trim().toUpperCase()??"";
 if(!/^[A-Z0-9 -]+$/.test(c)||/SIN CODIGO|SIN CÓDIGO/.test(c))return null;
 const m=c.match(/^(.+?)([0-9]+)$/);if(!m)return null;
 const prefijo=m[1]!,digitos=m[2]!;
 if(!/[- ]$/.test(prefijo)&&prefijo!=="PACTA")return null;
 if(prefijo==="AGBC-"||digitos.length>12)return null;
 return {prefijo,numero:BigInt(digitos),ancho:digitos.length};
}
export async function seriesCodigosActivo(origen:string,database:Pick<typeof db,"select">=db){
 const rows=await database.select({codigo:actActivos.codigo,origen:actActivos.origen,grupo:actActivos.grupoContable,descripcion:actActivos.descripcion}).from(actActivos).where(isNotNull(actActivos.codigo)).orderBy(asc(actActivos.creadoEn),asc(actActivos.id));
 const maximos=new Map<string,{numero:bigint;ancho:number}>();
 const opciones=new Map<string,{prefijo:string;ejemplo:string;categorias:string[];cantidad:number}>();
 for(const r of rows){const c=separarCodigo(r.codigo);if(!c)continue;const max=maximos.get(c.prefijo);maximos.set(c.prefijo,{numero:max&&max.numero>c.numero?max.numero:c.numero,ancho:Math.max(max?.ancho??0,c.ancho)});
  if(r.origen!==origen)continue;
  const categoria=clasificarActivo(r.grupo,r.descripcion).categoria;const o=opciones.get(c.prefijo)??{prefijo:c.prefijo,ejemplo:r.descripcion.slice(0,100),categorias:[],cantidad:0};o.cantidad++;if(!o.categorias.includes(categoria))o.categorias.push(categoria);opciones.set(c.prefijo,o);
 }
 const [procedencia]=await database.select().from(actProcedencias).where(eq(actProcedencias.clave,origen));
 if(procedencia?.activa){const generica=opciones.get(procedencia.prefijo);if(generica)generica.categorias=CATEGORIAS_ACTIVOS.map(c=>c.id);else if(!opciones.size){opciones.set(procedencia.prefijo,{prefijo:procedencia.prefijo,ejemplo:`Serie de ${procedencia.nombre}`,categorias:CATEGORIAS_ACTIVOS.map(c=>c.id),cantidad:0});if(!maximos.has(procedencia.prefijo))maximos.set(procedencia.prefijo,{numero:0n,ancho:4});}}
 return [...opciones.values()].sort((a,b)=>a.prefijo.localeCompare(b.prefijo,"es",{numeric:true})).map(o=>{const m=maximos.get(o.prefijo)!;return {...o,siguiente:o.prefijo+(m.numero+1n).toString().padStart(m.ancho,"0")};});
}
