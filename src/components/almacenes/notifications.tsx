"use client";
import { PostalLoader } from "./postal-loader";
import { useWarehouseTab } from './tab-session';
import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, PackageX, ClipboardList, Clock3, CheckCheck } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import toast from 'react-hot-toast';
import { getWarehouseNotificationGroups, markWarehouseNotificationsRead, type InventoryAlertStatus, type NotificationStatus, type RequestAlertStatus, type WarehouseNotification, type WarehouseNotificationCategory } from '@/actions/almacenes/notifications';
const kinds={stock_low:{label:'Reposición necesaria',icon:AlertTriangle},stock_out:{label:'Sin stock',icon:PackageX},request_new:{label:'Solicitud nueva',icon:ClipboardList},request_urgent:{label:'Solicitud urgente',icon:AlertTriangle},request_ready:{label:'Disponible para atender',icon:Clock3},request_handled:{label:'Atendida',icon:CheckCheck},general:{label:'Aviso',icon:Bell}};

const menus = [
  {category: 'inventory', label: 'Alertas de inventario', icon: Bell, destination: 'inventario'},
  {category: 'requests', label: 'Solicitudes de material', icon: ClipboardList, destination: 'solicitudes'},
] as const;

const inventoryFilters = [
  {value: 'all', label: 'Todos'},
  {value: 'minimum', label: 'En el mínimo'},
  {value: 'low', label: 'Stock bajo'},
  {value: 'out', label: 'Sin stock'},
] satisfies {value: 'all' | InventoryAlertStatus; label: string}[];

const requestFilters = [
  {value: 'all', label: 'Todas'},
  {value: 'request_new', label: 'Nuevas'},
  {value: 'request_urgent', label: 'Urgentes'},
  {value: 'request_ready', label: 'Disponibles para atender'},
  {value: 'request_handled', label: 'Atendidas'},
] satisfies {value: 'all' | RequestAlertStatus; label: string}[];

