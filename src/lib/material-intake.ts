import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { pool } from "@/db";
import { calendarDate, personFields, shortText, todayInBolivia } from "./warehouse-validation";
import { notifyNewRequest } from "./warehouse-notifications";
import { WarehouseError } from "./warehouse-errors";
import type { PoolClient } from "pg";
import { createRequestReference } from "./request-reference";

const requestFields = z.object({
  ...personFields,
  warehouseId: shortText,
  materialId: shortText,
  quantity: z.number().int().min(1).max(10000),
  purpose: z.string().trim().min(10).max(2000),
  priority: z.enum(["normal", "urgent"]),
  neededOn: calendarDate,
  submissionKey: z.string().uuid(),
  website: z.string().max(0).optional(),
});

export async function requestCatalog() {
  const [warehouses, materials] = await Promise.all([
    pool.query("select id,name,location from warehouses where requests_enabled order by name"),
    pool.query("select m.id,m.name,m.code,m.unit,m.warehouse_id from materials m join warehouses w on w.id=m.warehouse_id where not m.archived and w.requests_enabled order by m.name"),
  ]);
  return { warehouses: warehouses.rows as { id: string; name: string; location: string }[], materials: materials.rows as { id: string; name: string; code: string; unit: string; warehouse_id: string }[] };
}

/** El formulario nunca devuelve fichas, existencias ni solicitudes de otras personas. */
export async function receiveMaterialRequest(input: unknown) {
  const parsed = requestFields.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const c = parsed.data;
  if (c.neededOn < todayInBolivia()) return { ok: false as const, error: "La fecha requerida no puede estar en el pasado." };
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("begin");
    // Serializa reintentos del mismo envío y altas concurrentes del mismo CI.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [c.submissionKey]);
    const previous = await client.query("select id from material_requests where submission_key=$1", [c.submissionKey]);
    if (previous.rows[0]) {
      await client.query("commit");
      return { ok: true as const, reference: previous.rows[0].id as string };
    }
    const form = await client.query("select requests_enabled from warehouses where id=$1 for share", [c.warehouseId]);
    if (!form.rows[0]?.requests_enabled) throw new WarehouseError("El formulario de este almacén está cerrado.");
    const material = await client.query("select id from materials where id=$1 and warehouse_id=$2 and not archived for share", [c.materialId, c.warehouseId]);
    if (!material.rowCount) throw new WarehouseError("Selecciona un material disponible en este almacén.");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [`${c.warehouseId}:${c.document}`]);
    const recent = await client.query(`select count(*)::int as n from material_requests r join warehouse_people p on p.id=r.person_id
      where p.warehouse_id=$1 and p.document=$2 and r.created_at>now()-interval '1 hour'`, [c.warehouseId,c.document]);
    if (recent.rows[0].n >= 10) throw new WarehouseError("Ya registraste varias solicitudes. Contacta a la administradora antes de enviar más.");
    // Un formulario público no puede sobrescribir una ficha institucional existente.
    const person = await client.query(`insert into warehouse_people(id,warehouse_id,name,document,position,department,phone)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(warehouse_id,document) do update set document=excluded.document
      returning id,is_active`, [createId(),c.warehouseId,c.name,c.document,c.position,c.department,c.phone]);
    if (!person.rows[0].is_active) throw new WarehouseError("Contacta a la administradora para registrar tu solicitud.");
    let id='';
    for(let attempt=0;attempt<5;attempt++) {
      const candidate=createRequestReference();
      const inserted=await client.query(`insert into material_requests(id,person_id,material_id,quantity,purpose,priority,needed_on,submission_key,requester_details)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do nothing returning id`, [candidate,person.rows[0].id,c.materialId,c.quantity,c.purpose,c.priority,c.neededOn,c.submissionKey,JSON.stringify({name:c.name,document:c.document,position:c.position,department:c.department,phone:c.phone})]);
      if(inserted.rowCount){id=candidate;break;}
    }
    if(!id)throw new WarehouseError('No se pudo generar el comprobante. Intenta nuevamente.');
    await notifyNewRequest(client,id);
    await client.query("insert into audit_logs(id,module,action,entity_id,details,result) values($1,'almacenes','public_request',$2,$3,'success')", [createId(),id,JSON.stringify({personId:person.rows[0].id,warehouseId:c.warehouseId})]);
    await client.query("commit");
    return { ok: true as const, reference: id };
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    return { ok: false as const, error: error instanceof WarehouseError ? error.message : "No se pudo registrar la solicitud. Intenta nuevamente." };
  } finally { client?.release(); }
}
