import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Datos ficticios, carga local opcional; no modifica registros existentes.
const url = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "::1"].includes(url.hostname), "Carga permitida solo en una base local.");
const warehouseId = "agbc-central";
const reason = "Ingreso inicial de material ficticio para pruebas AGBC";
const items = [
  ["ELE-01", "Teclado USB en español", "Unidad", 15, 5],
  ["ELE-02", "Mouse óptico USB", "Unidad", 20, 5],
  ["ELE-03", "Monitor LED de 24 pulgadas", "Unidad", 8, 2],
  ["ELE-04", "Lector USB de códigos de barras para correspondencia", "Unidad", 6, 2],
  ["ELE-05", "Impresora térmica de etiquetas para encomiendas", "Unidad", 4, 1],
  ["ELE-06", "UPS de 1000 VA para puestos de atención", "Unidad", 5, 2],
  ["ELE-07", "Cable de red Cat 6 de 3 metros", "Unidad", 30, 10],
  ["ELE-08", "Cable HDMI de 2 metros", "Unidad", 12, 4],
  ["ELE-09", "Memoria USB de 64 GB", "Unidad", 18, 5],
  ["ELE-10", "Regleta eléctrica de 6 tomas con protección", "Unidad", 10, 3],
  ["ESC-01", "Papel bond tamaño carta de 75 g", "Resma de 500 hojas", 60, 15],
  ["ESC-02", "Papel bond tamaño oficio de 75 g", "Resma de 500 hojas", 40, 10],
  ["ESC-03", "Bolígrafo azul", "Unidad", 120, 30],
  ["ESC-04", "Bolígrafo negro", "Unidad", 100, 25],
  ["ESC-05", "Lápiz de grafito HB", "Unidad", 80, 20],
  ["ESC-06", "Carpeta de palanca tamaño oficio", "Unidad", 35, 10],
  ["ESC-07", "Sobre manila tamaño oficio para documentación", "Paquete de 50 unidades", 20, 5],
  ["ESC-08", "Engrapadora metálica de escritorio", "Unidad", 12, 3],
  ["ESC-09", "Grapas estándar 26/6", "Caja de 5000 unidades", 25, 5],
  ["ESC-10", "Notas adhesivas de 76 x 76 mm", "Bloc de 100 hojas", 50, 10],
];
const employees = [
  { name: "Ana Quispe — Prueba", document: "PRUEBA-CI-001", position: "Auxiliar de recepción y clasificación postal (prueba)", department: "Operaciones postales", phone: "+591 70000001" },
  { name: "Luis Mamani — Prueba", document: "PRUEBA-CI-002", position: "Auxiliar administrativo (prueba)", department: "Administración", phone: "+591 70000002" },
];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  assert.equal((await client.query("select id from warehouses where id=$1", [warehouseId])).rowCount, 1);
  const { rows: [actor] } = await client.query("select u.id from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.name='superadmin' and u.is_active order by u.created_at limit 1");
  assert(actor, "Se necesita un SuperAdmin existente para registrar los movimientos.");
  let materialsCreated = 0;
  let employeesCreated = 0;
  for (const [index, [suffix, name, unit, stock, minimum]] of items.entries()) {
    const electronic = index < 10;
    const id = randomUUID();
    const result = await client.query("insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(code) do nothing returning id", [id, warehouseId, `PRUEBA-${suffix}`, name, electronic ? "Material electrónico" : "Material de escritorio", unit, stock, minimum, `Sector ${electronic ? "E" : "D"} · Estante ${Math.floor((index % 10) / 5) + 1} · Nivel ${(index % 5) + 1}`]);
    if (!result.rowCount) continue;
    await client.query("insert into stock_movements(id,material_id,user_id,delta,reason) values($1,$2,$3,$4,$5)", [randomUUID(), id, actor.id, stock, reason]);
    materialsCreated++;
  }
  for (const employee of employees) {
    const existing = await client.query("select id,name,document from warehouse_people where warehouse_id=$1 and (name=$2 or document=$3)", [warehouseId, employee.name, employee.document]);
    if (existing.rowCount) {
      assert.equal(existing.rowCount, 1);
      assert.equal(existing.rows[0].name, employee.name);
      assert.equal(existing.rows[0].document, employee.document);
      continue;
    }
    const id = randomUUID();
    const result = await client.query("insert into warehouse_people(id,warehouse_id,name,document,position,department,phone) values($1,$2,$3,$4,$5,$6,$7) on conflict(warehouse_id,document) do nothing returning id", [id, warehouseId, employee.name, employee.document, employee.position, employee.department, employee.phone]);
    employeesCreated += result.rowCount;
  }
  const inventory = await client.query("select * from materials where code=any($1::text[])", [items.map(([suffix]) => `PRUEBA-${suffix}`)]);
  assert.equal(inventory.rowCount, 20);
  assert(inventory.rows.every(m => m.warehouse_id === warehouseId && m.name && m.category && m.unit && m.location && !m.archived && m.stock >= 0 && m.minimum >= 0));
  const staff = await client.query("select * from warehouse_people where warehouse_id=$1 and (document=any($2::text[]) or name=any($3::text[]))", [warehouseId, employees.map(e => e.document), employees.map(e => e.name)]);
  assert.equal(staff.rowCount, 2);
  assert(staff.rows.every(p => p.warehouse_id === warehouseId && p.is_active && p.document && p.position && p.department && p.phone));
  for (const employee of employees) {
    const matches = staff.rows.filter(p => p.document === employee.document || p.name === employee.name);
    assert.equal(matches.length, 1, "El nombre y documento demo deben identificar una única ficha en el almacén.");
    assert.equal(matches[0].name, employee.name);
    assert.equal(matches[0].document, employee.document);
  }
  if (materialsCreated || employeesCreated) await client.query("insert into audit_logs(id,user_id,action,module,details) values($1,$2,'demo_seed','almacenes',$3)", [randomUUID(), actor.id, JSON.stringify({ materialsCreated, employeesCreated, fictitious: true })]);
  await client.query("commit");
  console.log(JSON.stringify({ materialsCreated, employeesCreated, verifiedMaterials: inventory.rowCount, verifiedEmployees: staff.rowCount }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