export function WarehouseNotifications({onNavigate}:{onNavigate:(tab:'inventory'|'requests',entityId:string)=>void}) {
  const tabId=useWarehouseTab();
  const [groups,setGroups]=useState<Awaited<ReturnType<typeof getWarehouseNotificationGroups>>>({
    inventory: {items: [], unread: 0, byStatus: {
      minimum: {items: [], unread: 0}, low: {items: [], unread: 0}, out: {items: [], unread: 0},
    }},
    requests: {items: [], unread: 0, byStatus: {
      request_new: {items: [], unread: 0}, request_urgent: {items: [], unread: 0}, request_ready: {items: [], unread: 0},
      request_handled: {items: [], unread: 0},
    }},
  });
  const [filters, setFilters] = useState<Record<WarehouseNotificationCategory, 'all' | NotificationStatus>>({inventory: 'all', requests: 'all'});
  const [loading,setLoading]=useState(true);
  const [unavailable,setUnavailable]=useState(false);
  const [busy,setBusy]=useState(false);
  const [open,setOpen]=useState<WarehouseNotificationCategory | null>(null);
  useEffect(()=>{
    let active=true,inFlight=false,queued=false;
    let changeTimer: ReturnType<typeof setTimeout> | undefined;
    async function refresh(){
      if(!active)return;
      if(inFlight){queued=true;return;}
      inFlight=true;
      try{const value=await getWarehouseNotificationGroups(tabId);if(active){setGroups(value);setUnavailable(false);}}
      catch{if(active)setUnavailable(true);}
      finally{
        inFlight=false;
        if(active)setLoading(false);
        if(queued&&active){queued=false;void refresh();}
      }
    }
    void refresh();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    const changed=()=>{clearTimeout(changeTimer);changeTimer=setTimeout(()=>void refresh(),100);};
    window.addEventListener('warehouse:changed',changed);
    document.addEventListener('visibilitychange',visible);
    return()=>{active=false;window.removeEventListener('warehouse:changed',changed);clearTimeout(changeTimer);clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[tabId]);
  async function read(category: WarehouseNotificationCategory, item?: WarehouseNotification) {
    if(busy)return;
    if (item?.entity_id) {
      setOpen(null);
      onNavigate(category, item.entity_id);
    }
    if (!item?.is_read) {
      setBusy(true);
      try {
        const filter = filters[category];
        const status = filter === 'all' ? undefined : filter;
        await markWarehouseNotificationsRead(item?.id ?? null, tabId, category, status);
        window.dispatchEvent(new Event('warehouse:changed'));
      } catch {
        toast.error('No se pudieron marcar los avisos como leídos.');
      } finally {
        setBusy(false);
      }
    }
  }
  const byStatus = {...groups.inventory.byStatus, ...groups.requests.byStatus};
  return menus.map(({category, label, icon: TriggerIcon, destination}) => {
    const feed = groups[category];
    const filter = filters[category];
    const options = category === 'inventory' ? inventoryFilters : requestFilters;
    const visibleFeed = filter === 'all' ? feed : byStatus[filter];
    const emptyMessage = filter === 'request_handled' ? 'No hay solicitudes atendidas.'
      : filter === 'all' ? 'No tienes avisos pendientes.' : 'No hay avisos activos para este filtro.';
    return <DropdownMenu.Root key={category} modal={false} open={open === category} onOpenChange={next => setOpen(current => next ? category : current === category ? null : current)}>
    <DropdownMenu.Trigger asChild>
      <button className="icon-button notification-trigger" type="button" aria-label={`${label}${feed.unread ? `: ${feed.unread} sin leer` : ''}`} title={label}>
        <TriggerIcon size={19} aria-hidden="true"/>
        {feed.unread > 0 && <span className="notification-count" aria-hidden="true">{feed.unread > 99 ? '99+' : feed.unread}</span>}
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className="notification-menu" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
      <div className="notification-heading"><DropdownMenu.Label>{label}</DropdownMenu.Label><DropdownMenu.Item asChild disabled={busy||!visibleFeed.unread} onSelect={e=>{e.preventDefault();void read(category);}}><button type="button" disabled={busy||!visibleFeed.unread} aria-label="Marcar todos estos avisos como leídos" title="Marcar todos estos avisos como leídos">{busy?<PostalLoader/>:<CheckCheck size={18} aria-hidden="true"/>}</button></DropdownMenu.Item></div>
      <DropdownMenu.RadioGroup value={filter} className="notification-filters" aria-label={category === 'inventory' ? 'Filtrar por estado del inventario' : 'Filtrar por tipo de solicitud'}>
        {options.map(({value, label}) => <DropdownMenu.RadioItem
          key={value} value={value} className="notification-filter" onSelect={event => {
            event.preventDefault();
            setFilters(current => ({...current, [category]: value}));
          }}
        >{label}</DropdownMenu.RadioItem>)}
      </DropdownMenu.RadioGroup>
      {loading?<PostalLoader size="panel" label="Cargando avisos…"/>:unavailable?<p className="notification-empty" role="status">No se pudieron actualizar los avisos. Intenta nuevamente en unos segundos.</p>:!visibleFeed.items.length?<p className="notification-empty" role="status">{emptyMessage}</p>:<div className="notification-list">{visibleFeed.items.map(item=>{
        const {label: kindLabel,icon:Icon}=kinds[item.kind as keyof typeof kinds]??kinds.general;
        return <DropdownMenu.Item key={item.id} className={`notification-item notification-${item.kind}${item.is_read?' notification-read':''}`} disabled={busy} onSelect={e=>{e.preventDefault();void read(category, item);}}>
          <span className="notification-symbol"><Icon size={19} aria-hidden="true"/></span><div><span className="notification-kind">{kindLabel}{!item.is_read&&' · Sin leer'}</span><strong>{item.title}</strong><p>{item.message}</p><small>{new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'short',timeStyle:'short'}).format(new Date(item.created_at))}{item.entity_id && ` · Ir a ${destination}`}</small></div>
        </DropdownMenu.Item>;
      })}</div>}
      <p className="notification-footer">{category === 'inventory' && filter === 'all'
        ? 'Hasta 50 alertas activas, de la más reciente a la más antigua.'
        : filter === 'request_handled' ? 'Hasta 50 solicitudes atendidas, de la más reciente a la más antigua.'
          : 'Hasta 50 avisos, con los no leídos primero.'}</p>
    </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>;
  });
}
