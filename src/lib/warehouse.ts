import { pool } from "@/db";
import { getSession } from "@/lib/auth/session";
import { warehouseTabToken } from "@/lib/warehouse-tab";
import { WarehouseError } from "@/lib/warehouse-errors";

export const roleLabels = { superadmin: "SuperAdmin", admin_almacenes: "Administrador de almacén", empleado_agbc: "Empleado AGBC" };
export type WarehouseRole = keyof typeof roleLabels;
export type Material = { id: string; warehouse_id: string; code: string; name: string; category: string; unit: string; stock: number; minimum: number; location: string; reserved: number };
export type CatalogMaterial = Pick<Material, 'id' | 'warehouse_id' | 'code' | 'name' | 'category' | 'unit'>;
export type Staff = { id: string; name: string; email: string; username: string | null; role: WarehouseRole; is_active: boolean; warehouse_id: string; document: string; position: string; department: string; phone: string };
export type Request = { id: string; user_id: string; material_id: string; quantity: number; purpose: string; priority: string; needed_on: string; status: string; response: string; delivery_on: string | null; delivery_place: string | null; created_at: string; delivered_at: string | null; updated_at: string; responsible: string; employee: string; document: string; material: string; unit: string; warehouse_id: string };
export type EmployeeMaterial = { id: string; user_id: string; warehouse_id: string; name: string; category: string; unit: string; quantity: number; serial: string; condition: string; location: string; recorded_on: string; notes: string; employee: string; updated_at: string };
export type Snapshot = { viewer: Staff; warehouses: { id: string; name: string; location: string; requests_enabled: boolean }[]; materials: Material[]; materialCatalog: CatalogMaterial[]; staff: Staff[]; requests: Request[]; employeeMaterials: EmployeeMaterial[]; movements: { id: string; material: string; actor: string; delta: number; reason: string; created_at: string }[] };

export async function warehouseContext(tabId?: string, token?: string) {
  const session = await getSession(token ?? (tabId === undefined ? undefined : await warehouseTabToken(tabId)));
  if (!session) throw new WarehouseError("Inicia sesión para continuar.");
  const { rows } = await pool.query<Staff>(`select u.id,u.name,u.email,u.username,u.is_active,p.warehouse_id,p.document,p.position,p.department,p.phone,r.name as role
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
  const [warehouses, materials, staff, people, requests, movements, employeeMaterials] = await Promise.all([
    pool.query('select * from warehouses where ($1::text is null or id=$1) order by name',[scope]),
    pool.query(`select m.*,coalesce((select sum(quantity) from material_requests r where r.material_id=m.id and r.status='approved'),0)::int as reserved from materials m where not archived and ($1::text is null or warehouse_id=$1) order by name`,[scope]),
    viewer.role==='superadmin' ? pool.query(`select u.id,u.name,u.email,u.username,u.is_active,p.*,r.name as role from users u join staff_profiles p on p.user_id=u.id join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.name=any($2) and ($1::text is null or p.warehouse_id=$1) order by u.name`,[scope,['superadmin','admin_almacenes']]):Promise.resolve({rows:[]}),
    pool.query(`select p.*,''::text as email,null::text as username,'empleado_agbc'::text as role from warehouse_people p where ($1::text is null or p.warehouse_id=$1) order by p.name`,[scope]),
    pool.query(`select r.*,r.person_id as user_id,coalesce(r.requester_details->>'name',p.name) as employee,p.document,m.name as material,m.unit,m.warehouse_id,coalesce(a.name,'Sin registrar') as responsible from material_requests r join warehouse_people p on p.id=r.person_id join materials m on m.id=r.material_id left join users a on a.id=r.reviewed_by where ($1::text is null or m.warehouse_id=$1) order by r.created_at desc`,[scope]),
    pool.query(`select s.*,m.name as material,u.name as actor from stock_movements s join materials m on m.id=s.material_id join users u on u.id=s.user_id where ($1::text is null or m.warehouse_id=$1) order by s.created_at desc limit 200`,[scope]),
    pool.query(`select h.*,h.person_id as user_id,p.name as employee from employee_materials h join warehouse_people p on p.id=h.person_id where not h.archived and ($1::text is null or h.warehouse_id=$1) order by p.name,h.name`,[scope]),
  ]);
  // La etiqueta empleado_agbc identifica fichas en los componentes existentes; no es una cuenta ni concede acceso.
  return JSON.parse(JSON.stringify({viewer,warehouses:warehouses.rows,materials:materials.rows,materialCatalog:[],staff:[...staff.rows,...people.rows],requests:requests.rows,movements:movements.rows,employeeMaterials:employeeMaterials.rows}));
}
