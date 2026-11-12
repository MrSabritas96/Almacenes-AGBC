import { z } from "zod";
export const cambioArchivoSchema=z.object({id:z.uuid(),version:z.number().int().positive(),numero:z.string().trim().min(1).max(120),tipo:z.enum(["asignacion","devolucion"]),procedencia:z.string().trim().min(1).max(80),responsableId:z.uuid().nullable(),fecha:z.iso.date().nullable(),regional:z.enum(["Oficina Central","El Alto","Santa Cruz","Cochabamba","Oruro","Potosí","Sucre","Tarija","Beni","Pando"])});
export const estadoArchivoSchema=z.object({id:z.uuid(),version:z.number().int().positive(),restaurar:z.boolean()});
export type CambioArchivo=z.infer<typeof cambioArchivoSchema>;
export type EstadoArchivo=z.infer<typeof estadoArchivoSchema>;
