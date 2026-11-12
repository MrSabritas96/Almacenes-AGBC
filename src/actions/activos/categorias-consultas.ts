import { catalogoProcedencias } from "./procedencias-consultas";
import "server-only";
import { asc,eq,ilike,isNull,or,sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actCustodiaActual as actuales,actActivos as base,actResponsables,actMantenimientosVehiculos } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { responsableNormalizado } from "./consultas";
import { CATEGORIAS_ACTIVOS,clasificarActivo,textoBusqueda } from "./categorias-modelo";
import { consultarHojasKardexVehiculos } from "./vehiculos-excel-consultas";
export async function consultarCategorias(params:Record<string,string|string[]|undefined>,completo=false,soloCategoria=false){
 const s=await requireSession();if(!(await hasPermission(s.user.id,"activos:read")))redirect("/dashboard");
 const puedeCrear=await hasPermission(s.user.id,"activos:create");
 const valor=(key:string)=>typeof params[key]==="string"?(params[key] as string).trim().slice(0,200):"";
 const categoria=CATEGORIAS_ACTIVOS.find(c=>c.id===valor("categoria"))?.id??"";
 const origen=valor("origen"),estado=["BUENO","REGULAR","MALO"].includes(valor("estado"))?valor("estado"):"",q=valor("q"),regional=categoria==="vehiculos"?valor("regional"):"",responsable=categoria==="vehiculos"?valor("responsable"):"";
 const categoriaSql=soloCategoria&&categoria==="vehiculos"?or(
  ilike(base.grupoContable,"%vehiculo%"),ilike(base.grupoContable,"%vehículo%"),ilike(base.grupoContable,"%automotor%"),
  sql`regexp_replace(translate(lower(coalesce(${base.descripcion},'')), 'áéíóúüñ', 'aeiouun'), '^[0-9[:space:].,()/-]+', '') ~ '^(vehiculo|camioneta|camion|automovil|vagoneta|motocicleta|motocarro|furgon|jeep|minibus|motorizado)([^a-z]|$)'`
 ):undefined;
 const [responsables,procedencias,vehiculosExcelFuentes,rows,mantenimientosPorActivo]=await Promise.all([
  puedeCrear&&!soloCategoria?db.select({id:actResponsables.id,nombre:actResponsables.nombre}).from(actResponsables).where(isNull(actResponsables.eliminadoEn)).orderBy(asc(actResponsables.nombre)):Promise.resolve([]),
  soloCategoria?Promise.resolve([]):catalogoProcedencias(),
  categoria==="vehiculos"?consultarHojasKardexVehiculos():Promise.resolve([]),
  db.select({id:actuales.id,codigo:actuales.codigo,descripcion:actuales.descripcion,origen:actuales.origen,estado:actuales.estado,ubicacion:actuales.ubicacion,responsable:responsableNormalizado,manual:sql<boolean>`exists(select 1 from act_filas_importadas f join act_hojas_importadas h on h.id=f.hoja_id where f.id=${base.filaOrigenId} and h.tipo='alta_manual')`,grupo:base.grupoContable,regional:base.regional}).from(actuales).innerJoin(base,eq(base.id,actuales.id)).where(categoriaSql).orderBy(asc(actuales.origen),asc(actuales.filaExcel),asc(actuales.id)),
  categoria==="vehiculos"?db.select({activoId:actMantenimientosVehiculos.activoId,total:sql<number>`count(*)::int`}).from(actMantenimientosVehiculos).groupBy(actMantenimientosVehiculos.activoId):Promise.resolve([]),
 ]);
 const conteoMantenimientos=new Map(mantenimientosPorActivo.map(item=>[item.activoId,item.total]));
 const nombreRegional=(v:string|null)=>{const key=textoBusqueda(v||"");const nombres:Record<string,string>={"la paz":"La Paz","oficina central":"La Paz","cochabamba":"Cochabamba","santa cruz":"Santa Cruz","oruro":"Oruro","potosi":"Potosí","sucre":"Sucre","tarija":"Tarija","beni":"Beni","pando":"Pando","el alto":"El Alto"};return nombres[key]||(v?.trim()||"Sin regional registrada");};
 const placaDe=(descripcion:string)=>descripcion.match(/\bPLACA\s*:?\s*([A-Z0-9-]{4,})/i)?.[1]?.replace(/-/g,"").toUpperCase()??"";
 const chasisDe=(descripcion:string)=>descripcion.match(/\bCHASIS\s*:?\s*([A-Z0-9-]{8,})/i)?.[1]?.replace(/[,\s]/g,"").toUpperCase()??"";
 const anioDe=(descripcion:string)=>descripcion.match(/\bAÑO\s*:?\s*(\d{4})/i)?.[1]??"";
 const fuentesPorPlaca=new Map<string,typeof vehiculosExcelFuentes[number][]>();
 for(const f of vehiculosExcelFuentes){const placa=f.placa.replace(/-/g,"").toUpperCase();fuentesPorPlaca.set(placa,[...(fuentesPorPlaca.get(placa)??[]),f]);}
 const registros=rows.map(r=>{const c=clasificarActivo(r.grupo,r.descripcion),placa=placaDe(r.descripcion),fuentes=c.categoria==="vehiculos"?(fuentesPorPlaca.get(placa)??[]):[];return {...r,...c,placa,chasisInventario:chasisDe(r.descripcion),anioInventario:anioDe(r.descripcion),fuentesExcel:fuentes,mantenimientosRegistrados:conteoMantenimientos.get(r.id)??0,regionalNombre:nombreRegional(r.regional),criterio:r.manual&&c.criterio==="excel"?"registrada" as const:c.criterio};});
 const baseFiltrada=registros.filter(r=>{const textoExcel=r.fuentesExcel.map(f=>`${f.placa} ${f.chasis} ${f.marca} ${f.modelo} ${f.anio} ${f.conductor} ${f.regional}`).join(" ");return (!origen||r.origen===origen)&&(!estado||r.estado?.trim().toUpperCase()===estado)&&(!q||textoBusqueda(`${r.codigo||""} ${r.descripcion} ${r.responsable||""} ${textoExcel}`).includes(textoBusqueda(q)));});
 const categorias=CATEGORIAS_ACTIVOS.map(c=>({...c,total:registros.filter(r=>r.categoria===c.id).length}));
 const regionales=[...new Set(registros.filter(r=>r.categoria==="vehiculos").map(r=>r.regionalNombre))].sort((a,b)=>a.localeCompare(b,"es")).map(nombre=>({nombre,total:registros.filter(r=>r.categoria==="vehiculos"&&r.regionalNombre===nombre).length}));
 const nombreClave=(v:string)=>textoBusqueda(v).split(" ").filter(Boolean).sort().join(" ");
 const responsablesMap=new Map<string,string>();
 for(const nombre of registros.filter(r=>r.categoria==="vehiculos"&&r.responsable).map(r=>r.responsable!))responsablesMap.set(nombreClave(nombre),nombre);
 for(const f of vehiculosExcelFuentes)if(!responsablesMap.has(nombreClave(f.conductor)))responsablesMap.set(nombreClave(f.conductor),f.conductor);
 const responsablesVehiculos=[...responsablesMap.values()].sort((a,b)=>a.localeCompare(b,"es"));
 const regionalesVehiculos=[...new Set([...registros.filter(r=>r.categoria==="vehiculos").map(r=>r.regionalNombre),...vehiculosExcelFuentes.map(f=>nombreRegional(f.regional))])].sort((a,b)=>a.localeCompare(b,"es"));
 const filtrados=baseFiltrada.filter(r=>{
  const regionalCoincide=!regional||r.regionalNombre===regional||r.fuentesExcel.some(f=>nombreRegional(f.regional)===regional);
  const responsableCoincide=!responsable||nombreClave(r.responsable||"")===nombreClave(responsable)||r.fuentesExcel.some(f=>nombreClave(f.conductor)===nombreClave(responsable));
  return (!categoria||r.categoria===categoria)&&regionalCoincide&&responsableCoincide;
 });
 const raw=Number(valor("pagina")),paginas=Math.max(1,Math.ceil(filtrados.length/25)),pagina=Math.min(Number.isSafeInteger(raw)&&raw>0?raw:1,paginas);
 const vehiculosParaMantenimiento=registros.filter(r=>r.categoria==="vehiculos").map(({id,codigo,placa,descripcion,regionalNombre,estado})=>({id,codigo,placa,descripcion,regional:regionalNombre,estado}));
 return {puedeCrear,responsables,responsablesVehiculos,regionalesVehiculos,vehiculosParaMantenimiento,registradas:registros.filter(r=>r.criterio==="registrada").length,categorias,categoria,q,origen,estado,regional,responsable,regionales,origenes:procedencias.filter(p=>p.activa).map(p=>p.clave),totalInventario:rows.length,total:filtrados.length,totalBusqueda:baseFiltrada.length,oficiales:registros.filter(r=>r.criterio==="excel").length,sugeridas:registros.filter(r=>r.criterio==="sugerida").length,pagina,paginas,registros:completo?filtrados:filtrados.slice((pagina-1)*25,pagina*25)};
}
