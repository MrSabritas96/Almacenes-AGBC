import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { actResponsables as responsables } from "@/db/schema/activos.schema";
import { actListadoActas as actas, actListadoPdfs as originales } from "./archivo-listado";
import { uuidArchivo } from "./archivo-consultas";

/** Criterios comunes del listado y la impresión completa del archivo. */
export function filtrosArchivo(params: Record<string,string|string[]|undefined>) {
 const valor=(k:string)=>typeof params[k]==="string"?(params[k] as string).trim().slice(0,200):"";
 const q=valor("q"),tipo=valor("tipo")==="actualizacion"?"asignacion":valor("tipo"),responsable=valor("responsable"),procedencia=valor("procedencia"),departamento=valor("departamento"),regional=valor("regional"),categoria=valor("categoria"),gestion=valor("gestion"),mes=/^(0?[1-9]|1[0-2])$/.test(valor("mes"))?String(Number(valor("mes"))).padStart(2,"0"):"";
 const numero=sql<string>`coalesce(${originales.numero},${actas.numero})`,fecha=sql<string|null>`coalesce(${originales.fecha},${actas.fecha})`;
 // Se conserva el archivo original de 2026; las actas nativas se muestran en
 // cualquier gestión para que el nuevo año siga visible tras el cierre anual.
 const anioNumero=sql<number|null>`substring(${numero} from '[/ -](20[0-9]{2})$')::int`;
 const anioDocumento=sql<number|null>`extract(year from ${fecha})::int`;
 const correlativo=sql`substring(${numero} from '^[^0-9]*([0-9]+)([[:space:]/-]|$)')::numeric`;
 const condiciones:(SQL|undefined)[]=[categoria==="papelera"?isNotNull(actas.eliminadoEn):isNull(actas.eliminadoEn)];
 // La carga Excel vigente corresponde a 2026. Los documentos del sistema
 // pueden pertenecer a 2027, 2028 y gestiones posteriores.
 if(categoria!=="papelera")condiciones.push(sql`(${actas.fuente}='sistema' OR coalesce(${anioNumero},${anioDocumento})=2026)`);
 if(/^20\d{2}$/.test(gestion))condiciones.push(sql`coalesce(${anioNumero},${anioDocumento})=${Number(gestion)}`);
 if(mes)condiciones.push(sql`extract(month from ${fecha})::int=${Number(mes)}`);
 if(q&&/^\d+$/.test(q)){
  // Un número solo identifica el acta; no coincide con fragmentos de códigos de bienes.
  condiciones.push(sql`${correlativo} = ${q}::numeric`);
 }else if(q){
  // Search words independently so names also match with different order, accents or spacing.
  const normalizar=(texto:string)=>texto.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/(.)\1+/g,"$1");
  const palabras=normalizar(q).split(/[^a-z0-9]+/).filter(Boolean);
  const nombreBuscable=sql<string>`regexp_replace(translate(lower(coalesce(${responsables.nombre},'') || ' ' || coalesce(${actas.responsableOriginal},'')), 'áéíóúüñ', 'aeiouun'), '(.)\\1+', '\\1', 'g')`;
  const numeroCompacto=q.toLowerCase().replace(/[^a-z0-9]/g,"");
  const coincidenciaNumero=numeroCompacto?sql`regexp_replace(lower(${numero}), '[^a-z0-9]', '', 'g') like ${`%${numeroCompacto}%`}`:undefined;
  // Los documentos Excel guardan codigos[]; los nuevos guardan codigo.
  const coincidenciaActivo=numeroCompacto?sql`exists (
    select 1 from jsonb_array_elements(coalesce(${actas.documento}->'bienes','[]'::jsonb)) bien
    cross join lateral jsonb_array_elements_text(
      coalesce(bien->'codigos','[]'::jsonb) || jsonb_build_array(coalesce(bien->>'codigo',''))
    ) codigo(valor)
    where regexp_replace(lower(codigo.valor), '[^a-z0-9]', '', 'g') like ${`%${numeroCompacto}%`}
  )`:undefined;
  condiciones.push(or(coincidenciaNumero,coincidenciaActivo,palabras.length?and(...palabras.map(p=>ilike(nombreBuscable,`%${p}%`))):undefined));
 }

 if(tipo==="asignacion")condiciones.push(inArray(actas.tipo,["asignacion","actualizacion"]));
 if(tipo==="devolucion")condiciones.push(eq(actas.tipo,tipo));
 if(!q&&uuidArchivo(responsable))condiciones.push(eq(actas.responsableId,responsable));
 if(procedencia)condiciones.push(eq(actas.procedencia,procedencia));
 const dondeTarjetas=and(...condiciones,categoria==="devoluciones"?eq(actas.tipo,"devolucion"):undefined,categoria==="revision"?sql`jsonb_array_length(${originales.observaciones})>0`:undefined);
 if(!q&&departamento)condiciones.push(eq(originales.departamento,departamento));
 if(!q&&regional)condiciones.push(eq(originales.regional,regional));
 if(!q&&categoria==="central")condiciones.push(eq(originales.ambito,"oficina_central"));
 if(!q&&categoria==="regionales")condiciones.push(eq(originales.ambito,"regional"));
 if(categoria==="devoluciones")condiciones.push(eq(actas.tipo,"devolucion"));
 if(categoria==="revision")condiciones.push(sql`jsonb_array_length(${originales.observaciones})>0`);
 const where=and(...condiciones);
 const orden=[sql`${correlativo} desc nulls last`,desc(fecha),desc(numero),desc(actas.id)];
 return {q,tipo,responsable,procedencia,departamento,regional,categoria,gestion,mes,numero,fecha,where,dondeTarjetas,orden};
}
