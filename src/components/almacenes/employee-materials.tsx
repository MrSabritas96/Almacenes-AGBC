"use client";
import { useRef, useState, useTransition } from "react";
import { useWarehouseTab } from "./tab-session";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, Printer, Trash2, X, LoaderCircle } from "lucide-react";
import toast from "react-hot-toast";
import { warehouseAction, getDeliveryReceipt } from "@/actions/almacenes/manage";
import type { EmployeeMaterial, Request, Snapshot } from "@/lib/warehouse-types";

const dateText=(value:string)=>new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'short'}).format(new Date(value.length===10?`${value}T12:00:00-04:00`:value));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz'}).format(new Date());
type Editing = {kind:'initial';item?:EmployeeMaterial} | {kind:'delivery';item:Request} | {kind:'remove';id:string;source:'initial'|'delivery';name:string};

export async function downloadDeliveryReceipt(request: Request, tabId?: string) {
  const result=await getDeliveryReceipt(request.id,tabId);
  if(!result.ok) throw new Error(result.error);
  const {createDeliveryReceipt,loadReportLogo}=await import('@/lib/report-pdf');
  const logo=await loadReportLogo();
  const {request:current,recipient,warehouse,issuer}=result.data;
  const doc=createDeliveryReceipt(current,recipient,warehouse,issuer,logo);
  doc.autoPrint();
  await doc.save(`acta-entrega-${request.id}.pdf`,{returnPromise:true});
}

