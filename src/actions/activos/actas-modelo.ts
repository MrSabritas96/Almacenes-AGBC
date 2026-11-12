import { z } from "zod";
import { REGIONALES_ACTA, PISOS_LA_PAZ, nombreProcedencia } from "./actas-plantilla";

const texto = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v), "El texto contiene caracteres no válidos.");
const obligatorio = (max: number) => texto(max).refine(v => v.length > 0, "Completa los campos obligatorios.");
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v+"T00:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===v && v>="1900-01-01"; }, "Introduce una fecha válida.");
export const cabeceraActaSchema = z.object({
  formato: z.literal("institucional-2026").optional(),
  actasOrigen: z.array(z.object({id:z.uuid(),fuente:z.enum(["excel","sistema"])})).max(20).optional(),
  regional: z.enum(REGIONALES_ACTA).optional(), piso: z.enum(PISOS_LA_PAZ).optional(),
  responsable: obligatorio(200), cargo: obligatorio(200), ci: texto(80),
  entidad: obligatorio(80), procedenciaNombre: texto(80).optional(), ciudad: obligatorio(120), oficina: obligatorio(200),
  ubicacionDestino: obligatorio(200), fecha, fechaDevolucion: fecha.nullable(),
  motivo: obligatorio(2000).refine(v=>v.length>=5,"Describe el motivo de la operación (al menos cinco caracteres)."), entregadoPor: obligatorio(200), cargoEntrega: obligatorio(200), ciEntrega: texto(80),
  recibidoPor: obligatorio(200), cargoRecepcion: obligatorio(200), ciRecepcion: texto(80),
  recibirEnAlmacenes: z.boolean().optional(),
  observacionesGenerales: texto(2000),
});
export const guardarActaSchema = z.object({
  solicitudId: z.uuid(), tipo: z.enum(["fija","momentanea","devolucion"]), cabecera: cabeceraActaSchema,
  bienes: z.array(z.object({ activoId:z.uuid().nullable(), codigo:texto(200).optional(), descripcion:texto(4000).optional(), asignacionEsperada:z.uuid().nullable(), fijaEsperada:z.uuid().nullable(), placa:texto(80), estado:obligatorio(120), observaciones:texto(2000), accesorios:texto(2000) })).min(1,"Añade al menos un bien.").max(100,"El acta admite hasta 100 bienes."),
}).superRefine((a,ctx)=>{
  const ids=a.bienes.flatMap(b=>b.activoId?[b.activoId]:[]);
  if(new Set(ids).size!==ids.length)ctx.addIssue({code:"custom",message:"Hay bienes repetidos en la selección."});
  for(const b of a.bienes)if(!b.activoId&&(!b.descripcion||b.descripcion.length<3))ctx.addIssue({code:"custom",message:"Describe los bienes de las filas manuales."});
  if(a.cabecera.formato){
    if(!a.cabecera.regional)ctx.addIssue({code:"custom",message:"Selecciona la regional."});
    if(a.cabecera.regional==="La Paz"&&!a.cabecera.piso)ctx.addIssue({code:"custom",message:"Selecciona el piso de La Paz."});
    if(a.bienes.some(b=>!['BUENO','REGULAR','MALO'].includes(b.estado)))ctx.addIssue({code:"custom",message:"El estado debe ser BUENO, REGULAR o MALO."});
  }
  if(a.tipo==="momentanea" && !a.cabecera.fechaDevolucion)ctx.addIssue({code:"custom",message:"La momentánea requiere fecha prevista de devolución."});
  if(a.tipo!=="devolucion"&&a.cabecera.actasOrigen?.length)ctx.addIssue({code:"custom",message:"Solo una devolución puede vincular actas de asignación de origen."});
  if(a.tipo!=="momentanea" && a.cabecera.fechaDevolucion)ctx.addIssue({code:"custom",message:"Solo las momentáneas llevan fecha prevista de devolución."});
  if(a.cabecera.fechaDevolucion && a.cabecera.fechaDevolucion<a.cabecera.fecha)ctx.addIssue({code:"custom",message:"La devolución prevista no puede ser anterior a la entrega."});
});
export type ActaCabecera=z.infer<typeof cabeceraActaSchema>;
export type GuardarActa=z.infer<typeof guardarActaSchema>;
export type ActaBien={activoId:string|null;codigo:string|null;descripcion:string;origen:string;placa:string;estado:string;observaciones:string;accesorios:string};
export type DocumentoActa={id:string;numero:number;tipo:GuardarActa["tipo"];cabecera:ActaCabecera;bienes:ActaBien[]};
export function referenciaActa(a:Pick<DocumentoActa,"numero"|"tipo"|"cabecera">){return a.cabecera.formato?`${String(a.numero).padStart(3,"0")} ${nombreProcedencia(a.cabecera.entidad,a.cabecera.procedenciaNombre)}/${a.cabecera.fecha.slice(0,4)}`:`AF-${a.tipo==="fija"?"F":a.tipo==="momentanea"?"M":"D"}-${String(a.numero).padStart(4,"0")}/${a.cabecera.fecha.slice(0,4)}`;}
