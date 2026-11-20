ALTER TABLE "material_requests" ADD COLUMN "reviewed_by_name" text;
--> statement-breakpoint
DO $$
DECLARE
  retired_user users%ROWTYPE;
BEGIN
  SELECT u.* INTO retired_user
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE u.username = 'almacen' AND u.email = 'almacen@agbc.local'
    AND r.name = 'admin_almacenes'
    AND NOT EXISTS (
      SELECT 1 FROM user_roles other
      WHERE other.user_id = u.id AND other.role_id <> ur.role_id
    )
  FOR UPDATE OF u;

  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      JOIN accounts a ON a.user_id = u.id
      WHERE u.is_active AND r.name = 'superadmin'
        AND a.provider_id = 'credential' AND a.password IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Configura un SuperAdmin activo antes de retirar @almacen.';
    END IF;

    UPDATE material_requests
    SET reviewed_by_name = retired_user.name, reviewed_by = NULL
    WHERE reviewed_by = retired_user.id;

    UPDATE audit_logs
    SET details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
      'retiredUser', jsonb_build_object('id', retired_user.id, 'username', retired_user.username, 'name', retired_user.name)
    )
    WHERE user_id = retired_user.id;

    DELETE FROM users WHERE id = retired_user.id;
  END IF;
END;
$$;
--> statement-breakpoint
DELETE FROM roles r
WHERE r.name = 'admin_almacenes'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role_id = r.id);
