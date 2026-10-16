"use client";
import { useWarehouseTab } from './tab-session';
import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, PackageX, ClipboardList, Clock3, CheckCheck } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import toast from 'react-hot-toast';
import { getWarehouseNotifications, markWarehouseNotificationsRead, type WarehouseNotification } from '@/actions/almacenes/notifications';
const kinds={stock_low:{label:'Reposición necesaria',icon:AlertTriangle},stock_out:{label:'Sin stock',icon:PackageX},request_new:{label:'Solicitud nueva',icon:ClipboardList},request_urgent:{label:'Solicitud urgente',icon:AlertTriangle},request_ready:{label:'Disponible para atender',icon:Clock3},general:{label:'Aviso',icon:Bell}};
export function WarehouseNotifications({onNavigate}:{onNavigate:(tab:'inventory'|'requests',entityId:string)=>void}) {
  const tabId=useWarehouseTab();
  const [feed,setFeed]=useState<{items:WarehouseNotification[];unread:number}>({items:[],unread:0});
  const [loading,setLoading]=useState(true);
  const [unavailable,setUnavailable]=useState(false);
  const [busy,setBusy]=useState(false);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    let active=true;
    async function refresh(){try{const value=await getWarehouseNotifications(tabId);if(active){setFeed(value);setUnavailable(false);}}catch{if(active)setUnavailable(true);}finally{if(active)setLoading(false);}}
    void refresh();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    const changed=()=>{void refresh();};
    window.addEventListener('warehouse:changed',changed);
    document.addEventListener('visibilitychange',visible);
    return()=>{active=false;window.removeEventListener('warehouse:changed',changed);clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[tabId]);
  async function read(item?:WarehouseNotification){setBusy(true);try{
    await markWarehouseNotificationsRead(item?.id??null,tabId);
    setFeed(await getWarehouseNotifications(tabId));
  }catch{toast.error('No se pudo marcar el aviso como leído.');}finally{setBusy(false);}
    if(item?.entity_id){setOpen(false);onNavigate(item.kind.startsWith('stock_')?'inventory':'requests',item.entity_id);}
  }
  return <DropdownMenu.Root open={open} onOpenChange={setOpen}>
    <DropdownMenu.Trigger asChild><button className="icon-button notification-trigger" type="button" aria-label={`Notificaciones${feed.unread?`: ${feed.unread} sin leer`:''}`} title="Notificaciones"><Bell size={19}/>{feed.unread>0&&<span className="notification-count">{feed.unread>99?'99+':feed.unread}</span>}</button></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className="notification-menu" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
      <div className="notification-heading"><DropdownMenu.Label>Notificaciones</DropdownMenu.Label><DropdownMenu.Item asChild disabled={busy||!feed.unread} onSelect={e=>{e.preventDefault();void read();}}><button type="button" disabled={busy||!feed.unread} aria-label="Marcar todas como leídas" title="Marcar todas como leídas"><CheckCheck size={18}/></button></DropdownMenu.Item></div>
      {loading?<p className="notification-empty" role="status">Cargando avisos…</p>:unavailable?<p className="notification-empty" role="status">No se pudieron actualizar los avisos. Intenta nuevamente en unos segundos.</p>:!feed.items.length?<p className="notification-empty">No tienes avisos pendientes.</p>:<div className="notification-list">{feed.items.map(item=>{
        const {label,icon:Icon}=kinds[item.kind as keyof typeof kinds]??kinds.general;
        return <DropdownMenu.Item key={item.id} className={`notification-item notification-${item.kind}${item.is_read?' notification-read':''}`} disabled={busy} onSelect={e=>{e.preventDefault();void read(item);}}>
          <span className="notification-symbol"><Icon size={19}/></span><div><span className="notification-kind">{label}{!item.is_read&&' · Sin leer'}</span><strong>{item.title}</strong><p>{item.message}</p><small>{new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'short',timeStyle:'short'}).format(new Date(item.created_at))} · Ir a {item.kind.startsWith('stock_')?'inventario':'solicitudes'}</small></div>
        </DropdownMenu.Item>;
      })}</div>}
      <p className="notification-footer">Actualización inmediata al guardar y cada 15 segundos para otros cambios. Se muestran los últimos 50 activos.</p>
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
