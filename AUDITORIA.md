# Auditoría de Almacenes AGBC

Fecha: 16 de octubre de 2026. Revisión del árbol de trabajo local, incluidos cambios previos sin confirmar. Skills: production-code-audit, security-auditor y ponytail. Tres agentes revisaron acceso/sesiones, operaciones de almacén y frontend/código muerto; la revisión principal cubrió dependencias, contenedores y verificación conjunta.

## Correcciones

| Prioridad | Hallazgo confirmado | Corrección |
| --- | --- | --- |
| Alta | La consulta pública enumeraba hasta 50 solicitudes con solo conocer el CI. | Exige CI + comprobante exacto, devuelve como máximo una solicitud; interfaz y pruebas adaptadas. No persiste esos datos en URL ni almacenamiento del navegador. |
| Alta | Sin `.dockerignore`, `COPY . .` enviaba `.env`, respaldos y metadatos Git al contexto de compilación. | Exclusiones explícitas y valores ficticios solo durante compilación; secretos reales por entorno al ejecutar. |
| Alta | `xlsx` sin uso arrastraba avisos de prototype pollution y ReDoS. | Dependencia eliminada. No había importación de archivos XLSX en el sistema actual. |
| Media | Exportación CSV permitía fórmulas con prefijos de controles o espacios. | Celdas entre comillas y prefijo de apóstrofo para indicadores de fórmula, controles y variantes Unicode; prueba de regresión. |
| Media | La conexión Socket.IO mantenía autorización después de revocar sesión o desactivar cuenta. | Revalidación de sesión/cuenta/rol cada 30 segundos y desconexión ante errores. Los eventos contienen solo una señal; los datos vuelven a validarse por servidor. |
| Media | Respaldos podían configurarse dentro de `public`, exponer sesiones/credenciales y usar permisos demasiado abiertos. | Comprobación de ruta real, incluidos enlaces; directorio 0700, archivos 0600 y creación exclusiva. En Windows la protección efectiva depende de las ACL del directorio. |
| Alta | El exportador SQL podía emitir hijos antes que padres, mezclar estados de tablas durante escrituras y depender del escape de barras del destino. | Orden por claves foráneas con rechazo de ciclos, snapshot de solo lectura con aislamiento repeatable read y `SET LOCAL standard_conforming_strings = on` al restaurar. Pruebas con esquema real y base simulada. |
| Media | Acciones de acceso, comprobantes, mutaciones y solicitudes podían devolver mensajes internos de excepción. | Solo `WarehouseError` identificado como error de dominio conserva su mensaje; errores SQL/red se ocultan. `secureAction` devuelve mensaje genérico y registra el fallo en auditoría. El ingreso público también captura fallos de conexión y rollback. |
| Media | Corrección de entrega aceptaba destinatario histórico sin CI válido. | Aplica el mismo bloqueo de fichas LEGADO que la confirmación de entrega. |
| Media | Payload de entrega podía reemplazar la fecha aprobada. | Conserva la fecha autorizada al aprobar. |
| Media | Contenedor ejecutado como root y Compose permitía contraseña predeterminada de PostgreSQL. | Usuario `node`, contraseña obligatoria, puerto PostgreSQL limitado a loopback y entorno de producción explícito. |
| Baja | Identificadores opcionales sin límite y CI cuya longitud podía quedar inválida tras normalizar. | Validación de longitud tras normalización e identificadores acotados. |
| Baja | Faltaban cabeceras defensivas. | `nosniff`, prohibición de frames y política de Referer. |
| Baja | Script demo creaba cuentas de empleados incompatibles con las fichas actuales. | Crea fichas sin credenciales; conserva la carga opcional de materiales. |
| Baja | Portal enlazaba a módulos sin páginas y producía 404. | Activos y Conciliaciones muestran Próximamente; Almacenes mantiene su acceso. |

## Código muerto y dependencias

Eliminados cuatro módulos sin consumidores: `src/components/sidebar/sidebar.tsx`, `src/lib/socket.ts`, `src/lib/email.ts` y `src/lib/utils.ts` (77 líneas), además de las funciones sin consumidores `requireSession` y `hasRole`.

Retiradas diez dependencias directas: `@hookform/resolvers`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `react-hook-form`, `nodemailer`, `xlsx` y `@types/nodemailer`. Se conserva `socket.io-client` porque tiene consumidores activos. `serverExternalPackages` queda limitado a `pg`.

La dependencia transitiva vulnerable de esbuild usada por `@esbuild-kit/core-utils` se sustituye mediante override por 0.25.12. Se comprobó que la CLI de Drizzle carga; no se ejecutaron migraciones.

Auditoría de paquetes: **4 avisos iniciales → 1 restante**; **673 → 632 entradas** según metadatos de `pnpm audit`. No equivale a medir tamaño del bundle ni cobertura de seguridad.

## Pendientes y límites

1. **`braces` 3.0.3, GHSA-vfj7-8cjw-p6xm, severidad alta del registro:** dependencia de `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch`. El registro y `pnpm view braces version` no ofrecen versión corregida al revisar. No se silenció ni se impuso una versión inexistente. El camino observado corresponde al análisis de patrones de lint, sin entrada HTTP de la aplicación identificada. Requiere actualización del proveedor o una sustitución validada cuando exista.
2. **Abuso de formulario público:** diez envíos por CI/almacén/hora y campo señuelo no impiden rotar CI. Antes de exponerlo a Internet, aplicar límite en el proxy con IP de cliente confiable; no confiar ciegamente en `X-Forwarded-For`. No hay configuración de proxy disponible en este repositorio para aplicarlo aquí.
3. **Revocación Socket.IO:** ventana máxima aproximada de 30 segundos hasta desconexión; cada petición de datos comprueba permisos por separado.
4. **Restauración real y ACL:** las pruebas de respaldo usan dobles. Hace falta restaurar en una base aislada y verificar ACL en el host de despliegue. El exportador SQL contiene datos INSERT; no sustituye un respaldo completo de esquema y datos con `pg_dump`.
5. La mitigación CSV se verifica en el archivo generado; abrir, guardar y reexportar desde una hoja de cálculo puede cambiar su interpretación.

No se ejecutaron pruebas intrusivas, migraciones, seeds, cambios de existencias ni limpieza sobre la base de datos de trabajo. No se rotaron credenciales ni se modificó `.env`. No se certifica ausencia universal de vulnerabilidades ni conformidad regulatoria.

## Verificación reproducible

- `pnpm test`: seis scripts sin base de datos real: arranque, autenticación/socket, acciones y respaldos, seguridad de almacenes, CSV y PDF.
- `pnpm lint` y `pnpm typecheck`.
- `pnpm build` y `node tests/css-build.mjs`.
- Compilación repetida con conexión y secreto ficticios exclusivos del proceso de build; instalación con `--frozen-lockfile --ignore-scripts` aprobada.
- `pnpm audit --json`: conserva el aviso de `braces` y devuelve código 1 por esa alerta.
- `pnpm exec drizzle-kit generate --help`: carga de CLI tras el override, sin escribir migraciones.

Las pruebas de integración con PostgreSQL existentes se adaptaron al nuevo contrato de consulta; no se ejecutaron contra la base local porque crean y eliminan registros. No se midió cobertura ni se verificó un despliegue Docker real.

CI ejecuta las pruebas locales y comprueba el CSS después de compilar. El trabajo queda local para revisión, sin commits, push ni despliegue.

## Fuentes de avisos

- [esbuild: CORS del servidor de desarrollo](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99).
- [SheetJS: prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6).
- [SheetJS: ReDoS](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).
- [braces: agotamiento de pila](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
