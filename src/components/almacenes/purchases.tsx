"use client";
import { DateField } from './request-date';
import { dateInputValue } from '@/lib/request-date';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Snapshot } from '@/lib/warehouse-types';
import type { Supplier } from '@/lib/warehouse';
import { saveSupplier, setSupplierActive, registerPurchase } from '@/actions/almacenes/purchases';
import { useWarehouseTab } from './tab-session';
import { withMinimumLoading } from '@/lib/loading-time';
import { PostalLoader } from './postal-loader';
import { DocumentAttachments } from './document-attachments';
import { SearchSelect } from './search-select';

const money=(n:number|string)=>new Intl.NumberFormat('es-BO',{style:'currency',currency:'BOB'}).format(Number(n));
export function PurchaseHistory({data,supplierId,materialId}:{data:Snapshot;supplierId?:string;materialId?:string}) {
  const rows=data.purchases.filter(p=>(!supplierId||p.supplier_id===supplierId)&&(!materialId||p.material_id===materialId));
  return <div className="table-scroll"><table><thead><tr><th>Fecha / factura / entrada PEPS</th><th>Proveedor / material</th><th>Detalle facturado / lote</th><th>Cantidad</th><th>Costo unitario</th><th>Total</th><th>Respaldos</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td>{p.purchased_on}<small>Factura {p.invoice_number}</small><small>{p.batch_id?`PEPS E-${String(p.batch_id).padStart(6,'0')}`:'Entrada anterior a PEPS'}</small></td><td>{p.supplier}{!p.supplier_id&&<small>Compra ocasional · No registrado como proveedor</small>}{p.supplier_details?.nit&&<small>NIT: {p.supplier_details.nit}</small>}{p.supplier_details?.phone&&<small>Teléfono: {p.supplier_details.phone}</small>}<small>{p.material}</small></td><td>{p.invoice_description}<small>Lote: {p.lot||'Sin lote'} · Vence: {p.expires_on||'No aplica'}</small><small>{p.notes}</small></td><td>{p.quantity}</td><td>{money(p.unit_cost)}</td><td>{money(p.quantity*Number(p.unit_cost))}</td><td><DocumentAttachments kind="purchases" id={p.id} files={p.attachments}/></td></tr>)}</tbody></table>{!rows.length&&<p className="empty-state">Aún no hay compras registradas.</p>}</div>;
}

