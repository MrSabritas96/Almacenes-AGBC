# Guía de trabajo en equipo — Almacenes AGBC

## Quién trabaja dónde

| Módulo | Responsable | Carpetas propias (solo esta persona edita) |
|---|---|---|
| Activos | María | `src/app/(admin)/activos/`, `src/actions/activos/`, `src/components/modules/activos/`, `src/db/schema/activos.schema.ts` |
| Almacenes | Walter | `src/app/(admin)/almacenes/`, `src/actions/almacenes/`, `src/components/modules/almacenes/`, `src/db/schema/almacenes.schema.ts` |
| Conciliaciones | Manuel | `src/app/(admin)/conciliaciones/`, `src/actions/conciliaciones/`, `src/components/modules/conciliaciones/`, `src/db/schema/conciliaciones.schema.ts` |
| Núcleo compartido | Manuel (tech lead) | `src/lib`, `src/components/ui`, `src/components/sidebar`, `src/db/schema/{auth,rbac,audit}`, `server.js`, Docker, `package.json` |

Si necesitas algo del núcleo (un componente UI, un permiso nuevo, una dependencia): abre un **Issue** y Manuel lo integra. No lo edites tú.

## Flujo de ramas (GitHub Flow)

- `main`: protegida, siempre desplegable. **Nadie hace push directo.**
- Ramas por módulo y tarea: `feat/activos-listado`, `fix/almacenes-stock`, `feat/conciliaciones-importar-excel`.
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

1. Cada quien usa **su PostgreSQL local** (`.env` propio, nunca se sube).
2. Cada módulo tiene su archivo `*.schema.ts` → no hay choques de código.
3. Las migraciones SQL (`/drizzle`) sí son compartidas y se numeran en secuencia. Regla:
   **genera la migración justo después de `git pull --rebase`**, nunca la dejes días en tu rama.
   Si hay conflicto en `/drizzle`: borra TU migración, rebase, `pnpm db:generate` de nuevo.
4. Prefijo de tablas por módulo: `act_*`, `alm_*`, `con_*` para evitar colisiones de nombres.
5. Permisos RBAC con el formato `modulo:accion` (`activos:create`).

## Reglas de oro

- Una Server Action = sesión válida + permiso + registro en `audit_logs`.
- Un PR pequeño por tarea; máximo 1 día de vida.
- Nunca subir `.env`, `backups/`, ni credenciales.
