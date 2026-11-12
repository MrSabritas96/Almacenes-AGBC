import { pool } from '@/db';
import { z } from 'zod';
import { personFields } from './warehouse-validation';
import { normalizeRequestReference } from './request-reference';
import type { RequestReceiptData } from './warehouse-types';

const lookupFields = z.object({
  document: personFields.document,
  reference: z.string().trim().max(200).default('').transform(normalizeRequestReference),
});
const receiptFields = lookupFields.extend({
  reference: z.string().trim().min(1).max(200).transform(normalizeRequestReference),
});

export type PublicRequestStatus = {
  group_reference?:string|null;
  reference:string; material:string; quantity:number; unit:string; status:string; warehouse:string;
  created_at:string; needed_on:string; delivery_on:string|null; delivery_place:string|null;
  response:string; delivered_at:string|null; authorized_quantity:number|null;
};

export async function lookupMaterialRequests(input:unknown) {
  const lookup = lookupFields.safeParse(input);
  if (!lookup.success) return {ok:false as const,error:'Ingresa un CI válido, con la extensión si la registraste. El comprobante es opcional.'};
  try {
    // El historial se consulta por CI exacto; el comprobante solo restringe la búsqueda.
    const {rows}=await pool.query(`select r.id as reference,r.group_reference,m.name as material,r.quantity,m.unit,r.status,w.name as warehouse,
      r.created_at,r.needed_on,r.authorized_quantity,r.delivery_on,r.delivery_place,r.response,r.delivered_at
      from material_requests r join warehouse_people p on p.id=r.person_id
      join materials m on m.id=r.material_id join warehouses w on w.id=m.warehouse_id
      where p.document=$1 and ($2::text is null or r.id=$2 or r.group_reference=$2 or r.group_reference=(select coalesce(group_reference,id) from material_requests where id=$2))
      and p.warehouse_id=m.warehouse_id order by r.created_at desc,r.id`,[lookup.data.document,lookup.data.reference||null]);
    return {ok:true as const,requests:JSON.parse(JSON.stringify(rows)) as PublicRequestStatus[]};
  } catch { return {ok:false as const,error:'No se pudo consultar el estado. Intenta nuevamente.'}; }
}

export async function loadPublicRequestReceipt(input:unknown) {
  const lookup=receiptFields.safeParse(input);
  if(!lookup.success)return {ok:false as const,error:'Ingresa tu CI con extensión y el comprobante de la solicitud.'};
  try {
    const {rows}=await pool.query(`select r.id as reference,r.group_reference,r.created_at,r.needed_on,w.name as warehouse,w.location as warehouse_location,
      m.name as material,m.code as material_code,r.quantity,r.authorized_quantity,m.unit,r.purpose,r.priority,r.status,r.delivery_on,r.delivery_place,r.response,r.delivered_at,
      p.name as requester_name,p.document,p.position,p.department,p.regional
      from material_requests r join warehouse_people p on p.id=r.person_id
      join materials m on m.id=r.material_id join warehouses w on w.id=m.warehouse_id
      where p.document=$1 and (r.id=$2 or r.group_reference=(select coalesce(group_reference,id) from material_requests where id=$2)) and p.warehouse_id=m.warehouse_id order by (r.id=$2) desc,r.id limit 20`,[lookup.data.document,lookup.data.reference]);
    if(!rows[0])return {ok:false as const,error:'No se encontró la solicitud. Revisa el CI y el comprobante.'};
    const {requester_name,document,position,department,regional,group_reference,...request}=rows[0];
    const items=rows.map(({material,material_code,quantity,authorized_quantity,unit,status,delivery_on,delivery_place,response,delivered_at})=>({material,material_code,quantity,authorized_quantity,unit,status,delivery_on,delivery_place,response,delivered_at}));
    const data:RequestReceiptData=JSON.parse(JSON.stringify({...request,reference:group_reference||request.reference,...(rows.length>1?{items,status:items.every(item=>item.status===request.status)?request.status:'mixed'}:{}),requester:{name:requester_name,document,position,department,regional}}));
    return {ok:true as const,data};
  } catch {return {ok:false as const,error:'No se pudo obtener el comprobante. Intenta nuevamente.'};}
}
