"use server";
import { warehouseContext } from "@/lib/warehouse";
import { WarehouseError } from "@/lib/warehouse-errors";
export async function checkWarehouseAccess() {
  try { await warehouseContext(); return { ok: true, error: "" }; }
  catch (error) { return { ok: false, error: error instanceof WarehouseError ? error.message : "No se pudo verificar el acceso. Intenta nuevamente." }; }
}
