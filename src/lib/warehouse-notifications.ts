import { createId } from '@paralleldrive/cuid2';
import type { PoolClient } from 'pg';

async function notifyManagers(client:PoolClient, warehouseId:string, entityId:string, eventKey:string, kind:string, title:string, message:string, view:'inventory'|'requests') {
  await client.query(`insert into notificaciones(id,user_id,module,title,message,link,kind,warehouse_id,entity_id,event_key)
    select $1 || '-' || u.id,u.id,'almacenes',$2,$3,$4,$5,$6,$7,$8 from users u
    where u.is_active and exists(select 1 from user_roles ur join roles r on r.id=ur.role_id left join staff_profiles p on p.user_id=u.id
      where ur.user_id=u.id and (r.name='superadmin' or (r.name='admin_almacenes' and p.warehouse_id=$6)))
    on conflict(user_id,event_key) do update set title=excluded.title,message=excluded.message,link=excluded.link,kind=excluded.kind,
      is_read=case when notificaciones.resolved or notificaciones.kind<>excluded.kind then false else notificaciones.is_read end,
      created_at=case when notificaciones.resolved or notificaciones.kind<>excluded.kind then now() else notificaciones.created_at end,resolved=false`,
    [createId(),title,message,`/dashboard?view=${view}&focus=${encodeURIComponent(entityId)}`,kind,warehouseId,entityId,eventKey]);
}

export async function notifyNewRequest(client:PoolClient, requestId:string) {
  const {rows}=await client.query(`select r.*,m.warehouse_id,m.name as material,coalesce(r.requester_details->>'name',u.name) as employee from material_requests r join materials m on m.id=r.material_id join warehouse_people u on u.id=r.person_id where r.id=$1`,[requestId]);
  const r=rows[0];
  if(!r)return;
  await notifyManagers(client,r.warehouse_id,r.id,`request:${r.id}`,r.priority==='urgent'?'request_urgent':'request_new',r.priority==='urgent'?'Nueva solicitud urgente':'Nueva solicitud',`${r.employee} solicita ${r.quantity} ${r.material}.`,'requests');
}

export async function resolveRequestNotifications(client:PoolClient, requestId:string) {
  await client.query(`update notificaciones set resolved=true,is_read=true where module='almacenes' and event_key in ($1,$2)`,[`request:${requestId}`,`ready:${requestId}`]);
}

export async function syncStockNotifications(client:PoolClient, materialId:string) {
  const {rows}=await client.query('select * from materials where id=$1 for update',[materialId]);
  const m=rows[0];
  if(!m)return;
  if(m.archived||m.stock>m.minimum) await client.query(`update notificaciones set resolved=true,is_read=true where event_key=$1`,[`stock:${m.id}`]);
  else await notifyManagers(client,m.warehouse_id,m.id,`stock:${m.id}`,m.stock===0?'stock_out':'stock_low',m.stock===0?'Sin stock':m.stock===m.minimum?'Stock en el mínimo':'Stock bajo',`${m.name}: ${m.stock===0?'no quedan unidades disponibles (stock: 0)':`${m.stock} ${m.unit} disponibles`}. Nivel mínimo para reposición: ${m.minimum} ${m.unit}.`,'inventory');
  await client.query(`update notificaciones n set resolved=true,is_read=true from material_requests r where n.event_key='ready:' || r.id and r.material_id=$1 and (r.status<>'waiting' or r.quantity>$2 or $3)`,[m.id,m.stock,m.archived]);
  if(!m.archived){
    const waiting=await client.query(`select r.id,r.quantity,u.name as employee from material_requests r join warehouse_people u on u.id=r.person_id where r.material_id=$1 and r.status='waiting' and r.quantity<=$2`,[m.id,m.stock]);
    for(const r of waiting.rows) await notifyManagers(client,m.warehouse_id,r.id,`ready:${r.id}`,'request_ready','Pedido en espera con stock disponible',`${r.employee}: ya hay stock para ${r.quantity} ${m.unit} de ${m.name}. Revisar y reservar.`,'requests');
  }
}
