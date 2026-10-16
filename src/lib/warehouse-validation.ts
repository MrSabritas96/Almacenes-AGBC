import { z } from "zod";

export const shortText = z.string().trim().min(1).max(200);
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Fecha inválida");
export const personFields = {
  name: shortText,
  document: z.string().trim().min(3).max(40).transform(value => value.toUpperCase().replace(/\s+/g, "")).pipe(z.string().min(3).regex(/^[A-Z0-9-]+$/, "CI inválido. Usa números, letras y guiones.")),
  position: shortText,
  department: shortText,
  phone: z.string().trim().max(40).default(""),
};
export const todayInBolivia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
