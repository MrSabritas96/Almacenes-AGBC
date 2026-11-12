"use client";
import { DateField } from './request-date';
import { useState } from 'react';
import type { Material, Snapshot } from '@/lib/warehouse-types';
import { ITEM_CATEGORIES, MATERIAL_UNITS, normalizeCategory } from '@/lib/warehouse-reference';
import { SearchSelect } from './search-select';
import { ResponseMessage } from './response-message';
import { DocumentAttachments } from './document-attachments';
export function MaterialFields({materials,warehouses,item,canOpen=false,purchases=[]}:{materials:Material[];warehouses:Snapshot['warehouses'];item?:Material;canOpen?:boolean;purchases?:Snapshot['purchases']}) {
  const initialWarehouse=warehouses.find(w=>w.id===(item?.warehouse_id??warehouses[0]?.id));
  const [warehouse,setWarehouse]=useState(initialWarehouse?.id??'');
  const [warehouseText,setWarehouseText]=useState(initialWarehouse?.name??'');
  const [fields,setFields]=useState({name:item?.name??'',category:normalizeCategory(item?.category??''),unit:item?.unit??'unidad',location:item?.location??'',minimum:String(item?.minimum??5)});
  const [suggestion,setSuggestion]=useState('');
  const available=materials.filter(m=>m.warehouse_id===warehouse);
  const options=(values:string[])=>Array.from(new Set(values.filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es')).map(value=>({id:value,label:value}));
  const change=(key:keyof typeof fields,value:string)=>{setFields(previous=>({...previous,[key]:value}));if(key==='name')setSuggestion('');};
  function selectMaterial(id:string){
    const material=available.find(m=>m.id===id);
    if(!material)return;
    setFields({name:material.name,category:normalizeCategory(material.category),unit:material.unit,location:material.location,minimum:String(material.minimum)});
    setSuggestion(`Datos completados a partir de ${material.code}. Puedes modificarlos.`);
  }
  return <>
    <SearchSelect label="Almacén" value={warehouseText} options={warehouses.map(w=>({id:w.id,label:w.name,description:w.location}))} onChange={text=>{setWarehouseText(text);const match=warehouses.find(w=>w.name===text);if(match){setWarehouse(match.id);setSuggestion('');}}} onSelect={option=>{setWarehouse(option.id);setWarehouseText(option.label);setSuggestion('');}}/>
    <input type="hidden" name="warehouseId" value={warehouse}/>
    <label>Código único<input value={item?.code??''} placeholder="Se genera al guardar" readOnly autoComplete="off"/></label>
    <SearchSelect label="Nombre del material" name="name" value={fields.name} freeText options={available.map(m=>({id:m.id,label:m.name,description:`${m.code} · ${m.category} · ${m.unit}`}))} onChange={value=>change('name',value)} onSelect={option=>selectMaterial(option.id)} placeholder="Busca un material o escribe uno nuevo"/>
    <SearchSelect label="Partida de inventario" name="category" value={fields.category} freeText options={options([...ITEM_CATEGORIES.map(c=>`${c.code} · ${c.name}`),...available.map(m=>normalizeCategory(m.category))])} onChange={value=>change('category',value)} onSelect={option=>change('category',option.label)}/>
    <SearchSelect label="Unidad de medida" name="unit" value={fields.unit} freeText options={options([...MATERIAL_UNITS,...available.map(m=>m.unit),fields.unit])} onChange={value=>change('unit',value)} onSelect={option=>change('unit',option.label)}/>
    <SearchSelect label="Ubicación / estante" name="location" value={fields.location} freeText options={options(available.map(m=>m.location))} onChange={value=>change('location',value)} onSelect={option=>change('location',option.label)}/>
    <label>Stock disponible (sin reservas)<input name="stock" type="number" min={0} required defaultValue={item?.stock??0}/></label>
    <label>Costo unitario del saldo inicial (Bs)<input name="unitCost" type="number" min="0" max={100000000} step="0.000001" required defaultValue={item?.unit_cost??0} readOnly={!!item&&!canOpen}/></label>
    {(!item||canOpen)&&<DateField label="Fecha del saldo inicial" name="openingOn" required={!item} max={new Date().toLocaleDateString('en-CA',{timeZone:'America/La_Paz'})}/>}
    <label className="full-width">Descripción literal de factura / documento de apertura<textarea name="invoiceDescription" maxLength={2000} defaultValue={item?.invoice_description}/></label>
    <div className="full-width"><label>Documentos de respaldo de compra (opcional)<input name="attachments" type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={(item?.attachments?.length??0)>=4}/></label><p className="form-hint">Adjunta facturas, comprobantes o documentos pendientes. Hasta 4 archivos en total, PDF, JPG o PNG, de máximo 2 MB cada uno. Los respaldos existentes se conservan al guardar.</p>{item?.attachments?.length?<DocumentAttachments kind="materials" id={item.id} files={item.attachments}/>:<p className="form-hint">Este material aún no tiene documentos adjuntos directamente.</p>}{purchases.filter(p=>p.material_id===item?.id&&p.attachments.length).map(p=><div key={p.id}><p className="form-hint">Respaldos de factura {p.invoice_number} · {p.purchased_on}</p><DocumentAttachments kind="purchases" id={p.id} files={p.attachments}/></div>)}</div>
    <label className="full-width">Descripción específica / características visibles<textarea name="description" maxLength={2000} defaultValue={item?.description} placeholder="Marca, color, tamaño, presentación y características del material."/></label>
    <label>Stock mínimo<input name="minimum" type="number" min={0} required value={fields.minimum} onChange={e=>change('minimum',e.target.value)}/></label>
    <div className="full-width"><p className="form-hint">Seleccionar un material completa partida, unidad, ubicación y stock mínimo. Para compras y aumentos de stock usa Registrar compra / reposición, con factura y respaldo. Aquí se registra el saldo inicial o se corrigen disminuciones. {item?'El código único se conserva al editar.':'El código único se genera automáticamente al guardar.'}</p><p className="form-hint" role="status" aria-live="polite">{suggestion}</p></div>
    <ResponseMessage decision="stock_reason" required/>
  </>;
}
