-- Retira la configuración del módulo. No modifica cuentas, inventario ni auditoría.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.name = 'admin_conciliaciones' AND p.module <> 'conciliaciones'
  ) THEN
    RAISE EXCEPTION 'Reasigna los permisos de otros módulos antes de retirar admin_conciliaciones.';
  END IF;
END;
$$;
--> statement-breakpoint
DELETE FROM permissions WHERE module = 'conciliaciones';
--> statement-breakpoint
DELETE FROM roles WHERE name = 'admin_conciliaciones';
