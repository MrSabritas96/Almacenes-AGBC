import { pool } from '@/db';
import { z } from 'zod';
import { personFields } from './warehouse-validation';
import { normalizeRequestReference } from './request-reference';
import type { RequestReceiptData } from './warehouse-types';

const lookupFields = z.object({
  document: personFields.document,
  reference: z.string().trim().min(1).max(200).transform(normalizeRequestReference),
});

export type PublicRequestStatus = {
  reference:string; material:string; quantity:number; unit:string; status:string; warehouse:string;
  created_at:string; needed_on:string; delivery_on:string|null; delivery_place:string|null;
  response:string; delivered_at:string|null;
};

export async function lookupMaterialRequests(input:unknown) {
  const lookup = lookupFields.safeParse(input);
  if (!lookup.success) return {ok:false as const,error:'Ingresa tu CI con extensión y el comprobante de la solicitud.'};
  try {
    // El CI no es un secreto: también se exige el identificador impredecible del comprobante.
    const {rows}=await pool.query(`select r.id as reference,m.name as material,r.quantity,m.unit,r.status,w.name as warehouse,
      r.created_at,r.needed_on,r.delivery_on,r.delivery_place,r.response,r.delivered_at
      from material_requests r join warehouse_people p on p.id=r.person_id
      join materials m on m.id=r.material_id join warehouses w on w.id=m.warehouse_id
      where p.document=$1 and r.id=$2 and p.warehouse_id=m.warehouse_id limit 1`,[lookup.data.document,lookup.data.reference]);
    return {ok:true as const,requests:JSON.parse(JSON.stringify(rows)) as PublicRequestStatus[]};
  } catch { return {ok:false as const,error:'No se pudo consultar el estado. Intenta nuevamente.'}; }
}

export async function loadPublicRequestReceipt(input:unknown) {
  const lookup=lookupFields.safeParse(input);
  if(!lookup.success)return {ok:false as const,error:'Ingresa tu CI con extensión y el comprobante de la solicitud.'};
  try {
    const {rows}=await pool.query(`select r.id as reference,r.created_at,r.needed_on,w.name as warehouse,w.location as warehouse_location,
      m.name as material,m.code as material_code,r.quantity,m.unit,r.purpose,r.priority,r.status,r.delivery_on,r.delivery_place,r.response,r.delivered_at,
      p.name as requester_name,p.document,p.position,p.department
      from material_requests r join warehouse_people p on p.id=r.person_id
      join materials m on m.id=r.material_id join warehouses w on w.id=m.warehouse_id
      where p.document=$1 and r.id=$2 and p.warehouse_id=m.warehouse_id limit 1`,[lookup.data.document,lookup.data.reference]);
    if(!rows[0])return {ok:false as const,error:'No se encontró la solicitud. Revisa el CI y el comprobante.'};
    const {requester_name,document,position,department,...request}=rows[0];
    const data:RequestReceiptData=JSON.parse(JSON.stringify({...request,requester:{name:requester_name,document,position,department}}));
    return {ok:true as const,data};
  } catch {return {ok:false as const,error:'No se pudo obtener el comprobante. Intenta nuevamente.'};}
}
