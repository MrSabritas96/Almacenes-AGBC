import { compareMaterialNames } from "./material-code";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { pool } from "@/db";
import { personFields, shortText } from "./warehouse-validation";
import { notifyNewRequest } from "./warehouse-notifications";
import { WarehouseError } from "./warehouse-errors";
import type { PoolClient } from "pg";
import { createRequestReference } from "./request-reference";

const requestLine=z.object({materialId:shortText,quantity:z.number().int().min(1).max(10000)});
const requestFields = z.preprocess(value=>{
  if(value&&typeof value==='object'&&!Array.isArray(value)&&!('lines' in value)){
    const old=value as Record<string,unknown>;
    return {...old,lines:[{materialId:old.materialId,quantity:old.quantity}]};
  }
  return value;
},z.object({
  ...personFields,
  warehouseId: shortText,
  lines:z.array(requestLine).min(1).max(20).refine(lines=>new Set(lines.map(line=>line.materialId)).size===lines.length,'No repitas materiales: reúne su cantidad en una sola línea.'),
  purpose: z.string().trim().min(10).max(2000),
  priority: z.enum(["normal", "urgent"]),

  submissionKey: z.string().uuid(),
  website: z.string().max(0).optional(),
}));

export async function requestCatalog() {
  const [warehouses, materials, people] = await Promise.all([
    pool.query("select id,name,location from warehouses where requests_enabled order by name"),
    pool.query("select m.id,m.name,m.code,m.unit,m.warehouse_id from materials m join warehouses w on w.id=m.warehouse_id where not m.archived and w.requests_enabled order by m.name"),
    pool.query("select p.id,p.warehouse_id,p.name,p.document,p.position,p.department,p.phone,p.regional from warehouse_people p join warehouses w on w.id=p.warehouse_id where p.is_active and w.requests_enabled order by p.name,p.department,p.id"),
  ]);
  return { warehouses: warehouses.rows as { id: string; name: string; location: string }[], materials: materials.rows.sort(compareMaterialNames) as { id: string; name: string; code: string; unit: string; warehouse_id: string }[], people: people.rows as {id:string;warehouse_id:string;name:string;document:string;position:string;department:string;phone:string;regional:string}[] };
}

/** Registrar una solicitud no modifica fichas institucionales ni devuelve existencias o historiales. */
export async function receiveMaterialRequest(input: unknown) {
  const parsed = requestFields.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const c = parsed.data;
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
    const materialIds=c.lines.map(line=>line.materialId).sort();
    const material = await client.query("select id from materials where id=any($1::text[]) and warehouse_id=$2 and not archived order by id for share", [materialIds, c.warehouseId]);
    if (material.rowCount!==materialIds.length) throw new WarehouseError("Selecciona materiales disponibles en este almacén.");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [`${c.warehouseId}:${c.document}`]);
    const recent = await client.query(`select count(distinct coalesce(r.group_reference,r.id))::int as n from material_requests r join warehouse_people p on p.id=r.person_id
      where p.warehouse_id=$1 and p.document=$2 and r.created_at>now()-interval '1 hour'`, [c.warehouseId,c.document]);
    if (recent.rows[0].n >= 10) throw new WarehouseError("Ya registraste varias solicitudes. Contacta a la administradora antes de enviar más.");
    // Un formulario público no puede sobrescribir una ficha institucional existente.
    const person = await client.query(`insert into warehouse_people(id,warehouse_id,name,document,position,department,phone,regional)
      values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(warehouse_id,document) do update set document=excluded.document
      returning id,is_active`, [createId(),c.warehouseId,c.name,c.document,c.position,c.department,c.phone,c.regional]);
    if (!person.rows[0].is_active) throw new WarehouseError("Contacta a la administradora para registrar tu solicitud.");
    let reference='';
    const requesterDetails=JSON.stringify({name:c.name,document:c.document,position:c.position,department:c.department,phone:c.phone,regional:c.regional});
    for(const [index,line] of c.lines.entries()){
      let id='';
      for(let attempt=0;attempt<5;attempt++) {
        const candidate=createRequestReference();
        const inserted=await client.query(`insert into material_requests(id,person_id,material_id,quantity,purpose,priority,needed_on,submission_key,requester_details,group_reference)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do nothing returning id`, [candidate,person.rows[0].id,line.materialId,line.quantity,c.purpose,c.priority,"",index===0?c.submissionKey:null,requesterDetails,reference||candidate]);
        if(inserted.rowCount){id=candidate;break;}
      }
      if(!id)throw new WarehouseError('No se pudo generar el comprobante. Intenta nuevamente.');
      reference ||= id;
      await notifyNewRequest(client,id);
      await client.query("insert into audit_logs(id,module,action,entity_id,details,result) values($1,'almacenes','public_request',$2,$3,'success')", [createId(),id,JSON.stringify({personId:person.rows[0].id,warehouseId:c.warehouseId,reference})]);
    }
    await client.query("commit");
    return { ok: true as const, reference };
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    return { ok: false as const, error: error instanceof WarehouseError ? error.message : "No se pudo registrar la solicitud. Intenta nuevamente." };
  } finally { client?.release(); }
}
