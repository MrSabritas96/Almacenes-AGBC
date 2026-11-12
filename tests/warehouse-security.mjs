/** Regression checks with an in-memory SQL double; never connects to a database. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';

let viewer = { id: 'manager', name: 'Manager', role: 'admin_almacenes', warehouse_id: 'w1' };
let calls = [];
let respond = () => ({ rows: [], rowCount: 0 });
let contextError;
let connectionError;
const query = async (sql, values = []) => {
  calls.push({ sql, values });
  return respond(sql, values);
};
const pool = { query, connect: async () => {
  if (connectionError) throw connectionError;
  return { query, release() {} };
} };
const synthetic = exports => new SyntheticModule(Object.keys(exports), function () {
  for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
});
const modules = new Map([
  ['node:crypto', synthetic({ randomBytes })],
  ['zod', synthetic(zod)],
  ['@/db', synthetic({ pool })],
  ['@paralleldrive/cuid2', synthetic({ createId: () => 'generated-id' })],
  ['better-auth/crypto', synthetic({ hashPassword: async () => 'hash' })],
  ['@/lib/warehouse', synthetic({ warehouseContext: async () => {
    if (contextError) throw contextError;
    return viewer;
  } })],
  ['@/lib/audit', synthetic({ audit: async () => {} })],
  ['next/cache', synthetic({ revalidatePath() {} })],
  ['@/lib/warehouse-notifications', synthetic({ syncStockNotifications: async () => {}, resolveRequestNotifications: async () => {}, notifyNewRequest: async () => {} })],
]);
async function load(file) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const compiled = new SourceTextModule(code, { identifier: file });
  await compiled.link(specifier => {
    const dependency = modules.get(specifier);
    assert(dependency, `Unexpected dependency: ${specifier}`);
    return dependency;
  });
  await compiled.evaluate();
  return compiled;
}
const codes=await load('src/lib/material-code.ts');
modules.set('@/lib/material-code',codes);
modules.set('./material-code',codes);
const errors = await load('src/lib/warehouse-errors.ts');
modules.set('@/lib/warehouse-errors', errors);
modules.set('./warehouse-errors', errors);
modules.set('@/lib/warehouse-fifo',await load('src/lib/warehouse-fifo.ts'));
modules.set('@/lib/purchase-attachments',await load('src/lib/purchase-attachments.ts'));
modules.set('./warehouse-notifications', modules.get('@/lib/warehouse-notifications'));
modules.set('./warehouse-reference',await load('src/lib/warehouse-reference.ts'));
modules.set('@/lib/warehouse-reference',modules.get('./warehouse-reference'));
const validation = await load('src/lib/warehouse-validation.ts');
modules.set('./warehouse-validation', validation);
modules.set('@/lib/warehouse-validation', validation);
modules.set('./request-reference', await load('src/lib/request-reference.ts'));
const { lookupMaterialRequests, loadPublicRequestReceipt } = (await load('src/lib/request-status.ts')).namespace;
const { warehouseAction, getDeliveryReceipt } = (await load('src/actions/almacenes/manage.ts')).namespace;
const { checkWarehouseAccess } = (await load('src/actions/almacenes/access.ts')).namespace;
const { receiveMaterialRequest } = (await load('src/lib/material-intake.ts')).namespace;

const internalMessage = 'private-db.internal:5432 password=secret relation internal_accounts missing';
contextError = new Error(internalMessage);
assert.equal((await checkWarehouseAccess()).error, 'No se pudo verificar el acceso. Intenta nuevamente.');
assert.equal((await getDeliveryReceipt('receipt')).error, 'No se pudo emitir el acta.');
contextError = undefined;
respond = () => { throw new Error(internalMessage); };
assert.equal((await getDeliveryReceipt('receipt')).error, 'No se pudo emitir el acta.');
connectionError = new Error(internalMessage);
assert.equal((await warehouseAction({ type: 'archive', id: 'material' })).error, 'No se pudo guardar. Revisa los datos e intenta nuevamente.');
const intake = { regional:'La Paz', name: 'Employee', document: '1234567-LP', position: 'Officer', department: 'Office', phone: '', warehouseId: 'w1', materialId: 'material', quantity: 1, purpose: 'Request office supplies', priority: 'normal', neededOn: '2099-01-01', submissionKey: '12a87d29-f6b0-4ca4-a70b-24c30f665e61' };
assert.equal((await receiveMaterialRequest(intake)).error, 'No se pudo registrar la solicitud. Intenta nuevamente.', 'Pool connection failures must return a safe result');
connectionError = undefined;
assert.equal((await receiveMaterialRequest(intake)).error, 'No se pudo registrar la solicitud. Intenta nuevamente.', 'Query and rollback failures must not expose internal errors');
respond = () => ({ rows: [], rowCount: 0 });
assert.equal((await receiveMaterialRequest(intake)).error, 'El formulario de este almacén está cerrado.', 'Expected domain errors remain actionable');

for (const id of ['', 'x'.repeat(201)]) {
  calls = [];
  const material = { type: 'material', id, warehouseId: 'w1', code: 'CODE', name: 'Material', category: 'Office', unit: 'unit', stock: 1, minimum: 0, location: 'Shelf', reason: 'Inventory correction' };
  assert.equal((await warehouseAction(material)).ok, false, 'Empty and oversized material identifiers must be rejected');
  assert.equal(calls.length, 0);
}

for (const input of ['1234567-LP', {}, { document: 'A A', reference: 'receipt' }, {document:'1234567-LP',reference:'x'.repeat(201)}]) {
  calls = [];
  assert.equal((await lookupMaterialRequests(input)).ok, false);
  assert.equal(calls.length, 0, 'Incomplete or malformed credentials must not query records');
}
calls = [];
respond = () => ({ rows: [], rowCount: 0 });
assert.equal((await lookupMaterialRequests({ document: ' 1234567 lp ', reference: ' receipt ' })).ok, true);
assert.deepEqual(calls[0].values, ['1234567LP', 'receipt']);
assert.match(calls[0].sql, /p\.document=\$1 and \(\$2::text is null or r\.id=\$2/);
assert.match(calls[0].sql, /p\.warehouse_id=m\.warehouse_id/);
assert.match(calls[0].sql, /order by r\.created_at desc,r\.id/);
assert.doesNotMatch(calls[0].sql, /limit 20/);
for(const reference of [undefined,'','   ']){
  calls=[];
  assert.equal((await lookupMaterialRequests({document:' 1234567 lp ',reference})).ok,true,'Consulta sin comprobante');
  assert.deepEqual(calls[0].values,['1234567LP',null],'CI normalizado y sin filtro de comprobante');
}
calls=[];
assert.equal((await loadPublicRequestReceipt({document:'1234567-LP'})).ok,false,'Descargar sigue exigiendo seleccionar un comprobante concreto');
assert.equal(calls.length,0);

const review = { type: 'review', id: 'request', status: 'delivered', response: '', identityConfirmed: 'on' };
const request = { id: 'request', material_id: 'material', warehouse_id: 'w1', quantity: 2, status: 'approved', archived: false, recipient_active:true,recipient_document: '1234567-LP' };
function fixture(overrides = {}, target = { warehouse_id: 'w1', document: '1234567-LP' }) {
  calls = [];
  respond = sql => {
    if (sql.startsWith('select r.*')) return { rows: [{ ...request, ...overrides }], rowCount: 1 };
    if (sql.startsWith('select warehouse_id,document')) return { rows: [target], rowCount: 1 };
    if (sql.startsWith('update materials')) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  };
}
fixture({ warehouse_id: 'w2' });
assert.equal((await warehouseAction(review)).ok, false, 'Manager cannot mutate a foreign warehouse request');
assert(!calls.some(c => c.sql.startsWith('update ')));
assert(calls.some(c => c.sql === 'rollback'));

fixture();
assert.equal((await warehouseAction({ ...review, identityConfirmed: undefined })).ok, false, 'Delivery requires identity confirmation');
assert(!calls.some(c => c.sql.startsWith('update ')));

fixture();
assert.equal((await warehouseAction({ ...review, deliveryOn: '1900-01-01' })).ok, true);
const delivered = calls.find(c => c.sql.startsWith('update material_requests'));
assert.equal(delivered.values[3], null, 'Delivery cannot overwrite the approved pickup date');

fixture({ status: 'pending' });
assert.equal((await warehouseAction({ ...review, status: 'approved', deliveryOn: '2099-01-01' })).ok, false, 'Insufficient stock rolls back approval');
assert(calls.some(c => c.sql === 'rollback'));
assert(!calls.some(c => c.sql.startsWith('update material_requests')));

fixture({ status: 'delivered' }, { warehouse_id: 'w1', document: 'LEGADO-123' });
assert.equal((await warehouseAction({ type: 'delivery_correct', id: 'request', userId: 'legacy', quantity: 2, reason: 'Correction' })).ok, false, 'Correction cannot bypass the recipient CI check');
assert(!calls.some(c => c.sql.startsWith('update materials')));

fixture();
viewer = { ...viewer, role: 'empleado_agbc' };
assert.equal((await warehouseAction(review)).ok, false, 'Employee records do not grant administration permissions');
assert.equal(calls.length, 0);

console.log('OK: safe errors, public history by exact CI with optional receipt, warehouse isolation, role checks, stock rollback, recipient identity, and approved delivery date; no database access.');
