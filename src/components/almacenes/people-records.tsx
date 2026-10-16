"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X, LoaderCircle } from "lucide-react";
import toast from "react-hot-toast";
import { warehouseAction } from "@/actions/almacenes/manage";
import { useWarehouseTab } from "./tab-session";
import { statuses, type Snapshot, type Staff } from "@/lib/warehouse-types";

export function PeopleRecords({data,query,onMaterials}:{data:Snapshot;query:string;onMaterials:(id:string)=>void}) {
  const router=useRouter(); const tabId=useWarehouseTab(); const dialog=useRef<HTMLDialogElement>(null);
  const [editing,setEditing]=useState<Staff|null>(null);const [historyId,setHistoryId]=useState("");
  const history=data.staff.find(person=>person.id===historyId)??null;
  const historyPanel=useRef<HTMLElement>(null);
  useEffect(()=>{if(historyId){historyPanel.current?.focus({preventScroll:true});historyPanel.current?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});}},[historyId]);
  const [busy,setBusy]=useState(false);const [refreshing,startRefresh]=useTransition();const [error,setError]=useState("");
  const people=data.staff.filter(p=>p.role==='empleado_agbc'&&`${p.name} ${p.document} ${p.position} ${p.department}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const nameOf=(id:string)=>data.warehouses.find(w=>w.id===id)?.name??"";
  const date=(value:string)=>new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'short'}).format(new Date(value));
  function open(person:Staff|null){setEditing(person);setError("");dialog.current?.showModal();}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||refreshing)return;
    const values=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);setError("");
    try{const result=await warehouseAction({type:'person',id:editing?.id,...values},tabId);
      if(!result.ok){setError(result.error??'No se pudo guardar.');return;}
      dialog.current?.close();toast.success('Ficha guardada. No se creó una cuenta de acceso.');startRefresh(()=>router.refresh());
    }catch{setError('No se pudo conectar. Intenta nuevamente.');}finally{setBusy(false);}
  }
  return <>
    <div className="table-toolbar"><button className="primary-button" onClick={()=>open(null)}><Plus size={17}/>Registrar ficha</button><p className="muted">Empleados sin usuario ni contraseña. El CI agrupa solicitudes y materiales dentro de cada almacén.</p></div>
    <section className="data-panel"><div className="table-scroll"><table><thead><tr><th>Empleado / CI</th><th>Cargo y unidad</th><th>Almacén</th><th>Solicitudes</th><th>Acciones</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>CI: {p.document}</small><small>{p.phone}</small></td><td>{p.position}<small>{p.department}</small></td><td>{nameOf(p.warehouse_id)}</td><td>{data.requests.filter(r=>r.user_id===p.id).length} solicitudes<small>{data.requests.filter(r=>r.user_id===p.id&&r.status==='delivered').length} entregas</small></td><td><div className="row-actions"><button className="small-button" onClick={()=>setHistoryId(p.id)}>Ver historial</button><button className="small-button" onClick={()=>onMaterials(p.id)}>Ver materiales</button><button className="icon-button" aria-label={`Editar ficha ${p.name}`} onClick={()=>open(p)}><Pencil size={16}/></button></div></td></tr>)}</tbody></table>{!people.length&&<div className="empty-state">Aún no hay fichas. Se crean al recibir la primera solicitud o al registrar una ficha manualmente.</div>}</div></section>
    {history&&<section ref={historyPanel} tabIndex={-1} className="data-panel" aria-label={`Historial de ${history.name}`}><div className="panel-heading"><div><h2>Historial de {history.name}</h2><p className="muted">CI: {history.document} · {nameOf(history.warehouse_id)}</p></div><button className="icon-button" aria-label="Cerrar historial" onClick={()=>setHistoryId("")}><X size={18}/></button></div><div className="table-scroll"><table><thead><tr><th>Fecha / material</th><th>Cantidad</th><th>Estado</th><th>Motivo / respuesta</th><th>Entrega</th></tr></thead><tbody>{data.requests.filter(r=>r.user_id===history.id).map(r=><tr key={r.id}><td>{date(r.created_at)}<strong>{r.material}</strong><small>{r.id}</small></td><td>{r.quantity} {r.unit}</td><td><span className={`status-badge status-${r.status}`}>{statuses[r.status]??r.status}</span></td><td>{r.purpose}<small>{r.response||'Sin respuesta todavía'}</small></td><td>{r.delivered_at?date(r.delivered_at):'Sin entrega confirmada'}<small>{r.delivery_place}</small></td></tr>)}</tbody></table>{!data.requests.some(r=>r.user_id===history.id)&&<div className="empty-state">Esta persona aún no tiene solicitudes.</div>}</div></section>}
    <dialog ref={dialog} className="warehouse-dialog" aria-labelledby="person-title" onCancel={event=>{if(busy)event.preventDefault();}}>
      <div className="dialog-heading"><h2 id="person-title">{editing?'Editar ficha':'Registrar ficha de empleado'}</h2><button className="icon-button" disabled={busy} aria-label="Cerrar ficha" onClick={()=>dialog.current?.close()}><X size={20}/></button></div>
      <form key={editing?.id??'new'} onSubmit={submit}><fieldset disabled={busy||refreshing} className="form-grid">
        <label>Nombre completo<input name="name" required maxLength={200} defaultValue={editing?.name}/></label><label>CI y extensión<input name="document" required minLength={3} maxLength={40} defaultValue={editing?.document}/></label>
        <label>Cargo<input name="position" required maxLength={200} defaultValue={editing?.position}/></label><label>Unidad / departamento<input name="department" required maxLength={200} defaultValue={editing?.department}/></label>
        <label>Teléfono (opcional)<input name="phone" maxLength={40} defaultValue={editing?.phone}/></label><label>Almacén<select name="warehouseId" defaultValue={editing?.warehouse_id??data.warehouses[0]?.id} disabled={!!editing}>{data.warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>{editing&&<input type="hidden" name="warehouseId" value={editing.warehouse_id}/>}</label>
      </fieldset>{error&&<p role="alert" className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>dialog.current?.close()}>Cancelar</button><button className="primary-button" disabled={busy||refreshing}>{busy&&<LoaderCircle size={16} className="motion-spin"/>}{busy?'Guardando…':'Guardar ficha'}</button></div></form>
    </dialog>
  </>;
}
