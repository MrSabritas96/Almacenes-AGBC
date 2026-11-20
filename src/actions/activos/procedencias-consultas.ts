import { cache } from "react";
import { asc,eq } from "drizzle-orm";
import { db } from "@/db";
import { actProcedencias } from "@/db/schema/activos.schema";
export const catalogoProcedencias=cache(async()=>db.select({clave:actProcedencias.clave,nombre:actProcedencias.nombre,activa:actProcedencias.activa,version:actProcedencias.version}).from(actProcedencias).orderBy(asc(actProcedencias.nombre)));
export async function procedenciaActiva(clave:string,database:Pick<typeof db,"select">=db){
 const [p]=await database.select().from(actProcedencias).where(eq(actProcedencias.clave,clave));
 return p?.activa?p:null;
}
