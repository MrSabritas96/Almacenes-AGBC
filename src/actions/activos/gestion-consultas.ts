import "server-only";
import { db } from "@/db";
import { actGestionActiva } from "@/db/schema/activos.schema";
import { hoyBolivia } from "./asignaciones-modelo";

export async function gestionActiva() {
  const [row] = await db.select({ gestion: actGestionActiva.gestion }).from(actGestionActiva).limit(1);
  const gestion = row?.gestion ?? Number(hoyBolivia().slice(0, 4));
  const hoy = hoyBolivia();
  const hoyGestion = Number(hoy.slice(0, 4));
  return {
    gestion,
    hoy,
    fechaInicial: gestion === hoyGestion ? hoy : `${gestion}-01-01`,
    fechaMinima: `${gestion}-01-01`,
    fechaMaxima: gestion === hoyGestion ? hoy : `${gestion}-12-31`,
  };
}
