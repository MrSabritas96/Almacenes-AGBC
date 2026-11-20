"use client";
import { useState } from 'react';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { Material, Snapshot } from '@/lib/warehouse-types';
import { categoryLabel, compareCategoryLabels, normalizeCategory, type BudgetItem } from '@/lib/warehouse-reference';
import { compareMaterialNames } from '@/lib/material-code';
import { DocumentAttachments } from './document-attachments';

export function InventoryCategories({materials,budgetItems,warehouses,superadmin,expandInitially=false,includeEmpty=true,onEdit,onArchive}:{
  materials:Material[];budgetItems:BudgetItem[];warehouses:Snapshot['warehouses'];superadmin:boolean;expandInitially?:boolean;includeEmpty?:boolean;
  onEdit:(material:Material)=>void;onArchive:(material:Material)=>void;
}) {
  const categories=new Map<string,Material[]>();
  if(includeEmpty)for(const category of budgetItems)categories.set(categoryLabel(category),[]);
  for(const material of materials){
    const label=normalizeCategory(material.category);
    const group=categories.get(label)??[];group.push(material);categories.set(label,group);
  }
  const groups=[...categories].sort(([a],[b])=>compareCategoryLabels(a,b));
  const [expanded,setExpanded]=useState<string[]>(()=>expandInitially?groups.map(([label])=>label):[]);
  const count=groups.filter(([label])=>expanded.includes(label)).length;
  const money=(value:number)=>value.toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
  return <section className="inventory-categories" aria-label="Inventario por partidas">
    <div className="category-controls"><div><p className="muted">{groups.length} partidas · {materials.length} ítems. Selecciona una partida para mostrar u ocultar sus ítems.</p></div><div className="row-actions">
      <button type="button" className="secondary-button" disabled={!groups.length||count===groups.length} onClick={()=>setExpanded(groups.map(([label])=>label))}>Mostrar todos los ítems</button>
      <button type="button" className="secondary-button" disabled={!count} onClick={()=>setExpanded([])}>Ocultar todos</button>
    </div></div>
    {!groups.length&&<p className="empty-state">No hay ítems con estos filtros.</p>}
    {groups.map(([label,items])=><details key={label} className="category-menu data-panel" open={expanded.includes(label)} onToggle={event=>{
      if(event.target!==event.currentTarget)return;
      const open=event.currentTarget.open;
      setExpanded(previous=>open?(previous.includes(label)?previous:[...previous,label]):previous.includes(label)?previous.filter(value=>value!==label):previous);
    }}>
      <summary><ChevronRight size={19} aria-hidden="true"/><span className="category-name"><strong>{label}</strong></span><span className="category-count">{items.length} {items.length===1?'ítem':'ítems'}</span></summary>
      <div className="table-scroll"><table aria-label={`Ítems de ${label}`}><thead><tr><th>Ítem / código</th>{superadmin&&<th>Almacén</th>}<th>Unidad</th><th>Costo / valor Bs</th><th>Disponible</th><th>Reservado</th><th>Mínimo / ubicación</th><th>Acciones</th></tr></thead>
        <tbody>{items.sort(compareMaterialNames).map(material=><tr key={material.id}><td><strong>{material.name}</strong><small>{material.code}</small>{(material.description||material.invoice_description)&&<details className="material-description"><summary>Ver descripción y factura</summary>{material.description&&<p>{material.description}</p>}{material.invoice_description&&<p><strong>Según factura:</strong> {material.invoice_description}</p>}</details>}{!!material.attachments?.length&&<DocumentAttachments kind="materials" id={material.id} files={material.attachments}/>}</td>{superadmin&&<td>{warehouses.find(w=>w.id===material.warehouse_id)?.name??'Sin asignar'}</td>}<td>{material.unit}</td><td>{money(Number(material.unit_cost))}<small>Valor: {money(material.stock*Number(material.unit_cost))}</small></td><td><span className={material.stock<=material.minimum?'stock-warning':'stock-good'}>{material.stock}</span>{material.stock<=material.minimum&&<small>Reponer</small>}</td><td>{material.reserved}</td><td>{material.minimum}<small>{material.location}</small></td><td><div className="row-actions"><button type="button" className="icon-button" aria-label={`Editar ${material.name}`} onClick={()=>onEdit(material)}><Pencil size={16}/></button><button type="button" className="icon-button danger" aria-label={`Eliminar ${material.name}`} onClick={()=>onArchive(material)}><Trash2 size={16}/></button></div></td></tr>)}</tbody>
      </table>{!items.length&&<p className="empty-state">No hay ítems registrados en esta partida.</p>}</div>
    </details>)}
    {!!groups.length&&<p className="form-hint">Imprimir, Descargar PDF y Exportar usan únicamente los resultados de los filtros de partida, búsqueda y stock bajo. Abrir o cerrar una partida solo cambia su visualización.</p>}
  </section>;
}
