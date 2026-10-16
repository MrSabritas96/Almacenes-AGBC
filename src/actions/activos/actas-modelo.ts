import { z } from "zod";

const texto = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v), "El texto contiene caracteres no válidos.");
const obligatorio = (max: number) => texto(max).refine(v => v.length > 0, "Completa los campos obligatorios.");
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v+"T00:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===v && v>="1900-01-01"; }, "Introduce una fecha válida.");
export const cabeceraActaSchema = z.object({
  responsable: obligatorio(200), cargo: obligatorio(200), ci: texto(80),
  entidad: obligatorio(80), ciudad: obligatorio(120), oficina: obligatorio(200),
  ubicacionDestino: obligatorio(200), fecha, fechaDevolucion: fecha.nullable(),
  motivo: obligatorio(2000).refine(v=>v.length>=5,"Describe el motivo de la operación (al menos cinco caracteres)."), entregadoPor: obligatorio(200), cargoEntrega: obligatorio(200), ciEntrega: texto(80),
  recibidoPor: obligatorio(200), cargoRecepcion: obligatorio(200), ciRecepcion: texto(80),
  observacionesGenerales: texto(2000),
});
export const guardarActaSchema = z.object({
  solicitudId: z.uuid(), tipo: z.enum(["fija","momentanea","devolucion"]), cabecera: cabeceraActaSchema,
  bienes: z.array(z.object({ activoId:z.uuid(), asignacionEsperada:z.uuid().nullable(), fijaEsperada:z.uuid().nullable(), placa:texto(80), estado:obligatorio(120), observaciones:texto(2000), accesorios:texto(2000) })).min(1,"Selecciona al menos un bien.").max(30,"El acta admite hasta 30 bienes."),
}).superRefine((a,ctx)=>{
  if(new Set(a.bienes.map(b=>b.activoId)).size!==a.bienes.length)ctx.addIssue({code:"custom",message:"Hay bienes repetidos en la selección."});
  if(a.tipo==="momentanea" && !a.cabecera.fechaDevolucion)ctx.addIssue({code:"custom",message:"La momentánea requiere fecha prevista de devolución."});
  if(a.tipo!=="momentanea" && a.cabecera.fechaDevolucion)ctx.addIssue({code:"custom",message:"Solo las momentáneas llevan fecha prevista de devolución."});
  if(a.cabecera.fechaDevolucion && a.cabecera.fechaDevolucion<a.cabecera.fecha)ctx.addIssue({code:"custom",message:"La devolución prevista no puede ser anterior a la entrega."});
});
export type ActaCabecera=z.infer<typeof cabeceraActaSchema>;
export type GuardarActa=z.infer<typeof guardarActaSchema>;
export type ActaBien={activoId:string;codigo:string|null;descripcion:string;origen:string;placa:string;estado:string;observaciones:string;accesorios:string};
export type DocumentoActa={id:string;numero:number;tipo:GuardarActa["tipo"];cabecera:ActaCabecera;bienes:ActaBien[]};
export function referenciaActa(a:Pick<DocumentoActa,"numero"|"tipo"|"cabecera">){return `AF-${a.tipo==="fija"?"F":a.tipo==="momentanea"?"M":"D"}-${String(a.numero).padStart(4,"0")}/${a.cabecera.fecha.slice(0,4)}`;}
