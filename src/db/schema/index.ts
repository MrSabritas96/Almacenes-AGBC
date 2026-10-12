/**
 * Barrel de esquemas. Cada módulo agrega SU PROPIA línea aquí (una línea por persona
 * → conflictos de merge triviales). Los esquemas de módulo viven en archivos propios:
 *   activos.schema.ts       (María)
 *   almacenes.schema.ts     (Walter)
 *   conciliaciones.schema.ts (Manuel)
 */
export * from "./auth.schema";
export * from "./rbac.schema";
export * from "./audit.schema";

// ── Módulos (descomentar al crear cada archivo) ──
// export * from "./activos.schema";
// export * from "./almacenes.schema";
// export * from "./conciliaciones.schema";
