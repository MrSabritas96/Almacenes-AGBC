## Módulo
- [ ] activos  - [ ] almacenes  - [ ] conciliaciones  - [ ] núcleo compartido

## ¿Qué cambia?

## Checklist
- [ ] Solo toqué archivos de MI módulo (o pedí permiso para el núcleo)
- [ ] `pnpm typecheck` y `pnpm lint` pasan
- [ ] Hice `git pull --rebase origin main` antes de abrir el PR
- [ ] Si hay migración Drizzle: está regenerada después del rebase
- [ ] Las Server Actions validan sesión + permiso RBAC y escriben en audit_logs
