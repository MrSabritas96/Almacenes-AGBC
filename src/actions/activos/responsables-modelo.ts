import { z } from "zod";
export function nombreResponsable(value:string) {
 return value.replace(/\s+/g," ").trim().toUpperCase().replace(/[ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ]/g,c=>"AAAAEEEEIIIIOOOOUUUU"["ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ".indexOf(c)]??c);
}
const dato=z.string().trim().max(200).refine(v=>!/[\x00-\x1f\x7f]/.test(v),"No se permiten caracteres de control.");
export const responsableSchema=z.object({id:z.string().uuid().optional(),nombre:dato.min(3).transform(nombreResponsable),cargo:dato,oficina:dato,telefono:dato,correo:z.union([z.literal(""),z.string().email().max(200)])});
