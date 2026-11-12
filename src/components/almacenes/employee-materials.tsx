"use client";
import { DateField } from './request-date';
import { employeeMaterialView } from '@/lib/employee-materials-view';
import { withMinimumLoading } from '@/lib/loading-time';
import { PostalLoader } from './postal-loader';
import { useRef, useState, useTransition } from "react";
import { useWarehouseTab } from "./tab-session";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { warehouseAction, getDeliveryReceipt } from "@/actions/almacenes/manage";
import type { EmployeeMaterial, Request, Snapshot } from "@/lib/warehouse-types";

const dateText=(value:string)=>new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'short'}).format(new Date(value.length===10?`${value}T12:00:00-04:00`:value));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz'}).format(new Date());
type Editing = {kind:'initial';item?:EmployeeMaterial;userId?:string} | {kind:'delivery';item:Request} | {kind:'remove';id:string;source:'initial'|'delivery';name:string};
const materialFields=['name','category','unit','quantity','serial','condition','location','notes'] as const;

function PreviousMaterialFields({item,prefix=''}:{item?:EmployeeMaterial;prefix?:string}) {
  return <>
    <label>Cantidad<input name={`${prefix}quantity`} type="number" min={1} max={10000000} required defaultValue={item?.quantity??1}/></label>
    <label>Material<input name={`${prefix}name`} required maxLength={200} defaultValue={item?.name}/></label>
    <label>Partida<input name={`${prefix}category`} required maxLength={200} defaultValue={item?.category??'Material previo'}/></label>
    <label>Unidad<input name={`${prefix}unit`} required maxLength={200} defaultValue={item?.unit??'unidad'}/></label>
    <label>Serie / código (opcional)<input name={`${prefix}serial`} maxLength={200} defaultValue={item?.serial}/></label>
    <label>Estado físico<input name={`${prefix}condition`} required maxLength={200} defaultValue={item?.condition??'Bueno'}/></label>
    <label>Ubicación<input name={`${prefix}location`} required maxLength={200} defaultValue={item?.location}/></label>
    <label className="full-width">Observaciones<textarea name={`${prefix}notes`} maxLength={2000} defaultValue={item?.notes} placeholder="Uso, procedencia o información adicional."/></label>
  </>;
}

