/* eslint-disable @typescript-eslint/no-require-imports */
// Servidor híbrido: Next.js + Socket.IO en el mismo puerto.
const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const { createHash } = require("node:crypto");
const { realpathSync } = require("node:fs");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const project = createHash("sha256").update(realpathSync(__dirname)).digest("hex");
let handle;
const httpServer = createServer((req, res) => {
  // Permite reconocer este proyecto incluso mientras Next.js está preparando el arranque.
  if (dev && req.url === "/_agbc/dev-server") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ project, pid: process.pid }));
    return;
  }
  if (!handle) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "2" });
    res.end("El sistema está iniciando. Actualiza la página en unos segundos.");
    return;
  }
  return handle(req, res);
});

async function start() {
  // Reservar el puerto antes de preparar Next evita competir por su bloqueo de desarrollo.
  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      httpServer.once("error", onError);
      httpServer.listen(port, hostname, () => {
        httpServer.off("error", onError);
        resolve();
      });
    });
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    if (dev) {
      const host = hostname === "0.0.0.0" ? "127.0.0.1" : hostname === "::" ? "[::1]" : hostname;
      try {
        const response = await fetch(`http://${host}:${port}/_agbc/dev-server`, { signal: AbortSignal.timeout(2000) });
        const existing = response.ok ? await response.json() : null;
        if (existing?.project === project) {
          console.log(`> El sistema ya está iniciado o iniciando (PID ${existing.pid}). Abre http://localhost:${port}`);
          console.log("> No se inició otra instancia. Para detenerlo, usa Ctrl+C en la terminal original.");
          return;
        }
      } catch { /* Un servicio ajeno o que no responde no se considera una instancia propia. */ }
    }
    throw new Error(`El puerto ${port} está ocupado por otro servicio. No se cerró ningún proceso.`);
  }

  const app = next({ dev, hostname, port });
  await app.prepare();
  handle = app.getRequestHandler();

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: process.env.NEXT_PUBLIC_APP_URL || true, credentials: true },
  });

  // Accesible desde Server Actions: globalThis.__io?.to(`user:${id}`).emit(...)
  globalThis.__io = io;

  const socketDb = new Pool({connectionString:process.env.DATABASE_URL,max:3});
  const activeSocketSession = async (token) => {
    const { rows } = await socketDb.query(`select s.expires_at from sessions s join users u on u.id=s.user_id
      where s.token=$1 and s.expires_at>now() and u.is_active
      and exists(select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=u.id and r.name in ('superadmin','admin_almacenes'))`, [token]);
    return rows[0];
  };
  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && new URL(origin).host !== socket.handshake.headers.host && origin !== process.env.NEXT_PUBLIC_APP_URL) throw new Error('Origen inválido.');
      const tabId = socket.handshake.auth?.tabId;
      if (typeof tabId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tabId)) throw new Error('Sesión inválida.');
      const cookieName = `agbc-tab-${tabId}`;
      const raw = (socket.handshake.headers.cookie ?? '').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${cookieName}=`));
      const token = raw ? decodeURIComponent(raw.slice(cookieName.length+1)) : '';
      const session = await activeSocketSession(token);
      if (!session) throw new Error('Sesión inválida.');
      socket.data.sessionToken = token;
      socket.data.expiresAt = new Date(session.expires_at).getTime();
      next();
    } catch { next(new Error('Inicia sesión para recibir actualizaciones.')); }
  });
  io.on("connection", (socket) => {
    // Solo señal de actualización: los datos y permisos se consultan con la sesión de la pestaña.
    socket.join('warehouse:live');
    const expiry = setTimeout(()=>socket.disconnect(true),Math.min(socket.data.expiresAt-Date.now(),2147483647));
    // El middleware corre solo al conectar; también hay que comprobar revocaciones posteriores.
    const recheck = setInterval(async () => {
      try {
        if (!(await activeSocketSession(socket.data.sessionToken))) socket.disconnect(true);
      } catch { socket.disconnect(true); }
    }, 30000);
    socket.on('disconnect',()=>{
      clearTimeout(expiry);
      clearInterval(recheck);
    });
  });

  console.log(`> Listo en http://localhost:${port} (${dev ? "dev" : "prod"})`);
}

start().catch((error) => {
  console.error("No se pudo iniciar el sistema:", error.message);
  process.exit(1);
});
