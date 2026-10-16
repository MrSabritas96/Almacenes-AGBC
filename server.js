/* eslint-disable @typescript-eslint/no-require-imports */
// Servidor híbrido: Next.js + Socket.IO en el mismo puerto.
const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: process.env.NEXT_PUBLIC_APP_URL || true, credentials: true },
  });

  // Accesible desde Server Actions: globalThis.__io?.to(`user:${id}`).emit(...)
  globalThis.__io = io;

  io.on("connection", (socket) => {
    // El cliente se une a su sala personal para recibir notificaciones.
    socket.on("join", (userId) => {
      if (typeof userId === "string" && userId) socket.join(`user:${userId}`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Listo en http://localhost:${port} (${dev ? "dev" : "prod"})`);
  });
});
