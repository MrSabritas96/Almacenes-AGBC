"use server";

import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import { pool } from "@/db";
import { warehouseContext } from "@/lib/warehouse";
import type { DeliveryReceiptData } from "@/lib/warehouse-types";
import { syncStockNotifications, resolveRequestNotifications } from "@/lib/warehouse-notifications";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { personFields } from "@/lib/warehouse-validation";
import { WarehouseError } from "@/lib/warehouse-errors";

const short = z.string().trim().min(1).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Fecha inválida");
const staffFields = { username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_]+$/, "Usa entre 3 y 30 letras, números o guiones bajos."), name: short, email: z.string().email().max(200), role: z.literal("admin_almacenes"), warehouseId: short, document: short, position: short, department: short, phone: z.string().trim().max(40) };
const commands = z.discriminatedUnion("type", [
  z.object({type:z.literal("person"),id:short.optional(),warehouseId:short,...personFields}),
  z.object({ type: z.literal("material"), id: short.optional(), warehouseId: short, code: short, name: short, category: short, unit: short, stock: z.number().int().min(0).max(10000000), minimum: z.number().int().min(0).max(10000000), location: short, reason: short }),
  z.object({ type: z.literal("archive"), id: short }),
  z.object({ type: z.literal("review"), id: short, status: z.enum(["approved", "waiting", "denied", "delivered"]), response: z.string().trim().max(2000), identityConfirmed: z.literal("on").optional(), deliveryOn: date.optional() }),
  z.object({ type: z.literal("staff"), id: short.optional(), ...staffFields, password: z.string().min(8).max(128).optional() }),
  z.object({ type: z.literal("deactivate"), id: short, active: z.boolean() }),
  z.object({ type: z.literal("warehouse"), name: short, location: short }),
  z.object({ type: z.literal("request_form"), warehouseId: short, enabled: z.boolean() }),
  z.object({ type: z.literal("employee_material"), id: short.optional(), userId: short, name: short, category: short, unit: short, quantity: z.number().int().min(1).max(10000000), serial: z.string().trim().max(200), condition: short, location: short, recordedOn: date, notes: z.string().trim().max(2000), reason: short }),
  z.object({ type: z.literal("employee_material_archive"), id: short, reason: short }),
  z.object({ type: z.literal("delivery_correct"), id: short, userId: short, quantity: z.number().int().min(1).max(10000000), reason: short }),
  z.object({ type: z.literal("delivery_void"), id: short, reason: short }),
]);

/** El acta siempre se emite con la entrega vigente del servidor, nunca con una copia antigua de la pantalla. */
export async function getDeliveryReceipt(input: unknown, tabId?: string) {
  try {
    const id = short.parse(input);
    const viewer = await warehouseContext(tabId);
    if (!['superadmin','admin_almacenes'].includes(viewer.role)) throw new WarehouseError("Solo un administrador puede emitir actas de entrega.");
    const result = await pool.query(`select r.id,r.quantity,m.unit,m.name as material,r.delivered_at,r.updated_at,r.delivery_place,
      u.name as employee,u.document,u.position,u.department,w.name as warehouse,coalesce(a.name,'Sin registrar') as responsible
      from material_requests r join materials m on m.id=r.material_id join warehouse_people u on u.id=r.person_id
      join warehouses w on w.id=m.warehouse_id left join users a on a.id=r.reviewed_by
      where r.id=$1 and r.status='delivered' and ($2::text is null or m.warehouse_id=$2)`, [id,viewer.role==='superadmin'?null:viewer.warehouse_id]);
    const row = result.rows[0];
    if (!row) throw new WarehouseError("La entrega no está vigente o no pertenece a tu almacén.");
    const data: DeliveryReceiptData = JSON.parse(JSON.stringify({ request: {id:row.id,material:row.material,quantity:row.quantity,unit:row.unit,delivered_at:row.delivered_at,updated_at:row.updated_at,delivery_place:row.delivery_place,responsible:row.responsible}, recipient: {name:row.employee,document:row.document,position:row.position,department:row.department},warehouse:row.warehouse,issuer:viewer.name }));
    await audit({ userId:viewer.id,module:'almacenes',action:'delivery_receipt',entityId:id,details:{version:row.updated_at} });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: error instanceof WarehouseError ? error.message : 'No se pudo emitir el acta.' };
  }
}

