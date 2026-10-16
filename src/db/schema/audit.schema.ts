import { createId } from "@paralleldrive/cuid2";
import { index, jsonb, pgEnum, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth.schema";

export const auditResultEnum = pgEnum("audit_result", ["success", "failure", "denied"]);

/** Bitácora de trazabilidad: quién, qué, dónde (módulo), desde qué IP y con qué resultado. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // create | update | delete | login | backup ...
    module: text("module").notNull(), // activos | almacenes | conciliaciones | sistema
    entity: text("entity"),
    entityId: text("entity_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    result: auditResultEnum("result").notNull().default("success"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_user_idx").on(t.userId),
    index("audit_module_idx").on(t.module, t.createdAt),
  ],
);

export const notificaciones = pgTable(
  "notificaciones",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_user_read_idx").on(t.userId, t.isRead)],
);
