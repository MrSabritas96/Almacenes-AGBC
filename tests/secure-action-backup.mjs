import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

async function load(file, dependencies, env = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => {
    assert(name in dependencies, `Dependencia inesperada: ${name}`); return dependencies[name];
  }, process: { env }, Date, console });
  return exports;
}
let session = null, permitted = false, executions = 0;
const auditEvents = [];
const { secureAction } = await load('../src/lib/secure-action.ts', {
  '@/lib/auth/session': { getSession: async () => session },
  '@/lib/rbac': { hasPermission: async () => permitted },
  '@/lib/audit': { audit: async event => auditEvents.push(event) },
});
const action = secureAction({ permission: 'sistema:backup', module: 'sistema', action: 'backup' }, async () => {
  executions++;
  throw new Error('password=internal-secret');
});
assert.equal((await action()).ok, false);
assert.equal(executions, 0);
session = { user: { id: 'admin' } };
assert.equal((await action()).ok, false);
assert.equal(executions, 0);
assert.equal(auditEvents.at(-1).result, 'denied');
permitted = true;
const failure = await action();
assert.equal(failure.ok, false);
assert(!failure.error.includes('internal-secret'), 'Los errores internos no se envían al cliente');
assert.equal(auditEvents.at(-1).result, 'failure');

let selected = 0;
const writes = [];
const backupDependencies = {
  'node:fs/promises': {
    mkdir: async () => {}, realpath: async value => value,
    writeFile: async (...args) => writes.push(args),
  },
  'node:path': path,
  'drizzle-orm': { is: () => false },
  'drizzle-orm/pg-core': { PgTable: class {} },
  '@/db': { db: { transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, 'repeatable read');
    assert.equal(options.accessMode, 'read only');
    return callback({ select: () => { selected++; assert.fail('No debe consultar la DB'); } });
  } }, schema: {} },
  '@/lib/secure-action': { secureAction: (_meta, handler) => handler },
};
for (const backupDir of ['public', path.join('public', 'backups')]) {
  const { crearRespaldo } = await load('../src/actions/sistema/backup.ts', backupDependencies, { BACKUP_DIR: backupDir });
  await assert.rejects(crearRespaldo(), /no puede estar dentro de public/);
}
// Un enlace con nombre aparentemente privado también debe resolverse antes de validar.
const symlinkDependencies = { ...backupDependencies, 'node:fs/promises': {
  ...backupDependencies['node:fs/promises'],
  realpath: async value => value === path.resolve('private-backups') ? path.resolve('public', 'linked') : value,
} };
const linked = await load('../src/actions/sistema/backup.ts', symlinkDependencies, { BACKUP_DIR: 'private-backups' });
await assert.rejects(linked.crearRespaldo(), /no puede estar dentro de public/);
assert.equal(selected, 0);
assert.equal(writes.length, 0);
const backup = await load('../src/actions/sistema/backup.ts', backupDependencies, { BACKUP_DIR: 'private-backups' });
await backup.crearRespaldo();
assert.equal(writes.length, 2);
for (const [, , options] of writes) {
  assert.equal(options.mode, 0o600);
  assert.equal(options.flag, 'wx', 'No sobrescribe un archivo ni sigue un enlace preexistente');
}
assert.match(writes[1][1], /BEGIN;\nSET LOCAL standard_conforming_strings = on;/);

// Usa el esquema real (sin importar la conexión) para probar dependencias y escapes.
const drizzle = await import('drizzle-orm');
const pgCore = await import('drizzle-orm/pg-core');
const schemaModule = await load('../src/db/schema/auth.schema.ts', {
  '@paralleldrive/cuid2': { createId: () => 'id' }, 'drizzle-orm/pg-core': pgCore,
});
const tableOrder = [];
const fkWrites = [];
const fkDependencies = {
  ...backupDependencies,
  'drizzle-orm': drizzle, 'drizzle-orm/pg-core': pgCore,
  'node:fs/promises': { ...backupDependencies['node:fs/promises'], writeFile: async (...args) => fkWrites.push(args) },
  '@/db': { schema: schemaModule, db: { transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, 'repeatable read');
    assert.equal(options.accessMode, 'read only');
    return callback({ select: () => ({ from: async table => {
      tableOrder.push(table);
      return [{ name: "O'Brien\\path", id: 'id', email: 'example@local' }];
    } }) });
  } } },
};
const orderedBackup = await load('../src/actions/sistema/backup.ts', fkDependencies, { BACKUP_DIR: 'private-backups' });
await orderedBackup.crearRespaldo();
for (const table of tableOrder) {
  for (const key of pgCore.getTableConfig(table).foreignKeys) {
    assert(tableOrder.indexOf(key.reference().foreignTable) < tableOrder.indexOf(table), 'Los padres preceden a las tablas con FK');
  }
}
assert.match(fkWrites[1][1], /O''Brien\\path/);
const cyclic = pgCore.pgTable('cyclic', { id: pgCore.text('id').primaryKey(), parent: pgCore.text('parent').references(() => cyclic.id) });
const cyclicBackup = await load('../src/actions/sistema/backup.ts', {
  ...fkDependencies, '@/db': { ...fkDependencies['@/db'], schema: { cyclic } },
}, { BACKUP_DIR: 'private-backups' });
await assert.rejects(cyclicBackup.crearRespaldo(), /ciclo/);
console.log('OK: autenticación, permisos, errores privados y respaldos protegidos, sin DB real.');