export function Suppliers({data,query}:{data:Snapshot;query:string}) {
  const dialog=useRef<HTMLDialogElement>(null),router=useRouter(),tabId=useWarehouseTab();
  const [businessType,setBusinessType]=useState('');
  const typeOptions=Array.from(new Set(['Tienda','Almacén','Distribuidora','Fábrica','Empresa de servicios','Importadora','Mayorista',...data.suppliers.map(s=>s.business_type).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,'es')).map(label=>({id:label,label}));
  const [editing,setEditing]=useState<Supplier>(),[history,setHistory]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refreshing,startRefresh]=useTransition();
  const rows=data.suppliers.filter(s=>`${s.name} ${s.business_type} ${s.nit} ${s.contact} ${s.phone}`.toLowerCase().includes(query.toLowerCase()));
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy||refreshing)return;const values=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);setError('');try{const result=await withMinimumLoading(()=>saveSupplier({...values,id:editing?.id},tabId));if(!result.ok){setError(result.error);return;}dialog.current?.close();toast.success('Proveedor guardado');startRefresh(()=>router.refresh());}catch{setError('No se pudo conectar.');}finally{setBusy(false);}}
  async function toggleActive(supplier:Supplier){
    if(busy||refreshing)return;
    setBusy(true);
    try{const result=await withMinimumLoading(()=>setSupplierActive({id:supplier.id,active:!supplier.is_active},tabId));if(!result.ok){toast.error(result.error);return;}toast.success(supplier.is_active?'Proveedor dado de baja':'Proveedor activado');startRefresh(()=>router.refresh());}catch{toast.error('No se pudo conectar. Intenta nuevamente.');}finally{setBusy(false);}
  }
  return <><div className="table-toolbar"><button className="primary-button" disabled={busy||refreshing} onClick={()=>{setEditing(undefined);setBusinessType('');setError('');dialog.current?.showModal();}}>Registrar proveedor</button></div><section className="data-panel"><div className="table-scroll"><table><thead><tr><th>Razón social / NIT</th><th>Tipo de proveedor</th><th>Contacto</th><th>Dirección</th><th>Estado</th><th>Compras</th><th>Acciones</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td><strong>{s.name}</strong><small>NIT: {s.nit}</small><small>{data.warehouses.find(w=>w.id===s.warehouse_id)?.name}</small></td><td>{s.business_type||'Sin especificar'}</td><td>{s.contact}<small>{s.phone}</small><small>{s.email}</small></td><td>{s.address}<small>{s.notes}</small></td><td>{s.is_active?'Activo':'Inactivo'}</td><td>{data.purchases.filter(p=>p.supplier_id===s.id).length}</td><td><div className="row-actions supplier-actions"><button className="small-button" disabled={busy||refreshing} aria-label={`${s.is_active?'Dar de baja':'Activar'} proveedor ${s.name}`} onClick={()=>void toggleActive(s)}>{s.is_active?'Dar de baja':'Activar'}</button><button className="small-button" onClick={()=>setHistory(s.id)}>Ver historial</button><button className="small-button" disabled={busy||refreshing} onClick={()=>{setEditing(s);setBusinessType(s.business_type??'');setError('');dialog.current?.showModal();}}>Editar</button></div></td></tr>)}</tbody></table>{!rows.length&&<p className="empty-state">No hay proveedores con estos filtros.</p>}</div></section>
    {history&&<section className="data-panel"><div className="panel-heading"><h2>Compras a {data.suppliers.find(s=>s.id===history)?.name}</h2><button className="small-button" onClick={()=>setHistory('')}>Cerrar historial</button></div><PurchaseHistory data={data} supplierId={history}/></section>}
    <dialog ref={dialog} className="warehouse-dialog" aria-labelledby="supplier-title" onCancel={e=>{if(busy)e.preventDefault();}}><h2 id="supplier-title">{editing?'Editar proveedor':'Registrar proveedor'}</h2><form key={editing?.id??'new'} onSubmit={submit}><fieldset className="form-grid" disabled={busy||refreshing}>
      <input type="hidden" name="warehouseId" value={editing?.warehouse_id||data.viewer.warehouse_id||data.warehouses[0]?.id||''}/><SearchSelect label="Tipo de proveedor" name="businessType" value={businessType} options={typeOptions} onChange={setBusinessType} onSelect={option=>setBusinessType(option.label)} freeText placeholder="Selecciona o escribe: tienda, almacén…"/>
      {(['name','nit','contact','phone','email','address'] as const).map((key,i)=><label key={key}>{['Razón social','NIT / identificación tributaria','Persona de contacto','Teléfono','Correo electrónico','Dirección'][i]}<input name={key} required={i<2} type={key==='email'?'email':'text'} maxLength={200} defaultValue={editing?.[key]}/></label>)}
      <label className="full-width">Observaciones<textarea name="notes" maxLength={2000} defaultValue={editing?.notes}/></label>
    </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>dialog.current?.close()}>Cancelar</button><button className="primary-button" disabled={busy||refreshing}>{busy?<PostalLoader/>:'Guardar proveedor'}</button></div></form></dialog></>;
}

type PurchaseLine={key:string;materialId:string;materialText:string;quantity:string;unitCost:string;invoiceDescription:string;lot:string;expiresOn:string};
const newPurchaseLine=():PurchaseLine=>({key:crypto.randomUUID(),materialId:'',materialText:'',quantity:'1',unitCost:'',invoiceDescription:'',lot:'',expiresOn:''});

