// Tipos compartidos; este módulo no importa conexiones ni autenticación del servidor.
export type { WarehouseRole, Material, CatalogMaterial, Staff, Request, Snapshot, EmployeeMaterial } from "./warehouse";
import type { Request, Staff } from "./warehouse";
export type DeliveryReceiptData = {
  request: {allocations?:{entry_code:string;lot:string;expires_on:string|null;quantity:number;unit_cost:string}[]} & Pick<Request, 'id' | 'material' | 'quantity' | 'unit' | 'delivered_at' | 'updated_at' | 'delivery_place' | 'responsible'> & {code?:string;unit_cost?:string|null;lot?:string;expires_on?:string|null;fund?:string;purpose?:string};
  recipient: Pick<Staff, 'name' | 'document' | 'position' | 'department'> & {regional?:string};
  warehouse: string;
  issuer: string;
};
export const labels = { superadmin: "SuperAdmin", admin_almacenes: "Administrador de almacén", empleado_agbc: "Empleado" };
export const statuses: Record<string, string> = { pending: "Pendiente", approved: "Lista para entrega", waiting: "Aceptada sin stock", denied: "Rechazada", delivered: "Entregada", cancelled: "Entrega anulada" };

export type RequestReceiptData = {
  items?:Array<Pick<RequestReceiptData,'material'|'material_code'|'quantity'|'authorized_quantity'|'unit'|'status'|'delivery_on'|'delivery_place'|'response'|'delivered_at'>>;
  reference:string; created_at:string; needed_on:string; warehouse:string; warehouse_location:string;
  material:string; material_code:string; quantity:number; unit:string; purpose:string; priority:string;
  status:string; delivery_on:string|null; delivery_place:string|null; response:string; delivered_at:string|null;
  authorized_quantity?:number|null;
  requester:{name:string;document:string;position:string;department:string;regional?:string};
};
