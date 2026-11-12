"use server";
import { receiveFifo } from "@/lib/warehouse-fifo";
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { pool } from '@/db';
import { warehouseContext } from '@/lib/warehouse';
import { calendarDate, shortText, todayInBolivia } from '@/lib/warehouse-validation';
import { WarehouseError } from '@/lib/warehouse-errors';
import { syncStockNotifications } from '@/lib/warehouse-notifications';
import { revalidatePath } from 'next/cache';
import { readPurchaseAttachments } from '@/lib/purchase-attachments';

const optionalText=z.string().trim().max(2000).default('');
const supplierFields=z.object({id:shortText.optional(),warehouseId:shortText,businessType:shortText.optional(),name:shortText,nit:shortText,contact:optionalText,phone:optionalText,email:z.union([z.literal(''),z.email()]),address:optionalText,notes:optionalText,active:z.boolean().optional()});
export async function saveSupplier(input:unknown,tabId?:string) {
  try {
    const c=supplierFields.parse(input),viewer=await warehouseContext(tabId);
    if(viewer.role!=='superadmin'&&viewer.warehouse_id!==c.warehouseId)throw new WarehouseError('Almacén no autorizado.');
    const client=await pool.connect();
    try {
      await client.query('begin');
      if(c.id){const old=await client.query('select * from suppliers where id=$1 for update',[c.id]);if(old.rows[0]?.warehouse_id!==c.warehouseId)throw new WarehouseError('Proveedor no autorizado.');}
      const id=c.id??createId();
      await client.query(`insert into suppliers(id,warehouse_id,name,nit,contact,phone,email,address,notes,is_active,business_type) values($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,true),coalesce($11,''))
        on conflict(id) do update set name=$3,nit=$4,contact=$5,phone=$6,email=$7,address=$8,notes=$9,is_active=coalesce($10,suppliers.is_active),business_type=coalesce($11,suppliers.business_type)`,[id,c.warehouseId,c.name,c.nit,c.contact,c.phone,c.email,c.address,c.notes,c.active??null,c.businessType??null]);
      await client.query("insert into audit_logs(id,user_id,module,action,entity_id,details,result) values($1,$2,'almacenes','supplier',$3,$4,'success')",[createId(),viewer.id,id,JSON.stringify(c)]);
      await client.query('commit');
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
    revalidatePath('/dashboard');return {ok:true as const};
  }catch(error){return {ok:false as const,error:error instanceof WarehouseError?error.message:error instanceof z.ZodError?'Revisa los datos del proveedor.':'No se pudo guardar. Comprueba que el NIT no esté repetido.'};}
}

export async function setSupplierActive(input:unknown,tabId?:string) {
  try {
    const c=z.object({id:shortText,active:z.boolean()}).parse(input),viewer=await warehouseContext(tabId);
    const client=await pool.connect();
    try {
      await client.query('begin');
      const previous=(await client.query('select * from suppliers where id=$1 for update',[c.id])).rows[0];
      if(!previous||(viewer.role!=='superadmin'&&previous.warehouse_id!==viewer.warehouse_id))throw new WarehouseError('Proveedor no autorizado.');
      await client.query('update suppliers set is_active=$2 where id=$1',[c.id,c.active]);
      await client.query("insert into audit_logs(id,user_id,module,action,entity_id,details,result) values($1,$2,'almacenes','supplier_active',$3,$4,'success')",[createId(),viewer.id,c.id,JSON.stringify({previous:previous.is_active,active:c.active})]);
      await client.query('commit');
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
    revalidatePath('/dashboard');return {ok:true as const};
  }catch(error){return {ok:false as const,error:error instanceof WarehouseError?error.message:'No se pudo actualizar el estado del proveedor. Intenta nuevamente.'};}
}

const purchaseLine=z.object({materialId:shortText,invoiceDescription:z.string().trim().min(1).max(2000),lot:z.string().trim().max(200),expiresOn:z.union([z.literal(''),calendarDate]),quantity:z.coerce.number().int().min(1).max(10000000),unitCost:z.coerce.number().finite().min(.000001).max(100000000)});
const sellerText=z.string().trim().max(200).default('');
const purchaseFields=z.object({submissionKey:z.uuid(),supplierMode:z.enum(['registered','occasional']).default('registered'),supplierId:sellerText,supplierName:sellerText,supplierNit:sellerText,supplierType:sellerText,supplierPhone:sellerText,saveSupplier:z.literal('on').optional(),invoiceNumber:shortText,purchasedOn:calendarDate,notes:optionalText,lines:z.array(purchaseLine).min(1).max(50)});
export async function registerPurchase(form:FormData,tabId?:string) {
  try {
    const values=Object.fromEntries(form);
    let lines:unknown;
    if(form.has('lines')){
      const raw=form.get('lines');
      if(typeof raw!=='string'||raw.length>250000)throw new WarehouseError('Revisa los materiales de la compra (máximo 50 líneas).');
      try{lines=JSON.parse(raw);}catch{throw new WarehouseError('Revisa los materiales de la compra.');}
    }else lines=[values]; // Compatibilidad con formularios de una sola línea ya abiertos.
    const c=purchaseFields.parse({...values,lines}),viewer=await warehouseContext(tabId);
    if(c.supplierMode==='registered'&&!c.supplierId)throw new WarehouseError('Selecciona un proveedor registrado o elige una compra ocasional.');
    if(c.supplierMode==='occasional'&&!c.supplierName)throw new WarehouseError('Escribe el nombre o razón social del vendedor.');
    if(c.supplierMode==='occasional'&&c.saveSupplier&&!c.supplierNit)throw new WarehouseError('Para guardar al proveedor, completa su NIT o identificación tributaria.');
    if(c.purchasedOn>todayInBolivia())throw new WarehouseError('La fecha de compra no puede ser futura.');
    if(c.lines.some(line=>line.expiresOn&&line.expiresOn<c.purchasedOn))throw new WarehouseError('El vencimiento no puede ser anterior a la compra.');
    const attachments=await readPurchaseAttachments(form);
    if(!attachments.length)throw new WarehouseError('Adjunta entre 1 y 4 respaldos (PDF, JPG o PNG, máximo 2 MB cada uno).');
    const client=await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,2))',[c.submissionKey]);
      const existing=await client.query('select id from purchases where id=$1 and created_by=$2',[c.submissionKey,viewer.id]);
      if(existing.rowCount){await client.query('commit');return {ok:true as const};}
      // Bloqueo en un orden común para compras concurrentes de varios materiales.
      const materialIds=[...new Set(c.lines.map(line=>line.materialId))].sort();
      const result=await client.query('select * from materials where id=any($1::text[]) and not archived order by id for update',[materialIds]);
      if(result.rows.length!==materialIds.length||result.rows.some(m=>viewer.role!=='superadmin'&&m.warehouse_id!==viewer.warehouse_id))throw new WarehouseError('Material no autorizado.');
      const warehouseId=result.rows[0].warehouse_id;
      if(result.rows.some(m=>m.warehouse_id!==warehouseId))throw new WarehouseError('Todos los materiales de la compra deben pertenecer al mismo almacén.');
      let supplierId:string|null=null;
      let supplierDetails={name:c.supplierName,nit:c.supplierNit,business_type:c.supplierType,phone:c.supplierPhone};
      if(c.supplierMode==='registered'){
        const supplier=await client.query('select id,name,nit,business_type,phone from suppliers where id=$1 and warehouse_id=$2 and is_active for share',[c.supplierId,warehouseId]);
        if(!supplier.rowCount)throw new WarehouseError('Selecciona un proveedor activo del mismo almacén.');
        const s=supplier.rows[0];supplierId=s.id;supplierDetails={name:s.name,nit:s.nit,business_type:s.business_type,phone:s.phone};
      }
      for(const m of result.rows){
        const last=await client.query("select to_char(max(created_at) at time zone 'America/La_Paz','YYYY-MM-DD') as day from stock_movements where material_id=$1",[m.id]);
        if(last.rows[0]?.day&&c.purchasedOn<last.rows[0].day)throw new WarehouseError('La fecha del ingreso no puede preceder al último movimiento del material. Registra las compras en orden cronológico.');
      }
      if(c.supplierMode==='occasional'&&c.saveSupplier){
        supplierId=createId();
        const saved=await client.query('insert into suppliers(id,warehouse_id,name,nit,business_type,phone) values($1,$2,$3,$4,$5,$6) on conflict(warehouse_id,nit) do nothing returning id',[supplierId,warehouseId,c.supplierName,c.supplierNit,c.supplierType,c.supplierPhone]);
        if(!saved.rowCount)throw new WarehouseError('Ya existe un proveedor con ese NIT en el almacén. Selecciónalo como proveedor registrado o guarda solo los datos en esta compra.');
        await client.query("insert into audit_logs(id,user_id,module,action,entity_id,details,result) values($1,$2,'almacenes','supplier',$3,$4,'success')",[createId(),viewer.id,supplierId,JSON.stringify({warehouseId,...supplierDetails,submissionKey:c.submissionKey})]);
      }
      const storedAttachments=JSON.stringify(attachments);
      for(const [index,line] of c.lines.entries()){
        await client.query('update materials set invoice_description=$2 where id=$1',[line.materialId,line.invoiceDescription]);
        const batchId=await receiveFifo(client,{materialId:line.materialId,userId:viewer.id,quantity:line.quantity,unitCost:line.unitCost,reason:`Compra ${c.invoiceNumber} · ${line.invoiceDescription}`,lot:line.lot,expiresOn:line.expiresOn,movementDate:`${c.purchasedOn}T12:00:00-04:00`});
        const movementId=(await client.query('select id from stock_movements where batch_id=$1 and delta>0',[batchId])).rows[0].id,id=index===0?c.submissionKey:createId();
        await client.query('insert into purchases(id,material_id,supplier_id,movement_id,invoice_number,invoice_description,purchased_on,lot,expires_on,quantity,unit_cost,notes,attachments,created_by,supplier_details) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[id,line.materialId,supplierId,movementId,c.invoiceNumber,line.invoiceDescription,c.purchasedOn,line.lot,line.expiresOn||null,line.quantity,line.unitCost,c.notes,storedAttachments,viewer.id,JSON.stringify(supplierDetails)]);
        await client.query("insert into audit_logs(id,user_id,module,action,entity_id,details,result) values($1,$2,'almacenes','purchase',$3,$4,'success')",[createId(),viewer.id,id,JSON.stringify({submissionKey:c.submissionKey,supplierId,supplierDetails,invoiceNumber:c.invoiceNumber,purchasedOn:c.purchasedOn,notes:c.notes,...line,attachments:attachments.map(a=>a.name)})]);
      }
      for(const m of result.rows){
        await syncStockNotifications(client,m.id);
      }
      await client.query('commit');
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
    revalidatePath('/dashboard');return {ok:true as const};
  }catch(error){return {ok:false as const,error:error instanceof WarehouseError?error.message:error instanceof z.ZodError?'Completa la factura y todos los materiales (de 1 a 50 líneas), con cantidad, costo y descripción.':'No se pudo registrar la compra. Intenta nuevamente.'};}
}
