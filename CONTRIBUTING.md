# Guía de trabajo en equipo — SIBA

## Quién trabaja dónde

| Módulo | Responsable | Carpetas propias (solo esta persona edita) |
|---|---|---|
| Activos | María | `src/app/(admin)/activos/`, `src/actions/activos/`, `src/components/modules/activos/`, `src/db/schema/activos.schema.ts` |
| Almacenes | Walter | `src/app/(admin)/almacenes/`, `src/actions/almacenes/`, `src/components/modules/almacenes/`, `src/db/schema/almacenes.schema.ts` |
| Núcleo compartido | Manuel (tech lead) | `src/lib`, `src/components/ui`, `src/components/sidebar`, `src/db/schema/{auth,rbac,audit}`, `server.js`, Docker, `package.json` |

Si necesitas algo del núcleo (un componente UI, un permiso nuevo, una dependencia): abre un **Issue** y Manuel lo integra. No lo edites tú.

## Flujo de ramas (GitHub Flow)

- `main`: protegida, siempre desplegable. **Nadie hace push directo.**
- Ramas por módulo y tarea: `feat/activos-listado`, `fix/almacenes-stock`.
- Commits convencionales: `feat(activos): ...`, `fix(almacenes): ...`, `chore: ...`.

```bash
git checkout main && git pull
git checkout -b feat/activos-listado
# ... trabajar solo en tus carpetas ...
git add . && git commit -m "feat(activos): listado con filtros"
git pull --rebase origin main      # antes de subir
git push -u origin feat/activos-listado
# abrir Pull Request -> CODEOWNERS pide revisión automáticamente
```

## Base de datos y migraciones (lo más delicado)

### Preparar una copia local del sistema

Con Node.js 22 o superior, pnpm 10.18.3 y PostgreSQL disponibles:

```powershell
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
Copy-Item .env.example .env # Solo en la primera instalación; conservar el .env existente.
```

Crear una base PostgreSQL propia y configurar en `.env` su `DATABASE_URL`, un
`BETTER_AUTH_SECRET` aleatorio y las variables `SEED_ADMIN_*`, incluida una
contraseña de al menos 8 caracteres. Después:

```powershell
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Las migraciones crean y actualizan la estructura; no incluyen el inventario ni
los registros de otras instalaciones. El importador de Activos está documentado
en `src/actions/activos/scripts/README.md` y permite revisar una carga con
`--dry-run`. Cada colaborador debe crear su rama de trabajo desde `main`.

En instalaciones existentes, hacer un respaldo antes de migrar. La migración
`0020_retirar_admin_almacen` retira la cuenta inicial `almacen@agbc.local` cuando
solo tiene el rol `admin_almacenes`; exige otra cuenta SuperAdmin activa con
contraseña. Verificar ese acceso antes de actualizar. La migración `0018` retira
los permisos de Conciliaciones y bloquea el retiro de su rol si conserva permisos
de otros módulos. No usar `db:push` para sustituir el historial de migraciones.

Nunca subir `.env`, respaldos, archivos Excel con datos institucionales ni
exportaciones de la base de datos al repositorio. Compartir datos por el canal
privado acordado por el equipo.

1. Cada quien usa **su PostgreSQL local** (`.env` propio, nunca se sube).
2. Cada módulo tiene su archivo `*.schema.ts` → no hay choques de código.
3. Las migraciones SQL (`/drizzle`) sí son compartidas y se numeran en secuencia. Regla:
   **genera la migración justo después de `git pull --rebase`**, nunca la dejes días en tu rama.
   Si hay conflicto en `/drizzle`: borra TU migración, rebase, `pnpm db:generate` de nuevo.
4. Prefijo de tablas por módulo: `act_*`, `alm_*` para evitar colisiones de nombres.
5. Permisos RBAC con el formato `modulo:accion` (`activos:create`).

## Reglas de oro

- Una Server Action = sesión válida + permiso + registro en `audit_logs`.
- Un PR pequeño por tarea; máximo 1 día de vida.
- Nunca subir `.env`, `backups/`, ni credenciales.
