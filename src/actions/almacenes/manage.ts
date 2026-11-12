"use server";
import { z } from "zod";
import { consumeFifo, receiveFifo, restoreFifo, syncRequestFifo } from "@/lib/warehouse-fifo";
import { formatMaterialCode } from "@/lib/material-code";
import { normalizeCategory } from "@/lib/warehouse-reference";
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
import { readPurchaseAttachments } from "@/lib/purchase-attachments";
const short = z.string().trim().min(1).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Fecha inválida");
const staffFields = { username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_]+$/, "Usa entre 3 y 30 letras, números o guiones bajos."), name: short, email: z.string().email().max(200), role: z.literal("admin_almacenes"), warehouseId: short, document: short, position: short, department: short, phone: z.string().trim().max(40) };
const previousMaterialFields = { name: short, category: short, unit: short, quantity: z.number().int().min(1).max(10000000), serial: z.string().trim().max(200), condition: short, location: short, notes: z.string().trim().max(2000) };
const commands = z.discriminatedUnion("type", [
  z.object({type:z.literal("person_active"),id:short,active:z.boolean(),reason:short}),
  z.object({type:z.literal("person"),id:short.optional(),warehouseId:short,...personFields}),
  z.object({ type: z.literal("material"), id: short.optional(), warehouseId: short, name: short, category: short, unit: short, stock: z.number().int().min(0).max(10000000), minimum: z.number().int().min(0).max(10000000), location: short, reason: short, invoiceDescription:z.string().trim().max(2000).default(""), description:z.string().trim().max(2000).default(""), unitCost:z.coerce.number().finite().min(0).max(100000000).default(0), openingOn:z.preprocess(value=>value===''?undefined:value,date.optional()) }),
  z.object({ type: z.literal("archive"), id: short }),
  z.object({ type: z.literal("review"), id: short, status: z.enum(["approved", "waiting", "denied", "delivered"]), response: z.string().trim().max(2000), identityConfirmed: z.literal("on").optional(), deliveryOn: date.optional(), authorizedQuantity:z.coerce.number().int().positive().max(10000000).optional(), fund:z.string().trim().max(200).optional(),lot:z.string().trim().max(200).default(""),expiresOn:z.union([z.literal(""),date]).optional() }),
  z.object({ type: z.literal("staff"), id: short.optional(), ...staffFields, password: z.string().min(8).max(128).optional() }),
  z.object({ type: z.literal("deactivate"), id: short, active: z.boolean() }),
  z.object({ type: z.literal("warehouse"), name: short, location: short }),
  z.object({ type: z.literal("request_form"), warehouseId: short, enabled: z.boolean() }),
  z.object({ type: z.literal("employee_material"), id: short.optional(), userId: short, ...previousMaterialFields, recordedOn: date, reason: short }),
  z.object({ type: z.literal("employee_material_batch"), userId: short, items: z.array(z.object(previousMaterialFields)).min(1).max(50), recordedOn: date, reason: short }),
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
    const result = await pool.query(`select r.id,coalesce((select jsonb_agg(jsonb_build_object('entry_code','E-'||lpad(b.id::text,greatest(6,length(b.id::text)),'0'),'lot',b.lot,'expires_on',b.expires_on,'quantity',a.quantity,'unit_cost',b.unit_cost::text) order by b.received_at,b.id) from inventory_allocations a join inventory_batches b on b.id=a.batch_id where a.request_id=r.id),'[]'::jsonb) as allocations,coalesce(r.authorized_quantity,r.quantity) as quantity,r.quantity as requested_quantity,r.fund,r.lot,r.expires_on,r.purpose,r.unit_cost,m.code,m.unit,m.name as material,r.delivered_at,r.updated_at,r.delivery_place,
      u.name as employee,u.document,u.position,u.department,u.regional,w.name as warehouse,coalesce(a.name,'Sin registrar') as responsible
      from material_requests r join materials m on m.id=r.material_id join warehouse_people u on u.id=r.person_id
      join warehouses w on w.id=m.warehouse_id left join users a on a.id=r.reviewed_by
      where r.id=$1 and r.status='delivered' and ($2::text is null or m.warehouse_id=$2)`, [id,viewer.role==='superadmin'?null:viewer.warehouse_id]);
    const row = result.rows[0];
    if (!row) throw new WarehouseError("La entrega no está vigente o no pertenece a tu almacén.");
    const allocations=row.allocations??[];
    const data: DeliveryReceiptData = JSON.parse(JSON.stringify({ request: {allocations,id:row.id,material:row.material,quantity:row.quantity,unit:row.unit,delivered_at:row.delivered_at,updated_at:row.updated_at,delivery_place:row.delivery_place,responsible:row.responsible,code:row.code,unit_cost:row.unit_cost,lot:row.lot,expires_on:row.expires_on,fund:row.fund,purpose:row.purpose}, recipient: {name:row.employee,document:row.document,position:row.position,department:row.department,regional:row.regional},warehouse:row.warehouse,issuer:viewer.name }));
    await audit({ userId:viewer.id,module:'almacenes',action:'delivery_receipt',entityId:id,details:{version:row.updated_at} });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: error instanceof WarehouseError ? error.message : 'No se pudo emitir el acta.' };
  }
}
export async function warehouseAction(input: unknown, tabId?: string, documents?: FormData): Promise<{ ok: boolean; error?: string }> {
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
    if (["person_active", "person", "material", "archive", "review", "request_form", "employee_material", "employee_material_batch", "employee_material_archive", "delivery_correct", "delivery_void"].includes(c.type) && !manager) throw new WarehouseError("Solo un administrador puede realizar esta operación.");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const scope = (warehouseId: string) => { if (!superadmin && warehouseId !== viewer.warehouse_id) throw new WarehouseError("Este almacén no está asignado a tu cuenta."); };
      if(c.type === "person_active") {
        const target=await client.query('select * from warehouse_people where id=$1 for update',[c.id]);
        if(!target.rows[0])throw new WarehouseError('Ficha inexistente.');
        scope(target.rows[0].warehouse_id);
        await client.query('update warehouse_people set is_active=$2 where id=$1',[c.id,c.active]);
        changeDetails={previous:target.rows[0],active:c.active,reason:c.reason};
      } else if (c.type === "person") {
        scope(c.warehouseId);
        if(c.id){
          const previous=await client.query('select * from warehouse_people where id=$1 for update',[c.id]);
          if(!previous.rows[0])throw new WarehouseError('Ficha inexistente.');
          scope(previous.rows[0].warehouse_id);
          if(previous.rows[0].warehouse_id!==c.warehouseId)throw new WarehouseError('Una ficha con historial no se traslada a otro almacén.');
          await client.query('update warehouse_people set name=$2,document=$3,position=$4,department=$5,phone=$6,regional=$7 where id=$1',[c.id,c.name,c.document,c.position,c.department,c.phone,c.regional]);
          changeDetails={previous:previous.rows[0],values:c};
        }else{
          await client.query('insert into warehouse_people(id,warehouse_id,name,document,position,department,phone,regional) values($1,$2,$3,$4,$5,$6,$7,$8)',[createId(),c.warehouseId,c.name,c.document,c.position,c.department,c.phone,c.regional]);
        }
      } else if (c.type === "employee_material" || c.type === "employee_material_batch" || c.type === "employee_material_archive") {
        let previous;
        const editId = c.type === "employee_material_batch" ? undefined : c.id;
        if (editId) {
          const result = await client.query("select * from employee_materials where id=$1 and not archived for update", [editId]);
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
          const items = c.type === "employee_material_batch" ? c.items : [c];
          const recordIds: string[] = [];
          for (const item of items) {
            const id = editId ?? createId();
            await client.query("insert into employee_materials(id,person_id,warehouse_id,name,category,unit,quantity,serial,condition,location,recorded_on,notes,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) on conflict(id) do update set person_id=$2,user_id=null,warehouse_id=$3,name=$4,category=$5,unit=$6,quantity=$7,serial=$8,condition=$9,location=$10,recorded_on=$11,notes=$12,updated_by=$13,updated_at=now()", [id,c.userId,target.rows[0].warehouse_id,item.name,normalizeCategory(item.category),item.unit,item.quantity,item.serial,item.condition,item.location,c.recordedOn,item.notes,viewer.id]);
            recordIds.push(id);
          }
          changeDetails = { previous, recordId: recordIds[0], recordIds, values: c };
        }
      } else if (c.type === "delivery_correct" || c.type === "delivery_void") {
        const result = await client.query("select r.*,coalesce(r.authorized_quantity,r.quantity) as quantity,m.warehouse_id,m.archived,p.document as recipient_document from material_requests r join materials m on m.id=r.material_id join warehouse_people p on p.id=r.person_id where r.id=$1 for update of r", [c.id]);
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
        const reason=`${c.type==='delivery_void'?'Anulación':'Corrección'} de entrega ${c.id}: ${c.reason}`;
        if(delta>0)await restoreFifo(client,previous.material_id,viewer.id,delta,reason,c.id);
        else if(delta<0)await consumeFifo(client,previous.material_id,viewer.id,-delta,reason,c.id);
        if (c.type === "delivery_void") await client.query("update material_requests set status='cancelled',delivered_at=null,response=response || $2,updated_at=now() where id=$1", [c.id,`\nEntrega anulada por error de registro: ${c.reason}`]);
        else await client.query("update material_requests set person_id=$2,user_id=null,authorized_quantity=$3,response=response || $4,updated_at=now() where id=$1", [c.id,c.userId,c.quantity,`\nEntrega corregida: ${c.reason}`]);
        if(c.type === "delivery_correct")await syncRequestFifo(client,c.id);
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
        const attachments=documents?await readPurchaseAttachments(documents):[];
        if(c.openingOn&&c.openingOn>new Intl.DateTimeFormat("en-CA",{timeZone:"America/La_Paz"}).format(new Date()))throw new WarehouseError("La apertura no puede ser futura.");
        if(!c.id&&c.stock>0&&(!c.openingOn||!c.invoiceDescription||c.unitCost<=0))throw new WarehouseError("Indica fecha, descripción y costo positivo del saldo inicial.");
        const id = c.id ?? createId();
        let previous = 0;
        let previousCost = 0;
        let opening = !c.id;
        if (c.id) {
          const { rows } = await client.query("select * from materials where id=$1 for update", [id]);
          if (!rows[0] || rows[0].archived) throw new WarehouseError("Material no disponible.");
          scope(rows[0].warehouse_id);
          if((rows[0].attachments?.length??0)+attachments.length>4)throw new WarehouseError("El material admite hasta 4 respaldos. Los documentos existentes se conservan.");
          if (rows[0].warehouse_id !== c.warehouseId) throw new WarehouseError("No se puede trasladar un material con historial a otro almacén.");
          previous = rows[0].stock;
          previousCost = Number(rows[0].unit_cost);
          if(c.stock>previous){
            const history=await client.query('select exists(select 1 from stock_movements where material_id=$1) or exists(select 1 from material_requests where material_id=$1) as used',[id]);
            if(previous!==0||history.rows[0].used)throw new WarehouseError("Usa Registrar compra / reposición para aumentar existencias con factura y respaldo.");
            if(!c.openingOn||!c.invoiceDescription||c.unitCost<=0)throw new WarehouseError("Para el saldo inicial indica fecha, descripción del documento y costo positivo.");
            opening=true;
          }
          await client.query("update materials set name=$2,category=$3,unit=$4,minimum=$5,location=$6 where id=$1", [id,c.name,normalizeCategory(c.category),c.unit,c.minimum,c.location]);
        } else {
          // La numeración es global; incluye materiales archivados y altas simultáneas.
          await client.query("select pg_advisory_xact_lock(hashtextextended('warehouse-material-code',0))");
          let inserted=false;
          for(let attempt=0;attempt<5;attempt++) {
            const {rows}=await client.query("select coalesce(max(substring(code from '([0-9]+)$')::numeric),0)+1 as next_code from materials");
            const code=formatMaterialCode(c.name,Number(rows[0].next_code));
            const result=await client.query("insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(code) do nothing returning id", [id,c.warehouseId,code,c.name,normalizeCategory(c.category),c.unit,0,c.minimum,c.location]);
            if(result.rowCount){inserted=true;changeDetails={code};break;}
          }
          if(!inserted)throw new WarehouseError('No se pudo generar el código del material. Intenta nuevamente.');
        }
        await client.query("update materials set invoice_description=$2,description=$3,unit_cost=$4 where id=$1",[id,c.invoiceDescription,c.description,opening?c.unitCost:previousCost]);
        if(attachments.length){
          await client.query("update materials set attachments=attachments || $2::jsonb where id=$1",[id,JSON.stringify(attachments)]);
          changeDetails={...changeDetails,attachments:attachments.map(a=>a.name)};
        }
        if(c.stock>previous)await receiveFifo(client,{materialId:id,userId:viewer.id,quantity:c.stock-previous,unitCost:c.unitCost,reason:c.reason,opening:true,movementDate:c.openingOn?`${c.openingOn}T12:00:00-04:00`:undefined});
        else if(c.stock<previous)await consumeFifo(client,id,viewer.id,previous-c.stock,c.reason);
        await syncStockNotifications(client,id);
      } else if (c.type === "archive") {
        const { rows } = await client.query("select * from materials where id=$1 for update", [c.id]);
        if (!rows[0]) throw new WarehouseError("Material inexistente.");
        scope(rows[0].warehouse_id);
        if(rows[0].stock>0)throw new WarehouseError("El material todavía tiene existencias. Registra una salida o ajuste justificado antes de eliminarlo.");
        const pending = await client.query("select id from material_requests where material_id=$1 and status in ('pending','approved','waiting')", [c.id]);
        if (pending.rowCount) throw new WarehouseError("Resuelve las solicitudes abiertas antes de eliminar el material.");
        await client.query("update materials set archived=true where id=$1", [c.id]);
        await syncStockNotifications(client,c.id);
      } else if (c.type === "review") {
        const { rows } = await client.query("select r.*,m.warehouse_id,m.archived,w.name as pickup_warehouse,p.document as recipient_document,p.is_active as recipient_active from material_requests r join materials m on m.id=r.material_id join warehouses w on w.id=m.warehouse_id join warehouse_people p on p.id=r.person_id where r.id=$1 for update of r", [c.id]);
        const r = rows[0];
        if (!r) throw new WarehouseError("Solicitud inexistente.");
        scope(r.warehouse_id);
        if(!r.recipient_active&&["approved","delivered"].includes(c.status))throw new WarehouseError("El empleado está de baja. Rehabilita su ficha antes de autorizar o entregar material.");
        if (r.archived) throw new WarehouseError("Material eliminado.");
        const valid = c.status === "delivered" ? r.status === "approved" : ["pending", "waiting"].includes(r.status);
        if (!valid) throw new WarehouseError("La solicitud ya fue procesada. Actualiza la página.");
        if(c.status==="delivered"&&r.recipient_document.startsWith("LEGADO-"))throw new WarehouseError("Completa el CI del empleado en su ficha antes de confirmar la entrega.");
        if(c.status==="delivered"&&!c.identityConfirmed)throw new WarehouseError("Verifica el CI del destinatario antes de confirmar la entrega.");
        if ((c.status === "denied" || c.status === "waiting") && !c.response) throw new WarehouseError("Indica el motivo o la información de reposición.");
        const deliveryPlace = c.status === "approved" ? r.pickup_warehouse : null;
        const authorizedQuantity=c.authorizedQuantity??r.quantity;
        if (c.status === "approved") {
          if(authorizedQuantity>r.quantity)throw new WarehouseError("La cantidad autorizada no puede superar la pedida.");
          if (!c.deliveryOn) throw new WarehouseError("Indica la fecha de entrega o recojo.");
          const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
          if (c.deliveryOn < today) throw new WarehouseError("La fecha de entrega no puede estar en el pasado.");
          await consumeFifo(client,r.material_id,viewer.id,authorizedQuantity,`Reserva para solicitud ${r.id}`,r.id);
        }
        await client.query("update material_requests set authorized_quantity=case when $2='approved' then $7 else authorized_quantity end,fund=case when $2='approved' then coalesce($8,fund) else fund end,lot=case when $2='approved' then $9 else lot end,expires_on=case when $2='approved' then nullif($10,'') else expires_on end,unit_cost=case when $2='approved' then (select unit_cost from materials where id=material_requests.material_id) else unit_cost end,status=$2,response=$3,delivery_on=coalesce($4,delivery_on),delivery_place=coalesce($5,delivery_place),reviewed_by=$6,updated_at=now(),delivered_at=case when $2='delivered' then now() else delivered_at end where id=$1", [c.id,c.status,c.response,c.status === "approved" ? c.deliveryOn : null,deliveryPlace,viewer.id,authorizedQuantity,c.fund??null,c.lot,c.expiresOn??null]);
        if(c.status==="approved")await syncRequestFifo(client,c.id);
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
