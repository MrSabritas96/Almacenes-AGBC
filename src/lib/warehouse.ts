import { compareInventoryMaterials, normalizeCategory } from "./warehouse-reference";
import { pool } from "@/db";
import { getSession } from "@/lib/auth/session";
import { warehouseTabToken } from "@/lib/warehouse-tab";
import { WarehouseError } from "@/lib/warehouse-errors";
export const roleLabels = { superadmin: "SuperAdmin", admin_almacenes: "Administrador de almacén", empleado_agbc: "Empleado AGBC" };
export type WarehouseRole = keyof typeof roleLabels;
export type InventoryBatch = {id:number;received_at:string;quantity:number;remaining:number;unit_cost:string;lot:string;expires_on:string|null;source:string};
export type Material = { batches?:InventoryBatch[]; id: string; warehouse_id: string; code: string; name: string; category: string; unit: string; stock: number; minimum: number; location: string; reserved: number; invoice_description:string; description:string; unit_cost:string; attachments?:{name:string;type:string}[] };
export type CatalogMaterial = Pick<Material, 'id' | 'warehouse_id' | 'code' | 'name' | 'category' | 'unit'>;
export type Staff = { id: string; name: string; email: string; username: string | null; role: WarehouseRole; is_active: boolean; warehouse_id: string; document: string; position: string; department: string; phone: string; regional:string };
export type Request = { group_reference?:string|null; id: string; user_id: string; material_id: string; quantity: number; purpose: string; priority: string; needed_on: string; status: string; response: string; delivery_on: string | null; delivery_place: string | null; created_at: string; delivered_at: string | null; updated_at: string; responsible: string; employee: string; document: string; material: string; unit: string; warehouse_id: string; regional:string; unit_cost:string|null; requested_quantity:number; fund:string; lot:string; expires_on:string|null };
export type EmployeeMaterial = { id: string; user_id: string; warehouse_id: string; name: string; category: string; unit: string; quantity: number; serial: string; condition: string; location: string; recorded_on: string; notes: string; employee: string; updated_at: string };
export type Supplier = {id:string;warehouse_id:string;business_type:string;name:string;nit:string;contact:string;phone:string;email:string;address:string;notes:string;is_active:boolean};
export type Purchase = {batch_id?:number|null;category?:string;id:string;material_id:string;supplier_id:string|null;supplier_details?:{name?:string;nit?:string;business_type?:string;phone?:string};material:string;supplier:string;invoice_number:string;invoice_description:string;purchased_on:string;lot:string;expires_on:string|null;quantity:number;unit_cost:string;notes:string;attachments:{name:string;type:string}[]};
export type Movement = {material_description?:string;id:string;material_id:string;material:string;code:string;category:string;unit:string;actor:string;delta:number;reason:string;created_at:string;unit_cost:string;balance_after:number|null};
export type Snapshot = { viewer: Staff; warehouses: { id: string; name: string; location: string; requests_enabled: boolean }[]; materials: Material[]; materialCatalog: CatalogMaterial[]; staff: Staff[]; requests: Request[]; employeeMaterials: EmployeeMaterial[]; movements: Movement[]; suppliers:Supplier[]; purchases:Purchase[] };
export async function warehouseContext(tabId?: string, token?: string) {
  const session = await getSession(token ?? (tabId === undefined ? undefined : await warehouseTabToken(tabId)));
  if (!session) throw new WarehouseError("Inicia sesión para continuar.");
  const { rows } = await pool.query<Staff>(`select u.id,u.name,u.email,u.username,u.is_active,p.warehouse_id,p.document,p.position,p.department,p.phone,p.regional,r.name as role
    from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id
    left join staff_profiles p on p.user_id=u.id where u.id=$1 and r.name=any($2)
    order by case r.name when 'superadmin' then 0 when 'admin_almacenes' then 1 else 2 end limit 1`, [session.user.id, ["superadmin","admin_almacenes"]]);
  const viewer = rows[0];
  if (!viewer?.is_active) throw new WarehouseError("Tu cuenta no tiene acceso a almacenes. Contacta al SuperAdmin.");
  if (viewer.role !== "superadmin" && !viewer.warehouse_id) throw new WarehouseError("No tienes un almacén asignado.");
  return viewer;
}
export async function loadWarehouse(tabId?: string): Promise<Snapshot> {
  const viewer = await warehouseContext(tabId);
  const scope = viewer.role === "superadmin" ? null : viewer.warehouse_id;
  const [warehouses, materials, staff, people, requests, movements, employeeMaterials, suppliers, purchases] = await Promise.all([
    pool.query('select * from warehouses where ($1::text is null or id=$1) order by name',[scope]),
    pool.query(`select m.*,coalesce((select jsonb_agg(to_jsonb(b) order by b.received_at,b.id) from inventory_batches b where b.material_id=m.id),'[]'::jsonb) as batches,coalesce((select jsonb_agg(jsonb_build_object('name',a->>'name','type',a->>'type')) from jsonb_array_elements(m.attachments) a),'[]'::jsonb) as attachments,coalesce((select sum(coalesce(authorized_quantity,quantity)) from material_requests r where r.material_id=m.id and r.status='approved'),0)::int as reserved from materials m where not archived and ($1::text is null or warehouse_id=$1) order by name`,[scope]),
    viewer.role==='superadmin' ? pool.query(`select u.id,u.name,u.email,u.username,u.is_active,p.*,r.name as role from users u join staff_profiles p on p.user_id=u.id join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.name=any($2) and ($1::text is null or p.warehouse_id=$1) order by u.name`,[scope,['superadmin','admin_almacenes']]):Promise.resolve({rows:[]}),
    pool.query(`select p.*,''::text as email,null::text as username,'empleado_agbc'::text as role from warehouse_people p where ($1::text is null or p.warehouse_id=$1) order by p.name`,[scope]),
    pool.query(`select r.*,r.quantity as requested_quantity,coalesce(r.authorized_quantity,r.quantity) as quantity,r.person_id as user_id,coalesce(r.requester_details->>'name',p.name) as employee,p.document,p.regional,m.name as material,m.unit,m.warehouse_id,coalesce(a.name,'Sin registrar') as responsible from material_requests r join warehouse_people p on p.id=r.person_id join materials m on m.id=r.material_id left join users a on a.id=r.reviewed_by where ($1::text is null or m.warehouse_id=$1) order by r.created_at desc`,[scope]),
    pool.query(`select s.*,m.name as material,m.code,m.category,m.unit,m.description as material_description,u.name as actor from stock_movements s join materials m on m.id=s.material_id join users u on u.id=s.user_id where ($1::text is null or m.warehouse_id=$1) order by s.created_at desc`,[scope]),
    pool.query(`select h.*,h.person_id as user_id,p.name as employee from employee_materials h join warehouse_people p on p.id=h.person_id where not h.archived and ($1::text is null or h.warehouse_id=$1) order by p.name,h.name`,[scope]),
    pool.query('select * from suppliers where ($1::text is null or warehouse_id=$1) order by name',[scope]),
    pool.query(`select p.*,sm.batch_id,m.name as material,m.category,coalesce(nullif(p.supplier_details->>'name',''),s.name,'Sin identificar') as supplier,
      coalesce((select jsonb_agg(jsonb_build_object('name',a->>'name','type',a->>'type')) from jsonb_array_elements(p.attachments) a),'[]'::jsonb) as attachments
      from purchases p join materials m on m.id=p.material_id left join suppliers s on s.id=p.supplier_id left join stock_movements sm on sm.id=p.movement_id
      where ($1::text is null or m.warehouse_id=$1) order by p.purchased_on desc,p.created_at desc`,[scope]),
  ]);
  // La etiqueta empleado_agbc identifica fichas en los componentes existentes; no es una cuenta ni concede acceso.
  const categorized=<T extends {category:string}>(row:T):T=>({...row,category:normalizeCategory(row.category)});
  return JSON.parse(JSON.stringify({viewer,warehouses:warehouses.rows,materials:materials.rows.map(categorized).sort(compareInventoryMaterials),materialCatalog:[],staff:[...staff.rows,...people.rows],requests:requests.rows,movements:movements.rows.map(categorized),employeeMaterials:employeeMaterials.rows.map(categorized),suppliers:suppliers.rows,purchases:purchases.rows.map(categorized)}));
}
