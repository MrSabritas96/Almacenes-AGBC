import { and,eq,inArray,isNull,sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { actActas,actActaBienes,actDocumentosArchivo,actArchivoPdf,actCustodiaActual,actResponsables,actProcedencias } from "@/db/schema/activos.schema";
import { AsignacionError } from "./asignaciones-modelo";
import { referenciaActa } from "./actas-modelo";
import { REGIONALES_ACTA } from "./actas-plantilla";
import type { BorradorDevolucion,FilaDevolucion } from "./devolucion-desde-acta-modelo";
import { coberturaDevolucion } from "./actas-vinculo";
const normal=(s:string|null)=>s?.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"")||"";
export async function prepararDevolucion(id:string,fuente:"excel"|"sistema",database:typeof db=db):Promise<BorradorDevolucion>{
 if(!z.string().uuid().safeParse(id).success)throw new AsignacionError("El acta no es válida.");
 let referencia="",responsable="",cargo="",entidad="",regional="",piso="",texto="";
 let candidatos:(FilaDevolucion&{movimiento?:string|null})[]=[];
 if(fuente==="sistema"){
  const [a]=await database.select({id:actActas.id,numero:actActas.numero,tipo:actActas.tipo,cabecera:actActas.cabecera,bienes:actActas.bienes}).from(actActas).where(eq(actActas.id,id));
  if(!a||a.tipo==="devolucion")throw new AsignacionError("Selecciona un acta de asignación.");
  referencia=referenciaActa(a);({responsable,cargo,entidad}=a.cabecera);regional=a.cabecera.regional||a.cabecera.ciudad;piso=a.cabecera.piso||"";texto=a.cabecera.oficina;
  const movimientos=await database.select().from(actActaBienes).where(eq(actActaBienes.actaId,id));
  candidatos=a.bienes.map(b=>({...b,codigo:b.codigo||"",asignacionEsperada:null,fijaEsperada:null,movimiento:movimientos.find(m=>m.activoId===b.activoId)?.asignacionId}));
  const devolucionesVinculadas=await database.select({bienes:actActas.bienes}).from(actActas).where(sql`${actActas.tipo}='devolucion' and exists(select 1 from jsonb_array_elements(${actActas.cabecera}->'actasOrigen') origen where origen->>'id'=${id} and origen->>'fuente'='sistema')`);
  const codigosDevueltos=new Set(devolucionesVinculadas.flatMap(d=>d.bienes.flatMap(b=>(b.codigo||"").split("/").map(normal).filter(Boolean))));
  const idsDevueltos=new Set(devolucionesVinculadas.flatMap(d=>d.bienes.flatMap(b=>b.activoId?[b.activoId]:[])));
  const descripcionesDevueltas=new Set(devolucionesVinculadas.flatMap(d=>d.bienes.map(b=>normal(b.descripcion)).filter(v=>v.length>=16)));
  candidatos=candidatos.filter(b=>!(b.activoId&&idsDevueltos.has(b.activoId))&&!b.codigo.split("/").map(normal).some(c=>c&&codigosDevueltos.has(c))&&!(normal(b.descripcion).length>=16&&descripcionesDevueltas.has(normal(b.descripcion))));
 }else{
  const [a]=await database.select().from(actDocumentosArchivo).where(eq(actDocumentosArchivo.id,id));
  if(!a||a.eliminadoEn||!["asignacion","actualizacion"].includes(a.tipo))throw new AsignacionError("Selecciona un acta de asignación disponible.");
  const [pdf]=await database.select({regional:actArchivoPdf.regional}).from(actArchivoPdf).where(eq(actArchivoPdf.documentoId,id));
  const [r]=a.responsableId?await database.select().from(actResponsables).where(eq(actResponsables.id,a.responsableId)):[];
  referencia=a.numero;responsable=r?.nombre||a.responsableOriginal;cargo=a.documento.cargo||r?.cargo||"";entidad=a.procedencia;regional=pdf?.regional||a.documento.ciudad;texto=a.documento.texto;
  candidatos=a.documento.bienes.map(b=>({activoId:b.vinculo==="exacto"&&b.coincidencias.length===1?b.coincidencias[0]!.id:null,codigo:b.codigos.join(" / "),descripcion:b.descripcion,placa:b.descripcion.match(/placa\s*[:.-]?\s*([a-z0-9-]{5,15})/i)?.[1]?.toUpperCase()||"",estado:b.estado,observaciones:b.observaciones||"",accesorios:"",asignacionEsperada:null,fijaEsperada:null}));
  const devoluciones=await database.select({id:actDocumentosArchivo.id,numero:actDocumentosArchivo.numero,fecha:actDocumentosArchivo.fecha,procedencia:actDocumentosArchivo.procedencia,responsableId:actDocumentosArchivo.responsableId,responsableOriginal:actDocumentosArchivo.responsableOriginal,documento:actDocumentosArchivo.documento}).from(actDocumentosArchivo).where(and(eq(actDocumentosArchivo.tipo,"devolucion"),eq(actDocumentosArchivo.procedencia,entidad),isNull(actDocumentosArchivo.eliminadoEn)));
  const cobertura=coberturaDevolucion({id:a.id,numero:a.numero,fecha:a.fecha,procedencia:a.procedencia,responsableId:a.responsableId,responsableOriginal:responsable,documento:a.documento},devoluciones);
  const filasPendientes=new Set(cobertura.pendientes.map(b=>b.fila));
  candidatos=candidatos.filter((_,indice)=>filasPendientes.has(a.documento.bienes[indice]!.fila));
 }
 if(!candidatos.length)throw new AsignacionError("No quedan bienes pendientes de devolución para esta asignación.");
 if(candidatos.length>100)throw new AsignacionError(`El acta tiene ${candidatos.length} bienes y el formulario admite 100. No se ha omitido ningún bien: divide la devolución en varias actas.`);
 const [procedencia]=await database.select().from(actProcedencias).where(eq(actProcedencias.clave,entidad));if(!procedencia?.activa)throw new AsignacionError("La procedencia del acta no está activa. Revísala en Administrar procedencias.");
 regional=({"Oficina Central":"La Paz",Sucre:"Chuquisaca",Trinidad:"Beni",Cobija:"Pando"} as Record<string,string>)[regional]||regional;
 if(!REGIONALES_ACTA.includes(regional as typeof REGIONALES_ACTA[number]))regional="";
 if(!piso&&regional==="La Paz"){const t=texto.toLowerCase();piso=/mezz|mezan/.test(t)?"Piso mezzanine":/planta baja/.test(t)?"Planta baja":/subsuelo|sub suelo/.test(t)?"Subsuelo":"";}
 const ids=[...new Set(candidatos.flatMap(b=>b.activoId?[b.activoId]:[]))];
 const actuales=ids.length?await database.select().from(actCustodiaActual).where(inArray(actCustodiaActual.id,ids)):[];
 const usados=new Set<string>();let manuales=0,estados=0;
 const bienes=candidatos.map(b=>{const actual=actuales.find(a=>a.id===b.activoId);const seguro=actual&&actual.origen===entidad&&!usados.has(actual.id)&&(fuente==="sistema"?Boolean(b.movimiento&&actual.asignacionId===b.movimiento):!actual.asignacionId&&normal(actual.responsable)===normal(responsable));
  if(seguro)usados.add(actual.id);else manuales++;
  const estado=b.estado.trim().toUpperCase();if(!["BUENO","REGULAR","MALO"].includes(estado))estados++;
  return {activoId:seguro?actual.id:null,codigo:b.codigo,descripcion:b.descripcion,placa:b.placa||"",estado:["BUENO","REGULAR","MALO"].includes(estado)?estado:"",observaciones:b.observaciones||"",accesorios:b.accesorios||"",asignacionEsperada:seguro?actual.asignacionId:null,fijaEsperada:seguro&&actual.asignacionTipo==="fija"?actual.asignacionId:null};});
 const avisos:string[]=[];
 if(manuales)avisos.push(`${manuales} fila(s) se copiaron como documentales: no tienen un vínculo seguro con la custodia de esta asignación. Se incluyen en el PDF, pero no cambian la custodia del inventario. Revisa sus códigos antes de guardar.`);
 if(estados)avisos.push(`Selecciona el estado actual de ${estados} bien(es) cuyo estado de origen no es válido.`);
 if(!regional||regional==="La Paz"&&!piso)avisos.push("Revisa la regional y el piso: faltan datos en el acta de origen.");
 return {referencia,actasOrigen:[{id,fuente}],datos:{responsable,cargo,entidad,regional,piso},bienes,avisos};
}