export function EmployeeMaterials({data,query='',userId=''}:{data:Snapshot;query?:string;userId?:string}) {
  const tabId=useWarehouseTab();
  const employee=data.viewer.role==='empleado_agbc';
  const router=useRouter();
  const [refreshing,startRefresh]=useTransition();
  const dialog=useRef<HTMLDialogElement>(null);
  const [editing,setEditing]=useState<Editing|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState(userId);
  const staff=data.staff.filter(s=>s.role==='empleado_agbc'&&s.is_active);
  const matches=(name:string,person:string)=>`${name} ${person}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const initial=data.employeeMaterials.filter(h=>(!filter||h.user_id===filter)&&matches(h.name,h.employee));
  const deliveries=data.requests.filter(r=>r.status==='delivered'&&(!filter||r.user_id===filter)&&matches(r.material,r.employee));
  function open(next:Editing){setError('');setEditing(next);dialog.current?.showModal();}
  function close(){dialog.current?.close();setEditing(null);setError('');}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||refreshing)return;const values=Object.fromEntries(new FormData(event.currentTarget));
    let command:unknown;
    if(editing?.kind==='initial')command={type:'employee_material',id:editing.item?.id,...values,quantity:Number(values.quantity)};
    if(editing?.kind==='delivery')command={type:'delivery_correct',id:editing.item.id,...values,quantity:Number(values.quantity)};
    if(editing?.kind==='remove')command={type:editing.source==='initial'?'employee_material_archive':'delivery_void',id:editing.id,...values};
    setBusy(true);setError('');
    try{const result=await warehouseAction(command,tabId);if(!result.ok){setError(result.error??'No se pudo guardar.');return;}close();toast.success('Registro actualizado');window.dispatchEvent(new Event('warehouse:changed'));startRefresh(()=>router.refresh());}
    catch{setError('No se pudo conectar. Intenta nuevamente.');}finally{setBusy(false);}
  }
  async function receipt(r:Request){setBusy(true);try{await downloadDeliveryReceipt(r,tabId);toast.success('Acta descargada. Ábrela para imprimir y firmar.');}catch(e){toast.error(e instanceof Error?e.message:'No se pudo generar el acta.');}finally{setBusy(false);}}
  async function exportPdf(){setBusy(true);try{
    const rows=[...initial.map(h=>({Empleado:h.employee,Material:h.name,Cantidad:h.quantity,Unidad:h.unit,Origen:'Registro inicial',Estado:h.condition,Serie:h.serial,Ubicación:h.location,Fecha:dateText(h.recorded_on),Observaciones:h.notes})),...deliveries.map(r=>({Empleado:r.employee,Material:r.material,Cantidad:r.quantity,Unidad:r.unit,Origen:'Entrega de almacén',Estado:'Entregado',Serie:'',Ubicación:r.delivery_place??'',Fecha:dateText(r.delivered_at!),Observaciones:r.response}))];
    if(!rows.length){toast.error('No hay materiales en esta vista.');return;}
    const {createReportPdf,loadReportLogo}=await import('@/lib/report-pdf');
    const logo=await loadReportLogo();await createReportPdf(employee?'Mis materiales':'Materiales por empleado',rows,`${data.viewer.name} · ${filter?data.staff.find(s=>s.id===filter)?.name:'Todos los empleados autorizados'}${query?` · Búsqueda: ${query}`:''}`,logo).save('materiales-por-empleado.pdf',{returnPromise:true});
  }catch{toast.error('No se pudo generar el informe.');}finally{setBusy(false);}}
  return <>
    <div className="inline-status" role="status" aria-live="polite">{refreshing&&<><LoaderCircle size={14} className="motion-spin"/>Actualizando ficha…</>}</div>
    <div className="table-toolbar">{!employee&&<><label>Empleado<select aria-label="Filtrar empleado" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos los empleados</option>{data.staff.filter(s=>s.role==='empleado_agbc').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="primary-button" disabled={!staff.length||busy||refreshing} onClick={()=>open({kind:'initial'})}><Plus size={17}/>Registrar material previo</button></>}<button className="secondary-button" disabled={busy||refreshing} onClick={()=>void exportPdf()}><Download size={17}/>Descargar ficha PDF</button></div>
    <p className="muted">{employee?'Consulta los materiales registrados a tu nombre. Solo los administradores pueden modificar estos datos.':'Registra los materiales que el empleado ya posee. Este registro no descuenta stock; las entregas del almacén se incorporan al confirmarlas.'}</p>
    <section className="data-panel"><div className="table-scroll"><table><thead><tr>{!employee&&<th>Empleado</th>}<th>Material</th><th>Cantidad / unidad</th><th>Origen / fecha</th><th>Estado / ubicación / observaciones</th>{!employee&&<th>Acciones</th>}</tr></thead><tbody>
      {initial.map(h=><tr key={h.id}>{!employee&&<td>{h.employee}</td>}<td><strong>{h.name}</strong><small>{h.category}{h.serial&&` · Serie: ${h.serial}`}</small></td><td>{h.quantity} {h.unit}</td><td>Registro inicial<small>{dateText(h.recorded_on)}</small></td><td>{h.condition}<small>{h.location}</small><small>{h.notes}</small></td>{!employee&&<td><div className="row-actions"><button className="icon-button" disabled={busy||refreshing} aria-label={`Editar registro ${h.name}`} onClick={()=>open({kind:'initial',item:h})}><Pencil size={16}/></button><button className="icon-button danger" disabled={busy||refreshing} aria-label={`Eliminar registro ${h.name}`} onClick={()=>open({kind:'remove',id:h.id,source:'initial',name:h.name})}><Trash2 size={16}/></button></div></td>}</tr>)}
      {deliveries.map(r=><tr key={r.id}>{!employee&&<td>{r.employee}</td>}<td><strong>{r.material}</strong></td><td>{r.quantity} {r.unit}</td><td>Entrega de almacén<small>{dateText(r.delivered_at!)}</small></td><td>Entregado<small>{r.delivery_place}</small><small>{r.response}</small></td>{!employee&&<td><div className="row-actions"><button className="icon-button" disabled={busy||refreshing} aria-label={`Imprimir acta ${r.material}`} onClick={()=>void receipt(r)}><Printer size={16}/></button><button className="icon-button" disabled={busy||refreshing} aria-label={`Corregir entrega ${r.material}`} onClick={()=>open({kind:'delivery',item:r})}><Pencil size={16}/></button><button className="icon-button danger" disabled={busy||refreshing} aria-label={`Anular entrega ${r.material}`} onClick={()=>open({kind:'remove',id:r.id,source:'delivery',name:r.material})}><Trash2 size={16}/></button></div></td>}</tr>)}
    </tbody></table>{!initial.length&&!deliveries.length&&<div className="empty-state">No hay materiales registrados en esta vista.</div>}</div></section>
    {!employee&&<dialog ref={dialog} className="warehouse-dialog" aria-labelledby="employee-material-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else close();}}><div className="dialog-heading"><h2 id="employee-material-dialog-title">{editing?.kind==='remove'?'Eliminar / anular asignación':editing?.kind==='delivery'?'Corregir entrega':editing?.item?'Editar material registrado':'Ficha de materiales previos'}</h2><button className="icon-button" disabled={busy||refreshing} aria-label="Cerrar ficha de materiales" onClick={close}><X size={20}/></button></div>
      <form key={editing?.kind==='initial'?editing.item?.id??'new':editing?.kind==='delivery'?editing.item.id:editing?.kind} onSubmit={submit}><fieldset className="form-grid" disabled={busy||refreshing}>
        {editing?.kind!=='remove'&&<><label className="full-width">Empleado<select name="userId" required defaultValue={editing?.item?.user_id??filter??''}><option value="" disabled>Selecciona un empleado</option>{staff.filter(s=>editing?.kind!=='delivery'||s.warehouse_id===editing.item.warehouse_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Cantidad<input name="quantity" type="number" min={1} max={10000000} required defaultValue={editing?.item?.quantity??1}/></label></>}
        {editing?.kind==='initial'&&<><label>Material<input name="name" required maxLength={200} defaultValue={editing.item?.name}/></label><label>Categoría<input name="category" required maxLength={200} defaultValue={editing.item?.category??'Material previo'}/></label><label>Unidad<input name="unit" required maxLength={200} defaultValue={editing.item?.unit??'unidad'}/></label><label>Serie / código (opcional)<input name="serial" maxLength={200} defaultValue={editing.item?.serial}/></label><label>Estado físico<input name="condition" required maxLength={200} defaultValue={editing.item?.condition??'Bueno'}/></label><label>Ubicación<input name="location" required maxLength={200} defaultValue={editing.item?.location}/></label><label>Fecha del registro<input name="recordedOn" type="date" required max={today()} defaultValue={editing.item?.recorded_on??today()}/></label><label className="full-width">Observaciones<textarea name="notes" maxLength={2000} defaultValue={editing.item?.notes} placeholder="Uso, procedencia o información adicional."/></label></>}
        {editing?.kind==='delivery'&&<p className="full-width form-hint">Material: {editing.item.material}. Corregir la cantidad ajusta el stock. Para cambiar el material, anula esta entrega y registra una solicitud con el material correcto.</p>}
        {editing?.kind==='remove'&&<p className="full-width form-hint">{editing.name}: {editing.source==='delivery'?'Se anulará la entrega por error de registro y se restituirá su cantidad al stock. No uses esta opción para un consumo real.':'Se retirará de los materiales visibles del empleado; se conservará su historial.'}</p>}
        <label className="full-width">{editing?.kind==='initial'&&!editing.item?'Motivo del registro':'Motivo de la corrección o eliminación'}<textarea name="reason" required maxLength={200} placeholder="Explica el registro o el error que estás corrigiendo."/></label>
      </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy||refreshing} onClick={close}>Cancelar</button><button className="primary-button" disabled={busy||refreshing}>{busy&&<LoaderCircle size={16} className="motion-spin" aria-hidden="true"/>}{busy?'Guardando…':editing?.kind==='remove'?'Confirmar eliminación / anulación':'Guardar registro'}</button></div></form>
    </dialog>}
  </>;
}
