ALTER TABLE "notificaciones" ADD COLUMN "kind" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD COLUMN "warehouse_id" text;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD COLUMN "event_key" text;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD COLUMN "resolved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notif_user_event_idx" ON "notificaciones" USING btree ("user_id","event_key");
--> statement-breakpoint
INSERT INTO notificaciones(id,user_id,module,title,message,link,kind,warehouse_id,entity_id,event_key)
SELECT 'initial-stock-' || md5(u.id || ':' || m.id),u.id,'almacenes',
  CASE WHEN m.stock=0 THEN 'Stock agotado' ELSE 'Stock bajo' END,
  m.name || ': ' || m.stock || ' ' || m.unit || ' disponibles. Mínimo: ' || m.minimum || '.',
  '/dashboard?view=inventory&focus=' || m.id,
  CASE WHEN m.stock=0 THEN 'stock_out' ELSE 'stock_low' END,m.warehouse_id,m.id,'stock:' || m.id
FROM materials m CROSS JOIN users u
WHERE NOT m.archived AND m.stock<=m.minimum AND u.is_active
AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id LEFT JOIN staff_profiles p ON p.user_id=u.id
  WHERE ur.user_id=u.id AND (r.name='superadmin' OR (r.name='admin_almacenes' AND p.warehouse_id=m.warehouse_id)))
ON CONFLICT(user_id,event_key) DO NOTHING;
