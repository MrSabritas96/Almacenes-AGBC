import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { actAsignaciones } from "@/db/schema/activos.schema";
import { auditLogs } from "@/db/schema/audit.schema";
import { AsignacionError } from "./asignaciones-modelo";
export async function cambiarPapeleraAsignacion(input:unknown,userId:string,database:typeof db=db){
 const parsed=z.object({id:z.string().uuid(),restaurar:z.boolean()}).safeParse(input);if(!parsed.success)throw new AsignacionError("La asignación no es válida.");const {id,restaurar}=parsed.data;
 return database.transaction(async tx=>{
  const [a]=await tx.select().from(actAsignaciones).where(eq(actAsignaciones.id,id)).for("update");
  if(!a)throw new AsignacionError("No se encontró la asignación.");
  // Las recepciones creadas automáticamente al probar una devolución pueden retirarse
  // de la custodia activa; el acta queda intacta en el archivo institucional.
  if(!restaurar&&a.estado==="activa"&&!a.motivo.startsWith("Recepción por devolución:"))throw new AsignacionError("Esta asignación está activa. Registra primero su devolución mediante un acta de devolución y luego podrás eliminarla del listado.");
  if(Boolean(a.eliminadoEn)===!restaurar)return;
  await tx.update(actAsignaciones).set({eliminadoEn:restaurar?null:new Date()}).where(eq(actAsignaciones.id,id));
  await tx.insert(auditLogs).values({userId,module:"activos",action:restaurar?"restaurar_asignacion":"eliminar_asignacion",entity:"act_asignaciones",entityId:id,details:{activoId:a.activoId,estado:a.estado,recuperable:true}});
 });
}