export async function warehouseAction(input: unknown, tabId?: string): Promise<{ ok: boolean; error?: string }> {
  let actorId: string | undefined;
  let changeDetails: Record<string, unknown> | undefined;
  try {
    const parsed = commands.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." };
    const c = parsed.data;
    const viewer = await warehouseContext(tabId);
    actorId = viewer.id;
    const superadmin = viewer.role === "superadmin";
    const manager = viewer.role === "admin_almacenes" || superadmin;
    if (["staff", "deactivate", "warehouse"].includes(c.type) && !superadmin) throw new WarehouseError("Solo el SuperAdmin puede administrar el personal.");
    if (["person", "material", "archive", "review", "request_form", "employee_material", "employee_material_archive", "delivery_correct", "delivery_void"].includes(c.type) && !manager) throw new WarehouseError("Solo un administrador puede realizar esta operación.");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const scope = (warehouseId: string) => { if (!superadmin && warehouseId !== viewer.warehouse_id) throw new WarehouseError("Este almacén no está asignado a tu cuenta."); };
      if (c.type === "person") {
        scope(c.warehouseId);
        if(c.id){
          const previous=await client.query('select * from warehouse_people where id=$1 for update',[c.id]);
          if(!previous.rows[0])throw new WarehouseError('Ficha inexistente.');
          scope(previous.rows[0].warehouse_id);
          if(previous.rows[0].warehouse_id!==c.warehouseId)throw new WarehouseError('Una ficha con historial no se traslada a otro almacén.');
          await client.query('update warehouse_people set name=$2,document=$3,position=$4,department=$5,phone=$6 where id=$1',[c.id,c.name,c.document,c.position,c.department,c.phone]);
          changeDetails={previous:previous.rows[0],values:c};
        }else{
          await client.query('insert into warehouse_people(id,warehouse_id,name,document,position,department,phone) values($1,$2,$3,$4,$5,$6,$7)',[createId(),c.warehouseId,c.name,c.document,c.position,c.department,c.phone]);
        }
      } else if (c.type === "employee_material" || c.type === "employee_material_archive") {
        let previous;
        if (c.id) {
          const result = await client.query("select * from employee_materials where id=$1 and not archived for update", [c.id]);
          previous = result.rows[0];
          if (!previous) throw new WarehouseError("Registro inexistente o eliminado.");
          scope(previous.warehouse_id);
        }
        if (c.type === "employee_material_archive") {
          await client.query("update employee_materials set archived=true,updated_by=$2,updated_at=now() where id=$1", [c.id,viewer.id]);
          changeDetails = { previous, reason: c.reason };
        } else {
          const target = await client.query("select warehouse_id from warehouse_people where id=$1 and is_active for share", [c.userId]);
          if (!target.rows[0]) throw new WarehouseError("Selecciona un empleado activo.");
          scope(target.rows[0].warehouse_id);
          const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
          if (c.recordedOn > today) throw new WarehouseError("La fecha del registro no puede estar en el futuro.");
          const id = c.id ?? createId();
          await client.query("insert into employee_materials(id,person_id,warehouse_id,name,category,unit,quantity,serial,condition,location,recorded_on,notes,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) on conflict(id) do update set person_id=$2,user_id=null,warehouse_id=$3,name=$4,category=$5,unit=$6,quantity=$7,serial=$8,condition=$9,location=$10,recorded_on=$11,notes=$12,updated_by=$13,updated_at=now()", [id,c.userId,target.rows[0].warehouse_id,c.name,c.category,c.unit,c.quantity,c.serial,c.condition,c.location,c.recordedOn,c.notes,viewer.id]);
          changeDetails = { previous, recordId: id, values: c };
        }
      } else if (c.type === "delivery_correct" || c.type === "delivery_void") {
        const result = await client.query("select r.*,m.warehouse_id,m.archived,p.document as recipient_document from material_requests r join materials m on m.id=r.material_id join warehouse_people p on p.id=r.person_id where r.id=$1 for update of r", [c.id]);
        const previous = result.rows[0];
        if (!previous || previous.status !== "delivered") throw new WarehouseError("Solo puedes corregir entregas vigentes.");
        scope(previous.warehouse_id);
        const quantity = c.type === "delivery_void" ? 0 : c.quantity;
        if (c.type === "delivery_correct") {
          const target = await client.query("select warehouse_id,document from warehouse_people where id=$1 and is_active for share", [c.userId]);
          if (target.rows[0]?.warehouse_id !== previous.warehouse_id) throw new WarehouseError("El destinatario debe ser un empleado activo del mismo almacén.");
          if (target.rows[0].document.startsWith("LEGADO-")) throw new WarehouseError("Completa el CI del empleado en su ficha antes de corregir la entrega.");
        }
        const delta = previous.quantity - quantity;
        const stock = await client.query("update materials set stock=stock+$2 where id=$1 and stock+$2>=0 and (not archived or $2>=0) returning id", [previous.material_id,delta]);
        if (!stock.rowCount) throw new WarehouseError("No hay stock disponible para aumentar la cantidad entregada.");
        if (delta) await client.query("insert into stock_movements(id,material_id,user_id,delta,reason) values($1,$2,$3,$4,$5)", [createId(),previous.material_id,viewer.id,delta,`${c.type === 'delivery_void' ? 'Anulación' : 'Corrección'} de entrega ${c.id}: ${c.reason}`]);
        if (c.type === "delivery_void") await client.query("update material_requests set status='cancelled',delivered_at=null,response=response || $2,updated_at=now() where id=$1", [c.id,`\nEntrega anulada por error de registro: ${c.reason}`]);
        else await client.query("update material_requests set person_id=$2,user_id=null,quantity=$3,response=response || $4,updated_at=now() where id=$1", [c.id,c.userId,c.quantity,`\nEntrega corregida: ${c.reason}`]);
        changeDetails = { previous, values: c };
        await resolveRequestNotifications(client,c.id);
        await syncStockNotifications(client,previous.material_id);
      } else if (c.type === "request_form") {
        scope(c.warehouseId);
        const result = await client.query("update warehouses set requests_enabled=$2 where id=$1 returning id", [c.warehouseId,c.enabled]);
        if (!result.rowCount) throw new WarehouseError("Almacén inexistente.");
      } else if (c.type === "warehouse") {
        await client.query("insert into warehouses(id,name,location) values($1,$2,$3)", [createId(), c.name, c.location]);
      } else if (c.type === "material") {
        scope(c.warehouseId);
        const id = c.id ?? createId();
        let previous = 0;
        if (c.id) {
          const { rows } = await client.query("select * from materials where id=$1 for update", [id]);
          if (!rows[0] || rows[0].archived) throw new WarehouseError("Material no disponible.");
          scope(rows[0].warehouse_id);
          if (rows[0].warehouse_id !== c.warehouseId) throw new WarehouseError("No se puede trasladar un material con historial a otro almacén.");
          previous = rows[0].stock;
          await client.query("update materials set code=$2,name=$3,category=$4,unit=$5,stock=$6,minimum=$7,location=$8 where id=$1", [id,c.code,c.name,c.category,c.unit,c.stock,c.minimum,c.location]);
        } else {
          await client.query("insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location) values($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id,c.warehouseId,c.code,c.name,c.category,c.unit,c.stock,c.minimum,c.location]);
        }
        if (previous !== c.stock) await client.query("insert into stock_movements(id,material_id,user_id,delta,reason) values($1,$2,$3,$4,$5)", [createId(),id,viewer.id,c.stock-previous,c.reason]);
        await syncStockNotifications(client,id);
      } else if (c.type === "archive") {
        const { rows } = await client.query("select * from materials where id=$1 for update", [c.id]);
        if (!rows[0]) throw new WarehouseError("Material inexistente.");
        scope(rows[0].warehouse_id);
        const pending = await client.query("select id from material_requests where material_id=$1 and status in ('pending','approved','waiting')", [c.id]);
        if (pending.rowCount) throw new WarehouseError("Resuelve las solicitudes abiertas antes de eliminar el material.");
        await client.query("update materials set archived=true where id=$1", [c.id]);
        await syncStockNotifications(client,c.id);
      } else if (c.type === "review") {
        const { rows } = await client.query("select r.*,m.warehouse_id,m.archived,w.name as pickup_warehouse,p.document as recipient_document from material_requests r join materials m on m.id=r.material_id join warehouses w on w.id=m.warehouse_id join warehouse_people p on p.id=r.person_id where r.id=$1 for update of r", [c.id]);
        const r = rows[0];
        if (!r) throw new WarehouseError("Solicitud inexistente.");
        scope(r.warehouse_id);
        if (r.archived) throw new WarehouseError("Material eliminado.");
        const valid = c.status === "delivered" ? r.status === "approved" : ["pending", "waiting"].includes(r.status);
        if (!valid) throw new WarehouseError("La solicitud ya fue procesada. Actualiza la página.");
        if(c.status==="delivered"&&r.recipient_document.startsWith("LEGADO-"))throw new WarehouseError("Completa el CI del empleado en su ficha antes de confirmar la entrega.");
        if(c.status==="delivered"&&!c.identityConfirmed)throw new WarehouseError("Verifica el CI del destinatario antes de confirmar la entrega.");
        if ((c.status === "denied" || c.status === "waiting") && !c.response) throw new WarehouseError("Indica el motivo o la información de reposición.");
        const deliveryPlace = c.status === "approved" ? r.pickup_warehouse : null;
        if (c.status === "approved") {
          if (!c.deliveryOn) throw new WarehouseError("Indica la fecha de entrega o recojo.");
          const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
          if (c.deliveryOn < today) throw new WarehouseError("La fecha de entrega no puede estar en el pasado.");
          const reserved = await client.query("update materials set stock=stock-$2 where id=$1 and stock >= $2 and not archived returning id", [r.material_id,r.quantity]);
          if (!reserved.rowCount) throw new WarehouseError("Stock insuficiente. Usa «Aceptada sin stock» para informar al empleado.");
          await client.query("insert into stock_movements(id,material_id,user_id,delta,reason) values($1,$2,$3,$4,$5)", [createId(),r.material_id,viewer.id,-r.quantity,`Reserva para solicitud ${r.id}`]);
        }
        await client.query("update material_requests set status=$2,response=$3,delivery_on=coalesce($4,delivery_on),delivery_place=coalesce($5,delivery_place),reviewed_by=$6,updated_at=now(),delivered_at=case when $2='delivered' then now() else delivered_at end where id=$1", [c.id,c.status,c.response,c.status === "approved" ? c.deliveryOn : null,deliveryPlace,viewer.id]);
        if(r.user_id) await client.query("insert into notificaciones(id,user_id,module,title,message,link) values($1,$2,'almacenes',$3,$4,'/dashboard')", [createId(),r.user_id,"Tu solicitud fue actualizada",`${c.status === 'waiting' ? 'Aceptada sin stock' : c.status === 'denied' ? 'Rechazada' : c.status === 'delivered' ? 'Entregada' : 'Aprobada'}: ${c.response} ${c.deliveryOn ?? ''} ${deliveryPlace ?? ''}`]);
        await resolveRequestNotifications(client,c.id);
        await syncStockNotifications(client,r.material_id);
      } else if (c.type === "staff") {
        const id = c.id ?? createId();
        const exists = await client.query("select id from warehouses where id=$1", [c.warehouseId]);
        if (!exists.rowCount) throw new WarehouseError("Selecciona un almacén válido.");
        if (c.id) {
          const target = await client.query("select r.name from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=$1", [id]);
          if (!target.rowCount || target.rows.some(r => r.name!=='admin_almacenes')) throw new WarehouseError("Esta cuenta no puede editarse desde la nómina de almacenes.");
          await client.query("update users set name=$2,email=$3,username=$4,updated_at=now() where id=$1", [id,c.name,c.email.toLowerCase(),c.username]);
          await client.query("delete from user_roles where user_id=$1", [id]);
          await client.query("delete from sessions where user_id=$1", [id]);
          if (c.password) await client.query("update accounts set password=$2,updated_at=now() where user_id=$1 and provider_id='credential'", [id,await hashPassword(c.password)]);
        } else {
          if (!c.password) throw new WarehouseError("Introduce una contraseña de al menos 8 caracteres.");
          await client.query("insert into users(id,name,email,username) values($1,$2,$3,$4)", [id,c.name,c.email.toLowerCase(),c.username]);
          await client.query("insert into accounts(id,user_id,account_id,provider_id,password) values($1,$2,$2,'credential',$3)", [createId(),id,await hashPassword(c.password)]);
        }
        await client.query("insert into user_roles(user_id,role_id) select $1,id from roles where name=$2", [id,c.role]);
        await client.query("insert into staff_profiles(user_id,warehouse_id,document,position,department,phone) values($1,$2,$3,$4,$5,$6) on conflict(user_id) do update set warehouse_id=$2,document=$3,position=$4,department=$5,phone=$6", [id,c.warehouseId,c.document,c.position,c.department,c.phone]);
        if(c.role==='admin_almacenes') {
          const low=await client.query('select id from materials where warehouse_id=$1 and not archived and stock<=minimum order by id',[c.warehouseId]);
          for(const material of low.rows) await syncStockNotifications(client,material.id);
        }
      } else if (c.type === "deactivate") {
        const target = await client.query("select r.name from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=$1", [c.id]);
        if (!target.rowCount || target.rows.some(r => r.name!=='admin_almacenes')) throw new WarehouseError("Esta cuenta no puede eliminarse desde almacenes.");
        await client.query("update users set is_active=$2,updated_at=now() where id=$1", [c.id,c.active]);
        await client.query("delete from sessions where user_id=$1", [c.id]);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
    await audit({ userId: viewer.id, module: "almacenes", action: c.type, entityId: c.type === "request_form" ? c.warehouseId : "id" in c ? c.id : undefined, details: c.type === "request_form" ? { enabled: c.enabled } : changeDetails });
    (globalThis as typeof globalThis & { __io?: { to: (room: string) => { emit: (event: string) => void } } }).__io?.to("warehouse:live").emit("warehouse:changed");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    const databaseError = error as { code?: string } | null;
    const message = databaseError?.code === "23505" ? "El CI de esta ficha, correo, nombre de usuario o código ya existe." : error instanceof WarehouseError ? error.message : "No se pudo guardar. Revisa los datos e intenta nuevamente.";
    await audit({ userId: actorId, module: "almacenes", action: "mutation", result: "failure", details: { message } });
    return { ok: false, error: message };
  }
}
