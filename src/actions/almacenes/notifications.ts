"use server";
import { z } from 'zod';
import { pool } from '@/db';
import { warehouseContext } from '@/lib/warehouse';

export type WarehouseNotification={id:string;title:string;message:string;kind:string;entity_id:string|null;is_read:boolean;created_at:string};
const categories = z.enum(['inventory', 'requests']);
export type WarehouseNotificationCategory = z.infer<typeof categories>;
const inventoryStatuses = z.enum(['minimum', 'low', 'out']);
export type InventoryAlertStatus = z.infer<typeof inventoryStatuses>;
const requestStatuses = z.enum(['request_new', 'request_urgent', 'request_ready', 'request_handled']);
export type RequestAlertStatus = z.infer<typeof requestStatuses>;
const notificationStatuses = z.union([inventoryStatuses, requestStatuses]);
export type NotificationStatus = z.infer<typeof notificationStatuses>;
type NotificationFeed = { items: WarehouseNotification[]; unread: number };
type NotificationGroups = {
  inventory: NotificationFeed & { byStatus: Record<InventoryAlertStatus, NotificationFeed> };
  requests: NotificationFeed & { byStatus: Record<RequestAlertStatus, NotificationFeed> };
};
const categorySql = "case when left(kind, 6) = 'stock_' then 'inventory' else 'requests' end";
// Minimum and low stock alerts share the stored kind. The title distinguishes them.
const notificationStatusSql = `case
  when kind='stock_out' then 'out'
  when kind='stock_low' and title='Stock en el mínimo' then 'minimum'
  when kind='stock_low' then 'low'
  when kind in ('request_new', 'request_urgent', 'request_ready', 'request_handled') then kind
end`;

async function loadNotificationGroups(tabId: string | undefined, forMenu: boolean): Promise<NotificationGroups> {
  const viewer=await warehouseContext(tabId);
  if(!['admin_almacenes','superadmin'].includes(viewer.role)) throw new Error('Solo un administrador puede consultar estas notificaciones.');
  const scope=viewer.role==='superadmin'?null:viewer.warehouse_id;
  const { rows } = await pool.query<Omit<WarehouseNotification, 'created_at'> & {
    created_at: Date; category: WarehouseNotificationCategory; unread: number;
    notification_status: NotificationStatus | null; status_unread: number; in_category: boolean; in_status: boolean;
  }>(`
    with notices as (
      select n.id,n.message,n.entity_id,
        case r.status when 'approved' then 'Solicitud aprobada' when 'denied' then 'Solicitud rechazada'
          when 'delivered' then 'Solicitud entregada' else n.title end as title,
        case when r.id is not null then 'request_handled' else n.kind end as kind,
        n.is_read or r.id is not null as is_read,
        coalesce(r.updated_at,n.created_at) as created_at
      from notificaciones n
      left join material_requests r on $3::boolean and n.resolved
        and n.kind in ('request_new', 'request_urgent') and r.id=n.entity_id
        and r.status in ('approved', 'denied', 'delivered')
      where n.user_id=$1 and n.module='almacenes' and (not n.resolved or r.id is not null)
        and ($2::text is null or n.warehouse_id=$2)
    ), categorized as (
      select id,title,message,kind,entity_id,is_read,created_at,${categorySql} as category,
        ${notificationStatusSql} as notification_status
      from notices
    ), ranked as (
      select *, (count(*) filter (where not is_read) over (partition by category))::int as unread,
        (count(*) filter (where not is_read) over (partition by notification_status))::int as status_unread,
        row_number() over (partition by category order by ((not $3::boolean or category='requests') and is_read), created_at desc, id desc) as position,
        row_number() over (partition by notification_status order by is_read, created_at desc, id desc) as status_position
      from categorized
    )
    select id,title,message,kind,entity_id,is_read,created_at,category,unread,notification_status,status_unread,
      position <= 50 as in_category, status_position <= 50 as in_status
    from ranked where position <= 50 or (notification_status is not null and status_position <= 50)
    order by ((not $3::boolean or category='requests') and is_read), created_at desc, id desc`, [viewer.id, scope, forMenu]);

  const groups: NotificationGroups = {
    inventory: {items: [], unread: 0, byStatus: {
      minimum: {items: [], unread: 0}, low: {items: [], unread: 0}, out: {items: [], unread: 0},
    }},
    requests: {items: [], unread: 0, byStatus: {
      request_new: {items: [], unread: 0}, request_urgent: {items: [], unread: 0}, request_ready: {items: [], unread: 0},
      request_handled: {items: [], unread: 0},
    }},
  };
  const byStatus = {...groups.inventory.byStatus, ...groups.requests.byStatus};
  for (const {category, unread, created_at, notification_status, status_unread, in_category, in_status, ...item} of rows) {
    const notification = {...item, created_at: created_at.toISOString()};
    groups[category].unread = unread;
    if (in_category) groups[category].items.push(notification);
    if (notification_status && in_status) {
      const feed = byStatus[notification_status];
      feed.unread = status_unread;
      feed.items.push(notification);
    }
  }
  for (const feed of Object.values(groups.inventory.byStatus)) {
    feed.items.sort((a, b) => Number(a.is_read) - Number(b.is_read));
  }
  return groups;
}

export async function getWarehouseNotificationGroups(tabId?: string): Promise<NotificationGroups> {
  return loadNotificationGroups(tabId, true);
}

export async function getWarehouseNotifications(tabId?: string): Promise<NotificationFeed> {
  const {inventory, requests} = await loadNotificationGroups(tabId, false);
  const items = [...inventory.items, ...requests.items]
    .sort((a, b) => Number(a.is_read) - Number(b.is_read) || b.created_at.localeCompare(a.created_at))
    .slice(0, 50);
  return {items, unread: inventory.unread + requests.unread};
}

export async function markWarehouseNotificationsRead(input:unknown,tabId?:string,group?:WarehouseNotificationCategory,status?:NotificationStatus) {
  const id=z.string().min(1).max(200).nullable().parse(input);
  const category = categories.optional().parse(group) ?? null;
  const notificationStatus = notificationStatuses.optional().parse(status) ?? null;
  const viewer=await warehouseContext(tabId);
  if(!['admin_almacenes','superadmin'].includes(viewer.role)) throw new Error('Solo un administrador puede gestionar estas notificaciones.');
  await pool.query(`update notificaciones set is_read=true where user_id=$1 and module='almacenes'
    and ($2::text is null or id=$2) and ($3::text is null or warehouse_id=$3)
    and ($4::text is null or (${categorySql})=$4) and ($5::text is null or (${notificationStatusSql})=$5)`,
    [viewer.id,id,viewer.role==='superadmin'?null:viewer.warehouse_id,category,notificationStatus]);
  return {ok:true};
}
