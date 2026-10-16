import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

// Ejecuta el servidor con adaptadores falsos: no abre puertos ni conecta a PostgreSQL.
const source = await readFile(new URL('../server.js', import.meta.url), 'utf8');
let middleware, onConnection, recheck, expiry, queryFailure = false;
let authorized = true;
const cleared = new Set();
const queries = [];
const httpServer = new EventEmitter();
httpServer.listen = (_port, _host, callback) => callback();
class SocketServer {
  use(callback) { middleware = callback; }
  on(event, callback) { assert.equal(event, 'connection'); onConnection = callback; }
}
class Pool {
  async query(sql, values) {
    queries.push({ sql, values });
    if (queryFailure) throw new Error('database unavailable');
    return { rows: authorized ? [{ expires_at: new Date(Date.now() + 3600000) }] : [] };
  }
}
const dependencies = {
  'node:http': { createServer: () => httpServer },
  next: () => ({ prepare: async () => {}, getRequestHandler: () => () => {} }),
  'socket.io': { Server: SocketServer },
  pg: { Pool },
  'node:crypto': { createHash: () => ({ update: () => ({ digest: () => 'test' }) }) },
  'node:fs': { realpathSync: path => path },
};
vm.runInNewContext(source, {
  require: name => { assert(name in dependencies); return dependencies[name]; },
  __dirname: '/test', process: { env: { NODE_ENV: 'production' }, exit: () => assert.fail('unexpected exit') },
  console: { log() {}, error: assert.fail }, URL, Date,
  setTimeout: callback => { expiry = callback; return 'expiry'; },
  clearTimeout: handle => cleared.add(handle),
  setInterval: callback => { recheck = callback; return 'recheck'; },
  clearInterval: handle => cleared.add(handle),
});
await new Promise(resolve => setImmediate(resolve));
assert.equal(typeof middleware, 'function');
function socket(origin = 'https://almacenes.example') {
  const client = new EventEmitter();
  client.handshake = {
    headers: { origin, host: 'almacenes.example', cookie: 'agbc-tab-12345678-1234-4234-8234-123456789abc=opaque-token' },
    auth: { tabId: '12345678-1234-4234-8234-123456789abc' },
  };
  client.data = {};
  client.join = room => assert.equal(room, 'warehouse:live');
  client.disconnect = force => { assert.equal(force, true); client.disconnected = true; client.emit('disconnect'); };
  return client;
}
async function authenticate(client) {
  let error;
  await middleware(client, result => { error = result; });
  return error;
}
assert(await authenticate(socket('https://evil.example')), 'Rechaza otro origen');
const invalid = socket(); invalid.handshake.auth.tabId = '../invalid';
assert(await authenticate(invalid), 'Rechaza identificadores de pestaña inválidos');
authorized = false;
assert(await authenticate(socket()), 'Rechaza sesiones revocadas al conectar');
authorized = true;
const valid = socket();
assert.equal(await authenticate(valid), undefined);
assert.deepEqual(Array.from(queries.at(-1).values), ['opaque-token']);
assert.match(queries.at(-1).sql, /u\.is_active/);
assert.match(queries.at(-1).sql, /user_roles/);
onConnection(valid);
await recheck();
assert(!valid.disconnected, 'La sesión vigente conserva su conexión');
authorized = false;
await recheck();
assert(valid.disconnected, 'Una revocación posterior desconecta el socket');
assert(cleared.has('expiry') && cleared.has('recheck'), 'Libera temporizadores al desconectar');
authorized = true;
const failed = socket(); await authenticate(failed); onConnection(failed);
queryFailure = true;
await recheck();
assert(failed.disconnected, 'Un fallo de validación cierra la conexión');
queryFailure = false;
const expired = socket(); await authenticate(expired); onConnection(expired); expiry();
assert(expired.disconnected, 'La expiración desconecta la sesión');
console.log('OK: origen, sesión, revocación, fallo de DB, expiración y limpieza de sockets.');
