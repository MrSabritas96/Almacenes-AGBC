import type { PoolClient } from 'pg';
import { createId } from '@paralleldrive/cuid2';
import { WarehouseError } from './warehouse-errors';

export const entryCode=(id:number|string)=>`E-${String(id).padStart(6,'0')}`;
async function lockMaterial(client:PoolClient,id:string) {
  const row=(await client.query('select * from materials where id=$1 for update',[id])).rows[0];
  if(!row)throw new WarehouseError('Material inexistente.');
  return row;
}
async function balance(client:PoolClient,id:string) {
  await client.query(`update materials set stock=b.qty,unit_cost=case when b.qty>0 then b.value/b.qty else unit_cost end
    from (select coalesce(sum(remaining),0)::int qty,coalesce(sum(remaining*unit_cost),0) value from inventory_batches where material_id=$1) b where id=$1`,[id]);
}
async function checkBalance(client:PoolClient,id:string,stock:number) {
  const row=(await client.query('select coalesce(sum(remaining),0)::int qty from inventory_batches where material_id=$1',[id])).rows[0];
  if(row.qty!==stock)throw new WarehouseError('El saldo no coincide con las entradas PEPS. Revisa el historial antes de continuar.');
}
async function movement(client:PoolClient,id:string,user:string,batch:number,delta:number,cost:string|number,qty:number,reason:string,date?:string) {
  await client.query(`insert into stock_movements(id,material_id,user_id,batch_id,delta,unit_cost,balance_after,reason,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::timestamptz,clock_timestamp()))`,[createId(),id,user,batch,delta,cost,qty,`${reason} · PEPS ${entryCode(batch)}`,date??null]);
}
/** Cada ingreso recibe un correlativo inmutable. La fecha de factura no altera el orden físico de recepción. */
export async function receiveFifo(client:PoolClient,input:{materialId:string;userId:string;quantity:number;unitCost:number|string;reason:string;lot?:string;expiresOn?:string|null;movementDate?:string;opening?:boolean}) {
  const m=await lockMaterial(client,input.materialId);
  await checkBalance(client,m.id,m.stock);
  if(input.quantity<=0)throw new WarehouseError('La cantidad de entrada debe ser positiva.');
  const b=(await client.query(`insert into inventory_batches(material_id,quantity,remaining,unit_cost,lot,expires_on,source,received_at) values($1,$2,$2,$3,$4,$5,$6,coalesce($7::timestamptz,clock_timestamp())) returning id`,[m.id,input.quantity,input.unitCost,input.lot??'',input.expiresOn||null,input.reason,input.opening?input.movementDate??null:null])).rows[0];
  await movement(client,m.id,input.userId,b.id,input.quantity,input.unitCost,m.stock+input.quantity,input.reason,input.movementDate);
  await balance(client,m.id);
  return b.id as number;
}
/** Debe ejecutarse en la misma transacción de la reserva/ajuste; el bloqueo del material serializa las salidas. */
export async function consumeFifo(client:PoolClient,id:string,user:string,quantity:number,reason:string,requestId?:string) {
  const m=await lockMaterial(client,id);
  if(m.archived||m.stock<quantity)throw new WarehouseError('Stock insuficiente o material eliminado.');
  const batches=(await client.query('select * from inventory_batches where material_id=$1 and remaining>0 order by received_at,id for update',[id])).rows;
  if(batches.reduce((n,b)=>n+b.remaining,0)!==m.stock)throw new WarehouseError('El saldo no coincide con las entradas PEPS. Revisa el historial antes de continuar.');
  let left=quantity,stock=m.stock;
  for(const b of batches){
    if(!left)break;
    const take=Math.min(left,b.remaining);left-=take;stock-=take;
    await client.query('update inventory_batches set remaining=remaining-$2 where id=$1',[b.id,take]);
    if(requestId)await client.query('insert into inventory_allocations(request_id,batch_id,quantity) values($1,$2,$3) on conflict(request_id,batch_id) do update set quantity=inventory_allocations.quantity+$3',[requestId,b.id,take]);
    await movement(client,id,user,b.id,-take,b.unit_cost,stock,reason);
  }
  if(left)throw new WarehouseError('Entradas PEPS insuficientes.');
  await balance(client,id);
}
/** Las correcciones liberan primero lo último asignado; la devolución vuelve al lote de origen. */
export async function restoreFifo(client:PoolClient,id:string,user:string,quantity:number,reason:string,requestId:string) {
  const m=await lockMaterial(client,id);
  await checkBalance(client,id,m.stock);
  const rows=(await client.query(`select b.*,a.quantity as allocated from inventory_allocations a join inventory_batches b on b.id=a.batch_id where a.request_id=$1 and b.material_id=$2 order by b.received_at desc,b.id desc for update of b,a`,[requestId,id])).rows;
  let left=quantity,stock=m.stock;
  for(const b of rows){if(!left)break;const take=Math.min(left,b.allocated);left-=take;stock+=take;
    await client.query('update inventory_batches set remaining=remaining+$2 where id=$1',[b.id,take]);
    if(take===b.allocated)await client.query('delete from inventory_allocations where request_id=$1 and batch_id=$2',[requestId,b.id]);
    else await client.query('update inventory_allocations set quantity=quantity-$3 where request_id=$1 and batch_id=$2',[requestId,b.id,take]);
    await movement(client,id,user,b.id,take,b.unit_cost,stock,reason);
  }
  if(left)throw new WarehouseError('La devolución supera las unidades asignadas a la entrega.');
  await balance(client,id);
}
export async function syncRequestFifo(client:PoolClient,id:string) {
  await client.query(`update material_requests set unit_cost=f.cost,lot=coalesce(f.lots,''),expires_on=f.expires from
    (select sum(a.quantity*b.unit_cost)/nullif(sum(a.quantity),0) cost,string_agg('E-'||lpad(b.id::text,greatest(6,length(b.id::text)),'0')||case when b.lot='' then '' else ' ('||b.lot||')' end||' · '||a.quantity||' ud.',', ' order by b.received_at,b.id) lots,min(b.expires_on) expires from inventory_allocations a join inventory_batches b on b.id=a.batch_id where a.request_id=$1) f where id=$1`,[id]);
}
