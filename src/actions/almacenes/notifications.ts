"use server";
import { z } from 'zod';
import { pool } from '@/db';
import { warehouseContext } from '@/lib/warehouse';

export type WarehouseNotification={id:string;title:string;message:string;kind:string;entity_id:string|null;is_read:boolean;created_at:string};
export async function getWarehouseNotifications(tabId?:string):Promise<{items:WarehouseNotification[];unread:number}> {
  const viewer=await warehouseContext(tabId);
  if(!['admin_almacenes','superadmin'].includes(viewer.role)) throw new Error('Solo un administrador puede consultar estas notificaciones.');
  const scope=viewer.role==='superadmin'?null:viewer.warehouse_id;
  const [items,count]=await Promise.all([
    pool.query(`select id,title,message,kind,entity_id,is_read,created_at from notificaciones where user_id=$1 and module='almacenes' and not resolved and ($2::text is null or warehouse_id=$2) order by is_read,created_at desc limit 50`,[viewer.id,scope]),
    pool.query(`select count(*)::int as n from notificaciones where user_id=$1 and module='almacenes' and not resolved and not is_read and ($2::text is null or warehouse_id=$2)`,[viewer.id,scope]),
  ]);
  return JSON.parse(JSON.stringify({items:items.rows,unread:count.rows[0].n}));
}
export async function markWarehouseNotificationsRead(input:unknown,tabId?:string) {
  const id=z.string().min(1).max(200).nullable().parse(input);
  const viewer=await warehouseContext(tabId);
  if(!['admin_almacenes','superadmin'].includes(viewer.role)) throw new Error('Solo un administrador puede gestionar estas notificaciones.');
  await pool.query(`update notificaciones set is_read=true where user_id=$1 and module='almacenes' and ($2::text is null or id=$2) and ($3::text is null or warehouse_id=$3)`,[viewer.id,id,viewer.role==='superadmin'?null:viewer.warehouse_id]);
  return {ok:true};
}