export function PurchaseEntry({data}:{data:Snapshot}) {
  const dialog=useRef<HTMLDialogElement>(null),router=useRouter(),tabId=useWarehouseTab();
  const [lines,setLines]=useState<PurchaseLine[]>([]),[warehouseId,setWarehouseId]=useState(data.viewer.warehouse_id||data.warehouses[0]?.id||'');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[refreshing,startRefresh]=useTransition();
  const [entryKey,setEntryKey]=useState('');
  const [supplierMode,setSupplierMode]=useState<'registered'|'occasional'>('registered'),[saveNewSupplier,setSaveNewSupplier]=useState(false),[supplierType,setSupplierType]=useState('');
  const supplierTypeOptions=Array.from(new Set(['Tienda','Almacén','Distribuidora','Fábrica','Empresa de servicios','Importadora','Mayorista',...data.suppliers.map(s=>s.business_type).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,'es')).map(label=>({id:label,label}));
  const materialOptions=data.materials.filter(m=>m.warehouse_id===warehouseId).map(m=>({id:m.id,label:`${m.code} · ${m.name}`,description:m.unit}));
  const total=lines.reduce((sum,line)=>sum+Number(line.quantity)*Number(line.unitCost),0);
  function updateLine(key:string,patch:Partial<PurchaseLine>){setLines(current=>current.map(line=>line.key===key?{...line,...patch}:line));}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(lines.some(line=>!line.materialId)){setError('Selecciona un material de la lista en cada línea.');return;}
    const form=new FormData(event.currentTarget);
    form.set('lines',JSON.stringify(lines.map(({materialId,quantity,unitCost,invoiceDescription,lot,expiresOn})=>({materialId,quantity,unitCost,invoiceDescription,lot,expiresOn:dateInputValue(expiresOn)}))));
    setBusy(true);setError('');
    try{const result=await withMinimumLoading(()=>registerPurchase(form,tabId));if(!result.ok){setError(result.error);return;}dialog.current?.close();toast.success('Compra y existencias registradas');startRefresh(()=>router.refresh());window.dispatchEvent(new Event('warehouse:changed'));}
    catch{setError('No se pudo conectar. Reintenta este mismo formulario.');}finally{setBusy(false);}
  }
  return <><button className="secondary-button" disabled={!data.materials.length} onClick={()=>{setEntryKey(crypto.randomUUID());setWarehouseId(data.viewer.warehouse_id||data.warehouses[0]?.id||'');setLines([newPurchaseLine()]);setSupplierMode(data.suppliers.some(s=>s.is_active&&s.warehouse_id===(data.viewer.warehouse_id||data.warehouses[0]?.id))?'registered':'occasional');setSaveNewSupplier(false);setSupplierType('');setError('');dialog.current?.showModal();}}>Registrar compra / reposición</button>
    <dialog ref={dialog} className="warehouse-dialog purchase-dialog" aria-labelledby="purchase-title" onCancel={e=>{if(busy)e.preventDefault();}}>
      <h2 id="purchase-title">Compra y reposición de materiales</h2>
      <p>Registra varios materiales de una misma compra con su proveedor, factura y respaldo.</p>
      <form key={entryKey} onSubmit={submit}><input type="hidden" name="submissionKey" value={entryKey}/>
        <fieldset className="form-grid" disabled={busy||refreshing}>
          {data.warehouses.length>1&&<label className="full-width">Almacén<select value={warehouseId} onChange={e=>{setWarehouseId(e.target.value);setLines([newPurchaseLine()]);}}>{data.warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
          <label className="full-width">Proveedor de esta compra<select name="supplierMode" value={supplierMode} onChange={e=>{setSupplierMode(e.target.value as 'registered'|'occasional');setSaveNewSupplier(false);}}><option value="registered">Seleccionar proveedor registrado</option><option value="occasional">Proveedor nuevo u ocasional</option></select></label>
          {supplierMode==='registered'?<label className="full-width">Proveedor registrado<select key={warehouseId} name="supplierId" required defaultValue=""><option value="" disabled>Selecciona un proveedor</option>{data.suppliers.filter(s=>s.is_active&&s.warehouse_id===warehouseId).map(s=><option key={s.id} value={s.id}>{s.name} · {s.nit}</option>)}</select></label>:<div className="full-width purchase-line form-grid">
            <label>Nombre o razón social del vendedor<input name="supplierName" required maxLength={200}/></label>
            <label>NIT / identificación tributaria<input name="supplierNit" required={saveNewSupplier} maxLength={200}/><small>{saveNewSupplier?'Necesario para guardarlo en Proveedores.':'Opcional si no figura en el comprobante.'}</small></label>
            <SearchSelect label="Tipo de proveedor" name="supplierType" value={supplierType} options={supplierTypeOptions} onChange={setSupplierType} onSelect={option=>setSupplierType(option.label)} freeText required={false} placeholder="Tienda, almacén u otro"/>
            <label>Teléfono del vendedor (opcional)<input name="supplierPhone" maxLength={200}/></label>
            <label className="full-width supplier-save-toggle"><input type="checkbox" name="saveSupplier" checked={saveNewSupplier} onChange={e=>setSaveNewSupplier(e.target.checked)}/><span>Guardar este proveedor para futuras compras</span></label>
            <p className="full-width form-hint">{saveNewSupplier?'Se añadirá al registro de Proveedores al guardar la compra.':'Sus datos quedarán solo en esta compra; no se añadirá al registro de Proveedores.'}</p>
          </div>}
          <label>Número de factura / comprobante<input name="invoiceNumber" required maxLength={200}/></label>
          <DateField label="Fecha de compra / ingreso" name="purchasedOn" required max={new Date().toLocaleDateString('en-CA',{timeZone:'America/La_Paz'})}/>
          <div className="full-width purchase-lines">
            {lines.map((line,index)=><section className="purchase-line" key={line.key} aria-labelledby={`purchase-line-${line.key}`}>
              <div className="purchase-line-heading"><h3 id={`purchase-line-${line.key}`}>Material {index+1}</h3><button type="button" className="small-button danger" disabled={lines.length===1} aria-label={`Quitar material ${index+1}`} onClick={()=>setLines(current=>current.filter(item=>item.key!==line.key))}>Quitar</button></div>
              <div className="form-grid">
                <div className="full-width"><SearchSelect label={`Material ${index+1}`} value={line.materialText} options={materialOptions} maxLength={600} placeholder="Escribe el nombre o código del material" onChange={text=>updateLine(line.key,{materialText:text,materialId:materialOptions.find(m=>m.label===text)?.id??''})} onSelect={option=>updateLine(line.key,{materialId:option.id,materialText:option.label})}/></div>
                <label>Cantidad ingresada<input type="number" min={1} max={10000000} required value={line.quantity} onChange={e=>updateLine(line.key,{quantity:e.target.value})}/></label>
                <label>Costo unitario (Bs)<input type="number" min="0.000001" max={100000000} step="0.000001" required value={line.unitCost} onChange={e=>updateLine(line.key,{unitCost:e.target.value})}/></label>
                <label className="full-width">Descripción exacta según factura<textarea required maxLength={2000} rows={2} value={line.invoiceDescription} onChange={e=>updateLine(line.key,{invoiceDescription:e.target.value})}/></label>
                <label>Lote (opcional)<input maxLength={200} value={line.lot} onChange={e=>updateLine(line.key,{lot:e.target.value})}/></label>
                <DateField label="Vencimiento (si corresponde)" text={line.expiresOn} onTextChange={text=>updateLine(line.key,{expiresOn:text})}/>
              </div>
              <p className="purchase-subtotal">Subtotal: <strong>{money(Number(line.quantity)*Number(line.unitCost))}</strong></p>
            </section>)}
            <button type="button" className="secondary-button" disabled={lines.length>=50} onClick={()=>setLines(current=>[...current,newPurchaseLine()])}>Añadir otro material</button>
          </div>
          <p className="full-width purchase-total" aria-live="polite"><span>{lines.length} {lines.length===1?'línea de material':'líneas de materiales'} · Total de la compra</span><strong>{money(total)}</strong></p>
          <label className="full-width">Observaciones de la compra<textarea name="notes" maxLength={2000}/></label>
          <label className="full-width">Respaldo de compra<input name="attachments" type="file" accept="application/pdf,image/jpeg,image/png" multiple required/><small>1 a 4 imágenes o PDF, hasta 2 MB cada uno. El mismo respaldo se conserva en cada línea de esta compra.</small></label>
          <p className="full-width form-hint">Hasta 50 líneas del mismo almacén. Cada línea genera su entrada PEPS; puedes repetir un material si corresponde a otro lote o costo. La compra se guarda completa: si hay un error, no se registra ningún ingreso.</p>
        </fieldset>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>dialog.current?.close()}>Cancelar</button><button className="primary-button" disabled={busy||refreshing}>{busy?<PostalLoader/>:'Registrar compra'}</button></div>
      </form>
    </dialog></>;
}
