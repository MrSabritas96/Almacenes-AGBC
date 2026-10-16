import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, integer, timestamp, boolean, check, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth.schema";

export const warehouses = pgTable("warehouses", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull(),
  location: text("location").notNull(),
  requestsEnabled: boolean("requests_enabled").notNull().default(true),
});
export const staffProfiles = pgTable("staff_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id),
  document: text("document").notNull().default(""),
  position: text("position").notNull().default(""),
  department: text("department").notNull().default(""),
  phone: text("phone").notNull().default(""),
});
// Personas destinatarias: no tienen usuario, contraseña ni permisos de acceso.
export const warehousePeople = pgTable("warehouse_people", {
  id: text("id").primaryKey().$defaultFn(createId),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id),
  name: text("name").notNull(),
  document: text("document").notNull(),
  position: text("position").notNull().default(""),
  department: text("department").notNull().default(""),
  phone: text("phone").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("warehouse_person_document_unique").on(t.warehouseId, t.document)]);

export const materials = pgTable("materials", {
  id: text("id").primaryKey().$defaultFn(createId),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  stock: integer("stock").notNull().default(0),
  minimum: integer("minimum").notNull().default(5),
  location: text("location").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
}, t => [check("material_stock_nonnegative", sql`${t.stock} >= 0`), check("material_minimum_nonnegative", sql`${t.minimum} >= 0`)]);
export const materialRequests = pgTable("material_requests", {
  id: text("id").primaryKey().$defaultFn(createId),
  userId: text("user_id").references(() => users.id),
  personId: text("person_id").notNull().references(() => warehousePeople.id),
  requesterDetails: jsonb("requester_details").notNull().default({}),
  submissionKey: text("submission_key").unique(),
  materialId: text("material_id").notNull().references(() => materials.id),
  quantity: integer("quantity").notNull(),
  purpose: text("purpose").notNull(),
  priority: text("priority").notNull().default("normal"),
  neededOn: text("needed_on").notNull(),
  status: text("status").notNull().default("pending"),
  response: text("response").notNull().default(""),
  deliveryOn: text("delivery_on"),
  deliveryPlace: text("delivery_place"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
}, t => [check("request_quantity_positive", sql`${t.quantity} > 0`), check("request_valid_status", sql`${t.status} in ('pending','approved','waiting','denied','delivered','cancelled')`), index("request_user_idx").on(t.userId)]);
export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey().$defaultFn(createId),
  materialId: text("material_id").notNull().references(() => materials.id),
  userId: text("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employeeMaterials = pgTable("employee_materials", {
  id: text("id").primaryKey().$defaultFn(createId),
  userId: text("user_id").references(() => users.id),
  personId: text("person_id").notNull().references(() => warehousePeople.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  quantity: integer("quantity").notNull(),
  serial: text("serial").notNull().default(""),
  condition: text("condition").notNull(),
  location: text("location").notNull(),
  recordedOn: text("recorded_on").notNull(),
  notes: text("notes").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  createdBy: text("created_by").notNull().references(() => users.id),
  updatedBy: text("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("employee_material_quantity_positive", sql`${t.quantity} > 0`), index("employee_material_user_idx").on(t.userId)]);