export async function prepararDevolucionConjunta(input:unknown,database:typeof db=db):Promise<BorradorDevolucion>{
 const parsed=z.array(z.object({id:z.string().uuid(),fuente:z.enum(["excel","sistema"])})).min(1,"Selecciona al menos una asignación.").max(20,"Puedes reunir hasta 20 actas por devolución.").safeParse(input);
 if(!parsed.success)throw new AsignacionError(parsed.error.issues[0]?.message||"Revisa las actas seleccionadas.");
 const refs=parsed.data;if(new Set(refs.map(r=>r.fuente+r.id)).size!==refs.length)throw new AsignacionError("Hay actas repetidas en la selección.");
 const borradores:BorradorDevolucion[]=[];for(const r of refs)borradores.push(await prepararDevolucion(r.id,r.fuente,database));
 const primero=borradores[0]!;const normal=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
 if(borradores.some(b=>b.datos.entidad!==primero.datos.entidad||normal(b.datos.responsable)!==normal(primero.datos.responsable)))throw new AsignacionError("Las actas deben pertenecer al mismo responsable y procedencia. Prepara otra devolución para los demás responsables.");
 const inventario=await database.select({codigo:actCustodiaActual.codigo}).from(actCustodiaActual);const cantidadesCodigo=new Map<string,number>();for(const a of inventario){const c=normal(a.codigo||"");if(c)cantidadesCodigo.set(c,(cantidadesCodigo.get(c)||0)+1);}
 const bienes:FilaDevolucion[]=[],porId=new Map<string,FilaDevolucion>(),porCodigo=new Map<string,FilaDevolucion>();let repetidos=0,conflictos=0;
 const codigoAmbiguo=(b:FilaDevolucion)=>b.codigo.split(" / ").some(c=>(cantidadesCodigo.get(normal(c))||0)>1);
 const combinarTexto=(a:string,b:string)=>{if(!a)return b;if(!b||a===b)return a;const combinado=a+"\n"+b;if(combinado.length>2000)throw new AsignacionError("Las observaciones o accesorios acumulados superan el espacio de una fila. Reduce la selección y prepara otra devolución.");return combinado;};
 for(const d of borradores)for(const original of d.bienes){const b={...original};const codigo=normal(b.codigo),clave=codigo?codigo+"|"+normal(b.descripcion)+"|"+normal(b.placa):"";const coincidencia=(b.activoId?porId.get(b.activoId):undefined)||(clave?porCodigo.get(clave):undefined);const anterior=coincidencia&&((coincidencia.activoId&&b.activoId&&coincidencia.activoId!==b.activoId)||((!coincidencia.activoId||!b.activoId)&&codigoAmbiguo(b)))?undefined:coincidencia;
  if(anterior){repetidos++;anterior.observaciones=combinarTexto(anterior.observaciones,b.observaciones);anterior.accesorios=combinarTexto(anterior.accesorios,b.accesorios);if(anterior.estado!==b.estado){anterior.estado="";conflictos++;}if(!anterior.activoId&&b.activoId){anterior.activoId=b.activoId;anterior.asignacionEsperada=b.asignacionEsperada;anterior.fijaEsperada=b.fijaEsperada;}if(b.activoId)porId.set(b.activoId,anterior);if(clave)porCodigo.set(clave,anterior);
  }else{bienes.push(b);if(b.activoId)porId.set(b.activoId,b);if(clave)porCodigo.set(clave,b);}
 }
 if(bienes.length>100)throw new AsignacionError(`La selección reúne ${bienes.length} bienes distintos. El acta admite 100: selecciona menos actas. No se omitió ningún bien.`);
 const avisos=[...new Set(borradores.flatMap(b=>b.avisos))];
 if(repetidos)avisos.unshift(`${repetidos} fila(s) repetidas se reunieron en una sola fila por bien. Las observaciones y accesorios distintos se conservaron juntos.`);
 if(conflictos)avisos.unshift("Hay bienes con estados diferentes entre actas. Selecciona su estado actual antes de guardar.");
 if(borradores.some(b=>b.datos.regional!==primero.datos.regional||b.datos.piso!==primero.datos.piso))avisos.unshift("Las asignaciones tienen ubicaciones distintas. Revisa la regional y el piso de recepción de esta devolución conjunta.");
 return {referencia:borradores.map(b=>b.referencia).join("; "),actasOrigen:borradores.flatMap(b=>b.actasOrigen),datos:primero.datos,bienes,avisos};
}