export async function downloadDeliveryReceipt(request: Request, tabId?: string) {
  return withMinimumLoading(async()=>{
  const result=await getDeliveryReceipt(request.id,tabId);
  if(!result.ok) throw new Error(result.error);
  const {createDeliveryReceipt,loadReportLogos}=await import('@/lib/report-pdf');
  const logos=await loadReportLogos();
  const {request:current,recipient,warehouse,issuer}=result.data;
  const doc=createDeliveryReceipt(current,recipient,warehouse,issuer,logos);
  await doc.save(`acta-entrega-${request.id}.pdf`,{returnPromise:true});
  });
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
  const [lineKeys,setLineKeys]=useState<string[]>([]);
  const [filter,setFilter]=useState(userId);
  const staff=data.staff.filter(s=>s.role==='empleado_agbc'&&s.is_active);
  const {initial,deliveries,withoutMaterials}=employeeMaterialView(data,filter,query);
  function open(next:Editing){setError('');setLineKeys([crypto.randomUUID()]);setEditing(next);dialog.current?.showModal();}
  function close(){dialog.current?.close();setEditing(null);setError('');}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||refreshing)return;const form=new FormData(event.currentTarget),values=Object.fromEntries(form);
    let command:unknown;
    if(editing?.kind==='initial')command=editing.item
      ?{type:'employee_material',id:editing.item.id,...values,quantity:Number(values.quantity)}
      :{type:'employee_material_batch',userId:values.userId,recordedOn:values.recordedOn,reason:values.reason,items:lineKeys.map(key=>Object.fromEntries(materialFields.map(field=>[field,field==='quantity'?Number(form.get(`items.${key}.${field}`)):form.get(`items.${key}.${field}`)])))};
    if(editing?.kind==='delivery')command={type:'delivery_correct',id:editing.item.id,...values,quantity:Number(values.quantity)};
    if(editing?.kind==='remove')command={type:editing.source==='initial'?'employee_material_archive':'delivery_void',id:editing.id,...values};
    setBusy(true);setError('');
    try{const result=await withMinimumLoading(()=>warehouseAction(command,tabId));if(!result.ok){setError(result.error??'No se pudo guardar.');return;}close();toast.success('Registro actualizado');window.dispatchEvent(new Event('warehouse:changed'));startRefresh(()=>router.refresh());}
    catch{setError('No se pudo conectar. Intenta nuevamente.');}finally{setBusy(false);}
  }
  async function receipt(r:Request){setBusy(true);try{await downloadDeliveryReceipt(r,tabId);toast.success('Acta descargada. Ábrela para imprimir y firmar.');}catch(e){toast.error(e instanceof Error?e.message:'No se pudo generar el acta.');}finally{setBusy(false);}}
  async function exportPdf(){setBusy(true);try{await withMinimumLoading(async()=>{
    const rows=[...initial.map(h=>({Empleado:h.employee,Regional:data.staff.find(s=>s.id===h.user_id)?.regional??'Sin asignar',Material:h.name,Cantidad:h.quantity,Unidad:h.unit,Origen:'Registro inicial',Estado:h.condition,Serie:h.serial,Ubicación:h.location,Fecha:dateText(h.recorded_on),Observaciones:h.notes})),...deliveries.map(r=>({Empleado:r.employee,Regional:r.regional,Material:r.material,Cantidad:r.quantity,Unidad:r.unit,Origen:'Entrega de almacén',Estado:'Entregado',Serie:'',Ubicación:r.delivery_place??'',Fecha:dateText(r.delivered_at!),Observaciones:r.response})),...withoutMaterials.map(p=>({Empleado:p.name,Regional:p.regional,Material:'Sin materiales registrados',Cantidad:0,Unidad:'—',Origen:'—',Estado:p.is_active?'Activo':'Inactivo',Serie:'',Ubicación:'',Fecha:'',Observaciones:'No tiene materiales previos ni entregas confirmadas.'}))];
    if(!rows.length){toast.error('No hay materiales en esta vista.');return;}
    const {createReportPdf,loadReportLogos}=await import('@/lib/report-pdf');
    const logos=await loadReportLogos();await createReportPdf(employee?'Mis materiales':'Materiales por empleado',rows,`${data.viewer.name} · ${filter?data.staff.find(s=>s.id===filter)?.name:'Todos los empleados autorizados'}${query?` · Búsqueda: ${query}`:''}`,logos).save('materiales-por-empleado.pdf',{returnPromise:true});
  });}catch{toast.error('No se pudo generar el informe.');}finally{setBusy(false);}}
  return <>
    <div className="inline-status" role="status" aria-live="polite">{refreshing&&<><PostalLoader/>Actualizando ficha…</>}</div>
    {busy&&!editing&&<PostalLoader size="panel" label="Preparando documento…"/>}<div className="table-toolbar">{!employee&&<><label>Empleado<select aria-label="Filtrar empleado" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos los empleados</option>{data.staff.filter(s=>s.role==='empleado_agbc').map(s=><option key={s.id} value={s.id}>{s.name} · {s.regional}</option>)}</select></label><button className="primary-button" disabled={!staff.length||busy||refreshing} onClick={()=>open({kind:'initial'})}><Plus size={17}/>Registrar material previo</button></>}<button className="secondary-button" disabled={busy||refreshing} onClick={()=>void exportPdf()}><Download size={17}/>Descargar ficha PDF</button></div>
    <p className="muted">{employee?'Consulta los materiales registrados a tu nombre. Solo los administradores pueden modificar estos datos.':'Registra los materiales que el empleado ya posee. Este registro no descuenta stock; las entregas del almacén se incorporan al confirmarlas.'}</p>
    <section className="data-panel"><div className="table-scroll"><table><thead><tr>{!employee&&<th>Empleado</th>}<th>Material</th><th>Cantidad / unidad</th><th>Origen / fecha</th><th>Estado / ubicación / observaciones</th>{!employee&&<th>Acciones</th>}</tr></thead><tbody>
      {initial.map(h=><tr key={h.id}>{!employee&&<td>{h.employee}<small>{data.staff.find(s=>s.id===h.user_id)?.regional}</small></td>}<td><strong>{h.name}</strong><small>{h.category}{h.serial&&` · Serie: ${h.serial}`}</small></td><td>{h.quantity} {h.unit}</td><td>Registro inicial<small>{dateText(h.recorded_on)}</small></td><td>{h.condition}<small>{h.location}</small><small>{h.notes}</small></td>{!employee&&<td><div className="row-actions"><button className="icon-button" disabled={busy||refreshing} aria-label={`Editar registro ${h.name}`} onClick={()=>open({kind:'initial',item:h})}><Pencil size={16}/></button><button className="icon-button danger" disabled={busy||refreshing} aria-label={`Eliminar registro ${h.name}`} onClick={()=>open({kind:'remove',id:h.id,source:'initial',name:h.name})}><Trash2 size={16}/></button></div></td>}</tr>)}
      {deliveries.map(r=><tr key={r.id}>{!employee&&<td>{r.employee}<small>{r.regional}</small></td>}<td><strong>{r.material}</strong></td><td>{r.quantity} {r.unit}</td><td>Entrega de almacén<small>{dateText(r.delivered_at!)}</small></td><td>Entregado<small>{r.delivery_place}</small><small>{r.response}</small></td>{!employee&&<td><div className="row-actions"><button className="icon-button" disabled={busy||refreshing} aria-label={`Descargar acta ${r.material}`} onClick={()=>void receipt(r)}><Download size={16}/></button><button className="icon-button" disabled={busy||refreshing} aria-label={`Corregir entrega ${r.material}`} onClick={()=>open({kind:'delivery',item:r})}><Pencil size={16}/></button><button className="icon-button danger" disabled={busy||refreshing} aria-label={`Anular entrega ${r.material}`} onClick={()=>open({kind:'remove',id:r.id,source:'delivery',name:r.material})}><Trash2 size={16}/></button></div></td>}</tr>)}
      {withoutMaterials.map(person=><tr key={`empty-${person.id}`}><td><strong>{person.name}</strong><small>CI: {person.document}</small><small>{person.regional}{!person.is_active&&' · Inactivo'}</small></td><td><strong>Sin materiales registrados</strong></td><td>0</td><td>—</td><td>No tiene materiales previos ni entregas confirmadas.</td><td><button type="button" className="small-button" disabled={!person.is_active||busy||refreshing} title={person.is_active?'Registrar los materiales que ya posee':'Rehabilita la ficha del empleado para registrar materiales'} onClick={()=>open({kind:'initial',userId:person.id})}><Plus size={16}/>Registrar material previo</button></td></tr>)}
    </tbody></table>{!initial.length&&!deliveries.length&&!withoutMaterials.length&&<div className="empty-state">{employee?'No tienes materiales registrados en esta vista.':'No se encontraron empleados ni materiales con estos filtros.'}</div>}</div></section>
    {!employee&&<dialog ref={dialog} className="warehouse-dialog" aria-labelledby="employee-material-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else close();}}><div className="dialog-heading"><h2 id="employee-material-dialog-title">{editing?.kind==='remove'?'Eliminar / anular asignación':editing?.kind==='delivery'?'Corregir entrega':editing?.item?'Editar material registrado':'Ficha de materiales previos'}</h2><button className="icon-button" disabled={busy||refreshing} aria-label="Cerrar ficha de materiales" onClick={close}><X size={20}/></button></div>
      <form key={editing?.kind==='initial'?editing.item?.id??editing.userId??'new':editing?.kind==='delivery'?editing.item.id:editing?.kind} onSubmit={submit}><fieldset className="form-grid" disabled={busy||refreshing}>
        {editing?.kind!=='remove'&&<label className="full-width">Empleado<select name="userId" required defaultValue={editing?.item?.user_id??(editing?.kind==='initial'?editing.userId:undefined)??filter}><option value="" disabled>Selecciona un empleado</option>{staff.filter(s=>editing?.kind!=='delivery'||s.warehouse_id===editing.item.warehouse_id).map(s=><option key={s.id} value={s.id}>{s.name} · {s.regional}</option>)}</select></label>}
        {editing?.kind==='delivery'&&<label>Cantidad<input name="quantity" type="number" min={1} max={10000000} required defaultValue={editing.item.quantity}/></label>}
        {editing?.kind==='initial'&&<>
          <DateField label="Fecha del registro" name="recordedOn" required max={today()} defaultValue={editing.item?.recorded_on??today()}/>
          {editing.item?<PreviousMaterialFields item={editing.item}/>:<div className="full-width purchase-lines">
            {lineKeys.map((key,index)=><section className="purchase-line" key={key} aria-labelledby={`previous-material-${key}`}>
              <div className="purchase-line-heading"><h3 id={`previous-material-${key}`}>Material {index+1}</h3><button type="button" className="small-button danger" disabled={lineKeys.length===1} aria-label={`Quitar material ${index+1}`} onClick={()=>setLineKeys(current=>current.filter(value=>value!==key))}>Quitar</button></div>
              <div className="form-grid"><PreviousMaterialFields prefix={`items.${key}.`}/></div>
            </section>)}
            <button type="button" className="secondary-button" disabled={lineKeys.length>=50} onClick={()=>setLineKeys(current=>[...current,crypto.randomUUID()])}><Plus size={16}/>Añadir otro material</button>
            <p className="form-hint">{lineKeys.length} {lineKeys.length===1?'material':'materiales'} · Hasta 50 por ficha. Se guardan juntos para el empleado y la fecha seleccionados, sin descontar stock.</p>
          </div>}
        </>}
        {editing?.kind==='delivery'&&<p className="full-width form-hint">Material: {editing.item.material}. Corregir la cantidad ajusta el stock. Para cambiar el material, anula esta entrega y registra una solicitud con el material correcto.</p>}
        {editing?.kind==='remove'&&<p className="full-width form-hint">{editing.name}: {editing.source==='delivery'?'Se anulará la entrega por error de registro y se restituirá su cantidad al stock. No uses esta opción para un consumo real.':'Se retirará de los materiales visibles del empleado; se conservará su historial.'}</p>}
        <label className="full-width">{editing?.kind==='initial'&&!editing.item?'Motivo del registro':'Motivo de la corrección o eliminación'}<textarea name="reason" required maxLength={200} placeholder="Explica el registro o el error que estás corrigiendo."/></label>
      </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy||refreshing} onClick={close}>Cancelar</button><button className="primary-button" disabled={busy||refreshing}>{busy&&<PostalLoader/>}{busy?'Guardando…':editing?.kind==='remove'?'Confirmar eliminación / anulación':'Guardar registro'}</button></div></form>
    </dialog>}
  </>;
}
