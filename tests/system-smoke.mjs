import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Prueba opcional local: requiere pnpm build, PostgreSQL y credenciales SEED_ADMIN_*.
// Solo consulta datos; crea una sesión de prueba y la cierra al terminar.
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname), 'Solo base local');
assert(process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD, 'Faltan credenciales de prueba locales');
const port = process.env.TEST_PORT ?? '3100';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.js', '--production'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: {...process.env, PORT: port, HOSTNAME: '127.0.0.1', BETTER_AUTH_URL: base, NEXT_PUBLIC_APP_URL: base},
  stdio: ['ignore', 'pipe', 'pipe'],
});
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000});
const measurements = [];
let cookie;
async function page(path, {authenticated = true, status = 200, pdf = false, redirectTo} = {}) {
  const start = performance.now();
  const response = await fetch(base + path, {
    headers: authenticated && cookie ? {Cookie: cookie} : {},
    redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (redirectTo) {
    const body = new TextDecoder().decode(bytes);
    assert(response.headers.get('location') === redirectTo || (response.status === 200 && body.includes(`NEXT_REDIRECT;replace;${redirectTo};307;`)), `${path}: redirección de acceso`);
    assert(!body.replaceAll('\\"', '"').includes('"viewer":'), 'Sin sesión no hay snapshot de almacenes');
  } else if (status === 404 && response.status === 200) {
    assert(new TextDecoder().decode(bytes).includes('NEXT_HTTP_ERROR_FALLBACK;404'), `${path}: página no encontrada en respuesta streaming`);
  } else assert.equal(response.status, status, `${path}: HTTP ${response.status}`);
  if (pdf) {
    assert(response.headers.get('content-type')?.includes('application/pdf'), `${path}: tipo PDF`);
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-', 'PDF válido');
  } else if (status === 200 && !redirectTo) {
    const body = new TextDecoder().decode(bytes);
    assert(!/No se pudo cargar tu espacio|No se pudo cargar el inventario|Formulario no disponible|Internal Server Error/.test(body), `${path}: pantalla de error`);
    assert(!body.includes('"digest":"'), `${path}: error de render del servidor`);
  }
  measurements.push({path: path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'), status, ms: Math.round(performance.now() - start), bytes: bytes.length});
}
try {
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('El servidor no inició en 30 segundos')), 30000);
    const exited = code => {clearTimeout(timer); reject(new Error(`El servidor terminó: ${code}`));};
    server.once('exit', exited);
    server.once('error', error => {clearTimeout(timer); reject(error);});
    server.stderr.on('data', data => process.stderr.write(data));
    server.stdout.on('data', data => {
      output += data;
      if (output.includes('> Listo')) {clearTimeout(timer); server.off('exit', exited); resolve();}
    });
  });
  for (const path of ['/login', '/solicitar-material', '/consultar-solicitud']) await page(path, {authenticated: false});
  for (const path of ['/almacenes/dashboard', '/activos/dashboard']) await page(path, {authenticated: false, redirectTo: '/login'});
  const login = await fetch(base + '/api/auth/sign-in/email', {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: base},
    body: JSON.stringify({email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD}),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(login.status, 200, 'Acceso administrativo');
  cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert(cookie, 'Cookie de sesión');
  for (const section of ['dashboard', 'inventario', 'solicitudes', 'fichas', 'materiales-por-empleado', 'proveedores', 'movimientos', 'administradores', 'almacenes']) await page(`/almacenes/${section}`);
  for (const path of ['/activos/dashboard', '/activos', '/activos/categorias', '/activos/historial-vida', '/activos/archivo-actas', '/activos/asignaciones', '/activos/asignaciones/actas/nueva', '/activos/responsables', '/activos/vehiculos', '/activos/vehiculos/mantenimiento/nuevo', '/activos/cierre-gestion']) await page(path);
  const {rows} = await pool.query(`select d.id from act_documentos_archivo d join act_archivo_pdf p on p.documento_id=d.id where d.eliminado_en is null and p.pdf_original is not null limit 1`);
  if (rows[0]) {
    await page(`/activos/archivo-actas/${rows[0].id}`);
    await page(`/activos/archivo-actas/${rows[0].id}/editar`);
    await page(`/activos/archivo-actas/${rows[0].id}/pdf`, {pdf: true});
  }
  await page('/almacenes/seccion-inexistente', {status: 404});
  await page('/activos/archivo-actas/id-invalido/pdf', {status: 404});
  await mkdir(new URL('../output/', import.meta.url), {recursive: true});
  await writeFile(new URL('../output/system-smoke.json', import.meta.url), JSON.stringify({mode: 'production', measurements}, null, 2) + '\n');
  console.log(JSON.stringify({ok: true, routes: measurements.length, measurements}, null, 2));
} finally {
  if (cookie) {
    const logout = await fetch(base + '/api/auth/sign-out', {
      method: 'POST', headers: {'Content-Type': 'application/json', Origin: base, Cookie: cookie}, body: '{}', signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!logout?.ok) {console.error('No se pudo cerrar la sesión de prueba.'); process.exitCode = 1;}
  }
  await pool.end();
  server.kill();
}
