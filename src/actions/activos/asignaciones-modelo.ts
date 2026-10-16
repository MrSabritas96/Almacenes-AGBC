import { z } from "zod";

export function hoyBolivia() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const fechaValida = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Introduce una fecha válida.")
  .refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01";
  }, "Introduce una fecha válida.");

export const nuevaAsignacionSchema = z.object({
  solicitudId: z.uuid("La solicitud no es válida. Actualiza la ficha."),
  activoId: z.uuid("El activo no es válido."),
  asignacionFijaEsperada: z.uuid().nullable(),
  tipo: z.enum(["fija", "momentanea"]),
  responsableDestino: z.string().trim().min(3, "Indica el responsable receptor.").max(200),
  ubicacionDestino: z.string().trim().min(2, "Indica la ubicación de destino.").max(200),
  fechaInicio: fechaValida,
  fechaDevolucionPrevista: fechaValida.nullable(),
  motivo: z.string().trim().min(5, "Describe el motivo de la asignación (al menos 5 caracteres).").max(2000),
  referenciaActa: z.string().trim().max(200).nullable(),
}).superRefine((input, ctx) => {
  if (input.tipo === "momentanea" && !input.fechaDevolucionPrevista) ctx.addIssue({ code: "custom", path: ["fechaDevolucionPrevista"], message: "La asignación momentánea requiere una fecha prevista de devolución." });
  if (input.tipo === "fija" && input.fechaDevolucionPrevista) ctx.addIssue({ code: "custom", path: ["fechaDevolucionPrevista"], message: "La asignación fija no lleva fecha prevista de devolución." });
  if (input.fechaDevolucionPrevista && input.fechaDevolucionPrevista < input.fechaInicio) ctx.addIssue({ code: "custom", path: ["fechaDevolucionPrevista"], message: "La devolución no puede ser anterior al inicio." });
});

export const devolucionAsignacionSchema = z.object({
  asignacionId: z.uuid("La asignación no es válida."),
  fechaCierre: fechaValida,
  motivoCierre: z.string().trim().min(5, "Describe la devolución (al menos 5 caracteres).").max(2000),
});

export type NuevaAsignacion = z.infer<typeof nuevaAsignacionSchema>;
export type DevolucionAsignacion = z.infer<typeof devolucionAsignacionSchema>;
export type Asignacion = typeof import("@/db/schema/activos.schema").actAsignaciones.$inferSelect;

export class AsignacionError extends Error {}
