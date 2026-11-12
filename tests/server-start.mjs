import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const project = createHash('sha256').update(root).digest('hex');

// El puerto real de cada servidor de prueba lo asigna el SO; no se toca el sistema activo.
async function check(identity, expectedCode, expectedMessage) {
  let requests = 0;
  const fixture = createServer((req, res) => {
    requests++;
    assert.equal(req.url, '/_agbc/dev-server');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ project: identity, pid: process.pid }));
  });
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development', HOSTNAME: '127.0.0.1', PORT: String(fixture.address().port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const timeout = setTimeout(() => child.kill(), 15000);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    assert.equal(code, expectedCode, output);
    assert.match(output, expectedMessage);
    assert.equal(requests, 1);
    assert(fixture.listening, 'La instancia existente debe continuar funcionando.');
  } finally {
    clearTimeout(timeout);
    child.kill();
    await new Promise(resolve => fixture.close(resolve));
  }
}

await check(project, 0, /El sistema ya está iniciado o iniciando/);
await check('otro-proyecto', 1, /ocupado por otro servicio/);
console.log('OK: iniciar dos veces no falla; un servicio ajeno se conserva y se informa el conflicto.');
