# Auditoría de rendimiento y disponibilidad

Fecha: 20 de noviembre de 2026. Revisión local con tres agentes: backend, interfaz y pruebas/código muerto. No se ejecutaron migraciones ni se modificaron existencias, personas, actas o credenciales.

## Causas y correcciones

| Evidencia | Cambio |
| --- | --- |
| `withMinimumLoading` imponía 1500 ms incluso a respuestas inmediatas y errores. El indicador de filtrado también prolongaba la espera. | Eliminados ambos mecanismos; cada operación termina al resolver su trabajo. Los indicadores siguen el estado real. |
| Cada enlace entre secciones de Almacenes solicitaba otra página y repetía la carga del snapshot completo. | Navegación con History API integrada con Next y lectura reactiva de ruta/foco. Conserva enlaces directos, recarga, Ctrl+clic, Atrás/Adelante y protección de formularios. |
| Mutaciones locales y eventos Socket.IO podían refrescar el mismo snapshot por separado. | Un coordinador agrupa ráfagas durante 100 ms y conserva una actualización posterior si recibe cambios durante una carga activa. |
| Sondeo, visibilidad y eventos podían consultar avisos simultáneamente. Un clic esperaba marcar el aviso antes de navegar. | Consultas de avisos serializadas; una sola consulta posterior para cambios pendientes. Navegación antes de esperar la actualización de lectura. |
| Sesión/permisos se consultaban repetidamente desde páginas, layouts y acciones de un mismo render. | React cache por petición y argumentos. No se conserva autorización entre peticiones ni se mezclan tokens. |
| Un error de conexión PostgreSQL inactiva podía emitir `pool.error` sin listener y cerrar el proceso. | Manejo de errores de ambos pools; pg descarta la conexión dañada. La espera de conexión del pool Socket.IO queda limitada a 5 segundos. |
| `pnpm start` no imponía producción; el servidor decide el modo antes de que Next cargue `.env`. | `start` usa `node server.js --production`; el flag fija `NODE_ENV` antes de importar Next. `dev` sigue siendo explícitamente desarrollo. |
| Consultas de materiales/compras seleccionaban `m.*`/`p.*` además de metadatos de adjuntos. PostgreSQL podía transmitir el contenido completo en una columna duplicada. | Columnas explícitas sin contenido binario/base64 de los adjuntos; descargas existentes conservadas. |
| Actas calculaba un resumen agregado que ya no se mostraba. | Eliminada la consulta y el resultado sin consumidores. |

## Limpieza

Eliminados seis archivos de código sin uso: los dos mecanismos de demora y cuatro componentes antiguos (`crear-devolucion`, `historial-asignaciones`, `imprimir-vista`, `regiones-responsables`). También se retiraron exports de marca, formularios antiguos de asignación, imports, propiedades y variables sin consumidores. Se conserva `EstadoAsignacion`, usado por las pantallas actuales.

Retirada la prueba que exigía esperar 1,5 segundos. No se añadieron dependencias ni se eliminaron acciones de compatibilidad utilizadas por pruebas existentes.

## Verificación

- `pnpm test`: 19 scripts; seguridad, respaldos, CSV/PDF/XLSX, fechas, saldos, navegación, foco, formularios y errores.
- Nuevas pruebas: `interaction-performance.mjs`, `frontend-live-refresh.mjs`, `backend-performance.mjs`, `warehouse-loading.mjs`.
- `pnpm exec eslint . --max-warnings 0`: sin errores ni advertencias.
- `pnpm build`: compilación de producción y TypeScript aprobados.
- `node tests/css-build.mjs`: CSS compilado y estilos de ambos módulos conservados.
- Navegador real: carga de formulario público, añadir/quitar materiales y navegación a consulta, sin enviar solicitudes.
- `node tests/system-smoke.mjs`: servidor de producción temporal, 30 rutas con PostgreSQL local; acceso administrativo, nueve secciones de Almacenes, pantallas de Activos, detalle/edición de acta existente, PDF real, acceso sin sesión y rutas inexistentes. Solo crea y cierra su propia sesión; las demás operaciones son lecturas. Requiere compilación y credenciales locales `SEED_ADMIN_*`.

La prueba real guarda tiempos y tamaños sin credenciales ni identificadores de documentos en `output/system-smoke.json`. Son mediciones HTTP locales de una ejecución secuencial, no latencias de interacción del navegador ni una prueba de carga concurrente. El primer acceso en frío puede tardar más que las siguientes páginas; no se garantiza un tiempo máximo en otros equipos.

En la última ejecución, las 23 rutas autenticadas respondieron entre 80 y 607 ms (mediana 164 ms); el primer acceso público en frío tardó 2405 ms. No se atribuye una mejora porcentual: las observaciones iniciales se hicieron en desarrollo y estas mediciones en producción.

## Aplicación al servidor local

La compilación de producción se probó en un proceso temporal que se cerró al terminar. La revisión automática de ejecución rechazó tanto reiniciar el servidor existente como iniciar uno persistente adicional, con el mensaje `blocked by policy` y sin motivo más específico. El servidor original de desarrollo continúa en el puerto 3000; no se modificó `.env`.

Para aplicar las correcciones de arranque y conexiones al servicio actual, detenerlo en su terminal y ejecutar `pnpm start` desde el repositorio. El comando usa la compilación de producción ya verificada. Los cambios de interfaz pueden recargarse durante desarrollo, pero eso no sustituye reiniciar el proceso para aplicar `server.js`.

## Límites

La base local contiene materiales y 525 documentos importados, pero el inventario de Activos está vacío. Las escrituras y casos de error se verificaron con dobles; no se inventaron activos ni se ejercitaron asignaciones reales contra datos institucionales. Tampoco se reprodujo una caída real de PostgreSQL: la recuperación del error de conexión se probó simulando el evento correspondiente.

La revisión no certifica ausencia de todos los fallos ni sustituye un ensayo de carga con datos representativos del despliegue. No se publicaron cambios remotos, commits ni migraciones.
