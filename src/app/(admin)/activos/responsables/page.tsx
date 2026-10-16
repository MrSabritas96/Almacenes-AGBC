import Link from "next/link";
import { asc,isNull,sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actResponsables } from "@/db/schema/activos.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { CatalogoResponsables } from "@/components/modules/activos/catalogo-responsables";
export default async function ResponsablesPage(){
 const session=await requireSession();if(!(await hasPermission(session.user.id,"activos:read")))redirect("/dashboard");
 const gestionar=await hasPermission(session.user.id,"activos:update");
 const rows=await db.select({id:actResponsables.id,nombre:actResponsables.nombre,cargo:actResponsables.cargo,oficina:actResponsables.oficina,telefono:actResponsables.telefono,correo:actResponsables.correo}).from(actResponsables).where(isNull(actResponsables.eliminadoEn)).orderBy(asc(actResponsables.nombre));
 const referencias=await db.execute(sql`select r.id,r.nombre,r.oficina,coalesce(array_agg(distinct upper(trim(regexp_replace(replace(c.ubicacion,chr(160),' '),'[[:space:]]+',' ','g')))) filter(where nullif(trim(c.ubicacion),'') is not null),'{}') ubicaciones from act_responsables r left join act_responsable_nombres n on n.responsable_id=r.id left join act_custodia_actual c on nullif(translate(upper(trim(regexp_replace(replace(c.responsable,chr(160),' '),'[[:space:]]+',' ','g'))),'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛ','AAAAEEEEIIIIOOOOUUUU'),'')=n.clave where r.eliminado_en is null group by r.id`);
 const ubicaciones=new Map(referencias.rows.map(row=>[String(row.id),Array.isArray(row.ubicaciones)?row.ubicaciones.map(String).sort():[]]));
 const registros=rows.map(row=>({...row,ubicaciones:ubicaciones.get(row.id)??[]}));
 return <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6"><Link href="/activos" className="text-sm text-brand-600">← Volver al inventario</Link><header><h1 className="text-3xl font-bold">Responsables</h1><p className="mt-2 text-sm text-ink-500">Administra los nombres que se utilizan en la búsqueda del inventario. La ubicación de referencia se obtiene de sus bienes cuando hay una sola. Si hay varias, elige la principal en Editar.</p></header><CatalogoResponsables registros={registros} puedeGestionar={gestionar}/></div>;
}
