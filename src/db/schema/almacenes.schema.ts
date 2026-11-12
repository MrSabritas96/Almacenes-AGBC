import { createId } from "@paralleldrive/cuid2";
import { pgTable, serial, text, integer, timestamp, boolean, check, index, uniqueIndex, jsonb, numeric } from "drizzle-orm/pg-core";
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
  regional: text("regional").notNull().default("Sin asignar"),
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
  regional: text("regional").notNull().default("Sin asignar"),
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
  invoiceDescription: text("invoice_description").notNull().default(""),
  attachments: jsonb("attachments").$type<{name:string;type:string;data:string}[]>().notNull().default([]),
  description: text("description").notNull().default(""),
  unitCost: numeric("unit_cost", { precision: 18, scale: 6 }).notNull().default("0"),
  stock: integer("stock").notNull().default(0),
  minimum: integer("minimum").notNull().default(5),
  location: text("location").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
}, t => [check("material_stock_nonnegative", sql`${t.stock} >= 0`), check("material_minimum_nonnegative", sql`${t.minimum} >= 0`)]);
export const materialRequests = pgTable("material_requests", {
  id: text("id").primaryKey().$defaultFn(createId),
  userId: text("user_id").references(() => users.id),
  personId: text("person_id").notNull().references(() => warehousePeople.id),
  authorizedQuantity: integer("authorized_quantity"),
  fund: text("fund").notNull().default(""),
  lot: text("lot").notNull().default(""),
  expiresOn: text("expires_on"),
  requesterDetails: jsonb("requester_details").notNull().default({}),
  submissionKey: text("submission_key").unique(),
  groupReference: text("group_reference"),
  materialId: text("material_id").notNull().references(() => materials.id),
  quantity: integer("quantity").notNull(),
  purpose: text("purpose").notNull(),
  priority: text("priority").notNull().default("normal"),
  neededOn: text("needed_on").notNull().default(""),
  unitCost: numeric("unit_cost", { precision: 18, scale: 6 }),
  status: text("status").notNull().default("pending"),
  response: text("response").notNull().default(""),
  deliveryOn: text("delivery_on"),
  deliveryPlace: text("delivery_place"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
}, t => [check("request_quantity_positive", sql`${t.quantity} > 0`), check("request_valid_status", sql`${t.status} in ('pending','approved','waiting','denied','delivered','cancelled')`), index("request_user_idx").on(t.userId),index("request_group_idx").on(t.groupReference)]);
export const stockMovements = pgTable("stock_movements", {
  batchId: integer("batch_id").references(() => inventoryBatches.id, {onDelete:"set null"}),
  id: text("id").primaryKey().$defaultFn(createId),
  materialId: text("material_id").notNull().references(() => materials.id),
  userId: text("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  unitCost: numeric("unit_cost", { precision: 18, scale: 6 }).notNull().default("0"),
  balanceAfter: integer("balance_after"),
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
export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey().$defaultFn(createId),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id),
  businessType: text("business_type").notNull().default(""),
  name: text("name").notNull(), nit: text("nit").notNull(),
  contact: text("contact").notNull().default(""), phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""), address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""), isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, t => [uniqueIndex("supplier_warehouse_nit_unique").on(t.warehouseId,t.nit)]);
export const purchases = pgTable("purchases", {
  id: text("id").primaryKey().$defaultFn(createId),
  materialId: text("material_id").notNull().references(() => materials.id),
  supplierId: text("supplier_id").references(() => suppliers.id),
  supplierDetails: jsonb("supplier_details").notNull().default({}),
  movementId: text("movement_id").notNull().references(() => stockMovements.id),
  invoiceNumber: text("invoice_number").notNull(), invoiceDescription: text("invoice_description").notNull(),
  purchasedOn: text("purchased_on").notNull(), lot: text("lot").notNull().default(""), expiresOn: text("expires_on"),
  quantity: integer("quantity").notNull(), unitCost: numeric("unit_cost", {precision:18,scale:6}).notNull(),
  notes: text("notes").notNull().default(""), attachments: jsonb("attachments").notNull().default([]),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, t => [check("purchase_quantity_positive",sql`${t.quantity} > 0`),check("purchase_cost_nonnegative",sql`${t.unitCost} >= 0`),check("purchase_supplier_identified",sql`jsonb_typeof(${t.supplierDetails}) = 'object' AND (${t.supplierId} IS NOT NULL OR coalesce(length(btrim(${t.supplierDetails}->>'name')),0) > 0)`)]);

/** Entradas físicas; E- identifica el correlativo global, sin cambiar el código del material. */
export const inventoryBatches = pgTable("inventory_batches", {
  id: serial("id").primaryKey(),
  materialId: text("material_id").notNull().references(() => materials.id,{onDelete:"cascade"}),
  receivedAt: timestamp("received_at",{withTimezone:true}).notNull().defaultNow(),
  quantity: integer("quantity").notNull(), remaining: integer("remaining").notNull(),
  unitCost: numeric("unit_cost",{precision:18,scale:6}).notNull(),
  lot: text("lot").notNull().default(""), expiresOn: text("expires_on"), source: text("source").notNull(),
}, t=>[check("batch_valid_balance",sql`${t.quantity}>0 and ${t.remaining}>=0 and ${t.remaining}<=${t.quantity} and ${t.unitCost}>=0`),index("batch_fifo_idx").on(t.materialId,t.receivedAt,t.id)]);
export const inventoryAllocations = pgTable("inventory_allocations", {
  requestId: text("request_id").notNull().references(() => materialRequests.id,{onDelete:"cascade"}),
  batchId: integer("batch_id").notNull().references(() => inventoryBatches.id,{onDelete:"cascade"}),
  quantity: integer("quantity").notNull(),
}, t=>[uniqueIndex("allocation_request_batch_unique").on(t.requestId,t.batchId),check("allocation_quantity_positive",sql`${t.quantity}>0`)]);
export const warehouseClosings = pgTable("warehouse_closings", {
  id: text("id").primaryKey(),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id),
  year: integer("year").notNull(),
  digest: text("digest").notNull(),
  filename: text("filename").notNull(),
  workbookBase64: text("workbook_base64").notNull(),
  data: jsonb("data").notNull(),
  importedBy: text("imported_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("warehouse_closing_year_unique").on(t.warehouseId, t.year)]);
export const warehouseClosingStatements = pgTable("warehouse_closing_statements", {
  closingId: text("closing_id").primaryKey().references(() => warehouseClosings.id),
  digest: text("digest").notNull(),
  filename: text("filename").notNull(),
  workbookBase64: text("workbook_base64").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
