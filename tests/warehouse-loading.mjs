import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Ejecuta el cargador real con PostgreSQL simulado, sin leer ni modificar datos locales.
const source = await readFile(new URL('../src/lib/warehouse.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}});
let authenticated = true, active = true, failure;
const queries = [];
const viewer = {id: 'admin', is_active: true, role: 'superadmin'};
class WarehouseError extends Error {}
const dependencies = {
  './warehouse-reference': {
    ITEM_CATEGORIES: [], officialBudgetItem: () => null,
    compareBudgetItems: () => 0, compareInventoryMaterials: () => 0,
    normalizeCategory: value => value,
  },
  '@/lib/auth/session': {getSession: async () => authenticated ? {user: {id: viewer.id}} : null},
  '@/lib/warehouse-tab': {warehouseTabToken: async () => 'tab-token'},
  '@/lib/warehouse-errors': {WarehouseError},
  '@/db': {pool: {query: async (sql, values) => {
    queries.push({sql, values});
    if (failure) throw failure;
    if (sql.includes('from users u')) return {rows: active ? [viewer] : []};
    if (sql.includes('from materials m')) {
      assert(!/select m\.\*/.test(sql), 'El listado no debe transferir los archivos adjuntos completos');
      assert.match(sql, /jsonb_build_object\('name',a->>'name','type',a->>'type'\)/);
      return {rows: [{id: 'm1', category: 'Material', attachments: [{name: 'factura.pdf', type: 'application/pdf'}]}]};
    }
    if (sql.includes('from purchases p')) {
      assert(!/select p\.\*/.test(sql), 'Las compras no deben transferir archivos adjuntos completos');
      return {rows: [{id: 'p1', category: 'Material', attachments: [{name: 'compra.pdf', type: 'application/pdf'}]}]};
    }
    return {rows: []};
  }}},
};
const exports = {};
new Function('require', 'exports', outputText)(name => {
  assert(name in dependencies, `Dependencia inesperada: ${name}`);
  return dependencies[name];
}, exports);
const snapshot = await exports.loadWarehouse();
assert.equal(snapshot.viewer.id, viewer.id);
assert.equal(queries.length, 10, 'Una validación de acceso y nueve consultas de datos');
assert(queries.every(({values}) => !values || values[0] === null || values[0] === viewer.id));
assert.equal(snapshot.materials[0].attachments[0].name, 'factura.pdf');
assert.equal(snapshot.purchases[0].attachments[0].name, 'compra.pdf');
assert(!JSON.stringify(snapshot).includes('"data":'), 'El snapshot solo incluye metadatos de adjuntos');
queries.length = 0;
authenticated = false;
await assert.rejects(exports.loadWarehouse(), WarehouseError);
assert.equal(queries.length, 0, 'Sin sesión no se consulta ningún dato');
authenticated = true;
active = false;
await assert.rejects(exports.loadWarehouse(), WarehouseError);
assert.equal(queries.length, 1, 'Sin acceso no se carga el inventario');
active = true;
failure = new Error('database unavailable');
await assert.rejects(exports.loadWarehouse(), error => error === failure);
console.log('OK: carga autorizada, adjuntos sin contenido duplicado y fallos de conexión conservados.');
