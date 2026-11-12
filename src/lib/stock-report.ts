import { compareInventoryMaterials, normalizeCategory } from "./warehouse-reference";
import type { Material, Movement, Purchase } from './warehouse';
export function periodRange(period:string,anchor:string):[string,string] {
  const [y=2000,m=1,d=1]=anchor.split('-').map(Number);
  const day=(date:Date)=>date.toISOString().slice(0,10);
  if(period==='custom')return [anchor,anchor];
  if(period==='day')return [anchor,anchor];
  if(period==='week'){const start=new Date(Date.UTC(y,m-1,d));start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);return [day(start),day(end)];}
  const size=period==='year'?12:period==='quarter'?3:period==='bimester'?2:1;
  const first=Math.floor((m-1)/size)*size;
  return [day(new Date(Date.UTC(y,first,1))),day(new Date(Date.UTC(y,first+size,0)))];
}
export const movementDay=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz'}).format(new Date(value));
/** Límites reales de todo el historial autorizado, incluidos ingresos por compras. */
export function historyRange(movements:Pick<Movement,'created_at'>[],purchases:Pick<Purchase,'purchased_on'>[],today=movementDay(new Date().toISOString())):[string,string] {
  let from=today,to=today;
  const include=(date:string)=>{if(date<from)from=date;if(date>to)to=date;};
  for(const movement of movements)include(movementDay(movement.created_at));
  for(const purchase of purchases)include(purchase.purchased_on);
  return [from,to];
}
export function stockSummary(materials:Material[],movements:Movement[],from:string,to:string) {
  const map=new Map(materials.map(m=>[m.id,{id:m.id,code:m.code,name:m.name,...({description:m.description} as {description?:string}),unit:m.unit,category:m.category,unitCost:Number(m.unit_cost),opening:0,openingValue:0,incoming:0,incomingValue:0,outgoing:0,outgoingValue:0,closing:0,closingValue:0}]));
  for(const m of movements){
    const date=movementDay(m.created_at);if(date>to)continue;
    if(!map.has(m.material_id))map.set(m.material_id,{id:m.material_id,code:m.code,name:m.material,...({description:m.material_description} as {description?:string}),unit:m.unit,category:m.category,unitCost:Number(m.unit_cost),opening:0,openingValue:0,incoming:0,incomingValue:0,outgoing:0,outgoingValue:0,closing:0,closingValue:0});
    const row=map.get(m.material_id)!;const value=m.delta*Number(m.unit_cost);
    if(date<from){row.opening+=m.delta;row.openingValue+=value;}
    else if(m.delta>0){row.incoming+=m.delta;row.incomingValue+=value;}
    else{row.outgoing-=m.delta;row.outgoingValue-=value;}
  }
  return [...map.values()].map(r=>({...r,category:normalizeCategory(r.category),closing:r.opening+r.incoming-r.outgoing,closingValue:r.openingValue+r.incomingValue-r.outgoingValue,unitCost:r.opening+r.incoming-r.outgoing>0?(r.openingValue+r.incomingValue-r.outgoingValue)/(r.opening+r.incoming-r.outgoing):r.opening+r.incoming>0?(r.openingValue+r.incomingValue)/(r.opening+r.incoming):0})).sort(compareInventoryMaterials);
}

/** Selección común para los seis cuadros, sus exportaciones y las operaciones visibles. */
export function stockReportData(data: {materials:Material[];movements:Movement[];purchases:Purchase[]}, from:string, to:string, query='', category='all') {
  if(!from||!to||from>to)return {rows:[],purchases:[],movements:[]};
  const search=query.trim().toLocaleLowerCase('es-BO');
  const matches=(...values:unknown[])=>values.join(' ').toLocaleLowerCase('es-BO').includes(search);
  const inPeriod=(date:string)=>date>=from&&date<=to;
  const movements=data.movements.filter(m=>inPeriod(movementDay(m.created_at)));
  const purchases=data.purchases.filter(p=>inPeriod(p.purchased_on));
  const relatedIds=new Set<string>();
  if(search){
    for(const m of movements)if(matches(m.actor,m.reason))relatedIds.add(m.material_id);
    for(const p of purchases)if(matches(p.supplier,p.supplier_details?.nit,p.invoice_number,p.invoice_description,p.lot,p.notes,p.id))relatedIds.add(p.material_id);
  }
  // Una coincidencia selecciona el historial completo del ítem para conservar la conciliación.
  const rows=stockSummary(data.materials,data.movements,from,to).filter(r=>(category==='all'||r.category===normalizeCategory(category))&&(relatedIds.has(r.id)||matches(r.code,r.name,r.description,r.category)));
  const byId=new Map(rows.map(r=>[r.id,r]));
  return {
    rows,
    purchases:purchases.filter(p=>byId.has(p.material_id)).map(p=>({...p,category:byId.get(p.material_id)!.category})),
    movements:movements.filter(m=>byId.has(m.material_id)),
  };
}
