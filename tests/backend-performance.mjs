import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import ts from 'typescript';

async function load(file, dependencies) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}});
  const exports = {};
  new Function('require', 'exports', outputText)(name => {
    assert(name in dependencies, `Dependencia inesperada: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

// Doble del ámbito de React: cada render tiene su propio almacén y argumentos.
const requests = new AsyncLocalStorage();
function cache(callback) {
  return (...args) => {
    const request = requests.getStore();
    if (!request) return callback(...args);
    let entries = request.get(callback);
    if (!entries) request.set(callback, entries = new Map());
    const key = JSON.stringify(args);
    if (!entries.has(key)) entries.set(key, callback(...args));
    return entries.get(key);
  };
}
const request = callback => requests.run(new Map(), callback);
let headersRead = 0, sessionReads = 0, activeReads = 0, permissionReads = 0;
let active = true, allowed = true;
const sessions = await load('src/lib/auth/session.ts', {
  react: {cache},
  'next/headers': {headers: async () => {headersRead++; return new Headers({cookie: 'global-session'});}},
  './index': {auth: {api: {getSession: async ({headers}) => {
    sessionReads++;
    return {user: {id: headers.get('authorization') ?? headers.get('cookie')}};
  }}}},
  '@/db': {schema: {users: {id: 'id', isActive: 'active'}}, db: {select: () => ({from: () => ({where: async () => {activeReads++; return [{active}];}})})}},
  'drizzle-orm': {eq: () => null},
});
await request(async () => {
  const [first, duplicate, tab] = await Promise.all([sessions.getSession(), sessions.getSession(), sessions.getSession('tab-token')]);
  assert.equal(first, duplicate, 'Lecturas simultáneas de la misma sesión comparten validación');
  assert.equal(first.user.id, 'global-session');
  assert.equal(tab.user.id, 'Bearer tab-token', 'Sesión explícita conserva su identidad');
  assert.equal(await sessions.getSession(''), null, 'Token vacío nunca hereda sesión global');
});
assert.equal(sessionReads, 2);
assert.equal(activeReads, 2);
assert.equal(headersRead, 1);
active = false;
assert.equal(await request(() => sessions.getSession()), null, 'Nueva petición comprueba revocación de cuenta');
assert.equal(sessionReads, 3);

const permissions = await load('src/lib/rbac.ts', {
  react: {cache},
  'drizzle-orm': {eq: () => null},
  '@/db': {schema: {permissions: {key: 'key', id: 'id'}, roles: {id: 'id', name: 'name'}, userRoles: {userId: 'user', roleId: 'role'}, rolePermissions: {roleId: 'role', permissionId: 'permission'}}, db: {select: () => {
    const query = {from: () => query, innerJoin: () => query, leftJoin: () => query, where: async () => {permissionReads++; return allowed ? [{role: 'operator', key: 'activos:read'}] : [];}};
    return query;
  }}},
});
await request(async () => {
  assert.deepEqual(await Promise.all([permissions.hasPermission('a', 'activos:read'), permissions.hasPermission('a', 'activos:update')]), [true, false]);
  await permissions.getUserPermissions('b');
});
assert.equal(permissionReads, 2, 'Cada usuario se consulta una vez dentro de la petición');
allowed = false;
assert.equal(await request(() => permissions.hasPermission('a', 'activos:read')), false, 'Nueva petición comprueba permisos revocados');
assert.equal(permissionReads, 3);

// Conexiones inactivas rotas no deben terminar todo el proceso.
const pools = [];
class Pool extends EventEmitter {
  constructor(options) {super(); this.options = options; pools.push(this);}
}
const poolErrors = [];
const dbSource = await readFile(new URL('../src/db/index.ts', import.meta.url), 'utf8');
const dbOutput = ts.transpileModule(dbSource, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const dbDependencies = {'drizzle-orm/node-postgres': {drizzle: () => ({})}, pg: {Pool}, './schema': {}};
vm.runInNewContext(dbOutput, {exports: {}, require: name => dbDependencies[name], process: {env: {DATABASE_URL: 'postgresql://test', NODE_ENV: 'production'}}, console: {error: (...args) => poolErrors.push(args)}});
assert.equal(pools.length, 1);
assert.doesNotThrow(() => pools[0].emit('error', new Error('idle disconnect')));
assert.equal(poolErrors.length, 1);
assert.equal(pools[0].options.connectionTimeoutMillis, 5000);

const serverSource = await readFile(new URL('../server.js', import.meta.url), 'utf8');
const httpServer = new EventEmitter();
httpServer.listen = (_port, _hostname, callback) => callback();
let nextOptions, requiredEnvironment;
const processDouble = {argv: ['node', 'server.js', '--production'], env: {NODE_ENV: 'development'}, exit: () => assert.fail('No debe abortar el servidor')};
class SocketServer {use() {} on() {}}
const serverDependencies = {
  'node:http': {createServer: () => httpServer},
  next: options => {nextOptions = options; return {prepare: async () => {}, getRequestHandler: () => () => {}};},
  'socket.io': {Server: SocketServer}, pg: {Pool},
  'node:crypto': {createHash: () => ({update: () => ({digest: () => 'test-project'})})},
  'node:fs': {realpathSync: value => value},
};
vm.runInNewContext(serverSource, {require: name => {
  if (name === 'next') requiredEnvironment = processDouble.env.NODE_ENV;
  return serverDependencies[name];
}, process: processDouble, __dirname: '/test', console: {log() {}, error: (...args) => poolErrors.push(args)}, URL, AbortSignal});
await new Promise(resolve => setImmediate(resolve));
assert.equal(requiredEnvironment, 'production', 'Fija entorno antes de importar Next');
assert.equal(nextOptions.dev, false, 'start sirve build de producción');
assert.equal(pools.length, 2);
assert.equal(pools[1].options.connectionTimeoutMillis, 5000);
assert.doesNotThrow(() => pools[1].emit('error', new Error('socket idle disconnect')));
assert.equal(poolErrors.length, 2);
console.log('OK: autorización deduplicada por petición sin mezclar tokens, revocación posterior, errores idle y arranque de producción.');
